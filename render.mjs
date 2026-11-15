import { chromium } from 'playwright';
import { spawn } from 'child_process';
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let FF = 'ffmpeg'; try { FF = require('ffmpeg-static'); } catch {}
const FPS = 30;
const out = process.argv[2] || 'silent.mp4';
const exe = fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined;
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
p.on('pageerror', e => console.error('PAGEERR', e.message));
await p.goto('file://' + process.cwd() + '/anim.html');
await p.waitForFunction('window.ready===true', null, { timeout: 60000 });
const DUR = await p.evaluate('window.DUR');
const total = Math.round(DUR * FPS);
const ff = spawn(FF, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS), out], { stdio: ['pipe', 'inherit', 'inherit'] });
const t0 = Date.now();
for (let i = 0; i < total; i++) {
  const d = await p.evaluate(t => { render(t); return document.getElementById('c').toDataURL('image/jpeg', 0.95); }, i / FPS);
  const buf = Buffer.from(d.slice(d.indexOf(',') + 1), 'base64');
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  if (i % 150 === 0) console.log(`frame ${i}/${total} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
ff.stdin.end();
await new Promise(r => ff.on('close', r));
await b.close();
console.log('done', out, ((Date.now() - t0) / 1000).toFixed(0) + 's');
