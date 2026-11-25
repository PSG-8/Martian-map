/* iLab@home guide: Noor, a small nurse who walks in on the home screen, waves, looks at your pointer and helps.
   Pure SVG + CSS (no 3D library): walking and jumping move the whole figure with transforms only, and every small
   animation (wave, blink, steps) runs for a moment and then stops, so she costs nothing while you read.
   Women in full, loosely draped hijab; never a kumma with the nurse uniform. */
(function(){
'use strict';
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
const T = {
  en: { m: 'Good morning', e: 'Good evening', h: 'Hello', me: "I'm Noor, the iLab@home nurse.", ask: 'How can I help you today?', book: 'Book a test', kit: 'Self-kit', doc: 'Talk to a doctor', news: "What's new", close: 'Close', cheer: 'Great choice! It is in your cart.',
    tips: ['Drink water before a blood test: it makes the draw easier.', 'Fasting sugar and cholesterol tests need 8–12 hours without food. Water is fine.', 'Your sample travels in a 2–8 °C cold box all the way to the lab.', 'Every 5th home visit is free with the stamp card.', 'Results come to your phone with clear advice and a PDF.'], more: 'Another tip', hi: 'Hi' },
  ar: { m: 'صباح الخير', e: 'مساء الخير', h: 'أهلاً', me: 'أنا نور، ممرضة آي لاب@هوم.', ask: 'كيف أقدر أساعدك اليوم؟', book: 'احجز فحص', kit: 'عُدّة ذاتية', doc: 'كلّم طبيب', news: 'الجديد', close: 'إغلاق', cheer: 'اختيار موفّق! صار في سلتك.',
    tips: ['اشرب ماي قبل سحب الدم، يسهّل السحب.', 'فحص السكر الصائم والدهون يحتاج صيام 8 إلى 12 ساعة، والماي مسموح.', 'عينتك تنتقل في صندوق تبريد ٢–٨ °م لين المختبر.', 'كل زيارة خامسة مجاناً مع بطاقة الأختام.', 'نتائجك توصل جوالك مع نصائح واضحة وملف PDF.'], more: 'نصيحة ثانية', hi: 'هلا' }
};
const SVG = `<svg class="ns-svg" viewBox="0 0 120 172" aria-hidden="true">
<defs>
 <radialGradient id="nsHj" cx="38%" cy="28%" r="80%"><stop offset="0" stop-color="#5677b6"/><stop offset=".55" stop-color="#2f4d82"/><stop offset="1" stop-color="#1b3260"/></radialGradient>
 <linearGradient id="nsSc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#43d3c0"/><stop offset="1" stop-color="#0a8a7a"/></linearGradient>
 <radialGradient id="nsSk" cx="40%" cy="35%" r="72%"><stop offset="0" stop-color="#f7d3b5"/><stop offset="1" stop-color="#dda27b"/></radialGradient>
 <linearGradient id="nsPt" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1d3d7a"/><stop offset="1" stop-color="#12285a"/></linearGradient>
</defs>
<ellipse class="ns-sh" cx="60" cy="166" rx="30" ry="5" fill="#0b2350" opacity=".18"/>
<g class="ns-fig">
 <g class="ns-ll"><rect x="46" y="122" width="12" height="40" rx="6" fill="url(#nsPt)"/><ellipse cx="51" cy="162.5" rx="9.5" ry="4.6" fill="#f4f6fa" stroke="#cbd5e1"/></g>
 <g class="ns-lr"><rect x="62" y="122" width="12" height="40" rx="6" fill="url(#nsPt)"/><ellipse cx="69" cy="162.5" rx="9.5" ry="4.6" fill="#f4f6fa" stroke="#cbd5e1"/></g>
 <path d="M33 130 Q31 94 44 86 L76 86 Q89 94 87 130 Q60 137 33 130Z" fill="url(#nsSc)"/>
 <path d="M40 104 h40" stroke="#0a8a7a" stroke-width="1.4" opacity=".35"/>
 <g class="ns-al"><rect x="27" y="90" width="11" height="34" rx="5.5" fill="url(#nsSc)" transform="rotate(12 32 92)"/><circle cx="26.5" cy="123" r="5.6" fill="url(#nsSk)"/>
  <g class="ns-box"><rect x="13" y="114" width="25" height="19" rx="4" fill="#fff" stroke="#c9d6ea"/><rect x="13" y="114" width="25" height="5.5" rx="2.5" fill="#1257d6"/><path d="M25.5 122.5v7M22 126h7" stroke="#e2474f" stroke-width="2.2" stroke-linecap="round"/></g></g>
 <g class="ns-ar"><rect x="82" y="90" width="11" height="34" rx="5.5" fill="url(#nsSc)" transform="rotate(-10 88 92)"/><circle cx="92.5" cy="123" r="5.6" fill="url(#nsSk)"/></g>
 <g class="ns-head">
  <path d="M29 94 Q25 50 60 28 Q95 50 91 94 Q77 106 60 107 Q43 106 29 94Z" fill="url(#nsHj)"/>
  <ellipse cx="60" cy="58" rx="27.5" ry="29.5" fill="url(#nsHj)"/>
  <ellipse cx="60" cy="63" rx="17.5" ry="20" fill="url(#nsSk)"/>
  <path d="M41.5 58 Q60 35 78.5 58" stroke="#1b3260" stroke-width="3.6" fill="none" stroke-linecap="round"/>
  <g class="ns-eyes"><ellipse cx="53" cy="63" rx="2.7" ry="3.4" fill="#1d2433"/><ellipse cx="67" cy="63" rx="2.7" ry="3.4" fill="#1d2433"/><circle cx="54" cy="61.8" r=".95" fill="#fff"/><circle cx="68" cy="61.8" r=".95" fill="#fff"/></g>
  <circle cx="48" cy="70" r="3.6" fill="#f08a8a" opacity=".3"/><circle cx="72" cy="70" r="3.6" fill="#f08a8a" opacity=".3"/>
  <path class="ns-mouth" d="M55 72 Q60 76.5 65 72" stroke="#8a3f33" stroke-width="2" fill="none" stroke-linecap="round"/>
  <ellipse cx="46" cy="42" rx="9" ry="4" fill="#fff" opacity=".16" transform="rotate(-28 46 42)"/>
 </g>
 <path d="M49 100 Q47 113 56.5 117 Q66 113 64 100" stroke="#1f2633" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="56.5" cy="118.5" r="3.2" fill="#d9e0ea" stroke="#1f2633" stroke-width="1.4"/>
 <rect x="68" y="106" width="11" height="8" rx="1.6" fill="#fff"/><path d="M73.5 107.6v4.8M71.1 110h4.8" stroke="#0fae9b" stroke-width="1.5"/>
</g></svg>`;

let el = null, bub = null, st = { lang: 'ar', user: null, links: {}, shown: false, tip: -1, timers: [] }, raf = 0, aimX = 0, aimY = 0;
const L = () => T[st.lang] || T.en;
const later = (f, ms) => { const id = setTimeout(f, ms); st.timers.push(id); return id; };
const clearT = () => { st.timers.forEach(clearTimeout); st.timers = []; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function greetWord(){ let h = new Date().getUTCHours() + 4; h %= 24; return h >= 4 && h < 12 ? L().m : h >= 16 || h < 4 ? L().e : L().h; }
function build(){
  el = document.createElement('div'); el.id = 'nurse'; el.setAttribute('role', 'button'); el.setAttribute('tabindex', '0'); el.setAttribute('aria-label', st.lang === 'ar' ? 'نور، ممرضة آي لاب@هوم' : 'Noor, the iLab@home nurse');
  el.innerHTML = `<div class="ns-bub" role="status" aria-live="polite"></div><div class="ns-body">${SVG}</div>`;
  document.body.appendChild(el); bub = el.querySelector('.ns-bub');
  const tap = e => { if (e.target.closest('.ns-bub')) return; e.preventDefault(); jump(); if (bub.classList.contains('on')) tipNext(); else say(true); };
  el.querySelector('.ns-body').addEventListener('click', tap);
  el.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === el) { e.preventDefault(); jump(); say(true); } });
  bub.addEventListener('click', e => { const x = e.target.closest('[data-nsx]'); if (x) { e.preventDefault(); hideBub(); return; } const m = e.target.closest('[data-nsm]'); if (m) { e.preventDefault(); tipNext(); return; } if (e.target.closest('a')) hideBub(); });
  if (FINE) addEventListener('pointermove', look, { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearT(); });
}
function look(e){ if (!el || !el.classList.contains('in') || RM) return; aimX = e.clientX; aimY = e.clientY; if (raf) return;
  raf = requestAnimationFrame(() => { raf = 0; const r = el.getBoundingClientRect(); const dx = aimX - (r.left + r.width / 2), dy = aimY - (r.top + r.height * .3); const d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, 520 / d); const hx = Math.max(-1, Math.min(1, dx / 260)) * k, hy = Math.max(-1, Math.min(1, dy / 260)) * k;
    el.style.setProperty('--hx', hx.toFixed(3)); el.style.setProperty('--hy', hy.toFixed(3));
    if (d < 150 && !el._waved) { el._waved = true; wave(); later(() => { el._waved = false; }, 6000); } }); }
function cls(c, ms){ if (!el || RM) return; el.classList.remove(c); void el.offsetWidth; el.classList.add(c); later(() => el && el.classList.remove(c), ms); }
const wave = () => cls('wave', 1700), jump = () => cls('jump', 650), blink = () => { cls('blink', 160); later(blink, 3200 + Math.random() * 3000); };
function bubHtml(inner, chips){ return `<button class="ns-x" data-nsx aria-label="${L().close}">×</button><div class="ns-t">${inner}</div>${chips ? `<div class="ns-chips">${chips}</div>` : ''}`; }
function say(full){
  const l = L(), k = st.links; const name = st.user && st.user.full_name ? esc(st.user.full_name.split(' ')[0]) : '';
  const head = `<b>${greetWord()}${name ? (st.lang === 'ar' ? ' يا ' : ', ') + name : ''}!</b> ${l.me}<br>${l.ask}`;
  const small = !FINE || innerWidth < 900;
  const chips = `<a href="#/${k.book}">${l.book}</a><a href="#/${k.kit}">${l.kit}</a><a href="#/${k.doc}">${l.doc}</a>${small ? '' : `<a href="#/new">${l.news}</a>`}<button data-nsm>${l.more}</button>`;
  bub.innerHTML = bubHtml(head, full ? chips : ''); bub.classList.add('on'); wave();
}
function tipNext(){ const l = L(); st.tip = (st.tip + 1) % l.tips.length; bub.innerHTML = bubHtml(`<span class="ns-tip">💡</span> ${l.tips[st.tip]}`, `<button data-nsm>${l.more}</button><a href="#/${st.links.book}">${l.book}</a>`); bub.classList.add('on'); }
function hideBub(){ if (bub) bub.classList.remove('on'); if (!FINE || innerWidth < 900) leave(); }
function leave(){ if (!el) return; clearT(); el.classList.remove('in'); el.classList.add('walk', 'out'); later(() => { if (el) { el.classList.remove('walk'); el.style.display = 'none'; } }, 1500); try { sessionStorage.setItem('lah_noor', 'bye'); } catch(e) {} }
function place(){ if (!el) return; const tab = document.querySelector('.tabbar'); const cart = document.querySelector('.cart-bar');
  const vis = x => { if (!x) return 0; const r = x.getBoundingClientRect(); return r.height > 0 && r.top < innerHeight && getComputedStyle(x).display !== 'none' ? r.height : 0; };
  let b = 14; const th = vis(tab), ch = vis(cart); if (th) b = th + 10; if (ch) b += ch + 8;
  el.style.bottom = `calc(${b}px + env(safe-area-inset-bottom, 0px))`;
  // v34: in the app on a computer, stand beside the side bar, never on top of its account block
  const nav = document.querySelector('.side-nav'); const nr = nav && getComputedStyle(nav).display !== 'none' ? nav.getBoundingClientRect() : null;
  el.style.insetInlineStart = nr && nr.width > 0 ? `${Math.round(nr.width) + 18}px` : ''; el.classList.toggle('beside', !!(nr && nr.width > 0)); }

window.LAHMascot = {
  /* o: { lang, user, links:{book,kit,doc} } */
  show(o){
    st.lang = o.lang === 'en' ? 'en' : 'ar'; st.user = o.user || null; st.links = o.links || { book: 'tests', kit: 'tests?c=selfkit', doc: 'consult' };
    let bye = null; try { bye = sessionStorage.getItem('lah_noor'); } catch(e) {}
    const small = !FINE || innerWidth < 900;
    if (bye === 'bye' && small) { this.hide(); return; }
    if (!el) build(); clearT(); el.style.display = ''; el.classList.toggle('rtl', st.lang === 'ar'); place();
    if (el.classList.contains('in')) { if (bub.classList.contains('on')) say(true); return; }
    el.classList.remove('out', 'in'); bub.classList.remove('on');
    const first = bye !== 'seen';
    try { if (!bye) sessionStorage.setItem('lah_noor', 'seen'); } catch(e) {}
    if (RM) { el.classList.add('in'); if (first) say(true); return; }
    // v34: Noor never stands on top of the home banner: she walks in once the banner has scrolled out from under her
    const clear = () => { const h = document.querySelector('.h3'); if (!h || !h.isConnected) return true; return h.getBoundingClientRect().bottom < innerHeight - (small ? 250 : 300); };
    const enter = () => { if (!el || el.style.display === 'none') return;
      el.classList.add('walk', 'in'); later(() => { el.classList.remove('walk'); if (first) say(true); else wave(); blink(); }, 1450);
      if (first) later(() => { if (el && bub && bub.classList.contains('on') && !el.matches(':hover')) { if (small) hideBub(); else bub.classList.remove('on'); } }, small ? 9000 : 14000); };
    if (st.wait) { removeEventListener('scroll', st.wait); st.wait = null; }
    if (clear()) later(enter, first ? 1600 : 500);
    else { st.wait = () => { if (!el || el.style.display === 'none') { removeEventListener('scroll', st.wait); st.wait = null; return; } if (clear()) { removeEventListener('scroll', st.wait); st.wait = null; later(enter, 250); } }; addEventListener('scroll', st.wait, { passive: true }); }
  },
  hide(){ clearT(); if (st.wait) { removeEventListener('scroll', st.wait); st.wait = null; } if (el) { el.classList.remove('in', 'walk'); el.style.display = 'none'; if (bub) bub.classList.remove('on'); } },
  cheer(){ if (!el || el.style.display === 'none' || !el.classList.contains('in')) return; jump(); bub.innerHTML = bubHtml(L().cheer, `<a href="#/${st.links.cart || 'app/cart'}">🛒</a>`); bub.classList.add('on'); later(() => bub && bub.classList.remove('on'), 3200); },
  place
};
})();
