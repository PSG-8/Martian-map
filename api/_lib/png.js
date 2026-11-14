/* =====================================================================
   png.js  ·  Martian Map · MR_PSG / Team Starseekers
   Minimal PNG encoder (8-bit RGB) and decoder (8-bit gray / gray+alpha /
   RGB / RGBA / palette, not interlaced). Uses Node's built-in zlib.
   ===================================================================== */
'use strict';
const zlib = require('zlib');

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/* rgb: Uint8Array of width*height*3. Uses the "Sub" filter, good for smooth data. */
function encodeRGB(width, height, rgb) {
  const stride = width * 3, raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const o = y * (stride + 1), s = y * stride;
    raw[o] = 1;                                   // filter: Sub
    for (let x = 0; x < stride; x++) raw[o + 1 + x] = (rgb[s + x] - (x >= 3 ? rgb[s + x - 3] : 0)) & 0xff;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 7 })), chunk('IEND', Buffer.alloc(0))]);
}

/* Returns { width, height, gray: Uint8Array, alpha: Uint8Array|null }. */
function decode(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let p = 8, width = 0, height = 0, depth = 8, ctype = 0, interlace = 0, palette = null, trns = null;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { width = d.readUInt32BE(0); height = d.readUInt32BE(4); depth = d[8]; ctype = d[9]; interlace = d[12]; }
    else if (type === 'PLTE') palette = d;
    else if (type === 'tRNS') trns = d;
    else if (type === 'IDAT') idat.push(d);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (depth !== 8 || interlace) throw new Error('unsupported PNG layout');
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ctype];
  // some tile servers end the zlib stream early: SYNC_FLUSH still returns all complete data
  let raw;
  try { raw = zlib.inflateSync(Buffer.concat(idat), { finishFlush: zlib.constants.Z_SYNC_FLUSH }); }
  catch (e) { raw = Buffer.alloc(0); }
  const fullRows = Math.min(height, Math.floor(raw.length / (width * ch + 1)));   // rows we really have
  const stride = width * ch, img = Buffer.alloc(stride * height);
  for (let y = 0; y < fullRows; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride, prv = dst - stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? img[dst + x - ch] : 0, b = y > 0 ? img[prv + x] : 0, c = (x >= ch && y > 0) ? img[prv + x - ch] : 0;
      let v = raw[src + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      img[dst + x] = v & 0xff;
    }
  }
  const n = width * height, gray = new Uint8Array(n);
  let alpha = null;
  const finish = () => {                                  // rows missing from a cut-off file count as no data
    if (fullRows < height) { if (!alpha) alpha = new Uint8Array(n).fill(255); alpha.fill(0, fullRows * width); }
    return { width, height, gray, alpha, complete: fullRows === height };
  };
  if (ctype === 0) { gray.set(img); if (trns) { alpha = new Uint8Array(n).fill(255); const t = trns.readUInt16BE(0); for (let i = 0; i < n; i++) if (gray[i] === t) alpha[i] = 0; } }
  else if (ctype === 4) { alpha = new Uint8Array(n); for (let i = 0; i < n; i++) { gray[i] = img[2 * i]; alpha[i] = img[2 * i + 1]; } }
  else if (ctype === 2 || ctype === 6) {
    if (ctype === 6) alpha = new Uint8Array(n);
    for (let i = 0; i < n; i++) { const q = i * ch; gray[i] = (img[q] * 77 + img[q + 1] * 150 + img[q + 2] * 29) >> 8; if (alpha) alpha[i] = img[q + 3]; }
  } else if (ctype === 3) {
    if (trns) alpha = new Uint8Array(n);
    for (let i = 0; i < n; i++) { const k = img[i] * 3; gray[i] = (palette[k] * 77 + palette[k + 1] * 150 + palette[k + 2] * 29) >> 8; if (alpha) alpha[i] = img[i] < trns.length ? trns[img[i]] : 255; }
  }
  return finish();
}

module.exports = { encodeRGB, decode };
