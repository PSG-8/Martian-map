/* iLab@home motion layer.
   GSAP (vendored in /vendor, free standard licence) is loaded after the first screen is shown, so it never slows the first paint.
   Rules: content is never hidden before GSAP is ready; people who ask for less motion get none; phones get lighter moves. */
(function(){
'use strict';
const me = document.currentScript; const base = me.src.replace(/js\/motion\.js.*$/, ''); const VER = (me.src.match(/v=(\d+)/) || [])[1] || '1';
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
const SMALL = () => innerWidth < 760;
const BRAND = ['#1257d6', '#2f7bff', '#0fae9b', '#18b5d8', '#f2a516', '#ffffff'];
const load = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = base + src + '?v=' + VER; s.async = true; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
let G = null, gP = null, cP = null;
function gsapReady(){
  if (RM) return Promise.reject(new Error('reduced motion'));
  if (!gP) gP = load('vendor/gsap/gsap.min.js')
    .then(() => Promise.all(['ScrollTrigger', 'MotionPathPlugin', 'DrawSVGPlugin'].map(n => load('vendor/gsap/' + n + '.min.js'))))
    .then(() => { const g = window.gsap; g.registerPlugin(window.ScrollTrigger, window.MotionPathPlugin, window.DrawSVGPlugin); g.defaults({ ease: 'power3.out', duration: .6 }); window.ScrollTrigger.config({ ignoreMobileResize: true }); G = g; return g; })
    .catch(e => { gP = null; throw e; });
  return gP;
}
const confettiReady = () => cP || (cP = load('vendor/confetti/confetti.min.js').then(() => window.confetti));
const idle = window.requestIdleCallback || (f => setTimeout(f, 700));

/* what fades/rises in: cards and list rows of every screen */
const REVEAL = '.card:not(.flat):not(.report .card), .tcard, .pkg, .oitem, .kpi, .qa a, .feat, .step-c, .doc-card, .loyal, .why, .trend, .sec-in, [data-fx="rise"]';
const inView = el => { const r = el.getBoundingClientRect(); return r.top < innerHeight * .96 && r.bottom > 0; };

function counters(root){
  root.querySelectorAll('[data-count]:not([data-fxd])').forEach(el => {
    el.dataset.fxd = '1'; const end = parseFloat(el.dataset.count); if (!isFinite(end)) return;
    const dec = (el.dataset.count.split('.')[1] || '').length; const o = { v: 0 };
    const run = () => G.to(o, { v: end, duration: 1.1, ease: 'power2.out', onUpdate: () => { el.textContent = o.v.toFixed(dec); } });
    if (inView(el)) run(); else window.ScrollTrigger.create({ trigger: el, start: 'top 92%', once: true, onEnter: run });
  });
}
function draws(root){
  root.querySelectorAll('[data-draw]:not([data-fxd])').forEach(svg => {
    svg.dataset.fxd = '1'; const parts = svg.querySelectorAll('path,line,polyline,circle,rect,ellipse');
    G.fromTo(parts, { drawSVG: '0%' }, { drawSVG: '100%', duration: 1.4, stagger: .08, ease: 'power1.inOut', scrollTrigger: inView(svg) ? null : { trigger: svg, start: 'top 90%', once: true } });
  });
}
function bars(root){
  const marks = root.querySelectorAll('.rangebar i:not([data-fxd])'); if (!marks.length) return;
  marks.forEach(m => m.dataset.fxd = '1');
  G.from(marks, { left: '50%', opacity: 0, duration: .9, stagger: .05, ease: 'back.out(1.6)', delay: .2 });
  const bad = root.querySelectorAll('.flag.H:not(.mild), .flag.L:not(.mild), .flag.crit');
  if (bad.length) G.fromTo(bad, { scale: .6 }, { scale: 1, duration: .5, stagger: .06, ease: 'back.out(3)', delay: .5 });
}
function tilt(root){
  if (!FINE) return;
  root.querySelectorAll('[data-tilt]:not([data-fxd]), .pkg:not([data-fxd]), .doc-card:not([data-fxd])').forEach(el => {
    el.dataset.fxd = '1';
    el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      G.to(el, { rotateY: x * 7, rotateX: -y * 7, y: -4, transformPerspective: 800, duration: .4, ease: 'power2.out', overwrite: 'auto' }); });
    el.addEventListener('pointerleave', () => G.to(el, { rotateY: 0, rotateX: 0, y: 0, duration: .6, ease: 'elastic.out(1,.6)', overwrite: 'auto' }));
  });
}
function words(root){
  root.querySelectorAll('[data-split]:not([data-fxd])').forEach(h => {
    h.dataset.fxd = '1';
    /* words, not letters: Arabic letters must stay joined */
    const parts = []; h.childNodes.forEach(n => { if (n.nodeType === 3) n.textContent.split(/(\s+)/).forEach(w => parts.push(w.trim() ? `<span class="fx-w"><span>${w.replace(/</g, '&lt;')}</span></span>` : w)); else parts.push(n.outerHTML); });
    h.innerHTML = parts.join('');
    G.from(h.querySelectorAll('.fx-w > span'), { yPercent: 110, opacity: 0, duration: .7, stagger: .06, ease: 'power4.out' });
  });
}
function reveal(root, entrance){
  const els = Array.from(root.querySelectorAll(REVEAL)).filter(el => !el.dataset.fxd && !el.closest('.modal-bg, .drawer-bg, .no-fx')).slice(0, 80);
  if (!els.length) return;
  els.forEach(el => el.dataset.fxd = '1');
  const y = SMALL() ? 16 : 26;
  const now = els.filter(inView), later = els.filter(el => !inView(el));
  if (entrance && now.length) G.from(now, { y, opacity: 0, duration: .55, stagger: { each: .05, from: 'start' }, clearProps: 'transform,opacity' });
  if (later.length) {
    G.set(later, { y, opacity: 0 });
    window.ScrollTrigger.batch(later, { start: 'top 94%', once: true, onEnter: b => G.to(b, { y: 0, opacity: 1, duration: .6, stagger: .07, overwrite: true, clearProps: 'transform,opacity' }) });
  }
}

const FX = {
  ready: false,
  /* called after every screen render */
  scan(root){
    root = root || document;
    if (RM) return;
    const first = !G;
    const go = () => gsapReady().then(() => {
      FX.ready = true;
      try { window.ScrollTrigger.getAll().forEach(t => { if (!document.body.contains(t.trigger)) t.kill(); }); } catch(e) {}
      /* on the very first screen the content is already visible when GSAP arrives: only animate what is still below the fold */
      reveal(root, !first); counters(root); draws(root); bars(root); tilt(root); if (!first) words(root);
      window.ScrollTrigger.refresh();
    }).catch(() => {});
    /* first screen: wait until the browser is idle so GSAP never competes with the first paint */
    if (first) idle(go, { timeout: 1800 }); else go();
  },
  /* start fetching GSAP once the first screen is up */
  warm(){ if (!RM) idle(() => gsapReady().catch(() => {}), { timeout: 2500 }); },
  /* a small ball flies from the button to the cart icon */
  flyToCart(fromRect){
    if (RM || !G || !fromRect) return;
    const target = Array.from(document.querySelectorAll('a[href*="cart"]')).map(a => a.querySelector('svg') || a).find(a => { const r = a.getBoundingClientRect(); return r.width && r.top < innerHeight && r.bottom > 0; });
    if (!target) return;
    const t = target.getBoundingClientRect(); const dot = document.createElement('div'); dot.className = 'fx-fly';
    dot.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/></svg>';
    document.body.appendChild(dot);
    const x0 = fromRect.left + fromRect.width / 2 - 18, y0 = fromRect.top + fromRect.height / 2 - 18, x1 = t.left + t.width / 2 - 18, y1 = t.top + t.height / 2 - 18;
    G.set(dot, { x: x0, y: y0 });
    G.to(dot, { duration: .85, ease: 'power2.in', motionPath: { path: [{ x: x0, y: y0 }, { x: (x0 + x1) / 2, y: Math.min(y0, y1) - 140 }, { x: x1, y: y1 }], curviness: 1.4 }, scale: .55,
      onComplete: () => { dot.remove(); FX.bump(target.closest('a')); } });
  },
  bump(el){ if (!RM && G && el) G.fromTo(el, { scale: 1 }, { scale: 1.25, duration: .18, yoyo: true, repeat: 1, ease: 'power2.out' }); },
  /* celebration: 'big' after booking / healthy results, 'small' for a stamp */
  celebrate(kind){
    if (RM) return; try { navigator.vibrate && navigator.vibrate(kind === 'big' ? [18, 40, 18] : 12); } catch(e) {}
    confettiReady().then(c => {
      const o = { colors: BRAND, disableForReducedMotion: true, zIndex: 9999, ticks: 220 };
      if (kind === 'big') { c(Object.assign({ particleCount: 90, spread: 70, origin: { y: .65 } }, o));
        setTimeout(() => { c(Object.assign({ particleCount: 55, angle: 60, spread: 60, origin: { x: 0, y: .75 } }, o)); c(Object.assign({ particleCount: 55, angle: 120, spread: 60, origin: { x: 1, y: .75 } }, o)); }, 220); }
      else c(Object.assign({ particleCount: 40, spread: 55, scalar: .8, origin: { y: .7 } }, o));
    }).catch(() => {});
  },
  /* a stamp lands on the loyalty card */
  stamp(el){ if (RM || !G || !el) return; G.fromTo(el, { scale: 2.4, rotate: -25, opacity: 0 }, { scale: 1, rotate: -8, opacity: 1, duration: .55, ease: 'back.out(2.2)' }); },
  /* soft red pulse for results that need attention */
  alert(el){ if (RM || !G || !el) return; G.fromTo(el, { boxShadow: '0 0 0 0 rgba(220,38,38,.45)' }, { boxShadow: '0 0 0 14px rgba(220,38,38,0)', duration: 1.4, repeat: 2, ease: 'power1.out' }); },
  /* the van rides along the tracking line up to the current step */
  ride(svgEl, pct){
    if (RM || !G || !svgEl) return;
    const van = svgEl.querySelector('.fx-van'), path = svgEl.querySelector('.fx-road'); if (!van || !path) return;
    G.to(van, { duration: 2.2, ease: 'power2.inOut', motionPath: { path, align: path, alignOrigin: [.5, .8], autoRotate: false, start: 0, end: Math.max(.02, Math.min(1, pct)) } });
  },
  pop(el){ if (!RM && G && el) G.from(el, { scale: .4, opacity: 0, duration: .6, ease: 'back.out(2.4)' }); }
};
window.FX = FX;
/* printing or saving the page: show everything at once */
addEventListener('beforeprint', () => { if (G) G.set('[data-fxd]', { clearProps: 'opacity,transform' }); });
})();
