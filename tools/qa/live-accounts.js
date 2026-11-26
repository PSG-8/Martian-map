// Live, read-only: every public demo account (password Demo@2026 is public), real data, Samsung 384 px + iPhone SE 320 px.
const { chromium, devices } = require('playwright'); const fs = require('fs');
const base = process.env.QA_LIVE || 'https://labathome-oman.vercel.app/';
const SAM = { ...devices['Galaxy S24'], userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36' };
const accts = ['patient', 'nurse', 'mohammed.kindi', 'courier', 'fleet.coldchain', 'lab', 'doctor', 'company', 'admin'];
const sq = fs.readFileSync(__dirname + '/squeeze.js', 'utf8'); const probeSrc = sq.slice(sq.indexOf('function probe(){'), sq.indexOf('(async () => {'));
(async () => {
  const b = await chromium.launch(); let issues = 0, screens = 0;
  for (const [dn, co] of [['S24 384px', SAM], ['iPhone SE 320px', devices['iPhone SE']]]) {
    for (const a of accts) {
      const ctx = await b.newContext(co); const p = await ctx.newPage(); const errs = [];
      p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|favicon|status of 4/.test(m.text())) errs.push(m.text().slice(0, 140)); });
      await p.addInitScript(src => { try { localStorage.setItem('lah_seen', '1'); sessionStorage.setItem('lah_splash', '1'); } catch (e) {} eval(src + ';window.__sq=probe;'); }, probeSrc);
      await p.goto(base + '#/login'); await p.waitForTimeout(1500);
      await p.fill('#lf input[name=login]', a + '@demo.labathome.om'); await p.fill('#lf input[type=password]', 'Demo@2026');
      await p.locator('#lf button[type=submit], #lf .btn').first().click(); await p.waitForTimeout(4000);
      if (!(await p.evaluate(() => location.hash.startsWith('#/app')))) { console.log(dn, a, 'LOGIN FAILED', await p.evaluate(() => location.hash)); issues++; await ctx.close(); continue; }
      // routes = this account's menu + bottom bar + first order/consult
      const routes = await p.evaluate(async () => { const s = new Set(['app']); document.querySelectorAll('.tabbar a[href^="#/app"]').forEach(x => s.add(x.getAttribute('href').slice(2))); const m = document.querySelector('[data-menu]'); if (m) { m.click(); await new Promise(r => setTimeout(r, 500)); document.querySelectorAll('.dd nav a[href^="#/app"], .dd nav a[href^="#/business"]').forEach(x => s.add(x.getAttribute('href').slice(2))); const bg = document.querySelector('.dd-bg'); if (bg && bg._close) bg._close(); } return [...s]; });
      for (const extra of ['app/orders', 'app/consult']) { await p.evaluate(h => { location.hash = '#/' + h; }, extra); await p.waitForTimeout(2200); const f = await p.evaluate(() => { const x = document.querySelector('#app a[href^="#/app/order/"], #app a[href^="#/app/consult/c"], #app [data-go^="app/consult/"]'); return x && (x.getAttribute('href') || '#/' + x.dataset.go); }); if (f && !f.includes('/new')) routes.push(f.replace(/^#\//, '')); }
      const bad = [];
      for (const r of [...new Set(routes)]) {
        if (/consult\/new|book$/.test(r)) continue;
        await p.evaluate(h => { location.hash = '#/' + h; }, r); await p.waitForTimeout(2300); screens++;
        const res = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth - innerWidth, sq: window.__sq ? window.__sq() : [], err: !!document.querySelector('#app .card.empty .btn[onclick*="reload"]') }));
        if (res.sw > 1) bad.push(r + ': SIDEWAYS ' + res.sw); if (res.sq.length) bad.push(r + ': SQUEEZED ' + res.sq[0]); if (res.err) bad.push(r + ': ERROR SCREEN');
      }
      if (errs.length) bad.push('JS: ' + errs.slice(0, 2).join(' / '));
      issues += bad.length;
      console.log(dn.padEnd(16), a.padEnd(16), 'screens', routes.length, bad.length ? '\n    ' + bad.join('\n    ') : 'OK');
      await ctx.close();
    }
  }
  await b.close(); console.log('LIVE screens', screens, 'issues', issues);
})();
