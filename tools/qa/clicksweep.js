// Every button and link on every screen, phone and desktop: is it covered by something, and does tapping it do anything?
const H = require('./h.js'); const base = (process.env.QA_BASE || 'http://localhost:5055/');
const pub = ['', 'how', 'tests', 'about', 'new', 'contact', 'install', 'support', 'login', 'register', 'consult', 'dental', 'sources', 'expat', 'r/tok123', 'tests?c=selfkit'];
const roles = { patient: ['app', 'app/loyalty', 'app/privacy', 'app/order/k1', 'app/tests?c=selfkit', 'app/tests?c=expat', 'app/book', 'app/tests', 'app/cart', 'app/orders', 'app/order/o1', 'app/report/o1', 'app/report/o7', 'app/consult', 'app/consult/new?kind=post', 'app/profile', 'app/notifs'],
  nurse: ['app', 'app/orders', 'app/kit', 'app/order/o2'], courier: ['app', 'app/order/k1', 'app/order/o2'], lab: ['app', 'app/order/o3'], company: ['app', 'app/camps', 'app/privacy'],
  doctor: ['app', 'app/consult', 'app/order/o7'], admin: ['business', 'app', 'app/admin/safety', 'app/admin/coupons', 'app/admin/camps', 'app/admin/users', 'app/admin/payments', 'app/admin/settings', 'app/admin/catalog', 'app/admin/kit', 'app/orders'] };
roles.leader = ['app', 'business', 'app/admin/users', 'app/admin/tickets', 'app/admin/payments', 'app/admin/contracts', 'app/admin/catalog', 'app/admin/kit', 'app/admin/safety',
  'app/admin/coupons', 'app/admin/camps', 'app/admin/settings', 'app/orders', 'app/order/o1', 'app/report/o1', 'app/tests', 'app/tests?c=selfkit', 'app/cart', 'app/book',
  'app/consult', 'app/consult/new?kind=pre', 'app/loyalty', 'app/profile', 'app/privacy', 'app/notifs', 'dental', 'consult', ''];
roles.staff = ['app', 'app/admin/tickets', 'app/orders', 'app/admin/users', 'app/admin/safety', 'app/admin/settings', 'app/profile'];
const { devices } = require('playwright');
const SAM = { ...devices['Galaxy S24'], userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36' };
const only = process.argv[2]; const devs = process.argv[3] ? [process.argv[3] === 'd'] : [false, true];
async function screen(p, route){
  return p.evaluate(async (route) => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const SKIP = '[data-logout],[data-lang],[data-sos],[href^="tel:"],[href^="mailto:"],[href^="sms:"],input,select,textarea,label,[disabled],.bot-panel *';
    const sig = el => [el.tagName, (el.getAttribute('href') || ''), [...el.attributes].filter(a => a.name.startsWith('data-')).map(a => a.name + '=' + a.value).join(' '), (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 40)].join('|');
    const list = () => [...document.querySelectorAll('#app a, #app button, #app [role=button], #app [data-go], #app [onclick], #bot .bot-fab')].filter(el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return !(el.closest('details:not([open])') && !el.closest('summary')) && r.width > 4 && r.height > 4 && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > .1 && !el.closest(SKIP) && !el.matches(SKIP); });
    const sigs = [...new Set(list().map(sig))]; const out = { n: sigs.length, covered: [], dead: [], errs: [] };
    window.open = (u) => { window.__fx = (window.__fx || 0) + 1; return null; }; window.print = () => { window.__fx = (window.__fx || 0) + 1; }; window.confirm = () => true; window.alert = () => {};
    try { navigator.share = async () => { window.__fx = (window.__fx || 0) + 1; }; } catch (e) {}
    const home = location.hash; window.scrollTo(0, 0);
    const restore = async () => { document.querySelectorAll('#modal-root > *').forEach(m => { if (m._close) m._close(); if (m.parentNode) m.parentNode.removeChild(m); }); const bt = document.getElementById('bot'); if (bt) bt.classList.remove('open'); document.body.classList.remove('lock');
      if (location.hash !== home) { location.hash = home; for (let i = 0; i < 30 && !document.querySelector('#app .content, #app section, #app .auth'); i++) await sleep(50); await sleep(350); } };
    for (const s of sigs) {
      const el = list().find(e => sig(e) === s); if (!el) continue;
      const href = el.getAttribute('href');
      if (el.tagName === 'A' && href && !href.startsWith('#') && !href.startsWith('javascript')) { if (!/^(https?:|\/|[a-z]+\/|media\/|present\/)/.test(href)) out.dead.push(s + ' (odd href)'); continue; }
      el.scrollIntoView({ block: 'center', inline: 'center' }); await sleep(30);
      const r = el.getBoundingClientRect(); const cx = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 2), cy = Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 2);
      const hit = document.elementFromPoint(cx, cy);
      if (hit && hit !== el && !el.contains(hit) && !hit.contains(el)) { const c = hit.closest('[id],[class]'); out.covered.push(s + ' <- ' + (c ? c.tagName + (c.id ? '#' + c.id : '') + '.' + String(c.className.baseVal !== undefined ? c.className.baseVal : c.className).split(' ').slice(0, 2).join('.') : hit.tagName)); }
      let muts = 0; const mo = new MutationObserver(ms => { muts += ms.filter(m => !(m.target.id === 'navbar' || (m.target.closest && m.target.closest('#navbar')))).length; }); mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
      window.__fx = 0; const h0 = location.hash; const sy = scrollY;
      try { el.click(); } catch (e) { out.errs.push(s + ' ' + e.message); }
      await sleep(220); mo.disconnect();
      const moved = location.hash !== h0 || window.__fx > 0 || muts > 0 || Math.abs(scrollY - sy) > 30 || (document.activeElement && document.activeElement.matches('input,textarea,select'));
      if (!moved && !(href && href === home)) out.dead.push(s);
      await restore();
    }
    return out;
  }, route);
}
(async () => {
  let total = 0, probs = 0;
  for (const desktop of devs) {
    for (const [role, list] of [[null, pub], ...Object.entries(roles)]) {
      if (only && only !== (role || 'public')) continue;
      const { b, p, errors } = await H.open({ desktop, role, lang: desktop ? 'en' : 'ar', ctxOpts: !desktop && process.env.SAM ? SAM : undefined });
      for (const r of list) {
        errors.length = 0; await p.goto(base + '#/' + r); await p.waitForTimeout(1400);
        let res; try { res = await screen(p, r); } catch (e) { console.log('!!', r, e.message.slice(0, 150)); continue; }
        total += res.n; const bad = res.covered.length + res.dead.length + res.errs.length + errors.length; probs += bad;
        if (bad) console.log(desktop ? 'D' : 'M', role || 'public', '#/' + r, 'buttons', res.n, JSON.stringify({ covered: res.covered, dead: res.dead, errs: res.errs, js: errors.slice(0, 3) }));
      }
      await b.close();
    }
  }
  console.log('checked', total, 'buttons; problems', probs);
})();
