// node tools/runfn.js <api file> '<query json>' <out>
const fs = require('fs');
const [,, file, qs, out] = process.argv;
const h = require('../api/' + file);
const t0 = Date.now(), headers = {};
const res = { statusCode: 200, setHeader(k, v) { headers[k] = v; }, end(b) { fs.writeFileSync(out, b || ''); console.log(file, qs, this.statusCode, headers['X-Imagery'] || '', (Date.now() - t0) + 'ms', (b ? b.length : 0) + ' bytes'); if (/json/.test(headers['Content-Type'] || '')) console.log(String(b).slice(0, 700)); } };
h({ query: JSON.parse(qs) }, res);
