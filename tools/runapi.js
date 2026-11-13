// node runapi.js lat lon km f out
const h = require('../api/terrain.js');
const [,, lat, lon, km, f, out, extra] = process.argv;
const fs = require('fs');
const t0 = Date.now();
const chunks = []; const headers = {};
const res = { statusCode: 200, setHeader(k, v) { headers[k] = v; }, end(b) { fs.writeFileSync(out, b || ''); console.log(f, this.statusCode, headers['X-Imagery'] || '', (Date.now() - t0) + 'ms', (b ? b.length : 0) + ' bytes'); if (f === 'terrain.json' || this.statusCode !== 200) console.log(String(b).slice(0, 1500)); } };
h({ query: Object.assign({ lat, lon, km, f }, extra ? JSON.parse(extra) : {}) }, res);
