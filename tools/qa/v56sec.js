// v56 security UI: email change asks team accounts for the current password, "log out of all devices", owner-only security card.
const H = require('./h.js'); const { devices } = require('playwright'); const fs = require('fs');
const OUT = __dirname + '/out/v56'; fs.mkdirSync(OUT, { recursive: true });
const B = process.env.QA_BASE || 'http://localhost:5055/';
const fail = []; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail.push(m); };
(async () => {
  for (const lang of ['ar', 'en']) for (const dev of ['Galaxy S24', 'iPhone SE', null]) {
    const tag = lang + '-' + (dev || 'desktop').replace(/\s/g, '');
    // owner: password field, hint, logout-all link; empty password is caught before any call
    { const { b, p, errors } = await H.open({ ctxOpts: dev ? devices[dev] : { viewport: { width: 1366, height: 768 } }, role: 'leader', lang });
      await p.goto(B + '#/app/profile'); await p.waitForTimeout(1500);
      ok(await p.locator('#mailf input[name=pw]').count() === 1, tag + ' owner: email form has current-password field');
      ok(await p.locator('[data-logoutall]').count() >= 1, tag + ' owner: log-out-all link on profile');
      const w = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); ok(w <= 1, tag + ' profile: no sideways scroll (' + w + ')');
      await p.locator('#mailf input[name=em]').fill('owner.new@example.com'); await p.locator('#mailf button').click(); await p.waitForTimeout(500);
      const toast = await p.evaluate(() => (document.querySelector('#toast') || {}).textContent || ''); ok(/password|كلمة المرور/i.test(toast), tag + ' empty password → asks for it: "' + toast.slice(0, 60) + '"');
      await p.locator('#mailf input[name=pw]').fill('x-current'); await p.locator('#mailf button').click(); await p.waitForTimeout(900);
      ok(await p.locator('#mailf input[name=em]').inputValue() === 'owner.new@example.com', tag + ' with password → saved');
      await p.locator('#mailf').screenshot({ path: OUT + '/mail-' + tag + '.png' }).catch(() => {});
      await p.goto(B + '#/app/admin/safety'); await p.waitForTimeout(1800);
      const txt = await p.evaluate(() => document.querySelector('#app').innerText);
      ok(/Security \(owner only\)|الأمان \(للمالك فقط\)/.test(txt), tag + ' owner sees security card');
      const w2 = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); ok(w2 <= 1, tag + ' safety: no sideways scroll (' + w2 + ')');
      for (const d of await p.locator('details').all()) await d.evaluate(e => e.open = true);
      await p.waitForTimeout(300); const card = p.locator('.card', { hasText: lang === 'ar' ? 'الأمان (للمالك فقط)' : 'Security (owner only)' });
      await card.screenshot({ path: OUT + '/sec-' + tag + '.png' }).catch(() => {});
      ok(/→/.test(await card.innerText()), tag + ' audit shows what changed');
      await card.locator('[data-logoutall]').click(); await p.waitForTimeout(500);
      ok(await p.locator('#modal-root #lao').count() === 1, tag + ' log-out-all asks first');
      await p.locator('#modal-root [data-close]').click(); await p.waitForTimeout(300);
      ok(await p.locator('#modal-root .modal').count() === 0, tag + ' cancel closes the question');
      await card.locator('[data-logoutall]').click(); await p.waitForTimeout(400); await p.locator('#lao').click(); await p.waitForTimeout(1500);
      const st = await p.evaluate(() => ({ h: location.hash, tok: localStorage.getItem('lah_token') }));
      ok(!st.tok && (st.h === '' || st.h === '#/' || st.h === '#'), tag + ' after log-out-all: signed out, on home (' + st.h + ')');
      ok(errors.length === 0, tag + ' owner: no JS errors ' + errors.join(' / ').slice(0, 200)); await b.close(); }
    // demo admin + staff: no security card; patient: no password field
    for (const role of ['admin', 'staff', 'patient']) { const { b, p, errors } = await H.open({ ctxOpts: dev ? devices[dev] : { viewport: { width: 1366, height: 768 } }, role, lang });
      if (role !== 'patient') { await p.goto(B + '#/app/admin/safety'); await p.waitForTimeout(1500);
        ok(!/Security \(owner only\)|الأمان \(للمالك فقط\)/.test(await p.evaluate(() => document.querySelector('#app').innerText)), tag + ' ' + role + ': no security card'); }
      if (role === 'patient') await p.route('**/rpc/auth_me', r => { const m = H.mock.handle('auth_me', { p_token: 'tok-patient' }); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(Object.assign({}, m, { user: Object.assign({}, m.user, { is_demo: false }) })) }); });
      await p.goto(B + '#/app/profile'); await p.waitForTimeout(1400);
      const pw = await p.locator('#mailf input[name=pw]').count(); const mf = await p.locator('#mailf').count();
      if (role === 'patient') ok(mf === 1 && pw === 0, tag + ' patient (real): email form without password field');
      else ok(mf === 0 || pw === 1, tag + ' ' + role + ': email form (if shown) asks for password');
      ok(errors.length === 0, tag + ' ' + role + ': no JS errors ' + errors.join(' / ').slice(0, 200)); await b.close(); }
  }
  console.log(fail.length ? '\n' + fail.length + ' FAILED' : '\nALL PASSED'); process.exit(fail.length ? 1 : 0);
})();
