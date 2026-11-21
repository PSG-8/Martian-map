import { chromium, devices } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:9090/';
const OUT = '/vercel/stgout/'; import fs from 'fs'; fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); const res = []; const errs = [];
async function ctx(lang, w = 390){ const c = await b.newContext({ ...(w < 800 ? devices['Pixel 7'] : { viewport: { width: w, height: 900 } }) }); const p = await c.newPage();
  p.on('pageerror', e => errs.push(lang + ' pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load|ERR_|404|google/.test(m.text())) errs.push(lang + ' console: ' + m.text().slice(0, 200)); });
  await p.addInitScript(l => { localStorage.setItem('lah_lang', l); localStorage.setItem('lah_seen', '1'); }, lang); return p; }
async function login(p, email){ await p.goto(BASE + '#/login'); await p.waitForSelector('#lf'); await p.fill('[name=login]', email); await p.fill('[name=password]', 'Demo@2026'); await p.click('#lf button.btn'); await p.waitForFunction(() => location.hash.startsWith('#/app'), null, { timeout: 15000 }); await p.waitForTimeout(1500); }
const ok = (n, c, d) => res.push((c ? 'PASS ' : 'FAIL ') + n + (d ? ' :: ' + d : ''));
const shot = (p, n) => p.screenshot({ path: OUT + n + '.png', fullPage: true });
for (const lang of ['en', 'ar']) {
  let p = await ctx(lang);
  await login(p, 'patient@demo.labathome.om');
  await p.goto(BASE + '#/app/order/e6422350-b388-4bfe-9ee9-d6f29e64726f'); await p.waitForSelector('.care', { timeout: 15000 });
  ok(lang + ' urgent banner', await p.$('.care.lv-urgent') != null); ok(lang + ' hospital card', await p.$('#hospc .hosp') != null, await p.$$eval('#hospc .hosp b', x => x.map(y => y.textContent).join(' | ')));
  ok(lang + ' guidance card', await p.$('.gcard') != null); ok(lang + ' 9999', await p.$('a[href="tel:9999"]') != null); await shot(p, lang + '_urgent');
  await p.goto(BASE + '#/app/report/04e1c83b-78aa-4a63-92c9-dd29977552fd'); await p.waitForSelector('.report', { timeout: 15000 }); await p.waitForTimeout(800);
  ok(lang + ' report review level', await p.$('.care.lv-review') != null); await shot(p, lang + '_report_review');
  await p.goto(BASE + '#/app/tests'); await p.waitForSelector('.cats'); await p.click('[data-cat=kids]'); await p.waitForTimeout(400); ok(lang + ' kids pkg', (await p.$$('.pkg')).length >= 1); ok(lang + ' soon', (await p.$$('.soon-c')).length === 4); await shot(p, lang + '_tests_kids');
  await p.click('[data-cat=vitals]'); await p.waitForTimeout(300); ok(lang + ' vitals test', (await p.$$('.tcard')).length >= 1);
  await p.goto(BASE + '#/about'); await p.waitForTimeout(1200); const ord = await p.evaluate(() => { const a = document.querySelector('.vm'), s = document.querySelector('.story'); return a && s ? !!(a.compareDocumentPosition(s) & 4) : null; }); ok(lang + ' vision before story', ord === true);
  await p.context().close();
  p = await ctx(lang); await login(p, 'doctor@demo.labathome.om'); await p.waitForSelector('.olist .oitem, .empty', { timeout: 15000 }); const n = (await p.$$('.olist .oitem')).length; ok(lang + ' doctor queue', n >= 1, 'items ' + n); await shot(p, lang + '_doctor_home');
  await p.goto(BASE + '#/app/order/e6422350-b388-4bfe-9ee9-d6f29e64726f'); await p.waitForSelector('#docf', { timeout: 15000 });
  const addr = await p.evaluate(() => document.body.innerText.includes('tel:') || !!document.querySelector('a[href^="tel:"]:not([href="tel:9999"])')); ok(lang + ' doctor no phone', !addr);
  if (lang === 'en') { await p.fill('#dnote', 'Your fasting sugar is very high. Please go to Ibra Hospital emergency today and bring this report. After that, follow the diet advice and repeat HbA1c in 3 months.'); await p.click('#dsend'); await p.waitForSelector('.docnote', { timeout: 15000 }); ok('doctor note saved', true); }
  await shot(p, lang + '_doctor_order'); await p.context().close();
  p = await ctx(lang); await login(p, 'nurse@demo.labathome.om'); await p.goto(BASE + '#/app/kit'); await p.waitForSelector('#kf', { timeout: 15000 }); ok(lang + ' kit rows', (await p.$$('.kit-row')).length === 10);
  if (lang === 'en') { await p.fill('#kf input[name=gloves]', '20'); await p.click('#kf button.btn'); await p.waitForSelector('#kf', { timeout: 15000 }); await p.waitForTimeout(800); ok('kit request', (await p.content()).includes('Pending')); }
  await shot(p, lang + '_kit'); await p.context().close();
  p = await ctx(lang); await login(p, 'admin@demo.labathome.om'); await p.goto(BASE + '#/app/admin/kit'); await p.waitForSelector('.kit-hero', { timeout: 15000 }); await p.waitForTimeout(500);
  if (lang === 'en') { const f = await p.$('[data-fill]'); ok('admin sees request', !!f); if (f) { await f.click(); await p.waitForTimeout(2000); } }
  await shot(p, lang + '_admin_kit'); await p.goto(BASE + '#/app/admin/settings'); await p.waitForTimeout(2000); ok(lang + ' settings demo results', await p.$('#dr') != null); await p.context().close();
  p = await ctx(lang); await p.goto(BASE + '#/forgot'); await p.waitForSelector('#ff'); ok(lang + ' forgot page', true); await shot(p, lang + '_forgot');
  await p.goto(BASE + '#/login'); await p.waitForSelector('a[href="#/forgot"]'); ok(lang + ' forgot link', true); await shot(p, lang + '_login');
  await p.goto(BASE + '#/reset/deadbeef'); await p.waitForSelector('#rf'); await p.fill('[name=new1]', 'Abcdefgh1'); await p.click('#rf button.btn'); await p.waitForTimeout(2500); ok(lang + ' bad reset link msg', ((await p.textContent('#re')) || '').length > 5, await p.textContent('#re'));
  await p.context().close();
  p = await ctx(lang); await login(p, 'patient@demo.labathome.om'); await p.goto(BASE + '#/app/order/e6422350-b388-4bfe-9ee9-d6f29e64726f'); await p.waitForSelector('.docnote', { timeout: 15000 }); ok(lang + ' patient sees doctor note', true); await shot(p, lang + '_patient_note'); await p.context().close();
}
for (const w of [1366]) { const p = await ctx('ar', w); await login(p, 'patient@demo.labathome.om'); await p.goto(BASE + '#/app/order/e6422350-b388-4bfe-9ee9-d6f29e64726f'); await p.waitForSelector('.care'); await p.waitForTimeout(800); await shot(p, 'desk_urgent'); await p.context().close(); }
console.log(res.join('\n')); console.log('ERRORS', errs.length); errs.forEach(e => console.log(e));
await b.close();
