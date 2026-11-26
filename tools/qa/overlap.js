// Finds text that sits on top of pictures, characters, animations, canvases or other text, on every screen,
// phone + desktop, Arabic + English. Checks several moments (animations move). Screenshots each problem.
const H = require('./h.js'); const fs = require('fs'); const base = (process.env.QA_BASE || 'http://localhost:5055/');
const OUT = require('path').join(__dirname, 'out', 'overlap') + '/'; fs.mkdirSync(OUT, { recursive: true });
const src = fs.readFileSync(__dirname + '/sweep.js', 'utf8');
const pub = eval(src.match(/const pub = (\[[^\]]*\])/)[1]);
const roles = eval('(' + src.match(/const roles = (\{.*\});/)[1] + ')');
const only = process.argv[2]; // optional role filter
function probe() {
  const cs = e => getComputedStyle(e);
  const vis = e => { const s = cs(e); if (s.visibility === 'hidden' || s.display === 'none') return false; if (e.closest('details:not([open])') && !e.closest('summary')) return false; return true; };
  const opaque = e => { let x = e; while (x && x !== document.documentElement) { const s = cs(x); if (+s.opacity < .15 || s.visibility === 'hidden') return false; x = x.parentElement; } return true; };
  const fixedRoot = e => { let x = e; while (x && x !== document.body) { const p = cs(x).position; if (p === 'fixed' || p === 'sticky') return x; x = x.parentElement; } return null; };
  // rectangle actually visible: clipped by every ancestor that hides overflow, and by the window
  const clip = (e, r) => { let L = Math.max(r.left, 0), T = Math.max(r.top, 0), R = Math.min(r.right, innerWidth), B = Math.min(r.bottom, innerHeight); let x = e.parentElement;
    while (x && x !== document.body) { const s = cs(x); if (s.overflow !== 'visible' || s.overflowX !== 'visible' || s.overflowY !== 'visible' || s.clipPath !== 'none') { const q = x.getBoundingClientRect(); L = Math.max(L, q.left); T = Math.max(T, q.top); R = Math.min(R, q.right); B = Math.min(B, q.bottom); } if (s.position === 'fixed') break; x = x.parentElement; }
    return R - L > 2 && B - T > 2 ? { left: L, top: T, right: R, bottom: B, width: R - L, height: B - T } : null; };
  const texts = []; const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (tw.nextNode()) { const n = tw.currentNode; const tx = n.textContent.trim(); if (tx.length < 2) continue; const p = n.parentElement; if (!p || p.closest('svg,script,style,noscript,.leaflet-container,.sr-only,[aria-hidden=true]')) continue; if (!vis(p) || !opaque(p)) continue;
    const rg = document.createRange(); rg.selectNodeContents(n); for (const r0 of rg.getClientRects()) { if (r0.width < 4 || r0.height < 6) continue; const r = clip(p, r0); if (r) texts.push({ el: p, r, fx: fixedRoot(p) }); } }
  const visuals = [...document.querySelectorAll('img,svg,canvas,video,.leaflet-container')].filter(e => { if (e.closest('.leaflet-container') && !e.classList.contains('leaflet-container')) return false; if (e.tagName === 'svg' && e.parentElement && e.parentElement.closest('svg')) return false; if (!vis(e) || !opaque(e)) return false; const r0 = e.getBoundingClientRect(); if (r0.width < 56 || r0.height < 56) return false; return !!clip(e, r0); }).map(e => ({ el: e, r: clip(e, e.getBoundingClientRect()), fx: fixedRoot(e) }));
  const inter = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const name = e => (e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : (e.className && e.className.baseVal ? '.' + e.className.baseVal.split(' ')[0] : '')));
  // is A really drawn over B at this point, or is one of them hidden behind an opaque layer?
  const bothShow = (a, b, x, y) => { const st = document.elementsFromPoint(x, y); const ia = st.findIndex(z => z === a || a.contains(z) || z.contains(a)); const ib = st.findIndex(z => z === b || b.contains(z) || z.contains(b)); if (ia < 0 || ib < 0) return false;
    const [hi, lo] = ia < ib ? [ia, ib] : [ib, ia]; for (let k = hi + 1; k < lo; k++) { const z = st[k]; const s = cs(z); const bg = s.backgroundColor; if ((bg && !/rgba\(.*, 0\)|transparent/.test(bg) && !/rgba\([^)]*,\s*0?\.[0-4]\d*\)/.test(bg)) || s.backgroundImage !== 'none') return false; } return true; };
  const probs = [];
  for (const t of texts) {
    const ta = t.r.width * t.r.height;
    for (const v of visuals) {
      if (v.el.contains(t.el) || t.el.contains(v.el)) continue;
      if (!!t.fx !== !!v.fx) continue; // fixed bars/menus pass over scrolling content by design
      const a = inter(t.r, v.r); if (a < ta * .2) continue;
      const vr = v.r; if (vr.width >= innerWidth * .9 && vr.height >= 200) continue; // full-width backdrop under a hero
      const cx = (Math.max(t.r.left, vr.left) + Math.min(t.r.right, vr.right)) / 2, cy = (Math.max(t.r.top, vr.top) + Math.min(t.r.bottom, vr.bottom)) / 2;
      if (!bothShow(t.el, v.el, cx, cy)) continue;
      probs.push({ kind: 'text-on-visual', text: t.el.textContent.trim().slice(0, 40), textEl: name(t.el), visual: name(v.el), cover: Math.round(a / ta * 100), at: [Math.round(t.r.left), Math.round(t.r.top)] });
      break;
    }
  }
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    const A = texts[i], B = texts[j]; if (A.el === B.el || A.el.contains(B.el) || B.el.contains(A.el)) continue;
    if (!!A.fx !== !!B.fx) continue;
    const a = inter(A.r, B.r); if (a < Math.min(A.r.width * A.r.height, B.r.width * B.r.height) * .3) continue;
    const cx = (Math.max(A.r.left, B.r.left) + Math.min(A.r.right, B.r.right)) / 2, cy = (Math.max(A.r.top, B.r.top) + Math.min(A.r.bottom, B.r.bottom)) / 2;
    if (!bothShow(A.el, B.el, cx, cy)) continue;
    probs.push({ kind: 'text-on-text', text: A.el.textContent.trim().slice(0, 30) + ' ⟂ ' + B.el.textContent.trim().slice(0, 30), textEl: name(A.el), visual: name(B.el), at: [Math.round(A.r.left), Math.round(A.r.top)] });
  }
  return { probs, overflowX: document.documentElement.scrollWidth - innerWidth };
}
(async () => {
  const seen = new Map(); let n = 0;
  for (const desktop of [false, true]) for (const lang of ['ar', 'en']) {
    for (const [role, list] of [[null, pub], ...Object.entries(roles)]) {
      if (only && (role || 'public') !== only) continue;
      const { b, p } = await H.open({ desktop, role, lang });
      for (const r of list) {
        await p.goto(base + '#/' + r);
        for (const [wait, scrolls] of [[1200, 0], [2200, 1], [1500, 2], [1500, 3]]) {
          await p.waitForTimeout(wait);
          if (scrolls) await p.evaluate(k => scrollTo(0, innerHeight * .85 * k), scrolls), await p.waitForTimeout(700);
          const res = await p.evaluate(probe);
          if (res.overflowX > 2) res.probs.push({ kind: 'sideways-scroll', text: res.overflowX + 'px', textEl: '', visual: '' });
          for (const x of res.probs) { const key = (desktop ? 'D' : 'M') + lang + '|' + (role || 'public') + '|' + r + '|' + x.kind + '|' + x.text;
            if (seen.has(key)) continue; seen.set(key, 1); n++;
            const file = OUT + String(n).padStart(3, '0') + '.jpg'; await p.screenshot({ path: file, type: 'jpeg', quality: 50 });
            console.log(String(n).padStart(3, '0'), desktop ? 'D' : 'M', lang, role || 'public', r, 'scroll' + scrolls, x.kind, JSON.stringify(x)); }
          const [h, ih] = await p.evaluate(() => [document.documentElement.scrollHeight - innerHeight, innerHeight]); if (ih * .85 * (scrolls + 1) > h) break;
        }
      }
      await b.close();
    }
  }
  console.log('TOTAL', n);
})();
