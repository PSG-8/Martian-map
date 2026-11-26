// Back-button flows: the app's own Back button and the phone's Back, for the owner, patient, staff, doctor, and a signed-out visitor.
const H = require('./h.js'); const { devices } = require('playwright');
const base = (process.env.QA_BASE || 'http://localhost:5055/');
const UA = 'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36';
const ctxOpts = { ...devices['Galaxy S24'], userAgent: UA };
let pass = 0, fail = 0;
const hash = p => p.evaluate(() => location.hash);
async function expect(p, want, label){ await p.waitForTimeout(900); const h = await hash(p); const ok = want instanceof RegExp ? want.test(h) : h === want; ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + label + ' -> ' + h + (ok ? '' : '   (wanted ' + want + ')')); }
async function nav(p, h){ await p.evaluate(h => { location.hash = h; }, h); await p.waitForTimeout(900); }
async function appBack(p){ const b = p.locator('[data-goback]').first(); if (!(await b.count())) { console.log('  (no back button on ' + await hash(p) + ')'); fail++; return; } await b.click(); }
(async () => {
  try { H.mock.handle('consult_create', { p_token: 'tok-patient', p: { kind: 'pre', mode: 'chat', slot_date: '2026-12-01', slot_time: '10:00', reason: 'test', doctor_id: 'd1' } }); } catch (e) { console.log('seed failed', e.message); }
  // A. owner: normal navigation, app Back + phone Back
  { const { b, p, errors } = await H.open({ ctxOpts, role: 'leader', lang: 'ar' });
    await p.goto(base + '#/app'); await p.waitForTimeout(1200);
    await nav(p, '#/app/orders'); await nav(p, '#/app/order/o1');
    await appBack(p); await expect(p, '#/app/orders', 'A1 owner: order -> app Back');
    await p.goBack(); await expect(p, '#/app', 'A2 owner: phone Back after app Back');
    await nav(p, '#/app/consult'); await nav(p, '#/app/consult/new?kind=pre');
    await appBack(p); await expect(p, '#/app/consult', 'A3 owner: new consultation -> app Back');
    await nav(p, '#/app/tests'); await nav(p, '#/app/book');
    await appBack(p); await expect(p, '#/app/tests', 'A4 owner: booking (empty cart) -> app Back');
    await nav(p, '#/app/consult/nope'); await appBack(p); await expect(p, '#/app/tests', 'A4b owner: error screen has a working Back');
    await nav(p, '#/app/report/o1'); await appBack(p); await expect(p, '#/app/tests', 'A5 owner: report -> app Back');
    await nav(p, '#/login'); await expect(p, '#/app', 'A6 owner: signed in, opening #/login redirects in place');
    await p.goBack(); await expect(p, /#\/app\/(book|tests|report)/, 'A7 owner: phone Back after that redirect is not stuck');
    await nav(p, '#/app/admin/users'); await nav(p, '#/app/admin/tickets'); await p.goBack(); await expect(p, '#/app/admin/users', 'A8 owner: phone Back between admin pages');
    if (errors.length) console.log('  errors:', errors.slice(0, 3));
    await b.close(); }
  // B. deep link from WhatsApp: no history behind, app Back goes to the logical parent and never leaves the site
  { const { b, p } = await H.open({ ctxOpts, role: 'leader', lang: 'ar' });
    await p.goto(base + '#/app/order/o1'); await p.waitForTimeout(1300);
    await appBack(p); await expect(p, '#/app/orders', 'B1 deep link order -> app Back = my orders');
    await b.close(); }
  { const { b, p } = await H.open({ ctxOpts, role: 'leader', lang: 'ar' });
    await p.goto(base + '#/app/consult/c1'); await p.waitForTimeout(1300);
    await appBack(p); await expect(p, '#/app/consult', 'B2 deep link consultation -> app Back = consultations');
    await b.close(); }
  // C. signed-out visitor: sign in, the sign-in screen is not left behind in history
  { const { b, p } = await H.open({ ctxOpts, lang: 'ar' });
    await p.goto(base + '#/'); await p.waitForTimeout(1200);
    await nav(p, '#/login');
    await p.fill('#lf input[name=login]', 'leader@x.om'); await p.fill('#lf input[type=password]', 'whatever123');
    await p.locator('#lf button[type=submit], #lf .btn').first().click(); await expect(p, '#/app', 'C1 sign in -> home');
    await nav(p, '#/app/orders'); await nav(p, '#/app/order/o1'); await appBack(p); await expect(p, '#/app/orders', 'C2 after sign-in: app Back');
    await p.goBack(); await expect(p, '#/app', 'C3 phone Back');
    await p.goBack(); await expect(p, '#/', 'C4 phone Back again skips the sign-in screen');
    await b.close(); }
  // D. deep link while signed out -> sign in -> back where you wanted to go; Back does not return to sign-in
  { const { b, p } = await H.open({ ctxOpts, lang: 'ar' });
    await p.goto(base + '#/app/order/o1'); await p.waitForTimeout(1300); await expect(p, '#/login', 'D1 signed-out deep link -> sign in');
    await p.fill('#lf input[name=login]', 'patient@x.om'); await p.fill('#lf input[type=password]', 'whatever123');
    await p.locator('#lf button[type=submit], #lf .btn').first().click(); await expect(p, '#/app/order/o1', 'D2 after sign-in: the page asked for');
    await appBack(p); await expect(p, '#/app/orders', 'D3 app Back = my orders (never out of the site)');
    await b.close(); }
  // E. staff on a page it cannot open: redirect in place, phone Back not stuck
  { const { b, p } = await H.open({ ctxOpts, role: 'staff', lang: 'ar' });
    await p.goto(base + '#/app'); await p.waitForTimeout(1200); await nav(p, '#/app/admin/tickets');
    await nav(p, '#/app/loyalty'); await expect(p, '#/app', 'E1 staff -> loyalty redirects to home');
    await p.goBack(); await expect(p, '#/app/admin/tickets', 'E2 phone Back after redirect goes to the previous page');
    await b.close(); }
  // F. patient booking: step Back button and app Back
  { const { b, p } = await H.open({ ctxOpts, role: 'patient', lang: 'ar' });
    await p.goto(base + '#/app/tests'); await p.waitForTimeout(1300);
    const add = p.locator('[data-add]').first(); if (await add.count()) await add.click(); await p.waitForTimeout(400);
    await nav(p, '#/app/book'); await expect(p, '#/app/book', 'F1 patient booking opens');
    await appBack(p); await expect(p, '#/app/tests', 'F2 booking -> app Back');
    await b.close(); }
  // G. doctor: consultation detail -> Back
  { const { b, p } = await H.open({ ctxOpts, role: 'doctor', lang: 'en' });
    await p.goto(base + '#/app'); await p.waitForTimeout(1200); await nav(p, '#/app/consult'); await nav(p, '#/app/consult/c1');
    await appBack(p); await expect(p, '#/app/consult', 'G1 doctor: consultation -> app Back');
    await b.close(); }
  console.log('\nPASS', pass, 'FAIL', fail);
})();
