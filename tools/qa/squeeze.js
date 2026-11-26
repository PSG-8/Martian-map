// Squeezed text: a sentence forced into a narrow column (one or two words per line) because a button/icon beside it takes the room.
// Every screen x every account x several widths. Prints each problem once with the widths where it happens.
const H = require('./h.js'); const fs = require('fs');
const base = process.env.QA_BASE || 'http://localhost:5055/';
const src = fs.readFileSync(__dirname + '/sweep.js', 'utf8');
const pub = eval(src.match(/const pub = (\[[^\]]*\])/)[1]);
const roles = eval('(' + src.match(/const roles = (\{.*\});/)[1] + ')');
roles.leader = ['app', 'business', 'app/admin/users', 'app/admin/tickets', 'app/admin/payments', 'app/admin/contracts', 'app/admin/catalog', 'app/admin/kit', 'app/admin/safety', 'app/admin/coupons', 'app/admin/camps', 'app/admin/settings', 'app/orders', 'app/order/o1', 'app/report/o1', 'app/tests', 'app/cart', 'app/book', 'app/consult', 'app/consult/new?kind=pre', 'app/loyalty', 'app/profile', 'app/privacy', 'app/notifs'];
roles.staff = ['app', 'app/admin/tickets', 'app/orders', 'app/admin/users', 'app/admin/safety', 'app/admin/settings', 'app/profile'];
const widths = (process.env.WIDTHS || '320,360,384,412,768,1280').split(',').map(Number);
function probe(){
  const out = [];
  for (const e of document.querySelectorAll('body *')) {
    if (e.closest('svg,script,style,#nurse,.leaflet-container')) continue;
    const own = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 2); if (!own) continue;
    const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || r.bottom < 0) continue;
    const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const txt = (e.innerText || '').trim(); const words = txt.split(/\s+/).filter(Boolean).length; if (words < 5) continue;
    let lh = parseFloat(cs.lineHeight); if (!lh) lh = parseFloat(cs.fontSize) * 1.4;
    const inner = r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth);
    const lines = Math.round(inner / lh); if (lines < 4) continue;
    if (words / lines < 1.8 && r.width < 140) out.push((e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0]) + ' w=' + Math.round(r.width) + ' lines=' + lines + ' "' + txt.slice(0, 40).replace(/\s+/g, ' ') + '"');
  }
  return out;
}
(async () => {
  const found = new Map();
  for (const W of widths) {
    for (const [role, list] of [[null, pub], ...Object.entries(roles)]) {
      for (const lang of ['ar', 'en']) {
        const { b, p } = await H.open({ ctxOpts: W >= 900 ? { viewport: { width: W, height: 800 } } : { viewport: { width: W, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, role, lang });
        for (const r of list) {
          try { await p.goto(base + '#/' + r); await p.waitForTimeout(900); } catch (e) { continue; }
          const res = await p.evaluate(probe).catch(() => []);
          for (const x of res) { const k = (role || 'public') + ' #/' + r + ' ' + lang + ' | ' + x.replace(/ w=\d+ lines=\d+/, ''); if (!found.has(k)) found.set(k, []); found.get(k).push(W + ':' + x.match(/w=\d+ lines=\d+/)[0]); }
        }
        await b.close();
      }
    }
    console.log('width done', W, 'problems so far', found.size);
  }
  for (const [k, v] of found) console.log(k, '||', v.join(' '));
  console.log('SQUEEZED', found.size);
})();
