// Device matrix: every screen x every role x many real device profiles (Samsung, iPhone, iPad, Huawei, Redmi, Pixel, desktop).
// Per screen: JS errors, sideways scroll, interactive elements off-screen, buttons covered by something (cannot be tapped),
// text cut inside buttons/headings/chips, text on pictures/characters/other text, too-small tap targets.
// Usage: node devmatrix.js <groupIndex> <groupCount>   (to run several in parallel)  — prints JSON lines + summary.
const H = require('./h.js'); const fs = require('fs'); const { devices } = require('playwright');
const base = (process.env.QA_BASE || 'http://localhost:5055/');
const OUT = require('path').join(__dirname, 'out', 'devices') + '/'; fs.mkdirSync(OUT, { recursive: true });
const src = fs.readFileSync(__dirname + '/sweep.js', 'utf8');
const pub = eval(src.match(/const pub = (\[[^\]]*\])/)[1]);
const roles = eval('(' + src.match(/const roles = (\{.*\});/)[1] + ')');
roles.leader = ['app', 'business', 'app/admin/users', 'app/admin/tickets', 'app/admin/payments', 'app/admin/contracts', 'app/admin/catalog', 'app/admin/kit', 'app/admin/safety',
  'app/admin/coupons', 'app/admin/camps', 'app/admin/settings', 'app/orders', 'app/order/o1', 'app/report/o1', 'app/tests', 'app/tests?c=selfkit', 'app/cart', 'app/book',
  'app/consult', 'app/consult/new?kind=pre', 'app/loyalty', 'app/profile', 'app/privacy', 'app/notifs', 'dental'];
roles.staff = ['app', 'app/admin/tickets', 'app/orders', 'app/admin/users', 'app/admin/safety', 'app/admin/settings', 'app/profile'];
const UA = {
  samsung: 'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
  huawei: 'Mozilla/5.0 (Linux; Android 10; JNY-LX1; HMSCore 6.11.0.302) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.88 HuaweiBrowser/13.0.5.303 Mobile Safari/537.36',
  redmi: 'Mozilla/5.0 (Linux; U; Android 13; 23021RAA2Y Build/TKQ1.221114.001) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/112.0.5615.136 Mobile Safari/537.36 XiaoMi/MiuiBrowser/14.4.0-g' };
const mob = (w, h, dpr, ua) => ({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true, userAgent: ua });
const DEV = [
  ['Galaxy S24 (Samsung Internet)', { ...devices['Galaxy S24'], userAgent: UA.samsung }, 'ar'],
  ['Galaxy A55', devices['Galaxy A55'], 'ar'],
  ['Galaxy S8', devices['Galaxy S8'], 'ar'],
  ['Galaxy S9+', devices['Galaxy S9+'], 'en'],
  ['Galaxy Z Flip 7 cover', devices['Galaxy Z Flip 7 Cover'], 'ar'],
  ['Galaxy Z Fold 7 cover', devices['Galaxy Z Fold 7 Cover'], 'ar'],
  ['Galaxy Z Fold 7 open', devices['Galaxy Z Fold 7'], 'ar'],
  ['Galaxy Tab S9', devices['Galaxy Tab S9'], 'ar'],
  ['Huawei P40 lite', mob(360, 780, 3, UA.huawei), 'ar'],
  ['Redmi Note 12', mob(393, 873, 2.75, UA.redmi), 'ar'],
  ['Pixel 7', devices['Pixel 7'], 'en'],
  ['Large text (Android zoom 120%)', mob(300, 650, 3.6, UA.samsung), 'ar'],
  ['iPhone SE (1st)', devices['iPhone SE'], 'ar'],
  ['iPhone SE (3rd)', devices['iPhone SE (3rd gen)'], 'en'],
  ['iPhone 15 Pro Max', devices['iPhone 15 Pro Max'], 'ar'],
  ['iPad Mini', devices['iPad Mini'], 'ar'],
  ['iPad Pro 11 landscape', devices['iPad Pro 11 landscape'], 'en'],
  ['Galaxy S24 landscape', { ...devices['Galaxy S24 landscape'], userAgent: UA.samsung }, 'ar'],
  ['Laptop 1280x720', { viewport: { width: 1280, height: 720 } }, 'ar'],
  ['Desktop 1920x1080', { viewport: { width: 1920, height: 1080 } }, 'en'],
];
function probe(){
  const cs = e => getComputedStyle(e);
  const shown = e => { if (e.closest('details:not([open])') && !e.closest('summary')) return false; for (let x = e; x && x !== document.documentElement; x = x.parentElement) { const s = cs(x); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity < .1) return false; } const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
  const name = e => (e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '')) + ' "' + ((e.innerText || e.getAttribute('aria-label') || e.value || '').trim().replace(/\s+/g, ' ').slice(0, 28)) + '"';
  const scroller = e => { for (let x = e.parentElement; x && x !== document.body; x = x.parentElement) { const s = cs(x); if (/(auto|scroll|hidden|clip)/.test(s.overflowX) && x.scrollWidth > x.clientWidth + 1) return x; } return null; };
  const out = { overflowX: document.documentElement.scrollWidth - innerWidth, off: [], cut: [], small: [], covered: [] };
  const inter = [...document.querySelectorAll('#app a, #app button, #app input, #app select, #app textarea, #app [role=button], .tabbar a, .cart-bar a, .cart-bar button, #bot .bot-fab')].filter(shown).filter(e => !e.closest('.leaflet-control-attribution'));
  for (const e of inter) {
    const r = e.getBoundingClientRect();
    if ((r.right > innerWidth + 1 || r.left < -1) && !scroller(e)) out.off.push(name(e) + ' x=' + Math.round(r.left) + '..' + Math.round(r.right));
    const inline = e.tagName === 'A' && cs(e).display === 'inline' && e.closest('p,li,span,small,.small,.xs,td');
    if (!inline && e.type !== 'checkbox' && e.type !== 'radio' && e.type !== 'hidden' && (r.width < 24 || r.height < 24) && r.width > 2) out.small.push(name(e) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
  }
  for (const e of [...document.querySelectorAll('#app .btn, #app button, #app .chip, #app h1, #app h2, #app h3, #app h4, #app label span, #app .tab, #app th, .tabbar a span')].filter(shown)) {
    const s = cs(e); if (e.scrollWidth > e.clientWidth + 2 && (s.overflow !== 'visible' || s.overflowX !== 'visible' || s.textOverflow === 'ellipsis') && e.clientWidth > 0) out.cut.push(name(e) + ' ' + e.scrollWidth + '>' + e.clientWidth);
    else if (e.scrollHeight > e.clientHeight + 3 && s.overflowY !== 'visible' && e.clientHeight > 0 && !/(auto|scroll)/.test(s.overflowY)) out.cut.push(name(e) + ' (height) ' + e.scrollHeight + '>' + e.clientHeight);
  }
  return out;
}
async function coveredCheck(p){
  return p.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms)); const cs = e => getComputedStyle(e);
    const shown = e => { if (e.closest('details:not([open])') && !e.closest('summary')) return false; for (let x = e; x && x !== document.documentElement; x = x.parentElement) { const s = cs(x); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity < .1) return false; } const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
    const name = e => (e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '')) + ' "' + ((e.innerText || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 28)) + '"';
    const list = [...document.querySelectorAll('#app a, #app button, #app input, #app select, #app [role=button]')].filter(shown).filter(e => !e.closest('.leaflet-container'));
    const res = [];
    for (const e of list) {
      e.scrollIntoView({ block: 'center', inline: 'nearest' }); await sleep(15);
      const r = e.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) continue;
      // test a few points inside the element: a button is only "covered" if none of them reaches it
      const pts = [[.5, .5], [.2, .5], [.8, .5]].map(([fx, fy]) => [Math.min(Math.max(r.left + r.width * fx, 1), innerWidth - 2), Math.min(Math.max(r.top + r.height * fy, 1), innerHeight - 2)]);
      let ok = false, by = null;
      for (const [x, y] of pts) { const h = document.elementFromPoint(x, y); if (!h) continue; if (h === e || e.contains(h) || h.contains(e) || (e.tagName === 'INPUT' && h.tagName === 'LABEL' && h.control === e)) { ok = true; break; } by = h; }
      if (!ok && by) { const c = by.closest('[id],[class]') || by; res.push(name(e) + ' <- ' + c.tagName.toLowerCase() + (c.id ? '#' + c.id : '') + '.' + String(typeof c.className === 'string' ? c.className : '').split(' ')[0]); }
    }
    scrollTo(0, 0); return res;
  });
}
(async () => {
  const gi = +(process.argv[2] || 0), gn = +(process.argv[3] || 1);
  const ovSrc = fs.readFileSync(__dirname + '/overlap.js', 'utf8'); const ovFn = ovSrc.slice(ovSrc.indexOf('function probe() {'), ovSrc.indexOf('(async () => {'));
  const found = new Map(); let screens = 0;
  for (let di = 0; di < DEV.length; di++) {
    if (di % gn !== gi) continue;
    const [dname, ctxOpts, lang] = DEV[di];
    if (process.env.DEVS && !process.env.DEVS.split(',').some(x => dname.includes(x))) continue; // e.g. DEVS='iPhone SE,landscape'
    for (const [role, list] of [[null, pub], ...Object.entries(roles)]) {
      const { b, p, errors } = await H.open({ ctxOpts, role, lang });
      await p.addInitScript(ovFn + ';window.__ovProbe = probe;');
      for (const r of list) {
        errors.length = 0;
        try { await p.goto(base + '#/' + r); await p.waitForTimeout(1300); } catch (e) { continue; }
        screens++;
        let res; try { res = await p.evaluate(probe); res.covered = await coveredCheck(p); } catch (e) { console.log('ERR', dname, role, r, e.message.slice(0, 120)); continue; }
        let ov = []; try { for (const k of [0, 1, 2]) { if (k) await p.evaluate(k => scrollTo(0, innerHeight * .8 * k), k), await p.waitForTimeout(400); const o = await p.evaluate(() => window.__ovProbe()); ov = ov.concat(o.probs.map(x => x.kind + ': ' + x.text + ' [' + x.textEl + ' / ' + x.visual + ']')); } await p.evaluate(() => scrollTo(0, 0)); } catch (e) {}
        const items = [];
        if (res.overflowX > 2) items.push('sideways-scroll ' + res.overflowX + 'px');
        res.off.forEach(x => items.push('off-screen: ' + x)); res.cut.forEach(x => items.push('text-cut: ' + x)); res.covered.forEach(x => items.push('covered: ' + x));
        res.small.forEach(x => items.push('small-target: ' + x)); [...new Set(ov)].forEach(x => items.push('overlap: ' + x)); errors.forEach(x => items.push('js: ' + x.slice(0, 140)));
        for (const it of items) { const key = (role || 'public') + ' #/' + r + ' | ' + it.replace(/\d+(\.\.\d+)?px|x=-?\d+\.\.-?\d+|\d+>\d+|\d+x\d+/g, '#');
          if (!found.has(key)) { found.set(key, { devs: [], ex: it }); const f = OUT + String(found.size).padStart(3, '0') + '_' + gi + '.jpg'; await p.screenshot({ path: f, type: 'jpeg', quality: 40 }).catch(() => {}); found.get(key).shot = f; }
          found.get(key).devs.push(dname); }
      }
      await b.close();
    }
    console.log('device done', dname, 'screens so far', screens);
  }
  const rows = [...found.entries()].map(([k, v]) => ({ key: k, n: v.devs.length, devs: [...new Set(v.devs)], ex: v.ex, shot: v.shot }));
  fs.writeFileSync(OUT + 'result_' + gi + '.json', JSON.stringify({ screens, rows }, null, 1));
  console.log('GROUP', gi, 'screens', screens, 'issues', rows.length);
})();
