import { chromium } from 'playwright'; import { serve } from './serve.mjs'; import fs from 'fs';
const srv = await serve(8897); const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
fs.mkdirSync('out', { recursive: true });
for (const [tag, w, h, ox, oy, fov] of [['m', 780, 1200, -.1, .14, 48]]) {
  const p = await b.newPage({ viewport: { width: 1920, height: 1300 } }); p.on('pageerror', e => console.log('ERR', e.message)); p.on('console', m => console.log('CON', m.text()));
  await p.goto('http://127.0.0.1:8897/index.html'); await p.waitForFunction(() => window.ready); await p.evaluate(([w, h]) => go(w, h), [w, h]);
  for (let i = 0; i < 5; i++) { const d = await p.evaluate(([i, ox, oy, fov]) => shot(i, 3.2, ox, oy, fov), [i, ox, oy, fov]); fs.writeFileSync(`out/h${i}${tag}.jpg`, Buffer.from(d.split(',')[1], 'base64')); console.log(tag, i); }
  await p.close(); }
await b.close(); srv.close();
