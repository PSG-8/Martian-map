/* =====================================================================
   /api/terrain  ·  Martian Map · MR_PSG / Team Starseekers
   Builds a REAL 3D data pack for any place on Mars, straight from NASA /
   USGS data. Nothing here is simulated.

     /api/terrain?lat=18.44&lon=77.45&km=24&f=terrain.json   -> scale + names
     /api/terrain?...&f=heightmap.png                          -> elevation (rg16 PNG)
     /api/terrain?...&f=texture.jpg                            -> orbital image

   Elevation:
     - Mars 2020 Science Team CTX DEM of Jezero crater, 20 m/pixel
       (USGS Astrogeology, M20_JezeroCrater_CTXDEM_20m.tif), when the area fits inside it
     - otherwise the global HRSC + MOLA blended DEM, 200 m/pixel
       (USGS Astrogeology, Mars_HRSC_MOLA_BlendDEM_Global_200mp_v2.tif, Fergason et al. 2018)
   Surface image:
     - global CTX mosaic, about 5 m/pixel (NASA/JPL/MSSS, Caltech Murray Lab; Dickson et al. 2024),
       served as tiles by Esri (astro.arcgis.com/.../OnMars/CTX)
   Responses are immutable for a given set of parameters, so Vercel's CDN keeps them.
   ===================================================================== */
'use strict';
const TIFF = require('./_lib/tiff.js');
const PNG = require('./_lib/png.js');
const encodeJPEG = require('./_lib/jpeg-encoder.js');
let NAMES = null;
try { NAMES = require('../data/mars-names.json'); } catch (e) { NAMES = null; }

const R = 3396190;
const D2R = Math.PI / 180;
const S3 = 'https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/';
const DEMS = {
  hrsc: {
    url: S3 + 'Mars/HRSC_MOLA_Blend/Mars_HRSC_MOLA_BlendDEM_Global_200mp_v2.tif',
    name: 'HRSC + MOLA blended DEM, 200 m/px (ESA/DLR/FU Berlin, NASA/GSFC; USGS Astrogeology)',
    res: 200
  },
  jezero: {
    url: S3 + 'mars2020_trn/CTX/ScienceInvestigationMaps_JPL/M20_JezeroCrater_CTXDEM_20m.tif',
    name: 'Mars 2020 CTX DEM of Jezero crater, 20 m/px (NASA/JPL-Caltech/MSSS; USGS Astrogeology)',
    res: 20, latTs: 18.4663
  }
};
const CTX_TILES = 'https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX/MapServer/tile/';
const CTX_NAME = 'CTX global mosaic (NASA/JPL/MSSS, Caltech Murray Lab, Dickson et al. 2024; tiles by Esri)';

/* ---------- geometry: local map frame <-> latitude / longitude ---------- */
function frame(lat0, lon0, km, n) {
  const Wm = km * 1000;
  return {
    Wm, n,
    // grid (gx, gy) with gy = 0 at the NORTH edge
    ll(gx, gy) {
      const x = (gx / (n - 1) - 0.5) * Wm, y = (0.5 - gy / (n - 1)) * Wm;
      const lat = lat0 + (y / R) / D2R;
      const lon = lon0 + (x / (R * Math.cos(lat * D2R))) / D2R;
      return [lat, lon];
    }
  };
}
const wrapLon = l => ((l + 180) % 360 + 360) % 360 - 180;

/* ---------- sampling ---------- */
function cubic(p0, p1, p2, p3, t) {
  return p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
}
function sampleWin(win, fx, fy) {
  const { data, W, H } = win;
  const x = fx - win.col0 - 0.5, y = fy - win.row0 - 0.5;     // pixel centres
  const ix = Math.floor(x), iy = Math.floor(y), tx = x - ix, ty = y - iy;
  const at = (c, r) => data[Math.min(H - 1, Math.max(0, r)) * W + Math.min(W - 1, Math.max(0, c))];
  const rows = [];
  let ok = true;
  for (let j = -1; j <= 2; j++) {
    const a = at(ix - 1, iy + j), b = at(ix, iy + j), c = at(ix + 1, iy + j), d = at(ix + 2, iy + j);
    if (Number.isNaN(a) || Number.isNaN(b) || Number.isNaN(c) || Number.isNaN(d)) ok = false;
    rows.push(cubic(a, b, c, d, tx));
  }
  if (ok) return cubic(rows[0], rows[1], rows[2], rows[3], ty);
  // near missing data: bilinear over valid neighbours only
  let s = 0, w = 0;
  for (const [c, r, ww] of [[ix, iy, (1 - tx) * (1 - ty)], [ix + 1, iy, tx * (1 - ty)], [ix, iy + 1, (1 - tx) * ty], [ix + 1, iy + 1, tx * ty]]) {
    const v = at(c, r);
    if (!Number.isNaN(v)) { s += v * ww; w += ww; }
  }
  return w > 1e-6 ? s / w : NaN;
}
function fillGaps(g, n) {
  let missing = 0;
  for (let i = 0; i < g.length; i++) if (Number.isNaN(g[i])) missing++;
  let guard = 0;
  while (missing && guard++ < 64) {
    const next = g.slice();
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const i = y * n + x;
      if (!Number.isNaN(g[i])) continue;
      let s = 0, c = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= n || yy >= n) continue;
        const v = g[yy * n + xx];
        if (!Number.isNaN(v)) { s += v; c++; }
      }
      if (c) { next[i] = s / c; missing--; }
    }
    g.set(next);
  }
  return g;
}

/* ---------- elevation ---------- */
async function readDEM(lat0, lon0, km, n) {
  const F = frame(lat0, lon0, km, n);
  const cellM = F.Wm / (n - 1);
  const pts = new Float64Array(n * n * 2);
  for (let gy = 0; gy < n; gy++) for (let gx = 0; gx < n; gx++) {
    const [la, lo] = F.ll(gx, gy);
    pts[(gy * n + gx) * 2] = la; pts[(gy * n + gx) * 2 + 1] = wrapLon(lo);
  }

  // 1) Jezero 20 m DEM when the whole area fits inside it
  const J = DEMS.jezero;
  if (km <= 60) {
    try {
      const info = await TIFF.open(J.url);
      const ifd = info.main;
      const sx = info.main.scale[0], sy = info.main.scale[1], X0 = info.main.tie[3], Y0 = info.main.tie[4];
      const k = Math.cos(J.latTs * D2R);
      const toPix = (la, lo) => [((R * lo * D2R * k) - X0) / sx, (Y0 - R * la * D2R) / sy];
      let c0 = Infinity, c1 = -Infinity, r0 = Infinity, r1 = -Infinity;
      for (let i = 0; i < n * n; i++) {
        const [c, r] = toPix(pts[2 * i], pts[2 * i + 1]);
        if (c < c0) c0 = c; if (c > c1) c1 = c; if (r < r0) r0 = r; if (r > r1) r1 = r;
      }
      if (c0 >= 2 && r0 >= 2 && c1 < ifd.width - 3 && r1 < ifd.height - 3) {
        const win = await TIFF.readWindow(info, ifd, Math.floor(c0) - 2, Math.floor(r0) - 2, Math.ceil(c1) + 2, Math.ceil(r1) + 2);
        const g = new Float32Array(n * n);
        let bad = 0;
        for (let i = 0; i < n * n; i++) {
          const [c, r] = toPix(pts[2 * i], pts[2 * i + 1]);
          g[i] = sampleWin(win, c, r);
          if (Number.isNaN(g[i])) bad++;
        }
        if (bad / (n * n) < 0.01) return { grid: fillGaps(g, n), source: J.name, resM: J.res, key: 'jezero' };
      }
    } catch (e) { /* fall back to the global DEM */ }
  }

  // 2) global HRSC + MOLA DEM, using an overview when the area is large
  const H = DEMS.hrsc;
  const main = await TIFF.open(H.url);
  // overviews (2x, 4x, ...) live in the companion .ovr file
  let levels = [{ info: main, ifd: main.main, factor: 1 }];
  try {
    const ovr = await TIFF.open(H.url + '.ovr');
    for (const o of ovr.ifds) levels.push({ info: Object.assign({}, ovr, { nodata: main.nodata }), ifd: o, factor: main.main.width / o.width });
  } catch (e) { /* no overviews: full resolution only */ }
  levels = levels.filter(l => !l.ifd.tiled && l.ifd.compression === 1 && l.ifd.width > 1000);
  let pick = levels[0];
  for (const l of levels) if (H.res * l.factor <= cellM * 1.4 && l.factor > pick.factor) pick = l;
  const info = pick.info, ifd = pick.ifd;
  const resDeg = main.main.scale[0] * pick.factor, lonL = main.main.tie[3], latT = main.main.tie[4];
  const toPix = (la, lo) => [(lo - lonL) / resDeg, (latT - la) / resDeg];
  let c0 = Infinity, c1 = -Infinity, r0 = Infinity, r1 = -Infinity;
  for (let i = 0; i < n * n; i++) {
    const [c, r] = toPix(pts[2 * i], pts[2 * i + 1]);
    if (c < c0) c0 = c; if (c > c1) c1 = c; if (r < r0) r0 = r; if (r > r1) r1 = r;
  }
  if (c1 - c0 > ifd.width * 0.5) { c0 = 0; c1 = ifd.width - 1; }        // window crosses 180°: read the full width
  const win = await TIFF.readWindow(info, ifd, Math.floor(c0) - 2, Math.floor(r0) - 2, Math.ceil(c1) + 2, Math.ceil(r1) + 2);
  const g = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) {
    const [c, r] = toPix(pts[2 * i], pts[2 * i + 1]);
    g[i] = sampleWin(win, c, r);
  }
  return { grid: fillGaps(g, n), source: H.name, resM: Math.round(H.res * pick.factor), key: 'hrsc' };
}

/* ---------- orbital image (CTX) ---------- */
async function readImage(lat0, lon0, km, size) {
  const F = frame(lat0, lon0, km, size);
  const pxM = F.Wm / (size - 1);
  // level: finest tiles that are not much sharper than one output pixel (CTX itself is ~5 m)
  let L = 0;
  for (let l = 0; l <= 12; l++) { const m = (0.3515625 / 2 ** l) * D2R * R; if (m >= pxM * 0.7) L = l; }
  const res = 0.3515625 / 2 ** L, span = 512 * res;
  // which tiles?
  const need = new Map();
  for (let gy = 0; gy < size; gy += 32) for (let gx = 0; gx < size; gx += 32) {
    for (const [dx, dy] of [[0, 0], [31, 0], [0, 31], [31, 31]]) {
      const [la, lo] = F.ll(Math.min(size - 1, gx + dx), Math.min(size - 1, gy + dy));
      const r = Math.floor((90 - la) / span), c = Math.floor((wrapLon(lo) + 180) / span);
      need.set(`${r}/${c}`, [r, c]);
    }
  }
  if (need.size > 140 && L > 0) return readImage(lat0, lon0, km, Math.round(size * 0.75));
  const tiles = new Map();
  let got = 0;
  await TIFF.pool([...need.values()], 16, async ([r, c]) => {
    let best = null;
    for (let attempt = 0; attempt < 2 && !(best && best.complete); attempt++) {
      try {
        const resp = await fetch(`${CTX_TILES}${L}/${r}/${c}`, { headers: { 'User-Agent': 'MartianMap/1.0 (MR_PSG, Team Starseekers; educational)' } });
        if (!resp.ok) continue;
        const buf = Buffer.from(await resp.arrayBuffer());
        if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) continue;
        const d = PNG.decode(buf);
        if (!best || d.complete) best = d;
      } catch (e) { /* try again */ }
    }
    if (best) { tiles.set(`${r}/${c}`, best); got++; }
  });
  const gray = new Uint8Array(size * size), valid = new Uint8Array(size * size);
  const px = (la, lo) => {
    const X = (wrapLon(lo) + 180) / res - 0.5, Y = (90 - la) / res - 0.5;
    const ix = Math.floor(X), iy = Math.floor(Y), tx = X - ix, ty = Y - iy;
    let s = 0, w = 0;
    for (const [cx, cy, ww] of [[ix, iy, (1 - tx) * (1 - ty)], [ix + 1, iy, tx * (1 - ty)], [ix, iy + 1, (1 - tx) * ty], [ix + 1, iy + 1, tx * ty]]) {
      const t = tiles.get(`${Math.floor(cy / 512)}/${Math.floor(cx / 512)}`);
      if (!t) continue;
      const i = (cy & 511) * 512 + (cx & 511);
      if (t.alpha && t.alpha[i] < 128) continue;
      s += t.gray[i] * ww; w += ww;
    }
    return w > 1e-6 ? s / w : -1;
  };
  let sum = 0, cnt = 0;
  for (let gy = 0; gy < size; gy++) for (let gx = 0; gx < size; gx++) {
    const [la, lo] = F.ll(gx, gy);
    const v = px(la, lo), i = gy * size + gx;
    if (v >= 0) { gray[i] = v; valid[i] = 1; sum += v; cnt++; }
  }
  const mean = cnt ? sum / cnt : 128;
  for (let i = 0; i < gray.length; i++) if (!valid[i]) gray[i] = mean;
  return { gray, size, level: L, coverage: cnt / (size * size), tiles: got, mPerPx: (res * D2R * R) };
}

/* ---------- named features (IAU / USGS Gazetteer) inside the map ---------- */
function namesIn(lat0, lon0, km) {
  if (!NAMES || !Array.isArray(NAMES.f)) return [];
  const half = km * 500, out = [];
  for (const [name, la, lo, dkm, type] of NAMES.f) {
    const y = (la - lat0) * D2R * R;
    let dl = wrapLon(lo - lon0);
    const x = dl * D2R * R * Math.cos(la * D2R);
    const rad = (dkm || 0) * 500;
    if (Math.abs(x) > half + rad * 0.3 || Math.abs(y) > half + rad * 0.3) continue;
    if (dkm && dkm * 1000 > km * 1000 * 3) continue;                     // much bigger than the map: skip
    out.push({ name, type, diamKm: dkm, u: x / (km * 1000) + 0.5, v: 0.5 - y / (km * 1000) });
  }
  out.sort((a, b) => (b.diamKm || 0) - (a.diamKm || 0));
  return out.slice(0, 14);
}

/* ---------- handler ---------- */
module.exports = async function handler(req, res) {
  const q = req.query || Object.fromEntries(new URL(req.url, 'http://x').searchParams);
  const lat = parseFloat(q.lat), lon = parseFloat(q.lon);
  const km = Math.max(2, Math.min(800, parseFloat(q.km) || 24));
  const n = [256, 384, 512].includes(+q.n) ? +q.n : 512;
  const tex = [1024, 1536, 2048].includes(+q.tex) ? +q.tex : 2048;
  const f = String(q.f || 'terrain.json');
  const fail = (code, msg) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify({ error: msg })); };
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 88) return fail(400, 'lat (−88..88) and lon are required');
  const lon0 = wrapLon(lon);
  const forever = 'public, max-age=86400, s-maxage=31536000, immutable';

  try {
    if (f === 'texture.jpg') {
      const im = await readImage(lat, lon0, km, tex);
      if (im.coverage < 0.05) return fail(404, 'No CTX imagery here');
      const rgba = Buffer.alloc(im.size * im.size * 4);
      for (let i = 0; i < im.gray.length; i++) { const v = im.gray[i]; rgba[4 * i] = v; rgba[4 * i + 1] = v; rgba[4 * i + 2] = v; rgba[4 * i + 3] = 255; }
      const jpg = encodeJPEG({ data: rgba, width: im.size, height: im.size }, 84).data;
      res.statusCode = 200;
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', forever);
      res.setHeader('X-Imagery', `CTX level ${im.level}, ${im.mPerPx.toFixed(1)} m/px, coverage ${(im.coverage * 100).toFixed(1)}%`);
      return res.end(jpg);
    }

    const dem = await readDEM(lat, lon0, km, n);
    let lo = Infinity, hi = -Infinity;
    for (const v of dem.grid) { if (v < lo) lo = v; if (v > hi) hi = v; }
    lo = Math.floor(lo); hi = Math.ceil(hi);
    if (hi - lo < 1) hi = lo + 1;

    if (f === 'heightmap.png') {
      const rgb = new Uint8Array(n * n * 3);
      for (let i = 0; i < n * n; i++) {
        const u = Math.round((dem.grid[i] - lo) / (hi - lo) * 65535);
        rgb[3 * i] = u >> 8; rgb[3 * i + 1] = u & 255; rgb[3 * i + 2] = 0;
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', forever);
      return res.end(PNG.encodeRGB(n, n, rgb));
    }

    // terrain.json
    const body = {
      name: q.name ? String(q.name).slice(0, 80) : null,
      lat, lon: lon0, regionWidthM: km * 1000, elevMin: lo, elevMax: hi, encoding: 'rg16',
      heightmap: 'heightmap.png', texture: 'texture.jpg',
      source: dem.source, sourceResM: dem.resM, sourceKey: dem.key,
      textureSource: CTX_NAME,
      names: namesIn(lat, lon0, km),
      real: true
    };
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', forever);
    return res.end(JSON.stringify(body));
  } catch (e) {
    return fail(502, 'Could not read the NASA/USGS data right now: ' + (e && e.message ? e.message : 'unknown error'));
  }
};
