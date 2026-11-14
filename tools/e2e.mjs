// End-to-end check with REAL data: node tools/e2e.mjs [baseUrl]
// Opens each site in headless Chrome, waits for the 3D world and prints what was loaded.
import { chromium, devices } from 'playwright';
const base = process.argv[2] || 'http://localhost:8080';
const sites = (process.env.SITES || 'jezero,gale,olympus').split(',');
const phone = !!process.env.PHONE;
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext(phone ? devices['iPhone 13'] : { viewport: { width: 1366, height: 820 } });
const p = await ctx.newPage();
const logs = [];
p.on('console', m => { if (m.type() === 'error') logs.push('console: ' + m.text()); });
p.on('pageerror', e => logs.push('pageerror: ' + e.message));
await p.goto(base + '/', { waitUntil: 'load' });
await p.waitForFunction(() => window.__mmReady, null, { timeout: 30000 });
for (const id of sites) {
  const t0 = Date.now();
  await p.evaluate(async id => {
    const { SITES } = await import('./worldmap.js?v=6');
    document.getElementById('site-select').value = id;
    document.getElementById('site-select').dispatchEvent(new Event('change'));
    document.getElementById('site-open').click();
  }, id);
  await p.waitForFunction(() => document.getElementById('loading').classList.contains('hidden') || document.querySelector('.load-err'), null, { timeout: 120000 });
  await p.waitForTimeout(2500);
  const info = await p.evaluate(() => ({
    badge: document.getElementById('data-badge').textContent,
    region: document.getElementById('region-badge').textContent,
    mapInfo: document.getElementById('map-info').textContent,
    err: document.querySelector('.load-err') ? document.querySelector('.load-err').innerText : null,
    names: [...document.querySelectorAll('#qr-from option')].map(o => o.textContent),
    note: document.getElementById('data-note').textContent.slice(0, 300)
  }));
  const shot = await p.screenshot({ path: `/tmp/e2e-${id}.png` });
  console.log(JSON.stringify({ id, seconds: ((Date.now() - t0) / 1000).toFixed(1), ...info }));
}
console.log('LOGS', logs.slice(0, 12).join('\n'));
await b.close();
