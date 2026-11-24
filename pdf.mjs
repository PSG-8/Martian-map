import { chromium } from 'playwright'; import fs from 'fs';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } }); p.on('pageerror', e => console.log('ERR', e.message));
await p.goto('file://' + process.cwd() + '/deck.html', { waitUntil: 'networkidle' }); await p.waitForTimeout(2500);
await p.keyboard.press('Enter'); await p.waitForTimeout(2500);
fs.mkdirSync('out', { recursive: true });
const n = await p.evaluate(() => document.querySelectorAll('#stage .slide').length);
for (let i = 0; i < n; i++) {
  const steps = await p.evaluate(i => +(document.querySelectorAll('#stage .slide')[i].dataset.steps || 0), i);
  for (let k = 0; k < steps; k++) { await p.keyboard.press('ArrowRight'); await p.waitForTimeout(500); }
  await p.waitForTimeout(2200);
  await p.screenshot({ path: `out/s${String(i + 1).padStart(2, '0')}.png` });
  await p.emulateMedia({ media: 'screen' });
  await p.pdf({ path: `out/p${String(i + 1).padStart(2, '0')}.pdf`, width: '1600px', height: '900px', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 }, pageRanges: '1' });
  console.log('slide', i + 1, 'steps', steps, await p.evaluate(() => document.querySelector('#count').textContent));
  if (i < n - 1) { await p.keyboard.press('ArrowRight'); await p.waitForTimeout(1200); }
}
await b.close();
