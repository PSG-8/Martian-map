/* =====================================================================
   /api/names  ·  Martian Map · MR_PSG / Team Starseekers
   Every IAU-approved place name on Mars (craters, valleys, mountains...)
   from the USGS Gazetteer of Planetary Nomenclature, as compact JSON:
     { source, f: [[name, lat, lonEast(-180..180), diameterKm, type], ...] }
   The function reads the official shapefile download (zip -> .dbf table)
   and Vercel's CDN keeps the result for 30 days.
   ===================================================================== */
'use strict';
const zlib = require('zlib');

const ZIP = 'https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/MARS_nomenclature_center_pts.zip';

function unzipEntry(buf, suffix) {
  // end of central directory record
  let e = buf.length - 22;
  while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) throw new Error('zip: no directory');
  const count = buf.readUInt16LE(e + 10);
  let p = buf.readUInt32LE(e + 16);
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42), name = buf.toString('utf8', p + 46, p + 46 + nlen);
    if (name.toLowerCase().endsWith(suffix)) {
      const ln = buf.readUInt16LE(local + 26), lx = buf.readUInt16LE(local + 28);
      const data = buf.subarray(local + 30 + ln + lx, local + 30 + ln + lx + csize);
      return method === 0 ? data : zlib.inflateRawSync(data);
    }
    p += 46 + nlen + xlen + clen;
  }
  throw new Error('zip: ' + suffix + ' not found');
}

function readDBF(b) {
  const n = b.readUInt32LE(4), hlen = b.readUInt16LE(8), rlen = b.readUInt16LE(10);
  const fields = [];
  let off = 1;
  for (let p = 32; p < hlen - 1 && b[p] !== 0x0d; p += 32) {
    const name = b.toString('latin1', p, p + 11).replace(/\0.*$/, '');
    const len = b[p + 16];
    fields.push({ name, off, len });
    off += len;
  }
  const rows = [];
  for (let i = 0; i < n; i++) {
    const r = hlen + i * rlen;
    if (b[r] === 0x2a) continue;            // deleted record
    const o = {};
    for (const f of fields) o[f.name] = b.toString('utf8', r + f.off, r + f.off + f.len).trim();
    rows.push(o);
  }
  return rows;
}

module.exports = async function handler(req, res) {
  try {
    const r = await fetch(ZIP);
    if (!r.ok) throw new Error('USGS answered ' + r.status);
    const rows = readDBF(unzipEntry(Buffer.from(await r.arrayBuffer()), '.dbf'));
    const f = [];
    for (const d of rows) {
      if (!/adopted/i.test(d.approval || '')) continue;
      const type = (d.type || '').split(',')[0].trim();
      if (type === 'Albedo Feature') continue;
      let lon = parseFloat(d.center_lon), lat = parseFloat(d.center_lat);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      if (lon > 180) lon -= 360;
      f.push([d.clean_name || d.name, Math.round(lat * 1000) / 1000, Math.round(lon * 1000) / 1000, Math.round((parseFloat(d.diameter) || 0) * 10) / 10, type]);
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=2592000');
    res.end(JSON.stringify({ source: `IAU / USGS Gazetteer of Planetary Nomenclature (${f.length} adopted Mars names)`, f }));
  } catch (e) {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ error: 'Gazetteer not reachable: ' + e.message }));
  }
};
