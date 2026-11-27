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
/* v52: warm welcomes, funny reactions and "show me where" guides */
const X = {
  ar: { wel: ['حيّ الله من زارنا 🌸', 'يا هلا بالطش والرش 🌧️💙', 'يا مرحبا عدد ما هلّ المطر 🌧️', 'هلا وغلا، توّه ما نوّر البرنامج ✨', 'نوّرت آي لاب@هوم {n}🤍', 'مرحبا ملايين، حيّاك في بيتك الثاني 🏠', 'يا هلا بالزين 🌹', 'يا أهلاً وسهلاً، الدار دارك 💙', 'هلا والله! البرنامج صار أحلى بوجودك 🌟'],
    fun: [['لا تدغدغني! أنا في الدوام 😂', 'wiggle'], ['هوب! 🤸‍♀️ رياضة الصبح ولا بلاش', 'flip'], ['وابوي طحت! 🤕 … لا لا، أنا بخير 😅', 'fall'],
      ['واشيبي طحت، جاني دوار 😵‍💫 لحظة بس…', 'dizzy'], ['تبي سر؟ حتى أنا أخاف من الإبر… بس لا تقول لأحد 🤫', 'peek'], ['اشرب ماي! هذي نصيحتي ونصيحة حبوتي 💧😄', 'jump'],
      ['ما أقدر أوقف! فرحانة إنك هني 🎶💃', 'dance'], ['صحتك تاج على راسك، وأنت أدرى بقيمته 👑🤍', 'wave'], ['كل فحص تسويه خطوة لصحة أحسن، فخورة فيك 💪', 'jump'],
      ['تعرف؟ الممرض يجيك لين البيت، وعيّنتك تنحفظ مبرّدة لين المختبر 🧊', 'peek'], ['أنا أسرع من سيارة الإسعاف… تقريباً 🚑😄', 'flip'], ['أنت قدها، وإحنا معك خطوة بخطوة 🤍', 'wave'],
      ['تعرف؟ كل زيارة خامسة مجاناً مع بطاقة الأختام 🎁', 'jump'], ['اللي يهتم بصحته اليوم يرتاح بكرة 🌿', 'dance'], ['تعبك أجر ورفعة إن شاء الله، الله يشفي كل مريض 🤍', 'wave'],
      ['نصيحة: نام زين الليلة قبل الفحص، جسمك يشكرك 😴', 'peek'], ['تعرف؟ تقدر تكلم طبيب أو طبيبة أونلاين وأنت في بيتك 🩺', 'jump']],
    bye: 'أخدمك بشي، ولا أروح أكمل شغلي مع المستخدمين الثانيين؟ 🤍', byeYes: 'إيه، ساعديني', byeNo: 'روحي الله يحفظك 👋', byeOk: 'الله يحفظك ويعافيك، إذا احتجتني اضغط عليّ 🤍',
    g: { where: 'وريني وين', book: 'وين أحجز؟', res: 'وين نتايجي؟', doc: 'أكلم دكتور', help: 'أبي مساعدة', here: 'هني!', helpHere: 'خانة المساعدة تحت 👇 اضغطها والمساعد يرد عليك على طول', none: 'هالشي مب في هالصفحة، بوديك له 😉' } },
  en: { wel: ['Look who is here! Welcome 🌸', 'Welcome, welcome, a thousand times 🌧️💙', 'The app just got brighter ✨', 'Welcome to iLab@home {n}🤍', 'Hello and welcome, make yourself at home 🏠', 'So happy to see you 💙', 'Hey there! The app is better with you here 🌟'],
    fun: [['Hey, no tickling, I am on duty! 😂', 'wiggle'], ['Hop! 🤸‍♀️ morning exercise', 'flip'], ['Oops, I fell! 🤕 … no no, I am fine 😅', 'fall'],
      ['Whoa, I am dizzy 😵‍💫 one second…', 'dizzy'], ['Secret? Even I am a bit scared of needles… shh 🤫', 'peek'], ['Drink water! My advice and my grandma\'s 💧😄', 'jump'],
      ['I cannot stop, I am happy you are here 🎶💃', 'dance'], ['Your health is a crown, and you know its worth 👑🤍', 'wave'], ['Every test you do is a step to better health, proud of you 💪', 'jump'],
      ['Did you know? The nurse comes to your home and your sample stays cold all the way 🧊', 'peek'], ['I am faster than an ambulance… almost 🚑😄', 'flip'], ['You can do it, and we are with you every step 🤍', 'wave'],
      ['Did you know? Every 5th home visit is free with the stamp card 🎁', 'jump'], ['Caring for your health today means an easier tomorrow 🌿', 'dance'], ['Wishing every patient a quick recovery 🤍', 'wave'],
      ['Tip: sleep well the night before your test 😴', 'peek'], ['Did you know? You can talk to a doctor online from home 🩺', 'jump']],
    bye: 'Can I help you with anything, or shall I go back to helping other users? 🤍', byeYes: 'Yes, help me', byeNo: 'Go ahead, thank you 👋', byeOk: 'Take care! Tap me whenever you need me 🤍',
    g: { where: 'Show me', book: 'Where do I book?', res: 'My results?', doc: 'Talk to a doctor', help: 'I need help', here: 'Right here!', helpHere: 'The help button is down here 👇 tap it and the assistant replies right away', none: 'Not on this page, taking you there 😉' } }
};
const XL = () => X[st.lang] || X.en;
/* her way back: a little head peeking from the corner; tap it and Noor comes back (no refresh needed) */
let peek = null;
function peekShow(){ if (peek || !st.links) return; peek = document.createElement('button'); peek.className = 'ns-peek'; peek.type = 'button';
  peek.setAttribute('aria-label', st.lang === 'ar' ? 'رجّعي نور' : 'Bring Noor back');
  peek.innerHTML = `<span class="np-head">${SVG.replace('viewBox="0 0 120 172"', 'viewBox="22 22 76 78"').replace(/id="ns/g, 'id="np').replace(/url\(#ns/g, 'url(#np')}</span><span class="np-say">${st.lang === 'ar' ? 'أرجع لك؟ 👋' : 'Shall I come back? 👋'}</span>`;
  peek.onclick = () => { try { sessionStorage.removeItem('lah_noor'); } catch(e) {} peekHide(); if (window.LAHMascot) LAHMascot.show({ lang: st.lang, user: st.user, links: st.links }); };
  document.body.appendChild(peek); requestAnimationFrame(() => peek && peek.classList.add('on')); }
function peekHide(){ if (peek) { peek.remove(); peek = null; } }
const pick = a => a[Math.floor(Math.random() * a.length)];
const GUIDE = { book: ['.qt[href*="tests"]', 'a[href="#/app/tests"]', 'a[href="#/tests"]', '[data-go="app/tests"]', '[data-go="tests"]'],
  res: ['.tabbar a[href*="orders"]', 'a[href*="app/orders"]', '.qt[href*="orders"]'], doc: ['.qt[href*="consult"]', 'a[href*="consult"]'], help: ['#bot .bot-fab'] };
const GO = { book: () => st.links.book, res: () => (st.user ? 'app/orders?r=1' : 'login'), doc: () => st.links.doc, help: () => 'support' };
function spot(kind){
  const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('#nurse'); };
  let t = null; for (const sel of GUIDE[kind] || []) { t = [...document.querySelectorAll(sel)].find(vis); if (t) break; }
  if (kind === 'help' && t) { t.classList.remove('ns-spot'); void t.offsetWidth; t.classList.add('ns-spot'); later(() => t.classList.remove('ns-spot'), 3200); bub.innerHTML = bubHtml(XL().g.helpHere); cls('pointdown', 1600); hearts(4); return; }
  if (!t) { bub.innerHTML = bubHtml(XL().g.none); later(() => { location.hash = '#/' + GO[kind](); }, 900); return; }
  t.scrollIntoView({ block: 'center', behavior: RM ? 'auto' : 'smooth' });
  later(() => { t.classList.remove('ns-spot'); void t.offsetWidth; t.classList.add('ns-spot'); later(() => t.classList.remove('ns-spot'), 2600); }, RM ? 0 : 450);
  later(() => { if (!el || !bub) return; const up = t.getBoundingClientRect().top < el.getBoundingClientRect().top; bub.innerHTML = bubHtml(XL().g.here + (up ? ' 👆' : ' 👇')); }, RM ? 0 : 500); cls('point', 1200);
}
function hearts(n){ if (RM || !el) return; for (let i = 0; i < (n || 8); i++) { const h = document.createElement('span'); h.className = 'ns-heart'; h.textContent = pick(['🤍', '💙', '💚', '💜', '❤️', '✨', '🩷']); h.style.setProperty('--dx', (Math.random() * 60 - 30).toFixed(0) + 'px'); h.style.animationDelay = (i * 90) + 'ms'; h.style.fontSize = (14 + Math.random() * 10).toFixed(0) + 'px'; el.appendChild(h); later(() => h.remove(), 1700); } }
let funI = -1;
function funny(){ const l = XL(); funI = (funI + 1) % l.fun.length; const [line, move] = l.fun[funI];
  const ms = { flip: 1100, fall: 2200, dizzy: 1800, dance: 2200, wiggle: 900, peek: 1400, jump: 650, wave: 1700 }[move] || 1000;
  cls(move, ms); hearts(move === 'dance' || move === 'flip' ? 10 : 6);
  bub.innerHTML = bubHtml(line, guideChips()); bub.classList.add('on'); }
function askBye(){ if (!bub) return; const l = XL(); st.asked = true;
  bub.innerHTML = bubHtml(l.bye, `<button data-nsb="yes">${l.byeYes}</button><button data-nsb="no">${l.byeNo}</button>`); bub.classList.add('on'); wave(); }
function guideChips(){ const g = XL().g; return `<button data-nsg="book">${g.book}</button><button data-nsg="res">${g.res}</button><button data-nsg="doc">${g.doc}</button><button data-nsg="help">${g.help}</button>`; }
function idle(){ if (!el || el.style.display === 'none' || !el.classList.contains('in') || document.hidden) return later(idle, 30000);
  if (!bub.classList.contains('on') && !RM) cls(pick(['wave', 'wiggle', 'jump', 'peek']), 1400);
  later(idle, 25000 + Math.random() * 20000); }
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
  /* v42: at the bottom of the page Noor steps aside, so she never stands on the footer links (tablets, open Fold, laptops) */
  let ft = 0; addEventListener('scroll', () => { if (ft) return; ft = requestAnimationFrame(() => { ft = 0; if (!el) return; const f = document.querySelector('footer.site'); const away = !!(f && f.getBoundingClientRect().top < innerHeight - 30); el.classList.toggle('away', away); if (away && bub) bub.classList.remove('on'); }); }, { passive: true });
  const tap = e => { if (e.target.closest('.ns-bub')) return; e.preventDefault(); if (bub.classList.contains('on')) funny(); else { jump(); say(true); } };
  el.querySelector('.ns-body').addEventListener('click', tap);
  el.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === el) { e.preventDefault(); jump(); say(true); } });
  bub.addEventListener('click', e => { const x = e.target.closest('[data-nsx]'); if (x) { e.preventDefault(); if (!st.asked) askBye(); else hideBub(); return; }
    const by = e.target.closest('[data-nsb]'); if (by) { e.preventDefault(); if (by.dataset.nsb === 'yes') { bub.innerHTML = bubHtml(XL().g.where + ' 👀', guideChips()); hearts(5); } else { bub.innerHTML = bubHtml(XL().byeOk); hearts(10); wave(); later(hideBub, 1800); } return; } const m = e.target.closest('[data-nsm]'); if (m) { e.preventDefault(); tipNext(); return; } const g = e.target.closest('[data-nsg]'); if (g) { e.preventDefault(); if (g.dataset.nsg === 'where') { bub.innerHTML = bubHtml(XL().g.where + ' 👀', guideChips()); } else spot(g.dataset.nsg); return; } if (e.target.closest('a')) hideBub(); });
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
function say(full){ st.asked = false;
  const l = L(), k = st.links; const name = st.user && st.user.full_name ? esc(st.user.full_name.split(' ')[0]) : '';
  const wel = pick(XL().wel).replace('{n}', name ? (st.lang === 'ar' ? 'يا ' + name + ' ' : name + ' ') : '');
  const head = `<b>${greetWord()}${name ? (st.lang === 'ar' ? ' يا ' : ', ') + name : ''}!</b> ${wel}<br>${l.me} ${l.ask}`;
  const small = !FINE || innerWidth < 900;
  const chips = `<a href="#/${k.book}">${l.book}</a><a href="#/${k.kit}">${l.kit}</a><a href="#/${k.doc}">${l.doc}</a>${small ? '' : `<a href="#/new">${l.news}</a>`}<button data-nsm>${l.more}</button><button data-nsg="where">${XL().g.where} 👀</button>`;
  bub.innerHTML = bubHtml(head, full ? chips : ''); hearts(); bub.classList.add('on'); wave();
}
function tipNext(){ const l = L(); st.tip = (st.tip + 1) % l.tips.length; bub.innerHTML = bubHtml(`<span class="ns-tip">💡</span> ${l.tips[st.tip]}`, `<button data-nsm>${l.more}</button><a href="#/${st.links.book}">${l.book}</a>`); bub.classList.add('on'); }
function hideBub(){ if (bub) bub.classList.remove('on'); if (!FINE || innerWidth < 900) leave(); }
function leave(){ if (!el) return; clearT(); later(peekShow, 1600); el.classList.remove('in'); el.classList.add('walk', 'out'); later(() => { if (el) { el.classList.remove('walk'); el.style.display = 'none'; } }, 1500); try { sessionStorage.setItem('lah_noor', 'bye'); } catch(e) {} }
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
    if (bye === 'bye' && small) { this.hide(); peekShow(); return; }
    peekHide();
    if (!el) build(); clearT(); el.style.display = ''; el.classList.toggle('rtl', st.lang === 'ar'); place();
    if (el.classList.contains('in')) { if (bub.classList.contains('on')) say(true); return; }
    el.classList.remove('out', 'in'); bub.classList.remove('on');
    const first = bye !== 'seen';
    try { if (!bye) sessionStorage.setItem('lah_noor', 'seen'); } catch(e) {}
    if (RM) { el.classList.add('in'); if (first) say(true); return; }
    // v34: Noor never stands on top of the home banner: she walks in once the banner has scrolled out from under her
    const clear = () => { const h = document.querySelector('.h3'); if (!h || !h.isConnected) return true; return h.getBoundingClientRect().bottom < innerHeight - (small ? 250 : 300); };
    const enter = () => { if (!el || el.style.display === 'none') return;
      el.classList.add('walk', 'in'); later(() => { el.classList.remove('walk'); if (first) say(true); else wave(); blink(); }, 1450); later(idle, 20000);
      if (first) later(() => { if (el && bub && bub.classList.contains('on') && !el.matches(':hover')) { askBye(); later(() => { if (bub && bub.classList.contains('on') && el && !el.matches(':hover')) { if (small) hideBub(); else bub.classList.remove('on'); } }, 9000); } }, small ? 9000 : 14000); };
    if (st.wait) { removeEventListener('scroll', st.wait); st.wait = null; }
    if (clear()) later(enter, first ? 1600 : 500);
    else { st.wait = () => { if (!el || el.style.display === 'none') { removeEventListener('scroll', st.wait); st.wait = null; return; } if (clear()) { removeEventListener('scroll', st.wait); st.wait = null; later(enter, 250); } }; addEventListener('scroll', st.wait, { passive: true }); }
  },
  hide(){ peekHide(); clearT(); if (st.wait) { removeEventListener('scroll', st.wait); st.wait = null; } if (el) { el.classList.remove('in', 'walk'); el.style.display = 'none'; if (bub) bub.classList.remove('on'); } },
  cheer(){ if (!el || el.style.display === 'none' || !el.classList.contains('in')) return; jump(); bub.innerHTML = bubHtml(L().cheer, `<a href="#/${st.links.cart || 'app/cart'}">🛒</a>`); bub.classList.add('on'); later(() => bub && bub.classList.remove('on'), 3200); },
  place
};
})();
