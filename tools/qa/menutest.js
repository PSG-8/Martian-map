// Every item of the main menu, for every account type, on a Samsung phone and a desktop:
// tap it -> the screen it names opens (no silent redirect home, no error card, no JS error), and the menu closes.
const H = require('./h.js'); const { devices } = require('playwright');
const base = (process.env.QA_BASE || 'http://localhost:5055/');
const SAM = { ...devices['Galaxy S24'], userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36' };
const roles = [null, 'leader', 'staff', 'admin', 'patient', 'nurse', 'courier', 'lab', 'company', 'doctor'];
let ok = 0, bad = 0;
(async () => {
  for (const [dname, ctxOpts] of [['phone', SAM], ['desktop', { viewport: { width: 1366, height: 768 } }]]) {
    for (const role of roles) {
      const { b, p, errors } = await H.open({ ctxOpts, role, lang: 'ar' });
      await p.goto(base + '#/' + (role ? 'app' : '')); await p.waitForTimeout(1400);
      const openMenu = async () => { const m = p.locator('[data-menu]:visible').first(); if (!(await m.count())) return false; await m.click(); await p.waitForTimeout(450); return true; };
      if (!(await openMenu())) { console.log(dname, role || 'public', 'NO MENU BUTTON'); bad++; await b.close(); continue; }
      const items = await p.evaluate(() => [...document.querySelectorAll('.dd .mi, .dd nav a, .dd nav button')].filter(e => e.offsetParent).map(e => ({ href: e.getAttribute('href'), data: [...e.attributes].filter(a => a.name.startsWith('data-')).map(a => a.name + '=' + a.value).join(' '), txt: (e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 30) })));
      await p.evaluate(() => { const bg = document.querySelector('.dd-bg'); if (bg && bg._close) bg._close(); }); await p.waitForTimeout(300);
      for (const it of items) {
        if (/data-logout|data-lang/.test(it.data)) continue;
        await p.goto(base + '#/' + (role ? 'app' : '')); await p.waitForTimeout(700);
        errors.length = 0; await openMenu();
        const loc = it.href ? p.locator(`.dd nav [href="${it.href}"]`).first() : p.locator('.dd nav [' + it.data.split(' ')[0].replace('=', '="') + '"]').first();
        if (!(await loc.count())) { console.log('  ? missing item', it.txt); continue; }
        try { if (dname === "phone") await loc.tap({ timeout: 5000 }); else await loc.click({ timeout: 5000 }); } catch (e) { bad++; console.log("FAIL cannot tap", dname, role, it.txt, e.message.split("\n")[0]); continue; }
        await p.waitForTimeout(1300);
        const st = await p.evaluate(() => ({ hash: location.hash, menuOpen: !!document.querySelector('.dd-bg.open'), modal: !!document.querySelector('#modal-root .modal-bg'), err: !!document.querySelector('#app .card.empty .btn[onclick*="reload"]'), title: (document.querySelector('#app h1, #app h2') || {}).innerText || '' }));
        const want = it.href && it.href.startsWith('#') ? it.href.split('?')[0] : null;
        const problems = [];
        if (want && st.hash.split('?')[0] !== want) problems.push('ended at ' + st.hash + ' instead of ' + it.href);
        if (!want && !st.modal && st.hash === '#/' + (role ? 'app' : '')) problems.push('nothing happened');
        if (st.menuOpen) problems.push('menu stayed open');
        if (st.err) problems.push('error screen');
        if (errors.length) problems.push('js: ' + errors[0].slice(0, 120));
        if (problems.length) { bad++; console.log('FAIL', dname, role || 'public', '"' + it.txt + '"', it.href || it.data, '->', problems.join('; ')); } else ok++;
      }
      console.log(dname, (role || 'public').padEnd(8), 'menu items', items.length);
      await b.close();
    }
  }
  console.log('\nOK', ok, 'FAIL', bad);
})();
