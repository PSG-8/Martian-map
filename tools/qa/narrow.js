// Which element is the first to stick out at a given width? (prints the outermost offenders per screen)
const H = require('./h.js');
const W = +(process.env.W || 300);
const UA = 'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36';
const list = process.argv.slice(2);
(async () => {
  const byRole = {}; for (const x of list) { const [r, h] = x.split(':'); (byRole[r] = byRole[r] || []).push(h || ''); }
  for (const [role, routes] of Object.entries(byRole)) {
    const { b, p } = await H.open({ ctxOpts: { viewport: { width: W, height: 650 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: UA }, role: role === 'public' ? null : role, lang: process.env.L || 'ar' });
    for (const r of routes) {
      await p.goto((process.env.QA_BASE || 'http://localhost:5055/') + '#/' + r); await p.waitForTimeout(1500);
      const res = await p.evaluate(() => {
        const W = document.documentElement.clientWidth; const out = [];
        const nm = e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).slice(0, 3).join('.') : '');
        const clipped = e => { for (let x = e.parentElement; x && x !== document.body; x = x.parentElement) { const s = getComputedStyle(x); if (/(hidden|clip|auto|scroll)/.test(s.overflowX)) return true; } return false; };
        for (const e of document.querySelectorAll('body *')) { const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue; const s = getComputedStyle(e); if (s.position === 'fixed' && e.closest('#bot')) continue;
          if ((r.right > W + 1 || r.left < -1) && !clipped(e)) { const pr = e.parentElement.getBoundingClientRect(); if (!(pr.right > W + 1 || pr.left < -1) || e.parentElement === document.body) out.push(nm(e) + ' [' + Math.round(r.left) + '..' + Math.round(r.right) + '] in ' + nm(e.parentElement) + ' w=' + Math.round(pr.width)); } }
        return { sw: document.documentElement.scrollWidth, W, out: out.slice(0, 6) };
      });
      console.log(role, '#/' + r, 'scrollWidth', res.sw, 'of', res.W); res.out.forEach(x => console.log('   ', x));
    }
    await b.close();
  }
})();
