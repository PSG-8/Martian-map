import { launch, mock } from './harness.mjs';
import { chromium } from 'playwright'; import fs from 'fs'; import path from 'path';
const b = await launch(); const errors = [];
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage();
p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load/.test(m.text())) errors.push(m.text()); });
await p.route('**/*', async r => { const u = new URL(r.request().url()); if (u.hostname === 'site.local') { let f = path.join('/tmp/lab/site', u.pathname); if (f.endsWith('/')) f += 'index.html'; if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' }); const ext = path.extname(f); const ty = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.mp4': 'video/mp4' }[ext] || 'application/octet-stream'; return r.fulfill({ status: 200, contentType: ty, body: fs.readFileSync(f) }); }
  if (u.hostname.endsWith('supabase.co')) { try { return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mock.handle(u.pathname.split('/').pop(), JSON.parse(r.request().postData() || '{}'))) }); } catch (e) { return r.fulfill({ status: 400, body: '{}' }); } }
  return r.abort(); });
await p.addInitScript(() => { localStorage.setItem('lah_lang', 'en'); localStorage.setItem('lah_seen', '1'); });
await p.goto('http://site.local/?lite=0#/'); await p.waitForTimeout(6000);
console.log(await p.evaluate(() => document.querySelector('#h3').className));
await p.screenshot({ path: '/tmp/lv/v25_desk.png' });
await p.goto('http://site.local/#/about'); await p.waitForTimeout(1200); await p.evaluate(() => document.querySelector('.team').scrollIntoView({ block: 'center' })); await p.waitForTimeout(500); await p.screenshot({ path: '/tmp/lv/v25_desk_team.png' });
await b.close(); console.log(errors.join('\n') || 'no errors');
