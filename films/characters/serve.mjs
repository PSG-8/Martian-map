import http from 'http'; import fs from 'fs'; import path from 'path';
const root = path.dirname(new URL(import.meta.url).pathname);
const types = { '.html':'text/html', '.js':'application/javascript', '.mjs':'application/javascript', '.css':'text/css', '.ttf':'font/ttf', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.json':'application/json' };
export function serve(port){ return new Promise(r => { const s = http.createServer((q, res) => { let f = path.join(root, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html';
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(port, '127.0.0.1', () => r(s)); }); }
