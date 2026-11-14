// Local development server for Martian Map: serves the site AND runs the /api functions.
//   node tools/devserver.js [port]        ->  http://localhost:8080
// Needs Node 18+ and an internet connection (the functions read NASA / USGS data).
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const PORT = +process.argv[2] || 8080;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  const m = u.pathname.match(/^\/api\/([a-z-]+)$/);
  if (m) {
    const file = path.join(ROOT, 'api', m[1] + '.js');
    if (!fs.existsSync(file)) { res.writeHead(404); return res.end('no such function'); }
    req.query = Object.fromEntries(u.searchParams);
    try { return await require(file)(req, res); } catch (e) { res.writeHead(500); return res.end(String(e)); }
  }
  const f = path.join(ROOT, u.pathname === '/' ? 'index.html' : decodeURIComponent(u.pathname));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(res);
}).listen(PORT, () => console.log(`Martian Map dev server: http://localhost:${PORT}`));
