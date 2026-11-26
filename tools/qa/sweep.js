// Visit every screen as each role (mock API) on phone and desktop; report JS errors and sideways overflow.
const H = require('./h.js'); const base = (process.env.QA_BASE || 'http://localhost:5055/');
const pub = ['', 'how', 'tests', 'about', 'new', 'contact', 'install', 'support', 'login', 'register', 'consult', 'dental', 'sources', 'expat', 'r/tok123', 'tests?c=selfkit', 'guarantee', 'forgot'];
const roles = { patient: ['app', 'app/loyalty', 'app/privacy', 'app/order/k1', 'app/tests?c=selfkit', 'app/tests?c=expat', 'app/book', 'app/tests', 'app/cart', 'app/orders', 'app/order/o1', 'app/report/o1', 'app/report/o7', 'app/consult', 'app/profile', 'app/notifs'], nurse: ['app', 'app/orders', 'app/kit', 'app/order/o2'], courier: ['app', 'app/order/k1', 'app/order/o2'], lab: ['app', 'app/order/o3'], company: ['app', 'app/camps', 'app/privacy'], doctor: ['app', 'app/consult', 'app/order/o7'], admin: ['business', 'app', 'app/admin/safety', 'app/admin/coupons', 'app/admin/camps', 'app/admin/users', 'app/admin/payments', 'app/admin/settings', 'app/admin/catalog', 'app/admin/kit', 'app/orders'] };
(async () => {
  for (const desktop of [false, true]) { let bad = 0;
    for (const [role, list] of [[null, pub], ...Object.entries(roles)]) {
      const { b, p, errors } = await H.open({ desktop, role, lang: desktop ? 'en' : 'ar' });
      for (const r of list) { errors.length = 0; await p.goto(base + '#/' + r); await p.waitForTimeout(900);
        const w = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); const txt = await p.evaluate(() => document.body.innerText.length);
        if (errors.length || w > 2 || txt < 80) { bad++; console.log(desktop ? 'D' : 'M', role || 'public', r, 'overflow', w, 'text', txt, errors.slice(0, 2)); } }
      await b.close(); }
    console.log(desktop ? 'desktop' : 'phone', 'problems:', bad); }
})();
