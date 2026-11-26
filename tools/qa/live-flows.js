const { chromium, devices } = require('playwright');
const base = process.env.QA_LIVE || 'https://labathome-oman.vercel.app/';
const SAM = { ...devices['Galaxy S24'], userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36' };
(async () => {
  const b = await chromium.launch(); let bad = 0;
  for (const [dn, ctxOpts] of [['Galaxy S24 (Samsung)', SAM], ['iPhone SE', devices['iPhone SE']], ['Galaxy S9+ (320px)', devices['Galaxy S9+']], ['Laptop 1366x768', { viewport: { width: 1366, height: 768 } }]]) {
    const ctx = await b.newContext(ctxOpts); const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|favicon/.test(m.text())) errs.push(m.text().slice(0, 150)); });
    await p.addInitScript(() => { try { localStorage.setItem('lah_seen', '1'); sessionStorage.setItem('lah_splash', '1'); } catch (e) {} });
    const res = [];
    for (const r of ['', 'tests', 'consult', 'install', 'about', 'login']) { await p.goto(base + '#/' + r, { waitUntil: 'load' }); await p.waitForTimeout(2200); const sw = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); const v = await p.evaluate(() => typeof APP_V === 'undefined' ? (document.querySelector('script[src*="app.js"]') || {}).src : APP_V); res.push(r + ':' + (sw > 1 ? 'SIDEWAYS ' + sw : 'ok')); if (sw > 1) bad++; }
    // sign in with the public demo patient, then back-button flow
    await p.goto(base + '#/login'); await p.waitForTimeout(1500);
    await p.fill('#lf input[name=login]', 'patient@demo.labathome.om'); await p.fill('#lf input[type=password]', 'Demo@2026');
    await p.locator('#lf button[type=submit], #lf .btn').first().click(); await p.waitForTimeout(3500);
    const h1 = await p.evaluate(() => location.hash);
    await p.evaluate(() => { location.hash = '#/app/orders'; }); await p.waitForTimeout(2500);
    const first = await p.evaluate(() => { const a = document.querySelector('#app a[href^="#/app/order/"]'); return a && a.getAttribute('href'); });
    let backRes = 'no orders to open';
    if (first) { await p.evaluate(h => { location.hash = h; }, first); await p.waitForTimeout(2500); const bb = p.locator('[data-goback]').first(); if (await bb.count()) { await bb.click(); await p.waitForTimeout(1500); backRes = 'app Back -> ' + await p.evaluate(() => location.hash); } await p.goBack(); await p.waitForTimeout(1500); backRes += ' | phone Back -> ' + await p.evaluate(() => location.hash); }
    await p.evaluate(() => { location.hash = '#/login'; }); await p.waitForTimeout(1500); const loginRedir = await p.evaluate(() => location.hash);
    await p.goBack(); await p.waitForTimeout(1500); const afterBack = await p.evaluate(() => location.hash);
    const sw2 = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    console.log(dn, '| public:', res.join(' '), '| signed in ->', h1, '|', backRes, '| #/login while signed in ->', loginRedir, ', Back ->', afterBack, '| app sideways', sw2, '| JS errors', errs.length ? errs.slice(0, 2) : 0);
    if (errs.length) bad++;
    await ctx.close();
  }
  // storage blocked (in-app browser)
  const ctx = await b.newContext(SAM); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { for (const n of ['localStorage', 'sessionStorage']) Object.defineProperty(window, n, { get() { throw new DOMException('denied', 'SecurityError'); }, configurable: true }); });
  await p.goto(base + '#/'); await p.waitForTimeout(3000);
  const txt = await p.evaluate(() => document.querySelector('#app').innerText.trim().slice(0, 50).replace(/\n/g, ' | '));
  console.log('Storage blocked (in-app browser):', txt ? 'site opens: ' + JSON.stringify(txt) : 'BLANK', errs.slice(0, 1));
  await b.close(); console.log('bad', bad);
})();
