import { chromium } from 'playwright'; import { serve } from './serve.mjs'; import { spawn } from 'child_process'; import fs from 'fs';
const [a, b2, name, port] = [+process.argv[2], +process.argv[3], process.argv[4], +process.argv[5]];
const srv = await serve(port); const br = await chromium.launch({ args: ['--no-sandbox'] });
const p = await br.newPage({ viewport: { width: 1920, height: 1080 } }); p.on('pageerror', e => console.log('ERR', e.message));
await p.goto(`http://127.0.0.1:${port}/index.html`); await p.waitForFunction(() => window.ready, null, { timeout: 60000 });
const f0 = Math.round(a * 30), f1 = Math.round(b2 * 30); const tmp = `out/${name}.part.mp4`;
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', '30', '-i', '-', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '30', tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
for (let f = f0; f < f1; f++) { await p.evaluate(t => setT(t), f / 30); const buf = await p.screenshot({ type: 'jpeg', quality: 92 }); if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r)); }
ff.stdin.end(); const code = await new Promise(r => ff.on('close', r)); if (code === 0) fs.renameSync(tmp, `out/${name}.mp4`); console.log('done', name, code); await br.close(); srv.close();
