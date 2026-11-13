/* =====================================================================
   tiff.js  ·  Martian Map · MR_PSG / Team Starseekers
   A small GeoTIFF reader that works over HTTP range requests.
   It reads only the bytes it needs, so a window of a 11 GB global DEM
   costs a few hundred kilobytes.

   Supported: classic TIFF and BigTIFF, little or big endian, strip
   layout without compression (USGS HRSC+MOLA blend, Mars 2020 CTX DEM),
   int16 / uint16 / float32 samples, internal overviews (IFD chain).
   ===================================================================== */
'use strict';

const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8, 16: 8, 17: 8, 18: 8 };

async function fetchRange(url, start, length, tries = 3) {
  let err;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { Range: `bytes=${start}-${start + length - 1}` } });
      if (r.status !== 206 && r.status !== 200) throw new Error(`HTTP ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      if (r.status === 200) return buf.subarray(start, start + length);   // server ignored Range (should not happen)
      return buf;
    } catch (e) { err = e; await new Promise(res => setTimeout(res, 120 * (i + 1))); }
  }
  throw err;
}

/* Runs async jobs with a concurrency limit. */
async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  });
  await Promise.all(workers);
  return out;
}

class Reader {
  constructor(buf, le, big) { this.b = buf; this.le = le; this.big = big; }
  u16(o) { return this.le ? this.b.readUInt16LE(o) : this.b.readUInt16BE(o); }
  u32(o) { return this.le ? this.b.readUInt32LE(o) : this.b.readUInt32BE(o); }
  u64(o) { return Number(this.le ? this.b.readBigUInt64LE(o) : this.b.readBigUInt64BE(o)); }
  f64(o) { return this.le ? this.b.readDoubleLE(o) : this.b.readDoubleBE(o); }
  off(o) { return this.big ? this.u64(o) : this.u32(o); }
}

/* Reads `count` values of TIFF `type` from buffer b at position o. */
function readValues(rd, o, type, count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const p = o + i * TYPE_SIZE[type];
    switch (type) {
      case 1: case 7: out.push(rd.b[p]); break;
      case 2: out.push(rd.b[p]); break;
      case 3: out.push(rd.u16(p)); break;
      case 4: out.push(rd.u32(p)); break;
      case 8: out.push(rd.le ? rd.b.readInt16LE(p) : rd.b.readInt16BE(p)); break;
      case 9: out.push(rd.le ? rd.b.readInt32LE(p) : rd.b.readInt32BE(p)); break;
      case 11: out.push(rd.le ? rd.b.readFloatLE(p) : rd.b.readFloatBE(p)); break;
      case 12: out.push(rd.f64(p)); break;
      case 16: case 18: out.push(rd.u64(p)); break;
      case 17: out.push(Number(rd.le ? rd.b.readBigInt64LE(p) : rd.b.readBigInt64BE(p))); break;
      case 5: out.push(rd.u32(p) / rd.u32(p + 4)); break;
      default: out.push(null);
    }
  }
  return out;
}

const cache = new Map();   // url -> parsed header (kept while the function instance is warm)

/* Parses the header and every IFD (main image + overviews). Large arrays (strip offsets) are NOT loaded:
   only their position is stored, and the needed entries are fetched later. */
async function open(url) {
  if (cache.has(url)) return cache.get(url);
  const head = await fetchRange(url, 0, 65536);
  const le = head[0] === 0x49;
  let rd = new Reader(head, le, false);
  const magic = rd.u16(2);
  const big = magic === 43;
  rd = new Reader(head, le, big);
  let ifdOff = big ? rd.u64(8) : rd.u32(4);
  const ifds = [];
  let guard = 0;
  while (ifdOff && guard++ < 24) {
    // read a generous block around the IFD; entries + small arrays usually fit
    const blk = await fetchRange(url, ifdOff, 16384);
    const r = new Reader(blk, le, big);
    const n = big ? r.u64(0) : r.u16(0);
    const es = big ? 20 : 12, base = big ? 8 : 2, inl = big ? 8 : 4;
    const tags = {};
    for (let i = 0; i < n; i++) {
      const p = base + i * es;
      const tag = r.u16(p), type = r.u16(p + 2), count = big ? r.u64(p + 4) : r.u32(p + 4);
      const vpos = p + (big ? 12 : 8);
      const bytes = (TYPE_SIZE[type] || 1) * count;
      if (bytes <= inl) tags[tag] = { type, count, values: readValues(r, vpos, type, count) };
      else tags[tag] = { type, count, at: big ? r.u64(vpos) : r.u32(vpos) };
    }
    const nextPos = base + n * es;
    const next = big ? r.u64(nextPos) : r.u32(nextPos);
    // small out-of-line tags we need right away (pixel scale, tiepoint, nodata, bits, sample format)
    for (const t of [258, 339, 33550, 33922, 42113]) {
      const e = tags[t];
      if (e && e.at !== undefined && !e.values) {
        const sz = (TYPE_SIZE[e.type] || 1) * e.count;
        const b = await fetchRange(url, e.at, sz);
        e.values = readValues(new Reader(b, le, big), 0, e.type, e.count);
      }
    }
    const v = (t, d) => (tags[t] && tags[t].values ? tags[t].values[0] : d);
    const ifd = {
      width: v(256), height: v(257), bits: v(258, 8), compression: v(259, 1), spp: v(277, 1),
      rowsPerStrip: v(278, v(257)), sampleFormat: v(339, 1), planar: v(284, 1),
      tiled: !!tags[322], stripOffsets: tags[273], subfile: v(254, 0),
      scale: tags[33550] && tags[33550].values, tie: tags[33922] && tags[33922].values,
      nodata: tags[42113] && tags[42113].values ? parseFloat(String.fromCharCode(...tags[42113].values).replace(/\0/g, '')) : null
    };
    ifds.push(ifd);
    ifdOff = next;
  }
  const main = ifds[0];
  for (const o of ifds) o.factor = main.width / o.width;
  const info = { url, le, big, ifds, main, nodata: main.nodata };
  cache.set(url, info);
  return info;
}

/* Byte offset of the start of each strip in [s0, s1]. Uses inline values when present. */
async function stripOffsets(info, ifd, s0, s1) {
  const e = ifd.stripOffsets;
  if (e.values) return e.values.slice(s0, s1 + 1);
  const sz = TYPE_SIZE[e.type];
  const b = await fetchRange(info.url, e.at + s0 * sz, (s1 - s0 + 1) * sz);
  return readValues(new Reader(b, info.le, info.big), 0, e.type, s1 - s0 + 1);
}

/* Reads a window (col0..col1, row0..row1 inclusive) of one IFD into a Float32Array (NaN = no data). */
async function readWindow(info, ifd, col0, row0, col1, row1) {
  if (ifd.tiled) throw new Error('tiled TIFF not supported by this reader');
  if (ifd.compression !== 1) throw new Error(`compression ${ifd.compression} not supported by this reader`);
  col0 = Math.max(0, col0); row0 = Math.max(0, row0);
  col1 = Math.min(ifd.width - 1, col1); row1 = Math.min(ifd.height - 1, row1);
  const W = col1 - col0 + 1, H = row1 - row0 + 1;
  const bps = ifd.bits / 8, px = bps * ifd.spp, rowBytes = ifd.width * px;
  const rps = ifd.rowsPerStrip;
  const s0 = Math.floor(row0 / rps), s1 = Math.floor(row1 / rps);
  const offs = await stripOffsets(info, ifd, s0, s1);
  const out = new Float32Array(W * H);
  const nod = info.nodata;
  const rows = Array.from({ length: H }, (_, i) => row0 + i);
  await pool(rows, 48, async (row) => {
    const s = Math.floor(row / rps);
    const start = offs[s - s0] + (row % rps) * rowBytes + col0 * px;
    const b = await fetchRange(info.url, start, W * px);
    const base = (row - row0) * W;
    for (let i = 0; i < W; i++) {
      const p = i * px;
      let val;
      if (ifd.sampleFormat === 3) val = bps === 4 ? (info.le ? b.readFloatLE(p) : b.readFloatBE(p)) : (info.le ? b.readDoubleLE(p) : b.readDoubleBE(p));
      else if (ifd.sampleFormat === 2) val = bps === 2 ? (info.le ? b.readInt16LE(p) : b.readInt16BE(p)) : (info.le ? b.readInt32LE(p) : b.readInt32BE(p));
      else val = bps === 2 ? (info.le ? b.readUInt16LE(p) : b.readUInt16BE(p)) : b[p];
      if ((nod !== null && (val === nod || Math.abs(val - nod) < 1e-3 * Math.abs(nod || 1))) || !Number.isFinite(val) || val < -1e5 || val > 1e5) val = NaN;
      out[base + i] = val;
    }
  });
  return { data: out, W, H, col0, row0 };
}

module.exports = { open, readWindow, fetchRange, pool };
