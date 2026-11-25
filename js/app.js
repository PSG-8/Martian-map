/* iLab@home – single-page app (vanilla JS, no build step) */
(function(){
'use strict';
const A = window.ART, ic = A.icon;
const $ = (s, el) => (el||document).querySelector(s);
const $$ = (s, el) => Array.from((el||document).querySelectorAll(s));
const app = document.getElementById('app');
const STATUS = ['booked','assigned','on_the_way','arrived','collected','in_transit','at_lab','processing','completed'];
const ACTIVE = s => !['completed','cancelled'].includes(s);
const S = {
  lang: localStorage.getItem('lah_lang') || ((navigator.language||'').startsWith('ar') ? 'ar' : 'en'),
  user: null, unread: 0, catalog: null, timers: [], installEvt: null,
  cart: JSON.parse(localStorage.getItem('lah_cart') || '{"packages":[],"tests":[]}'),
  bk: null
};

/* ---------- helpers ---------- */
function t(k, v){ let s = (I18N[S.lang]||{})[k]; if (s == null) s = I18N.en[k]; if (s == null) return esc(k); if (v) for (const x in v) s = s.split('{'+x+'}').join(v[x]); return s; }
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
const omr = n => Number(n||0).toFixed(3);
const LN = (o, base) => o ? (S.lang === 'ar' ? (o[base+'_ar'] || o[base+'_en']) : o[base+'_en']) : '';
const wN = w => S.lang === 'ar' ? (WILAYAT_AR[w] || w) : w;
const loc = () => S.lang === 'ar' ? 'ar-OM-u-nu-latn' : 'en-GB';
function fmtDate(d, o){ if (!d) return ''; const x = typeof d === 'string' && d.length === 10 ? new Date(d+'T00:00:00') : new Date(d); return x.toLocaleDateString(loc(), o || { weekday:'short', day:'numeric', month:'short' }); }
function fmtDT(d){ if (!d) return '—'; return new Date(d).toLocaleString(loc(), { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit', timeZone:'Asia/Muscat' }); }
function fmtTime(d){ return new Date(d).toLocaleTimeString(loc(), { hour:'2-digit', minute:'2-digit', timeZone:'Asia/Muscat' }); }
function ago(ts){ const m = Math.round((Date.now() - new Date(ts)) / 60000); if (m < 1) return t('just_now'); if (m < 60) return t('min_ago',{n:m}); const h = Math.round(m/60); if (h < 24) return t('h_ago',{n:h}); return t('d_ago',{n:Math.round(h/24)}); }
function muscatNow(){ const p = new Intl.DateTimeFormat('en-CA',{ timeZone:'Asia/Muscat', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false }).formatToParts(new Date()); const g = k => p.find(x => x.type === k).value; return { date: `${g('year')}-${g('month')}-${g('day')}`, mins: (+g('hour') % 24) * 60 + (+g('minute')) }; }
function addDays(iso, n){ const d = new Date(iso+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); }
function age(dob){ if (!dob) return ''; const d = new Date(dob); const n = new Date(); let a = n.getFullYear() - d.getFullYear(); if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--; return a; }
function initials(n){ return String(n||'?').replace(/[()]/g,'').trim().split(/\s+/).filter(Boolean).slice(0,2).map(x => x[0]).join('').toUpperCase() || '?'; }
function toast(msg, bad){ if (!msg) return; const el = $('#toast'); el.textContent = msg; el.className = 'show' + (bad ? ' bad' : ''); clearTimeout(el._t); el._t = setTimeout(() => el.className = '', 3200); }
function errMsg(e){ const c = e && e.code ? e.code : 'GENERIC'; if (c === 'ABORTED') return ''; const k = 'e_' + c; return (I18N[S.lang][k] || I18N.en[k]) ? t(k) : t('e_GENERIC'); }
/* v32: copy that always answers within a moment (some browsers never settle the clipboard promise) */
function copyText(txt, okKey){
  const old = () => { try { const ta = document.createElement('textarea'); ta.value = txt; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;opacity:0'; document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.parentNode.removeChild(ta); return ok; } catch(e) { return false; } };
  const done = ok => toast(ok ? t(okKey || 'copied') : txt);
  if (!navigator.clipboard || !window.isSecureContext) return done(old());
  Promise.race([navigator.clipboard.writeText(txt).then(() => true), new Promise(r => setTimeout(() => r(null), 1200))]).then(ok => done(ok === true ? true : old())).catch(() => done(old()));
}
function go(h){ if (location.hash === '#/' + h) render(); else location.hash = '#/' + h; }
function saveCart(){ localStorage.setItem('lah_cart', JSON.stringify(S.cart)); }
function clearTimers(){ S.timers.forEach(x => clearInterval(x)); S.timers = []; }
function stChip(s){ const cls = s === 'completed' ? 'teal' : s === 'cancelled' ? 'gray' : s === 'recollect' ? 'red' : ['booked'].includes(s) ? 'amber' : ''; return `<span class="chip ${cls}">${esc(t('st_'+s))}</span>`; }
async function busy(btn, fn){ if (btn) { btn.disabled = true; btn._h = btn.innerHTML; btn.innerHTML = '<span class="spin" style="width:18px;height:18px;border-width:2.5px;border-color:rgba(255,255,255,.4);border-top-color:#fff"></span>'; }
  try { return await fn(); } catch(e) { toast(errMsg(e), true); throw e; } finally { if (btn) { btn.disabled = false; btn.innerHTML = btn._h; } } }
function modal(html, mount){
  const root = $('#modal-root'); const bg = document.createElement('div'); bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`; root.appendChild(bg);
  document.body.classList.add('lock');
  const close = () => { bg.remove(); document.removeEventListener('keydown', onKey); if (!$('#modal-root .modal-bg') && !$('.drawer-bg.open')) document.body.classList.remove('lock'); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey); bg._close = close;
  bg.addEventListener('click', e => { if (e.target === bg) close(); });
  $$('[data-close]', bg).forEach(b => b.onclick = close);
  if (mount) mount(bg, close);
  return close;
}
function confirmBox(msg, yes, no){ return new Promise(r => modal(`<h3>${esc(msg)}</h3><div class="row" style="margin-top:18px"><button class="btn ghost grow" data-n>${esc(no||t('cancel'))}</button><button class="btn red grow" data-y>${esc(yes||t('confirm'))}</button></div>`, (el, close) => { $('[data-y]', el).onclick = () => { close(); r(true); }; $('[data-n]', el).onclick = () => { close(); r(false); }; })); }
function setLang(l){ S.lang = l; localStorage.setItem('lah_lang', l); document.documentElement.lang = l; document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr'; document.title = 'iLab@home · ' + t('brand_sub'); }
/* catalog: shown at once from the copy saved on this device, then refreshed from the server in the background */
let CATF = null; const CAT_KEY = 'lah_cat_v2';
function setCatalog(c){ c.T = {}; c.tests.forEach(x => c.T[x.id] = x); c.P = {}; c.packages.forEach(x => c.P[x.id] = x); S.catalog = c;
  /* drop cart items that no longer exist (an old item made the cart look full but open empty) */
  const pk = S.cart.packages.filter(id => c.P[id]), ts = S.cart.tests.filter(id => c.T[id]);
  if (pk.length !== S.cart.packages.length || ts.length !== S.cart.tests.length) { S.cart = { packages: pk, tests: ts }; saveCart(); } }
function fetchCatalog(){ if (!CATF) CATF = API.catalog().then(c => { try { localStorage.setItem(CAT_KEY, JSON.stringify(c)); } catch(e) {} setCatalog(c); return S.catalog; }).finally(() => { CATF = null; }); return CATF; }
let CAT_FRESH = false;
async function loadCatalog(force){
  if (force) { try { localStorage.removeItem(CAT_KEY); } catch(e) {} S.catalog = null; return fetchCatalog(); }
  if (S.catalog) return S.catalog;
  let cached = null; try { cached = JSON.parse(localStorage.getItem(CAT_KEY) || 'null'); } catch(e) {}
  if (cached && Array.isArray(cached.tests)) { setCatalog(cached); if (!CAT_FRESH) { CAT_FRESH = true; fetchCatalog().catch(() => {}); } return S.catalog; }
  return fetchCatalog();
}
/* a cart with only self-collection tests is a courier visit (lower fee); anything else needs a nurse */
const isKit = ids => { const C = S.catalog; return !!(C && ids && ids.length && ids.every(id => (C.T[id] || {}).collection === 'self')); };
const fee = () => { if (!S.catalog) return 5; const C = S.catalog; let ids = []; try { ids = cartCalc().tests; } catch(e) {} return isKit(ids) ? Number(C.self_fee || 2) : Number(C.home_fee); };
const colChip = x => x.collection === 'self' ? `<span class="chip teal">${ic('box',13)} ${t('col_self')}</span>` : x.collection === 'device' ? `<span class="chip gray">${t('col_device')}</span>` : '';
function pkgFull(p){ return p.test_ids.reduce((s, id) => s + Number((S.catalog.T[id]||{}).price || 0), 0); }
function cartCalc(){
  const C = S.catalog; if (!C) return { items:[], sub:0, tests:[] };
  const items = []; let sub = 0; const covered = new Set();
  S.cart.packages.forEach(id => { const p = C.P[id]; if (!p) return; items.push({ type:'package', id, name:LN(p,'name'), price:Number(p.price) }); sub += Number(p.price); p.test_ids.forEach(x => covered.add(x)); });
  S.cart.tests.forEach(id => { const x = C.T[id]; if (!x || covered.has(id)) return; items.push({ type:'test', id, name:LN(x,'name'), price:Number(x.price) }); sub += Number(x.price); covered.add(id); });
  return { items, sub, tests:[...covered], fasting: Math.max(0, ...[...covered].map(id => (C.T[id]||{}).fasting_hours || 0)) };
}
function cartCount(){ return S.cart.packages.length + S.cart.tests.length; }
function toggleCart(type, id){ const k = type === 'package' ? 'packages' : 'tests'; const i = S.cart[k].indexOf(id); if (i >= 0) S.cart[k].splice(i, 1); else S.cart[k].push(id); saveCart(); }

/* ---------- public site ---------- */
function topbar(){
  const n = cartCount();
  return `<header class="topbar"><div class="wrap-w in">
    <a href="#/" class="brand">${brandInner(t('brand_sub'))}</a>
    <div class="grow"></div>
    <button class="menu-btn" data-menu aria-haspopup="true" aria-label="${t('menu')}">${ic('menu',20)}<span class="hide-sm">${t('menu')}</span><svg class="chev hide-sm" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg></button>
    <button class="lang hide-sm" data-lang>${t('lang')}</button>
    <a class="icon-btn ${S.user ? '' : 'hide-sm'}" href="#/${S.user ? 'app/cart' : 'tests'}" aria-label="${t('m_cart')}">${ic('box')}${n ? `<span class="dot">${n}</span>` : ''}</a>
    ${S.user ? `<a class="btn sm" href="#/app">${ic('home',18)} <span class="hide-sm">${esc(t('m_home'))}</span></a>` : `<a class="btn sm" href="#/login">${t('login')}</a>`}
  </div></header>`;
}
function testCard(x, inCart){
  return `<div class="tcard">${A.catIcon(x.cat)}
    <div class="grow"><h4>${esc(LN(x,'name'))}</h4><div class="muted small">${esc(LN(x,'desc'))}</div>
    <div class="meta">${colChip(x)}<span class="chip ${x.fasting_hours ? 'amber' : 'teal'}">${x.fasting_hours ? t('fasting',{h:x.fasting_hours}) : t('no_fasting')}</span><span class="chip gray">${t('results_in',{h:x.tat_hours})}</span></div></div>
    <div style="text-align:end;display:flex;flex-direction:column;align-items:flex-end;gap:8px"><div class="price">${omr(x.price)} <small>${t('omr')}</small></div>
    <button class="btn sm ${inCart ? 'teal' : 'soft'}" data-add="test:${x.id}">${inCart ? ic('check',16,2.6) + ' ' + t('in_cart') : ic('plus',16,2.6) + ' ' + t('add_cart')}</button></div></div>`;
}
function pkgCard(p, inCart){
  const full = pkgFull(p);
  return `<div class="pkg ${inCart ? 'on' : ''}">
    ${p.badge ? `<span class="chip ${p.badge === 'best' ? 'purple' : p.badge === 'kids' || p.badge === 'seniors' || p.badge === 'new' ? 'teal' : 'amber'} tag">${t(p.badge === 'best' ? 'best' : p.badge === 'kids' ? 'badge_kids' : p.badge === 'seniors' ? 'badge_seniors' : p.badge === 'new' ? 'badge_new' : 'popular')}</span>` : ''}
    ${A.catIcon('packages')}<h3>${esc(LN(p,'name'))}</h3><p class="muted small" style="margin:0">${esc(LN(p,'desc'))}</p>
    <ul>${p.test_ids.filter(id => S.catalog.T[id]).map(id => `<li>${esc(LN(S.catalog.T[id],'name'))}</li>`).join('')}</ul>
    <div class="foot"><div><div class="price" style="font-size:1.3rem">${omr(p.price)} <small>${t('omr')}</small><span class="strike">${omr(full)}</span></div><span class="chip teal" style="margin-top:4px">${t('save',{x:omr(full - p.price)})}</span></div>
    <button class="btn ${inCart ? 'teal' : ''} sm" data-add="package:${p.id}">${inCart ? ic('check',18,2.4) + ' ' + t('in_cart') : ic('plus',18,2.4) + ' ' + t('add_cart')}</button></div></div>`;
}
function catalogBlock(cat, limit){
  const C = S.catalog;
  const cats = ['all','packages','selfkit','expat','premarital','vitals','kids','vitamins','blood','diabetes','heart','thyroid','organs','men'];
  const tabs = `<div class="cats">${cats.map(c => `<button class="${c === cat ? 'on' : ''}" data-cat="${c}">${t('cat_'+c)}</button>`).join('')}</div>`;
  const pk = (cat === 'all' || cat === 'packages') ? C.packages : cat === 'kids' ? C.packages.filter(p => p.badge === 'kids') : cat === 'premarital' ? C.packages.filter(p => p.id === 'premarital') : cat === 'selfkit' ? C.packages.filter(p => p.id === 'selfkit') : cat === 'expat' ? C.packages.filter(p => ['expat_pre','housemaid'].includes(p.id)) : [];
  if (cat === 'expat') { const ex = new Set(C.packages.filter(p => ['expat_pre','housemaid'].includes(p.id)).flatMap(p => p.test_ids)); return `${tabs}<div class="banner blue small" style="margin-top:14px">${ic('shield',20)}<span>${t('ex_note')} <a href="#/expat" class="b">${t('m_expat')} ›</a></span></div><div class="grid g3" style="margin:14px 0 22px">${pk.map(p => pkgCard(p, S.cart.packages.includes(p.id))).join('')}</div><div class="grid g2 collapse">${C.tests.filter(x => ex.has(x.id) || x.cat === 'expat').map(x => testCard(x, S.cart.tests.includes(x.id))).join('')}</div>`; }
  let ts = cat === 'packages' ? [] : C.tests.filter(x => cat === 'all' || x.cat === cat);
  if (limit) ts = ts.slice(0, limit);
  return `${tabs}${pk.length ? `<div class="grid g3" style="margin:14px 0 22px">${pk.slice(0, limit ? 3 : 99).map(p => pkgCard(p, S.cart.packages.includes(p.id))).join('')}</div>` : ''}
    <div class="grid g2 collapse" style="margin-top:14px">${ts.map(x => testCard(x, S.cart.tests.includes(x.id))).join('')}</div>`;
}
function bindCatalog(root, rerender){
  $$('[data-cat]', root).forEach(b => b.onclick = () => rerender(b.dataset.cat));
  $$('[data-add]', root).forEach(b => b.onclick = () => { const [ty, id] = b.dataset.add.split(':'); const k = ty === 'package' ? 'packages' : 'tests'; const was = S.cart[k].includes(id);
    const rect = b.getBoundingClientRect(); toggleCart(ty, id); rerender(); refreshCartBadges(); if (!was) { toastCart(); if (window.FX) FX.flyToCart(rect); if (window.LAHMascot) LAHMascot.cheer(); } });
}
function cartBar(){
  const n = cartCount(); if (!n || !S.catalog) return '';
  const c = cartCalc();
  return `<div class="cart-bar"><div class="in">${ic('box',22)}<div class="grow"><b>${t('items_n',{n:c.items.length})} · ${omr(c.sub)} ${t('omr')}</b><div class="small" style="opacity:.8">+ ${omr(fee())} ${t(isKit(c.tests) ? 'kit_fee' : 'home_fee')}</div></div><button class="btn sm" data-go="${S.user ? 'app/cart' : 'register'}">${t('view_cart')} ${'<span class="flip">'+ic('arrow',18)+'</span>'}</button></div></div>`;
}
async function viewHow(){
  await loadCatalog().catch(() => null);
  const C = S.catalog;
  let cat = 'all';
  const steps = ['s1','s2','s3','s4','s5','s6','s7','s8','s9','s10'];
  app.innerHTML = `${topbar()}
  <section class="section" id="how"><div class="wrap-w">
    <div class="section-h"><span class="eyebrow">${t('how_eyebrow')}</span><h2>${t('how_t')}</h2><p>${t('how_p')}</p></div>
    <div class="journey">${steps.map((s, i) => `<div class="jstep"><span class="n">${i+1}</span><div class="ic" style="color:var(--blue)">${ic(A.steps[i],30)}</div><h4>${t(s)}</h4><p>${t(s+'d')}</p></div>`).join('')}</div>
  </div></section>

  <section class="section" id="partners"><div class="wrap-w">
    <div class="section-h"><span class="eyebrow">${t('roles_eyebrow')}</span><h2>${t('roles_t')}</h2><p>${t('roles_p')}</p></div>
    <div class="roles">${['patient','nurse','doctor','courier','lab','company'].map(r => `<a class="role" href="#/register/${r}">${A.roleIcon(r)}<h4>${t('r_'+r)}</h4><p>${t('r_'+r+'_d')}</p></a>`).join('')}</div>
    <div class="band" style="margin-top:34px">
      <div><b>48 h</b><span>${t('band1')}</span></div><div><b>${omr(fee())}</b><span>${t('band2')} (${t('omr')})</span></div>
      <div><b>${C ? C.wilayats.length : 7}</b><span>${t('band3')}</span></div><div><b>${C ? C.tests.length + C.packages.length : 17}</b><span>${t('band4')}</span></div>
    </div>
    <div class="section-h" style="margin:46px auto 20px"><span class="eyebrow">${t('net_eyebrow')}</span><h2>${t('net_t')}</h2><p>${t('net_p')}</p></div><div id="netb"></div>
  </div></section>

  <section class="section alt" id="coverage"><div class="wrap-w">
    <div class="section-h"><span class="eyebrow">${t('cov_eyebrow')}</span><h2>${t('cov_t')}</h2><p>${t('cov_p')}</p></div>
    <div class="cover"><div class="map" id="cov-map"></div>
      <div class="card pad-lg">
        ${['ph1','ph2','ph3'].map((p, i) => `<div class="phase"><span class="badge-n" style="${i ? 'background:#c4d4f2' : ''}">${i+1}</span><div><b>${t(p)}</b><div class="muted small">${t(p+'d')}</div>${i === 0 && C ? `<div class="row wrap" style="gap:6px;margin-top:8px">${C.wilayats.map(w => `<span class="chip">${esc(wN(w))}</span>`).join('')}</div>` : ''}</div></div>`).join('')}
        <hr class="sep"><h4>${t('waitlist_t')}</h4><p class="muted small">${t('waitlist_p')}</p>
        <form id="wl" class="grid g2 collapse" style="gap:10px"><input class="input" name="n" placeholder="${t('your_name')}"><input class="input" name="p" placeholder="${t('phone')}" inputmode="tel" required>
        <input class="input" name="w" placeholder="${t('your_wilayat')}" required><button class="btn">${t('join')}</button></form>
      </div></div>
  </div></section>

  <section class="section" id="faq"><div class="wrap-w" style="max-width:820px">
    <div class="section-h"><span class="eyebrow">FAQ</span><h2>${t('faq_t')}</h2></div>
    <div class="stack">${[1,2,3,4,5,6].map(i => `<details class="faq"><summary>${t('q'+i)}</summary><p>${t('a'+i)}</p></details>`).join('')}</div>
  </div></section>

  <section class="wrap-w"><div class="welcome" style="padding:34px;text-align:center"><h2 style="font-size:1.8rem">${t('hero_t1')} ${t('hero_t2')}</h2><p style="opacity:.85">${t('hero_p')}</p>
    <div class="row wrap" style="justify-content:center;margin-top:16px"><a class="btn" style="background:#fff;color:var(--blue)" href="#/${S.user ? 'app/tests' : 'register'}">${t('book_now')}</a><a class="btn ghost" style="background:transparent;color:#fff;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.5)" href="#/login">${t('try_demo').split('(')[0]}</a></div></div></section>
  ${footer()}${cartBar()}`;
  $('#wl').onsubmit = async e => { e.preventDefault(); const f = e.target; const b = $('button', f);
    await busy(b, () => API.waitlist(f.n.value, f.p.value, f.w.value)).then(() => { toast(t('joined')); f.reset(); }).catch(() => {}); };
  covMap(); partnersHtml().then(h => { const el = $('#netb'); if (el) el.innerHTML = h; });
  const hash = location.hash.split('#')[2]; if (hash) setTimeout(() => { const el = document.getElementById(hash); if (el) el.scrollIntoView({ behavior:'smooth' }); }, 50);
}
function footer(){
  return `<footer class="site"><div class="wrap-w"><div class="row wrap between" style="gap:20px;align-items:flex-start">
    <div style="max-width:520px"><div class="brand">${brandInner()}</div><p class="small" style="margin-top:12px">${t('foot_note')}</p><p class="xs" style="opacity:.75">${t('foot_team')}</p></div>
    <div class="stack small"><a href="#/tests">${t('nav_tests')}</a><a href="#/consult">${t('m_consult')}</a><a href="#/dental">${t('m_dental')}</a><a href="#/support">${t('m_support')}</a><a href="#/about">${t('m_about')}</a><a href="#/expat">${t('m_expat')}</a><a href="#/guarantee">${t('m_guarantee')}</a><a href="#/sources">${t('m_sources')}</a></div><div class="stack small ft-ct"><b>${t('m_contact')}</b><a href="https://wa.me/${CONTACT.wa}" target="_blank" rel="noopener" class="ltr">WhatsApp ${CONTACT.phone}</a><a href="tel:${CONTACT.tel}" class="ltr">${CONTACT.phone}</a><a href="mailto:${CONTACT.email}" class="ltr">${CONTACT.email}</a><a href="${CONTACT.ig}" target="_blank" rel="noopener" class="ltr">Instagram ${CONTACT.igh}</a></div><div class="stack small"><a href="#/install">${t('m_install')}</a><a href="#/register/nurse">${t('r_nurse')}</a><a href="#/register/doctor">${t('r_doctor')}</a><a href="#/register/lab">${t('r_lab')}</a><a href="#/register/company">${t('r_company')}</a></div></div>
    <p class="xs" style="opacity:.6;margin-top:24px">© 2026 iLab@home · Oman</p></div></footer>`;
}
/* map library: loaded only when a screen shows a map (it used to load on every page) */
let LREQ = false;
function needL(){ if (window.L || LREQ) return; LREQ = true;
  const c = document.createElement('link'); c.rel = 'stylesheet'; c.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; c.crossOrigin = ''; document.head.appendChild(c);
  const j = document.createElement('script'); j.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; j.crossOrigin = ''; j.async = true; j.onerror = () => { LREQ = false; }; document.head.appendChild(j); }
function covMap(){
  const el = $('#cov-map'); if (!el) return;
  const draw = () => { if (!document.body.contains(el)) return; if (!(needL(), window.L) || !S.catalog) return setTimeout(draw, 200);
    const touch = matchMedia('(pointer:coarse)').matches; const m = L.map(el, { scrollWheelZoom:false, attributionControl:true, dragging:!touch, touchZoom:!touch, doubleClickZoom:!touch, tap:false }).setView([22.72, 58.55], 9);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:18, attribution:'© OpenStreetMap' }).addTo(m);
    S.catalog.wilayats.forEach(w => { const ll = WILAYAT_LL[w]; if (!ll) return;
      L.circle(ll, { radius: w === 'Ibra' ? 9000 : 6000, color:'#1257d6', weight:2, fillColor:'#2f7bff', fillOpacity:.18 }).addTo(m).bindTooltip(wN(w), { permanent: w === 'Ibra', direction:'top' }); });
  }; draw();
}
async function viewTestsPublic(){
  await loadCatalog();
  let cat = new URLSearchParams(location.hash.split('?')[1] || '').get('c') || 'all';
  app.innerHTML = `${topbar()}<section class="section" style="padding-top:32px"><div class="wrap-w"><div class="section-h"><h2 data-split>${t('tests_t')}</h2><p>${t('tests_p',{fee:omr(fee())})}</p>${waChip()}</div><div id="cb"></div><div id="cbar"></div></div></section>${footer()}`;
  const rer = c => { if (c) cat = c; $('#cb').innerHTML = catalogBlock(cat); bindCatalog($('#cb'), rer); $('#cbar').innerHTML = cartBar(); bindGo(); };
  rer();
}

/* ---------- auth ---------- */
function authShell(inner){
  return `<div class="auth"><div class="side"><a href="#/" class="brand on-dark brand-anim">${A.logo}<span class="bw">${wmAnim('big')}</span></a>
    <div><h2>${t('hero_t1')} ${t('hero_t2')}</h2><p style="opacity:.85">${t('hero_p')}</p></div>
    <div style="max-width:420px;opacity:.95">${A.welcomeArt}</div></div>
    <div class="main"><div class="box"><div class="row between" style="margin-bottom:14px"><a href="#/" class="brand brand-anim">${A.logo}<span class="bw">${wmAnim()}</span></a><button class="lang" data-lang>${t('lang')}</button></div>${vanStrip()}${inner}</div></div></div>`;
}
function pwField(name, label, hint){
  return `<label class="field"><span>${label}</span><div class="pw"><input class="input" type="password" name="${name}" autocomplete="${name === 'password' ? 'current-password' : 'new-password'}" required><button type="button" class="eye" data-eye aria-label="${t('show')}">${ic('eye',20)}</button></div>${hint ? `<div class="meter"><i></i></div><div class="hint">${hint}</div>` : ''}</label>`;
}
function bindPw(root){
  $$('[data-eye]', root).forEach(b => b.onclick = () => { const i = b.previousElementSibling; i.type = i.type === 'password' ? 'text' : 'password'; });
  $$('.meter', root).forEach(m => { const i = m.parentElement.querySelector('input'); i.addEventListener('input', () => { const v = i.value; let s = 0; if (v.length >= 8) s++; if (/[0-9]/.test(v) && /[A-Za-z]/.test(v)) s++; if (/[^A-Za-z0-9]/.test(v) || v.length >= 12) s++; const bar = $('i', m); bar.style.width = (s/3*100) + '%'; bar.style.background = ['#e2474f','#f2a516','#0fae9b'][Math.max(0, s-1)]; }); });
}
async function afterLogin(r){
  API.setToken(r.token); S.user = r.user; S.unread = 0;
  if ('Notification' in window && Notification.permission === 'granted' && localStorage.getItem('lah_push') === '1') setTimeout(() => pushEnable(true).catch(() => {}), 1500);
  const back = sessionStorage.getItem('lah_after'); sessionStorage.removeItem('lah_after');
  go(back || (S.user.role === 'patient' && cartCount() ? 'app/book' : 'app'));
}
function viewLogin(){
  const D = x => x + '@demo.labathome.om';
  const demos = [['patient',D('patient'),''],['nurse',D('nurse'),t('female')],['nurse',D('mohammed.kindi'),t('male')],['courier',D('courier'),'Cold Chain'],['fleet',D('fleet.coldchain'),'Cold Chain'],['lab',D('lab'),'Ibra'],['lab',D('lab.sinaw'),'Sinaw'],['doctor',D('doctor'),''],['company',D('company'),''],['admin',D('admin'),'']];
  app.innerHTML = authShell(`<h1>${t('welcome_back')}</h1><p class="muted">${t('login_sub')}</p>
    <form id="lf" class="stack" style="margin-top:18px"><label class="field"><span>${t('email_or_phone')}</span><input class="input ltr" name="login" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false" required placeholder="name@email.com · 9XXXXXXX"></label>
    ${pwField('password', t('password'))}<div class="row" style="justify-content:flex-end;margin-top:-4px"><a href="#/forgot" class="small b">${t('forgot')}</a></div><div class="err" id="le"></div><button class="btn block">${t('login')}</button></form><div id="gbox"></div>
    <p class="center muted" style="margin:16px 0">${t('no_account')} <a href="#/register" class="b">${t('signup')}</a></p>
    <div class="card flat" style="margin-top:8px"><div class="small b" style="margin-bottom:10px">${t('try_demo')}</div>
    <div class="demo-grid">${demos.map(([r, e, sub]) => `<button type="button" data-demo="${e}">${A.roleIcon(r === 'fleet' ? 'courier' : r, 34)}<span>${t('r_'+r)}${sub ? `<small>${esc(sub)}</small>` : ''}</span></button>`).join('')}</div></div>`);
  bindPw(app);
  $('#lf').onsubmit = async e => { e.preventDefault(); const f = e.target; $('#le').textContent = '';
    try { const r = await busy($('button.btn', f), () => API.login(f.login.value, f.password.value)); afterLogin(r); } catch(err) { $('#le').textContent = errMsg(err); const fl = $('a[href="#/forgot"]', f); if (fl) { fl.classList.remove('nudge'); void fl.offsetWidth; fl.classList.add('nudge'); fl.title = t('th_err'); } } };
  $$('[data-demo]').forEach(b => b.onclick = async () => { try { const r = await busy(b, () => API.login(b.dataset.demo, 'Demo@2026')); afterLogin(r); } catch(e) {} });
  mountGoogle();
}
function viewRegister(role){
  const C = S.catalog; const W = C ? C.wilayats : Object.keys(WILAYAT_AR);
  const partner = /partner=1/.test(location.hash);
  const st = { role: role || (partner ? null : 'patient'), gender: '' };
  const draw = () => {
    if (!st.role) {
      app.innerHTML = authShell(`<button class="link" data-pat>${'<span class="flip">'+ic('back',18)+'</span>'} ${t('patient_link')}</button><h1 style="margin-top:12px">${t('partner_t')}</h1><p class="muted">${t('partner_q')}</p>
        <div class="grid g2 collapse" style="margin-top:16px">${['nurse','doctor','lab','courier','company'].map(r => `<button class="role" style="text-align:start;display:flex;gap:12px;align-items:center;padding:14px" data-role="${r}">${A.roleIcon(r, 46)}<span><b>${t('r_'+r)}</b><span class="muted small" style="display:block">${t('r_'+r+'_d')}</span></span></button>`).join('')}</div>`);
      $$('[data-role]').forEach(b => b.onclick = () => { st.role = b.dataset.role; history.replaceState(null, '', '#/register/' + st.role); draw(); });
      $('[data-pat]').onclick = () => { st.role = 'patient'; history.replaceState(null, '', '#/register'); draw(); };
      bindGlobal(); return;
    }
    const r = st.role;
    const wsel = (name, multi) => multi
      ? `<div class="row wrap" style="gap:8px">${W.map(w => `<label class="chip gray" style="cursor:pointer;padding:8px 12px"><input type="checkbox" name="${name}" value="${esc(w)}" ${w === 'Ibra' ? 'checked' : ''} style="accent-color:var(--blue)"> ${esc(wN(w))}</label>`).join('')}</div>`
      : `<select class="input" name="${name}">${W.map(w => `<option value="${esc(w)}">${esc(wN(w))}</option>`).join('')}</select>`;
    const genderPick = `<div class="field"><span>${t('gender_q')}</span><div class="gpick"><button type="button" data-g="female" class="${st.gender === 'female' ? 'on' : ''}">${ic('user',22)} ${t('female')}</button><button type="button" data-g="male" class="${st.gender === 'male' ? 'on' : ''}">${ic('user',22)} ${t('male')}</button></div><div class="hint">${t('gender_hint')}</div></div>`;
    const extra = {
      patient: '',
      nurse: `<div class="grid g2"><label class="field"><span>${t('license')}</span><input class="input" name="license" required placeholder="OMSB-RN-…"></label><label class="field"><span>${t('years')}</span><input class="input" type="number" min="0" max="50" name="years"></label></div>
        <label class="field"><span>${t('wilayat')}</span>${wsel('wilayat')}</label><div class="field"><span>${t('coverage')}</span>${wsel('coverage', true)}</div>`,
      courier: `<label class="field"><span>${t('logistics_co')}</span><input class="input" name="company"></label><div class="grid g2"><label class="field"><span>${t('vehicle')}</span><input class="input" name="vehicle" placeholder="Van · 2–8 °C box"></label><label class="field"><span>${t('plate')}</span><input class="input" name="plate" placeholder="12345 AB"></label></div><label class="field"><span>${t('wilayat')}</span>${wsel('wilayat')}</label><div class="field"><span>${t('coverage')}</span>${wsel('coverage', true)}</div>`,
      doctor: `<div class="grid g2"><label class="field"><span>${t('license')}</span><input class="input" name="license" required placeholder="OMSB-MD-…"></label><label class="field"><span>${t('years')}</span><input class="input" type="number" min="0" max="60" name="years"></label></div>
        <label class="field"><span>${t('specialty')}</span><select class="input" name="specialty"><option value="Family Medicine">${t('sp_family')}</option><option value="Internal Medicine">${t('sp_internal')}</option><option value="Pediatrics">${t('sp_peds')}</option><option value="Dentistry">${t('sp_dent')}</option></select></label>
        <label class="field"><span>${t('wilayat')}</span>${wsel('wilayat')}</label>`,
      lab: `<label class="field"><span>${t('lab_name')}</span><input class="input" name="lab_name" required></label><div class="grid g2"><label class="field"><span>${t('lab_license')}</span><input class="input" name="license" required></label><label class="field"><span>${t('accreditation')}</span><input class="input" name="accreditation" placeholder="ISO 15189 / CAP"></label></div>
        <label class="field"><span>${t('wilayat')}</span>${wsel('wilayat')}</label>`,
      company: `<label class="field"><span>${t('company_name')}</span><input class="input" name="company_name" required></label><div class="grid g2"><label class="field"><span>${t('cr')}</span><input class="input" name="cr"></label><label class="field"><span>${t('employees')}</span><input class="input" type="number" min="1" name="employees"></label></div><label class="field"><span>${t('wilayat')}</span>${wsel('wilayat')}</label>`
    }[r];
    app.innerHTML = authShell(`${r !== 'patient' ? `<button class="link" data-back>${'<span class="flip">'+ic('back',18)+'</span>'} ${t('back')}</button>` : ''}
      <div class="row" style="margin:10px 0 4px">${A.roleIcon(r, 48)}<div><h1 style="margin:0">${t('reg_t')}</h1><div class="muted small">${t('r_'+r)} · ${t('r_'+r+'_d')}</div></div></div>
      <form id="rf" class="stack" style="margin-top:16px" novalidate>
        <label class="field"><span>${r === 'company' || r === 'lab' ? t('contact_person') : t('full_name')}</span><input class="input" name="full_name" autocomplete="name" required></label>
        ${r === 'patient' || r === 'nurse' || r === 'doctor' ? genderPick : ''}
        ${['patient','nurse','courier'].includes(r) ? `<label class="field"><span>${t('civil_id')}</span><input class="input" name="civil_id" inputmode="numeric" maxlength="10" required placeholder="${t('civil_ph')}"><div class="hint">${ic('shield',13)} ${t('civil_hint')}</div></label>` : ''}
        <label class="field"><span>${t('phone')}</span><input class="input" name="phone" inputmode="tel" autocomplete="tel" placeholder="9XXX XXXX"></label>
        <label class="field"><span>${t('email_opt')}</span><input class="input" type="email" name="email" autocomplete="email"></label>
        ${pwField('newpass', t('password'), t('pass_rule'))}
        ${extra}
        <label class="check"><input type="checkbox" name="consent"> <span>${t('consent')}</span></label>
        ${r !== 'patient' ? `<div class="banner blue small">${ic('shield',20)}<span>${t('pending_p')}</span></div>` : ''}
        <div class="err" id="re"></div><button class="btn block">${t('finish')}</button></form>${st.role === 'patient' ? '<div id="gbox"></div>' : ''}
      <p class="center muted" style="margin-top:16px">${t('have_account')} <a href="#/login" class="b">${t('login')}</a></p>
      ${r === 'patient' ? `<div class="card flat center" style="margin-top:8px"><div class="small muted">${t('partner_q')}</div><button class="btn soft sm" data-partner style="margin-top:8px">${ic('building',16)} ${t('partner_link')}</button></div>` : ''}`);
    bindPw(app);
    $$('[data-g]').forEach(b => b.onclick = () => { st.gender = b.dataset.g; $$('[data-g]').forEach(x => x.classList.toggle('on', x === b)); });
    if ($('[data-back]')) $('[data-back]').onclick = () => { st.role = null; history.replaceState(null, '', '#/register?partner=1'); draw(); };
    if ($('[data-partner]')) $('[data-partner]').onclick = () => { st.role = null; history.replaceState(null, '', '#/register?partner=1'); draw(); };
    $('#rf').onsubmit = async e => { e.preventDefault(); const f = e.target; $('#re').textContent = '';
      const val = n => f[n] ? (f[n].value || '').trim() : '';
      if ((r === 'patient' || r === 'nurse' || r === 'doctor') && !st.gender) { $('#re').textContent = t('e_NEED_GENDER'); return; }
      const civ = val('civil_id').replace(/\D/g,'');
      if (['patient','nurse','courier'].includes(r) && !/^\d{6,10}$/.test(civ)) { $('#re').textContent = t(civ ? 'e_BAD_CIVIL' : 'e_NEED_CIVIL'); return; }
      const meta = {}; if (st.gender) meta.gender = st.gender;
      ['license','years','lab_name','accreditation','company_name','cr','employees','vehicle','company','plate'].forEach(k => { if (f[k] && f[k].value) meta[k] = f[k].value.trim(); });
      if (r === 'nurse' || r === 'courier') meta.coverage = $$('input[name=coverage]:checked', f).map(x => x.value);
      if (r === 'lab' && !meta.lab_name) { $('#re').textContent = t('e_NEED_NAME'); return; }
      if (r === 'doctor') { const sp = f.specialty.value; meta.specialty = sp; meta.specialty_ar = { 'Family Medicine':'طب الأسرة', 'Internal Medicine':'الطب الباطني', 'Pediatrics':'طب الأطفال', 'Dentistry':'طب الأسنان' }[sp]; if (sp === 'Dentistry') meta.dental = true; meta.langs = ['Arabic','English']; }
      const w = val('wilayat') || null; const ll = WILAYAT_LL[w] || [];
      const p = { role:r, full_name: r === 'lab' ? (meta.lab_name || val('full_name')) : r === 'company' ? (meta.company_name || val('full_name')) : val('full_name'),
        phone: val('phone'), email: val('email'), password: f.newpass.value, consent: f.consent.checked,
        governorate: 'North Al Sharqiyah', wilayat: w, lat: ll[0] || '', lng: ll[1] || '', meta, civil_id: civ || null };
      if (r === 'lab' || r === 'company') p.meta.contact = val('full_name');
      try { const res = await busy($('button.btn', f), () => API.register(p)); localStorage.setItem('lah_seen', '1'); afterLogin(res); if (p.email) setTimeout(() => mailSend(null, true), 800); } catch(err) { $('#re').textContent = errMsg(err); }
    };
    bindGlobal();
  };
  draw();
}
/* ---------- app shell ---------- */
function navFor(role){
  const m = {
    patient: [['app','home','m_home'],['app/tests','flask','m_tests'],['app/cart','cart','m_cart'],['app/orders','list','m_orders'],['app/loyalty','star','m_loyalty'],['app/consult','steth','m_consult'],['dental','tooth','m_dental'],['app/profile','user','m_profile']],
    nurse: [['app','home','m_home'],['app/orders','syringe','m_jobs'],['app/kit','box','m_kit'],['app/notifs','bell','m_notifs'],['app/profile','user','m_profile']],
    doctor: [['app','steth','m_review'],['app/consult','video','m_consults'],['app/notifs','bell','m_notifs'],['app/profile','user','m_profile']],
    courier: [['app','home','m_home'],['app/orders','van','m_pickups'],['app/notifs','bell','m_notifs'],['app/profile','user','m_profile']],
    lab: [['app','home','m_home'],['app/orders','flask','m_samples'],['app/notifs','bell','m_notifs'],['app/profile','user','m_profile']],
    company: [['app','home','m_programs'],['app/camps','building','m_camps'],['app/notifs','bell','m_notifs'],['support','chat','m_support'],['app/profile','user','m_profile']],
    admin: [['app','chart','overview'],['business','coin','m_business'],['app/orders','list','m_all_orders'],['app/admin/users','users','m_users'],['app/admin/tickets','chat','m_tickets'],['app/admin/payments','card','m_payments'],['app/admin/contracts','building','m_contracts'],['app/admin/catalog','flask','m_catalog'],['app/admin/kit','box','m_kits'],['app/admin/safety','shield','m_safety'],['app/admin/coupons','coin','m_coupons'],['app/admin/camps','building','m_camps'],['app/admin/settings','gear','m_settings'],['app/profile','user','m_profile']],
    staff: [['app','chart','overview'],['app/admin/tickets','chat','m_tickets'],['app/orders','list','m_all_orders'],['app/admin/users','users','m_users'],['app/admin/contracts','building','m_contracts'],['app/admin/kit','box','m_kits'],['app/admin/safety','shield','m_safety'],['app/admin/camps','building','m_camps'],['app/admin/settings','gear','m_settings'],['app/profile','user','m_profile']]
  };
  return m[role] || m.patient;
}
function shell(title, body, opts){
  const u = S.user; const route = (location.hash.slice(2) || 'app').split('?')[0];
  const items = navFor(u.role);
  const isOn = h => route === h || (h !== 'app' && route.startsWith(h));
  const n = cartCount();
  return `${u.is_demo ? `<div class="demo-banner">${ic('play',14)} ${S.lang === 'ar' ? 'حساب تجريبي' : 'Demo account'} · ${t('r_'+u.role)} · ${esc(u.full_name)}</div>` : ''}
  <div class="shell"><aside class="side-nav"><a href="#/" class="brand">${brandInner(t('r_'+u.role))}</a>
    ${items.map(([h, i, k]) => `<a href="#/${h}" class="${isOn(h) ? 'on' : ''}">${ic(i)} <span class="grow">${t(k)}</span>${h === 'app/cart' && n ? `<span class="chip red">${n}</span>` : ''}</a>`).join('')}
    <a href="#/app/notifs" class="${isOn('app/notifs') ? 'on' : ''}" style="${['patient','admin','staff'].includes(u.role) ? '' : 'display:none'}">${ic('bell')} <span class="grow">${t('m_notifs')}</span>${S.unread ? `<span class="chip red">${S.unread}</span>` : ''}</a>
    <a href="#" data-menu>${ic('menu')} <span class="grow">${t('m_more')}</span></a>
    <div class="me"><span class="avatar">${esc(initials(u.full_name))}</span><div class="grow"><div class="b small" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(u.full_name)}</div><button class="link small" data-logout>${t('logout')}</button></div></div></aside>
  <main class="main-area"><div class="app-top">${opts && opts.back ? `<button class="icon-btn" data-goback aria-label="${t('back')}"><span class="flip">${ic('back')}</span></button>` : ''}<h1 class="grow">${title}</h1>
    <button class="icon-btn" data-go="app/notifs" aria-label="${t('m_notifs')}">${ic('bell')}${S.unread ? `<span class="dot">${S.unread}</span>` : ''}</button></div>
  <div class="content">${profileBanner()}${emailBanner()}${pushBanner()}${u.status === 'pending' ? `<div class="banner amber" style="margin-bottom:16px">${ic('clock',22)}<div><b>${t('pending_t')}</b><div class="small">${t('pending_p')}</div></div></div>` : ''}${body}</div></main></div>
  <nav class="tabbar">${items.slice(0, 4).map(([h, i, k]) => `<a href="#/${h}" class="${isOn(h) ? 'on' : ''}">${ic(i)}${h === 'app/cart' && n ? `<span class="dot">${n}</span>` : ''}<span>${t(k)}</span></a>`).join('')}<a href="#" data-menu>${ic('menu')}<span>${t('menu')}</span></a></nav>`;
}
function loading(title){ app.innerHTML = shell(title || '', `<div class="skel" aria-busy="true" aria-label="${t('loading')}"><i class="sk sk-h"></i><div class="sk-row"><i class="sk sk-c"></i><i class="sk sk-c"></i></div><i class="sk sk-l"></i><i class="sk sk-l"></i><i class="sk sk-l s"></i></div>`); }
function orderItem(o, extra){
  const names = (o.items || []).map(i => S.lang === 'ar' ? i.name_ar : i.name_en).join(' · ');
  return `<a class="oitem" href="#/app/order/${o.id}"><span class="oi" style="color:var(--blue)">${ic(o.status === 'completed' ? 'file' : 'flask', 26)}</span>
    <div class="grow"><div class="row between"><b>${esc(o.code)}</b>${stChip(o.status)}</div>
    <div class="small muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(names)}</div>
    <div class="xs muted">${ic('cal',13)} ${fmtDate(o.slot_date)} · ${esc(o.slot_time)} · ${ic('pin',13)} ${esc(wN(o.wilayat))}${o.person ? ' · ' + esc(o.person) : ''}</div>${o.updated_at ? `<div class="xs upd">${ic('clock',12)} ${t('updated_x',{x:ago(o.updated_at)})}</div>` : ''}${extra || ''}</div></a>`;
}
function brandInner(sub){ return `${A.logo}<span class="bw">${A.wordmark}${sub ? `<small>${esc(sub)}</small>` : ''}</span>`; }
function emptyBox(msg, cta){ return `<div class="card empty">${A.emptyArt}<p>${msg}</p>${cta || ''}</div>`; }

/* ---------- patient ---------- */
async function viewPatientHome(){
  loading(t('m_home'));
  const [list, loy] = await Promise.all([API.orders(), API.loyalty().catch(() => null), loadCatalog()]);
  const active = list.filter(o => ACTIVE(o.status)); const done = list.filter(o => o.status === 'completed');
  const C = S.catalog; if (loy) S.loy = loy;
  app.innerHTML = shell(t('m_home'), `<div class="stack-lg">
    ${heroHtml(true)}
    <div><h3 class="hm-h">${t('hello',{n:esc(S.user.full_name.split(' ')[0])})} 👋 <span class="muted small" style="font-weight:500">${t('hm_quick')}</span></h3>${quickTiles()}</div>
    ${ramBanner()}${loy ? loyStrip(loy) : ''}
    <div class="grid g2 promos"><a class="promo p-kit" href="#/app/tests?c=selfkit">${A.catIcon('selfkit', 30)}<div class="grow"><b>${t('hm_selfkit_t')}</b><div class="small">${t('hm_selfkit_p',{x:omr(C.self_fee || 2)})}</div></div><span class="flip">${ic('arrow',18)}</span></a>
      <a class="promo p-ex" href="#/expat">${A.catIcon('expat', 30)}<div class="grow"><b>${t('hm_expat_t')}</b><div class="small">${t('hm_expat_p')}</div></div><span class="flip">${ic('arrow',18)}</span></a></div>
    <div><div class="row between"><h3>${t('upcoming')}</h3>${list.length ? `<a href="#/app/orders" class="small b">${t('see_all')}</a>` : ''}</div>
      ${active.length ? `<div class="olist">${active.map(o => orderItem(o)).join('')}</div>` : emptyBox(t('none_orders'), `<a class="btn" href="#/app/tests">${t('book_now')}</a>`)}</div>
    ${done.length ? `<div><h3>${t('q_reports')}</h3><div class="olist">${done.slice(0, 3).map(o => orderItem(o)).join('')}</div></div>` : ''}
    <div><div class="row between"><h3>${t('hm_pk')}</h3><a href="#/app/tests?c=packages" class="small b">${t('see_all')}</a></div><div class="hscroll" id="hp">${C.packages.map(p => pkgCard(p, S.cart.packages.includes(p.id))).join('')}</div></div>
    ${newBlock(true)}${contactCard(false)}
  </div>${cartBar()}`);
  bindHero();
  $$('#hp [data-add]').forEach(b => b.onclick = () => { const [ty, id] = b.dataset.add.split(':'); toggleCart(ty, id); viewPatientHome(); });
}
async function viewAppTests(){
  await loadCatalog();
  let cat = new URLSearchParams(location.hash.split('?')[1] || '').get('c') || 'all';
  app.innerHTML = shell(t('m_tests'), `<div class="row between wrap" style="gap:8px"><p class="muted" style="margin:0">${t('tests_p',{fee:omr(fee())})}</p>${waChip()}</div><div id="cb"></div>${soonBlock()}<div id="cbar"></div>`);
  const rer = c => { if (c) cat = c; $('#cb').innerHTML = catalogBlock(cat); bindCatalog($('#cb'), rer); $('#cbar').innerHTML = cartBar(); bindGo(); };
  rer();
}
async function viewOrders(){
  loading(t(S.user.role === 'patient' ? 'm_orders' : 'm_jobs'));
  const r = S.user.role;
  if (r === 'patient') {
    const list = await API.orders(); const rep = /r=1/.test(location.hash);
    const l = rep ? list.filter(o => o.status === 'completed') : list;
    app.innerHTML = shell(t(rep ? 'q_reports' : 'm_orders'), l.length ? `<div class="olist">${l.map(o => orderItem(o)).join('')}</div>` : emptyBox(t('none_orders'), `<a class="btn" href="#/app/tests">${t('book_now')}</a>`));
    return;
  }
  if (r === 'admin' || r === 'staff') return viewAdminOrders();
  const list = await API.orders();
  const title = t(r === 'nurse' ? 'my_visits' : r === 'courier' ? 'm_pickups' : 'm_samples');
  app.innerHTML = shell(title, list.length ? `<div class="olist">${list.map(o => orderItem(o)).join('')}</div>` : emptyBox(t('none_yet')));
}

/* booking */
function bkInit(){
  if (!S.bk) { const now = muscatNow(); const u = S.user;
    S.bk = { step: 1, who: 'me', person: { name:'', relation:'parent', gender:'female', dob:'' }, date: addDays(now.date, 1), time: '', wilayat: u.wilayat && WILAYAT_LL[u.wilayat] ? u.wilayat : 'Ibra', address: u.address || '', lat: null, lng: null, notes:'', pay:'card', code:'', program:null, nurse:null, gps:'' }; }
  return S.bk;
}
async function viewBook(){
  await loadCatalog(); const b = bkInit(); const C = S.catalog; if (b.pay === 'cash') b.pay = 'card';
  const c = cartCalc(); const kit = !b.program && isKit(c.tests);
  if (kit && b.step === 3) b.step = b._back ? 2 : 4; b._back = false;
  if (!b.program && S.loy === undefined) S.loy = await API.loyalty().catch(() => null);
  const L = S.loy || {}; const subNow = c.sub;
  const dStamp = !b.program && L.free_next ? fee() : 0;
  const dCoupon = !b.program && b.coupon ? Math.min(Number(b.coupon.amount) || 0, subNow) : 0;
  const dRef = !b.program && L.referred_by && !L.orders && !(L.history || []).length ? Math.min(Number(L.reward || 1), Math.max(subNow - dCoupon, 0)) : 0;
  if (!b.program && !c.items.length) { app.innerHTML = shell(t('q_book'), emptyBox(t('cart_empty'), `<a class="btn" href="#/app/tests">${t('explore_tests')}</a>`)); return; }
  const stepNames = ['b2_who','b2_loc', kit ? 'b2_kit' : 'b2_nurse','b2_time','b2_pay'];
  const head = `<div class="stepper">${stepNames.map((s, i) => `<i class="${i < b.step ? 'on' : ''}"></i>`).join('')}</div><div class="steplabels">${stepNames.map((s, i) => `<span class="${i + 1 === b.step ? 'on' : ''}">${i + 1}. ${t(s)}</span>`).join('')}</div>`;
  const items = b.program ? [{ name: LN(C.P[b.program.package_id],'name'), price: Number(C.P[b.program.package_id].price) }] : c.items;
  const sub = b.program ? Number(C.P[b.program.package_id].price) : c.sub;
  const total = b.program ? 0 : Math.max(0, sub + fee() - dStamp - dCoupon - dRef);
  const g = bkGender(b);
  const fastH = b.program ? Math.max(0, ...C.P[b.program.package_id].test_ids.map(id => (C.T[id] || {}).fasting_hours || 0)) : (c.fasting || 0);
  const summary = `<div class="card summary"><h3>${t('summary')}</h3>${items.map(i => `<div class="line"><span>${esc(i.name)}</span><span class="num">${omr(i.price)}</span></div>`).join('')}
    <div class="line"><span>${t(kit ? 'kit_fee' : 'home_fee')}</span><span class="num">${omr(fee())}</span></div>
    ${b.program ? `<div class="line" style="color:var(--teal)"><span>${t('discount')}</span><span class="num">−${omr(sub + fee())}</span></div>` : ''}
    ${dStamp ? `<div class="line disc"><span>${ic('star',14)} ${t('d_stamp')}</span><span class="num">−${omr(dStamp)}</span></div>` : ''}
    ${dCoupon ? `<div class="line disc"><span>${ic('coin',14)} ${t('d_coupon')} · ${esc(b.coupon.code)}</span><span class="num">−${omr(dCoupon)}</span></div>` : ''}
    ${dRef ? `<div class="line disc"><span>${ic('users',14)} ${t('d_ref')}</span><span class="num">−${omr(dRef)}</span></div>` : ''}
    <div class="line total"><span>${t('total')}</span><span class="num">${omr(total)} ${t('omr')}</span></div>
    <hr class="sep"><div class="small muted stack" style="--g:6px">${b.step > 1 ? `<div>${ic('user',14)} ${esc(b.who === 'family' ? b.person.name : S.user.full_name)} · ${t(g)}</div>` : ''}${b.step > 2 ? `<div>${ic('pin',14)} ${esc(wN(b.wilayat))}</div>` : ''}${b.step > 3 && kit ? `<div>${ic('box',14)} ${t('kit_mode_t')}</div>` : ''}${b.step > 3 && !kit ? `<div>${ic('syringe',14)} ${b.nurse ? esc(b.nurse.name) : t('any_nurse')}</div>` : ''}${b.step > 4 ? `<div>${ic('cal',14)} ${fmtDate(b.date)} · ${b.time}</div>` : ''}${fastH ? `<div style="color:var(--amber)">${ic('timer',14)} ${t('fasting',{h:fastH})}</div>` : ''}</div></div>`;
  let body = '';
  if (b.step === 1) {
    body = `<div class="card stack"><h3>${t('who_t')}</h3><div class="seg"><button data-who="me" class="${b.who === 'me' ? 'on' : ''}">${t('me')}</button><button data-who="family" class="${b.who === 'family' ? 'on' : ''}">${t('family')}</button></div>
      ${b.who === 'family' ? `<label class="field"><span>${t('full_name')}</span><input class="input" id="pn" value="${esc(b.person.name)}"></label>
      <div class="field"><span>${t('gender_q')}</span><div class="gpick"><button type="button" data-pg="female" class="${b.person.gender === 'female' ? 'on' : ''}">${ic('user',22)} ${t('female')}</button><button type="button" data-pg="male" class="${b.person.gender === 'male' ? 'on' : ''}">${ic('user',22)} ${t('male')}</button></div><div class="hint">${t('gender_hint')}</div></div>
      <div class="grid g2"><label class="field"><span>${t('relation')}</span><select class="input" id="pr">${['parent','child','spouse','other'].map(x => `<option value="${x}" ${b.person.relation === x ? 'selected' : ''}>${t('rel_'+x)}</option>`).join('')}</select></label>
      <label class="field"><span>${t('dob')}</span><input class="input" type="date" id="pd" value="${esc(b.person.dob)}"></label></div>
      <label class="field"><span>${t('civil_id')} <span class="muted">(${t('optional')})</span></span><input class="input" id="pc" inputmode="numeric" maxlength="10" value="${esc(b.person.civil_id || '')}" placeholder="${t('civil_ph')}"></label>` : `<div class="row"><span class="avatar">${esc(initials(S.user.full_name))}</span><div><b>${esc(S.user.full_name)}</b><div class="small muted">${t(g)} · ${esc(S.user.phone || S.user.email || '')}</div>${S.user.civil_id ? `<span class="chip gray" style="margin-top:6px">${ic('idcard',13)} •••• ${esc(String(S.user.civil_id).slice(-4))}</span>` : ''}</div></div><div class="hint">${t('gender_hint')}</div>`}</div>`;
  } else if (b.step === 2) {
    body = `<div class="card stack"><h3>${t('loc_t')}</h3>
      <div class="banner ${b.gps === 'ok' ? 'teal' : b.gps === 'denied' ? 'amber' : 'blue'}" id="gpsb">${ic('pin',22)}<div class="grow"><b>${b.gps === 'ok' ? t('gps_ok') : t('gps_ask_t')}</b><div class="small">${b.gps === 'denied' ? t('gps_denied') : b.gps === 'far' ? t('gps_far',{w:wN(b.wilayat)}) : t('gps_ask_p')}</div></div><button class="btn sm" id="gps">${t('use_gps')}</button></div>
      <label class="field"><span>${t('wilayat')}</span><select class="input" id="bw">${C.wilayats.map(w => `<option value="${esc(w)}" ${b.wilayat === w ? 'selected' : ''}>${esc(wN(w))}</option>`).join('')}</select></label>
      <div class="mapbox" id="bmap"></div><span class="hint">${t('pin_tip')}</span>
      <label class="field"><span>${t('address')}</span><textarea class="input" id="ba" rows="2" placeholder="${t('address_ph')}">${esc(b.address)}</textarea></label>
      <label class="field"><span>${t('notes')}</span><input class="input" id="bn" value="${esc(b.notes)}" placeholder="${t('notes_ph')}"></label></div>`;
  } else if (b.step === 3) {
    body = `<div class="card stack"><h3>${t('nurse_t')}</h3><p class="muted small" style="margin:0">${t('nurse_p',{w:esc(wN(b.wilayat)), g:t(bkNurseGender(b) === 'female' ? 'g_female' : 'g_male')})}</p><div class="banner blue small" style="margin:0">${ic('shield',18)}<span>${t(bkChild(b) ? 'nurse_rule_child' : 'nurse_rule')}</span></div>
      <button type="button" class="ncard ${!b.nurse ? 'on' : ''}" data-nurse=""><span class="avatar" style="background:var(--teal)">${ic('users',20)}</span><span class="grow" style="text-align:start"><b>${t('any_nurse')}</b><span class="xs muted" style="display:block">${t('any_nurse_d')}</span></span><span class="radio"></span></button>
      <div id="nlist" class="stack"><div class="skel" style="height:90px"></div></div></div>`;
  } else if (b.step === 4) {
    const now = muscatNow(); const days = Array.from({ length: 14 }, (_, i) => addDays(now.date, i));
    const ram = C.ramadan && b.date >= C.ramadan.from && b.date <= C.ramadan.to ? (C.ramadan.slots || []) : [];
    const slots = C.slots; const dis = s => b.date === now.date && (parseInt(s) * 60 <= now.mins + 60);
    const fl = String(C.fasting_last_slot || '10:00').replace(/"/g, ''); const lock = s => fastH > 0 && s > fl;
    if (b.time && lock(b.time)) b.time = '';
    const sbtn = s => `<button data-slot="${s}" class="${b.time === s ? 'on' : ''}${lock(s) ? ' locked' : ''}" ${dis(s) ? 'disabled' : ''} ${lock(s) ? `aria-disabled="true" title="${esc(t('fast_locked',{t:fl}))}"` : ''}>${lock(s) ? ic('lock',13) + ' ' : ''}${s}</button>`;
    body = `<div class="card stack"><h3>${t('date_t')}</h3><div class="cal">${days.map(d => { const x = new Date(d+'T12:00:00'); return `<button data-date="${d}" class="${b.date === d ? 'on' : ''}"><div class="xs" style="opacity:.75">${x.toLocaleDateString(loc(),{ weekday:'short' })}</div>${x.getDate()}</button>`; }).join('')}</div>
      <h3 style="margin-top:8px">${t('time_t')}</h3>${fastH ? `<div class="banner amber small" id="fastb">${ic('timer',20)}<span><b>${t('fast_banner_t',{h:fastH})}</b><br>${t('fast_banner_p',{t:fl})}</span></div>` : ''}
      <div class="small b muted">${ic('sun',14)} ${t('morning')}</div><div class="slots">${slots.filter(s => parseInt(s) < 13).map(sbtn).join('')}</div>
      <div class="small b muted">${t('evening')}${fastH ? ` · <span style="color:var(--amber)">${t('fast_evening')}</span>` : ''}</div><div class="slots">${slots.filter(s => parseInt(s) >= 13).map(sbtn).join('')}</div>${ram.length ? `<div class="small b muted">🌙 ${t('ram_slots')}</div><div class="slots">${ram.map(sbtn).join('')}</div>` : ''}</div>`;
  } else {
    body = `<div class="card stack"><h3>${t('review_t')}</h3>
      <div class="vline"><span class="muted">${t('patient')}</span><b>${esc(b.who === 'family' ? b.person.name : S.user.full_name)} · ${t(g)}</b></div>
      <div class="vline"><span class="muted">${t('location')}</span><b>${esc(wN(b.wilayat))}</b></div>
      ${kit ? `<div class="banner teal small">${ic('box',20)}<span><b>${t('kit_mode_t')}</b><br>${t('kit_mode_p')}</span></div>` : `<div class="vline"><span class="muted">${t('chosen_nurse')}</span><b>${b.nurse ? esc(b.nurse.name) : t('any_nurse')}</b></div>`}
      <div class="vline"><span class="muted">${t('appointment')}</span><b>${fmtDate(b.date)} · ${b.time}</b></div></div>
      <div class="card stack"><h3>${t('pay_t')}</h3>
      <div class="row"><input class="input grow" id="code" placeholder="${t('sponsor_code')}" value="${esc(b.code)}" style="text-transform:uppercase"><button class="btn soft" id="apply">${t('apply')}</button></div>
      ${b.program ? `<div class="banner teal">${ic('check',20)}<b>${t('sponsored_by',{c:esc(b.program.company)})} · ${esc(b.program.name)}</b></div>` : `
      ${dStamp ? `<div class="banner teal loyal-win">${ic('star',22)}<span><b>${t('free_visit_t')}</b><br><span class="small">${t('free_visit_p')}</span></span></div>` : ''}
      <div class="row"><input class="input grow" id="cpn" placeholder="${t('coupon')} · ${t('coupon_ph')}" value="${esc(b.coupon ? b.coupon.code : '')}" style="text-transform:uppercase" autocomplete="off"><button class="btn soft" id="cpa">${t('apply')}</button></div>
      ${b.coupon ? `<div class="small" style="color:var(--teal);font-weight:600">${ic('check',14)} ${t('coupon_ok',{x:omr(dCoupon)})}</div>` : ''}
      <div class="paym">${[['card','card','pay_card'],['applepay','phone','pay_apple']].map(([v, i, k]) => `<label class="${b.pay === v ? 'on' : ''}"><input type="radio" name="pay" value="${v}" ${b.pay === v ? 'checked' : ''}> ${ic(i)} <span class="grow b">${t(k)}</span></label>`).join('')}</div>
      ${b.pay === 'card' ? `<div class="grid g3"><label class="field" style="grid-column:1/-1"><span>${t('card_no')}</span><input class="input ltr" id="cn" inputmode="numeric" maxlength="23" placeholder="4242 4242 4242 4242" autocomplete="cc-number" style="width:100%"></label><label class="field"><span>${t('exp')}</span><input class="input ltr" id="ce" inputmode="numeric" maxlength="5" placeholder="12/28" autocomplete="cc-exp"></label><label class="field"><span>${t('cvv')}</span><input class="input ltr" id="cv" inputmode="numeric" maxlength="4" placeholder="123" autocomplete="cc-csc"></label></div>` : ''}
      <div class="banner blue small">${ic('shield',20)}<span>${t('epay_only')} ${t('test_mode')}</span></div>`}<p class="xs muted" style="margin:8px 0 0"><a class="b" href="#/guarantee">${t('guar_book')}</a></p></div>`;
  }
  const next = b.step < 5 ? `<button class="btn" id="nx">${t('next')} ${'<span class="flip">'+ic('arrow',18)+'</span>'}</button>` : `<button class="btn teal" id="pay">${b.program ? t('confirm_book') : t('confirm_pay',{x:omr(total)})}</button>`;
  app.innerHTML = shell(t('q_book'), `${head}<div class="grid" style="grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:18px" id="bkg">
    <div class="stack">${body}<div class="err" id="be"></div><div class="row">${b.step > 1 ? `<button class="btn ghost" id="pv">${t('back')}</button>` : `<a class="btn ghost" href="#/app/cart">${t('m_cart')}</a>`}<div class="grow"></div>${next}</div></div><div>${summary}</div></div>`, { back: true });
  if (innerWidth < 900) $('#bkg').style.gridTemplateColumns = 'minmax(0,1fr)';
  const err = m => $('#be').textContent = m;
  $$('[data-who]').forEach(x => x.onclick = () => { b.who = x.dataset.who; b.nurse = null; viewBook(); });
  $$('[data-pg]').forEach(x => x.onclick = () => { b.person.name = $('#pn').value; b.person.gender = x.dataset.pg; b.nurse = null; viewBook(); });
  $$('[data-date]').forEach(x => x.onclick = () => { b.date = x.dataset.date; b.time = ''; viewBook(); });
  $$('[data-slot]').forEach(x => x.onclick = () => { if (x.classList.contains('locked')) { err(t('fast_locked',{t:String(C.fasting_last_slot || '10:00').replace(/"/g, '')})); x.classList.remove('shake'); void x.offsetWidth; x.classList.add('shake'); const fb = $('#fastb'); if (fb) { fb.classList.remove('flash'); void fb.offsetWidth; fb.classList.add('flash'); } return; } b.time = x.dataset.slot; viewBook(); });
  $$('input[name=pay]').forEach(x => x.onchange = () => { b.pay = x.value; viewBook(); });
  if (b.step === 2) bookMap(b);
  if (b.step === 3) API.nursesToday(b.wilayat, bkNurseGender(b)).then(list => { const el = $('#nlist'); if (!el) return;
      el.innerHTML = list.length ? list.map(n => nurseCardHtml(n, b.nurse && b.nurse.id === n.id)).join('') : `<div class="banner amber small">${ic('clock',20)}<span>${t('no_nurses')}</span></div>`;
      bindNurses(list); }).catch(e => { $('#nlist').innerHTML = `<div class="err">${errMsg(e)}</div>`; });
  function bindNurses(list){ $$('[data-np]').forEach(x => x.onclick = e => { e.stopPropagation(); const n = list.find(y => y.id === x.dataset.np); if (n) partyModal('nurse', { nurse: n }); }); $$('[data-nurse]').forEach(x => x.onclick = () => { const id = x.dataset.nurse; b.nurse = id ? { id, name: (list.find(n => n.id === id) || {}).name } : null; $$('[data-nurse]').forEach(y => y.classList.toggle('on', y === x)); }); }
  if (b.step === 3) bindNurses([]);
  const keep = () => {
    if (b.step === 1 && b.who === 'family') { b.person = { name: $('#pn').value.trim(), relation: $('#pr').value, gender: b.person.gender, dob: $('#pd').value, civil_id: $('#pc').value.replace(/\D/g, '') || undefined }; }
    if (b.step === 2) { b.wilayat = $('#bw').value; b.address = $('#ba').value.trim(); b.notes = $('#bn').value.trim(); }
  };
  if ($('#pv')) $('#pv').onclick = () => { keep(); b.step--; b._back = true; viewBook(); };
  if ($('#cpa')) $('#cpa').onclick = async () => { const code = $('#cpn').value.trim().toUpperCase(); if (!code) { b.coupon = null; return viewBook(); }
    try { const r = await busy($('#cpa'), () => API.couponCheck(code, subNow)); b.coupon = r; if (window.FX) FX.celebrate('small'); viewBook(); } catch(e) { b.coupon = null; err(errMsg(e)); } };
  if ($('#nx')) $('#nx').onclick = () => { keep();
    if (b.step === 1 && b.who === 'family' && !b.person.name) return err(t('e_NEED_NAME'));
    if (b.step === 1 && b.who === 'family' && b.person.civil_id && !/^\d{6,10}$/.test(b.person.civil_id)) return err(t('e_BAD_CIVIL'));
    if (b.step === 2 && !b.address) return err(t('e_NEED_ADDRESS'));
    if (b.step === 4 && !b.time) return err(t('e_BAD_SLOT'));
    b.step++; viewBook(); window.scrollTo(0, 0); };
  if ($('#apply')) $('#apply').onclick = async () => { const code = $('#code').value.trim(); if (!code) return; b.code = code;
    try { const pr = await busy($('#apply'), () => API.programLookup(code)); b.program = pr; viewBook(); } catch(e) { b.program = null; err(errMsg(e)); } };
  if ($('#cn')) { $('#cn').oninput = e => { const d = e.target.value.replace(/\D/g, '').slice(0, 19); e.target.value = d.replace(/(\d{4})(?=\d)/g, '$1 '); }; }
  if ($('#ce')) { $('#ce').oninput = e => { let d = e.target.value.replace(/\D/g, '').slice(0, 4); if (d.length >= 3) d = d.slice(0, 2) + '/' + d.slice(2); e.target.value = d; }; }
  if ($('#cv')) { $('#cv').oninput = e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); }; }
  if ($('#pay')) $('#pay').onclick = async () => {
    if (!b.program && b.pay === 'card') { const n = ($('#cn').value || '').replace(/\D/g, ''); const ex = ($('#ce').value || '').trim(); const cv = ($('#cv').value || '').trim();
      if (!luhn(n) || !/^(0[1-9]|1[0-2])\/\d{2}$/.test(ex) || !/^\d{3,4}$/.test(cv)) return err(t('e_CARD')); }
    const p = { items: c.items.map(i => ({ type:i.type, id:i.id })), slot_date: b.date, slot_time: b.time, wilayat: b.wilayat, governorate: 'North Al Sharqiyah', address: b.address, lat: b.lat, lng: b.lng, notes: b.notes, payment_method: b.pay, nurse_id: b.nurse ? b.nurse.id : null };
    if (b.program) p.program_code = b.code; else if (b.coupon) p.coupon = b.coupon.code;
    p.person = b.who === 'family' ? b.person : { name: S.user.full_name, gender: g, dob: (S.user.meta || {}).dob, relation: 'self' };
    try { const o = await busy($('#pay'), () => API.orderCreate(p)); S.cart = { packages:[], tests:[] }; saveCart(); S.bk = null; S.loy = undefined; bookedScreen(o); } catch(e) { err(errMsg(e)); }
  };
}
function luhn(n){ if (n.length < 13 || n.length > 19) return false; let s = 0, alt = false; for (let i = n.length - 1; i >= 0; i--) { let d = +n[i]; if (alt) { d *= 2; if (d > 9) d -= 9; } s += d; alt = !alt; } return s % 10 === 0; }
function bookMap(b){
  const el = $('#bmap');
  const askGps = (m, mk, set) => { if (!navigator.geolocation) { b.gps = 'denied'; return; }
    navigator.geolocation.getCurrentPosition(p => { const x = [p.coords.latitude, p.coords.longitude]; const nw = nearestWilayat(x[0], x[1]);
      b.wilayat = nw.w; b.gps = nw.km > 45 ? 'far' : 'ok'; if (m) { m.setView(x, 16); mk.setLatLng(x); set(mk.getLatLng()); } else { b.lat = x[0]; b.lng = x[1]; }
      const sel = $('#bw'); if (sel) sel.value = nw.w; updBanner(); },
      () => { b.gps = 'denied'; updBanner(); }, { enableHighAccuracy:true, timeout:10000, maximumAge:60000 }); };
  const updBanner = () => { const bn = $('#gpsb'); if (!bn) return; bn.className = 'banner ' + (b.gps === 'ok' ? 'teal' : b.gps === 'denied' || b.gps === 'far' ? 'amber' : 'blue');
    $('b', bn).textContent = b.gps === 'ok' ? t('gps_ok') : t('gps_ask_t'); $('.small', bn).textContent = b.gps === 'denied' ? t('gps_denied') : b.gps === 'far' ? t('gps_far',{w:wN(b.wilayat)}) : t('gps_ask_p'); };
  const draw = () => { if (!document.body.contains(el)) return; if (!(needL(), window.L)) { if (!b.gps) { b.gps = 'asked'; askGps(null); } $('#gps').onclick = () => askGps(null); return setTimeout(draw, 300); }
    const ll = b.lat && b.lng ? [b.lat, b.lng] : (WILAYAT_LL[b.wilayat] || WILAYAT_LL.Ibra);
    const touch = matchMedia('(pointer:coarse)').matches; const m = L.map(el, { zoomControl:true, tap:false, dragging:!touch, scrollWheelZoom:false, touchZoom:'center', bounceAtZoomLimits:false }).setView(ll, b.lat ? 16 : 13); if (touch) el.classList.add('map-tap');
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19, attribution:'© OpenStreetMap' }).addTo(m);
    const mk = L.marker(ll, { draggable:true }).addTo(m);
    const set = p => { b.lat = +p.lat.toFixed(6); b.lng = +p.lng.toFixed(6); };
    set(mk.getLatLng());
    mk.on('dragend', () => set(mk.getLatLng())); m.on('click', e => { mk.setLatLng(e.latlng); set(e.latlng); });
    $('#bw').onchange = () => { b.wilayat = $('#bw').value; b.nurse = null; const w = WILAYAT_LL[b.wilayat]; if (w) { m.setView(w, 14); mk.setLatLng(w); set(mk.getLatLng()); } };
    $('#gps').onclick = () => askGps(m, mk, set);
    if (!b.gps) { b.gps = 'asked'; askGps(m, mk, set); }
  }; draw();
}
function bookedScreen(o){
  app.innerHTML = shell(t('booked_t'), `<div class="card pad-lg center" style="max-width:560px;margin:20px auto">
    <div style="width:84px;height:84px;border-radius:50%;background:var(--teal-bg);color:var(--teal);display:grid;place-items:center;margin:0 auto 14px">${ic('check',46,2.6)}</div>
    <h2 data-split>${t('booked_t')}</h2><p class="muted">${t('booked_p',{c:esc(o.code)})}</p>${o.disc && o.disc.stamp ? `<div class="banner teal loyal-win" style="text-align:start">${ic('star',22)}<b>${t('booked_free')}</b></div>` : ''}
    <div class="card flat" style="text-align:start;margin:16px 0"><div class="vline"><span class="muted">${t('appointment')}</span><b>${fmtDate(o.slot_date)} · ${esc(o.slot_time)}</b></div><div class="vline"><span class="muted">${t('location')}</span><b>${esc(wN(o.wilayat))}</b></div><div class="vline" style="border:0"><span class="muted">${t('total')}</span><b class="num">${omr(o.total)} ${t('omr')}</b></div></div>
    <a class="btn block" href="#/app/order/${o.id}">${t('track_btn')}</a><a class="btn ghost block" style="margin-top:10px" href="#/app/loyalty">${ic('star',18)} ${t('m_loyalty')}</a></div>`);
  if (window.FX) { FX.scan(app); setTimeout(() => FX.celebrate('big'), 250); }
}

/* order detail – shared by all roles */
async function viewOrder(id){
  clearTimers();
  let o;
  try { o = await API.order(id); } catch(e) { app.innerHTML = shell('', emptyBox(errMsg(e))); return; }
  drawOrder(o);
  if (ACTIVE(o.status)) S.timers.push(setInterval(async () => { if (!location.hash.includes('/order/' + id) || document.hidden) return; const ae = document.activeElement; if (ae && ae.matches && ae.matches('input,textarea,select')) return; try { const n = await API.order(id); if (n.updated_at !== o.updated_at && !$('.modal-bg') && !$('#results-form')) { o = n; const y = window.scrollY; drawOrder(o); window.scrollTo(0, y); } } catch(e) {} }, 8000));
}
const STEP_IC = { booked:'cal', assigned:'check', on_the_way:'truck', arrived:'pin', collected:'syringe', in_transit:'van', at_lab:'flask', processing:'gear', completed:'file' };
const STEP_ROLE = { booked:'patient', assigned:'nurse', on_the_way:'nurse', arrived:'nurse', collected:'nurse', in_transit:'courier', at_lab:'courier', processing:'lab', completed:'lab' };
function durTxt(ms){ const m = Math.max(0, Math.round(ms / 60000)); if (m < 60) return t('dur_m',{n:m}); const h = Math.floor(m / 60), r = m % 60; if (h < 48) return r ? t('dur_hm',{h, m:r}) : t('dur_h',{n:h}); return t('dur_d',{n:Math.round(h / 24)}); }
function slotAt(o){ return new Date(o.slot_date + 'T' + (o.slot_time || '08:00') + ':00+04:00'); }
function expectAt(o, s, ev){
  const slot = slotAt(o).getTime(); const tat = Math.max(12, ...(o.tests || []).map(x => x.tat_hours || 24));
  const base = ev.collected ? new Date(ev.collected).getTime() : slot + 20 * 60000;
  const m = { on_the_way: slot - 25 * 60000, arrived: slot, collected: slot + 15 * 60000, in_transit: base + 40 * 60000, at_lab: base + 110 * 60000, processing: base + 130 * 60000, completed: base + tat * 3600000 }[s];
  return m ? new Date(m) : null;
}
function fastStart(o){ const h = Math.max(0, ...(o.tests || []).map(x => x.fasting_hours || 0)); return h ? { h, at: new Date(slotAt(o).getTime() - h * 3600000) } : null; }
function icsDownload(o){
  const st = slotAt(o), en = new Date(st.getTime() + 30 * 60000); const f = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const fs = fastStart(o); const link = location.origin + location.pathname + '#/app/order/' + o.id;
  const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//iLab@home//Oman//EN','CALSCALE:GREGORIAN','BEGIN:VEVENT','UID:' + o.id + '@labathome.om','DTSTAMP:' + f(new Date()),'DTSTART:' + f(st),'DTEND:' + f(en),
    'SUMMARY:iLab@home ' + o.code + ' – nurse home visit','LOCATION:' + String(o.address || wN(o.wilayat)).replace(/[,;\n]/g, ' '),
    'DESCRIPTION:' + (fs ? 'Fasting ' + fs.h + 'h – stop eating by ' + fmtTime(fs.at) + '. ' : '') + 'Track: ' + link, 'URL:' + link,
    'BEGIN:VALARM','TRIGGER:' + (fs ? '-PT' + (fs.h + 1) + 'H' : '-PT2H'),'ACTION:DISPLAY','DESCRIPTION:iLab@home ' + o.code,'END:VALARM','END:VEVENT','END:VCALENDAR'];
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([lines.join('\r\n')], { type:'text/calendar' })); a.download = o.code + '.ics'; document.body.appendChild(a); a.click(); a.remove();
}
function partyRow(kind, p, state){
  const col = kind === 'nurse' ? (p && p.gender === 'female' ? '#e8466f' : '#2563eb') : kind === 'courier' ? '#f59e0b' : '#0fae9b';
  if (!p) return `<div class="party wait"><span class="pav" style="background:#e6ecf6;color:#8a97b0">${ic(kind === 'nurse' ? 'syringe' : kind === 'courier' ? 'van' : 'flask', 22)}</span><div class="grow"><div class="xs muted b">${t('pt_' + kind)}</div><b class="muted">${t('pt_wait_' + kind)}</b></div><span class="pulse"></span></div>`;
  const sub = kind === 'nurse' ? `${p.rating ? '★ ' + p.rating + ' · ' : ''}${t('visits',{n:p.visits})}${p.years ? ' · ' + t('years_exp',{n:esc(p.years)}) : ''}`
    : kind === 'courier' ? `${esc(p.company || '')}${p.vehicle ? ' · ' + esc(p.vehicle) : ''}`
    : `${esc(p.accreditation || '')}${p.wilayat ? ' · ' + esc(wN(p.wilayat)) : ''}`;
  return `<button type="button" class="party" data-party="${kind}"><span class="pav" style="background:${col}">${kind === 'lab' ? ic('flask', 22) : esc(initials(p.name))}</span>
    <div class="grow"><div class="xs muted b">${t('pt_' + kind)} ${state ? `<span class="chip ${state === 'done' ? 'teal' : ''} xs-chip">${t(state === 'done' ? 'pt_done' : 'pt_now')}</span>` : ''}</div><b>${esc(p.name)}</b><div class="xs muted">${sub}</div></div>${ic('arrow', 18)}</button>`;
}
async function partyModal(kind, o){
  if (kind === 'nurse') {
    let n = o.nurse; try { n = Object.assign({}, n, await API.nurseProfile(o.nurse.id)); } catch(e) {}
    const col = n.gender === 'female' ? '#e8466f' : '#2563eb';
    return modal(`<div class="pm-head"><span class="pav xl" style="background:${col}">${esc(initials(n.name))}</span><div><h3 style="margin:0">${esc(n.name)}</h3><div class="small muted">${t('r_nurse')} · ${t(n.gender === 'female' ? 'female' : 'male')} · ${esc(wN(n.wilayat))}</div>
      <div class="row wrap" style="gap:6px;margin-top:8px"><span class="chip teal">${ic('shield',12)} ${t('verified')}</span>${n.rating ? `<span class="chip amber">★ ${n.rating} · ${t('reviews_n',{n:n.reviews || 0})}</span>` : ''}</div></div></div>
      <div class="pm-stats"><div><b>${n.visits}</b><span>${t('visits_l')}</span></div><div><b>${esc(n.years || '—')}</b><span>${t('years')}</span></div><div><b>${esc(n.since || '—')}</b><span>${t('since')}</span></div></div>
      ${n.bio ? `<p style="margin:12px 0 0">${esc(n.bio)}</p>` : ''}
      <div class="vline"><span class="muted">${t('licence')}</span><b class="ltr">${esc(n.license || '—')}</b></div>
      <div class="vline"><span class="muted">${t('langs')}</span><b>${(n.languages || []).map(esc).join(' · ')}</b></div>
      ${(n.specialties || []).length ? `<div class="vline"><span class="muted">${t('specialties')}</span><span class="row wrap" style="gap:4px;justify-content:flex-end">${n.specialties.map(x => `<span class="chip gray">${esc(x)}</span>`).join('')}</span></div>` : ''}
      ${(n.coverage || []).length ? `<div class="vline"><span class="muted">${t('coverage')}</span><span class="small" style="text-align:end">${n.coverage.map(w => esc(wN(w))).join(' · ')}</span></div>` : ''}
      ${(n.recent || []).filter(x => x.review).length ? `<h4 style="margin:14px 0 6px">${t('recent_reviews')}</h4>${n.recent.filter(x => x.review).map(x => `<div class="rev"><span style="color:var(--amber)">${'★'.repeat(x.rating)}</span> <span class="small">${esc(x.review)}</span><div class="xs muted">${ago(x.at)}</div></div>`).join('')}` : ''}
      <button class="btn ghost block" data-x style="margin-top:14px">${t('close')}</button>`, (el, close) => { $('[data-x]', el).onclick = close; });
  }
  if (kind === 'lab') { const l = o.lab;
    return modal(`<div class="pm-head"><span class="pav xl" style="background:#0fae9b">${ic('flask', 30)}</span><div><h3 style="margin:0">${esc(l.name)}</h3><div class="small muted">${t('r_lab')} · ${esc(wN(l.wilayat))}</div><div class="row wrap" style="gap:6px;margin-top:8px">${l.accreditation ? `<span class="chip teal">${ic('award',12)} ${esc(l.accreditation)}</span>` : ''}</div></div></div>
      <div class="pm-stats"><div><b>${l.done || 0}</b><span>${t('reports_done')}</span></div><div><b>${esc(l.tat || '24 h')}</b><span>${t('tat_l')}</span></div><div><b>2–8 °C</b><span>${t('cold_chain')}</span></div></div>
      <div class="vline"><span class="muted">${t('lab_license')}</span><b class="ltr">${esc(l.license || '—')}</b></div>
      ${l.director ? `<div class="vline"><span class="muted">${t('director')}</span><b>${esc(l.director)}</b></div>` : ''}
      ${l.hours ? `<div class="vline"><span class="muted">${t('hours')}</span><b>${esc(l.hours)}</b></div>` : ''}
      ${l.address ? `<div class="vline"><span class="muted">${t('address')}</span><span class="small" style="text-align:end">${esc(l.address)}</span></div>` : ''}
      <div class="row" style="margin-top:14px">${l.lat ? `<a class="btn soft sm grow" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${l.lat},${l.lng}">${ic('pin',16)} ${t('open_maps')}</a>` : ''}${l.phone ? `<a class="btn soft sm grow" href="tel:${esc(l.phone)}">${ic('phone',16)} ${t('call')}</a>` : ''}<button class="btn ghost sm grow" data-x>${t('close')}</button></div>`, (el, close) => { $('[data-x]', el).onclick = close; });
  }
  const c = o.courier;
  return modal(`<div class="pm-head"><span class="pav xl" style="background:#f59e0b">${esc(initials(c.name))}</span><div><h3 style="margin:0">${esc(c.name)}</h3><div class="small muted">${t('r_courier')} · ${esc(c.company || '')}</div><div class="row wrap" style="gap:6px;margin-top:8px"><span class="chip teal">${ic('thermo',12)} 2–8 °C</span></div></div></div>
    ${c.vehicle ? `<div class="vline"><span class="muted">${t('vehicle')}</span><b>${esc(c.vehicle)}</b></div>` : ''}
    ${c.plate ? `<div class="vline"><span class="muted">${t('plate')}</span><b class="ltr">${esc(c.plate)}</b></div>` : ''}
    ${(c.coverage || []).length ? `<div class="vline"><span class="muted">${t('coverage')}</span><span class="small" style="text-align:end">${c.coverage.map(w => esc(wN(w))).join(' · ')}</span></div>` : ''}
    ${o.sample_temp != null ? `<div class="vline"><span class="muted">${t('temp')}</span><b class="num">${esc(o.sample_temp)} °C</b></div>` : ''}
    <div class="row" style="margin-top:14px">${c.phone ? `<a class="btn soft sm grow" href="tel:${esc(c.phone)}">${ic('phone',16)} ${t('call')}</a>` : ''}<button class="btn ghost sm grow" data-x>${t('close')}</button></div>`, (el, close) => { $('[data-x]', el).onclick = close; });
}
const stL = (o, s) => o.mode === 'self' && I18N.en['st_k_' + s] ? t('st_k_' + s) : t('st_' + s);
/* the van rides along a little road up to the current step */
function rideSvg(pct){
  return `<svg class="ride" viewBox="0 0 640 84" role="img" aria-label="${pct}%"><defs><linearGradient id="rdg" x1="0" x2="1"><stop offset="0" stop-color="#1257d6"/><stop offset="1" stop-color="#18b5d8"/></linearGradient></defs>
    <path class="fx-road-bg" d="M24 60 C 140 18, 250 78, 360 44 S 560 30, 616 46" fill="none" stroke="#e3e9f4" stroke-width="10" stroke-linecap="round"/>
    <path class="fx-road" d="M24 60 C 140 18, 250 78, 360 44 S 560 30, 616 46" fill="none" stroke="url(#rdg)" stroke-width="10" stroke-linecap="round" stroke-dasharray="1 0" pathLength="100" style="stroke-dasharray:${pct} 100"/>
    <g class="fx-pins"><circle cx="24" cy="60" r="9" fill="#fff" stroke="#1257d6" stroke-width="3"/><path d="M612 26c-6 0-10 4-10 10 0 7 10 16 10 16s10-9 10-16c0-6-4-10-10-10z" fill="#0fae9b"/><circle cx="612" cy="36" r="3.5" fill="#fff"/></g>
    <g class="fx-van"><g transform="translate(-22,-26)"><rect x="2" y="6" width="30" height="18" rx="4" fill="#1257d6"/><path d="M32 11h7l5 6v7H32z" fill="#2f7bff"/><rect x="6" y="10" width="9" height="6" rx="1.5" fill="#cfe0ff"/><path d="M19 11h6M22 8v6" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><circle cx="11" cy="25" r="4" fill="#0f1b33"/><circle cx="35" cy="25" r="4" fill="#0f1b33"/><circle cx="11" cy="25" r="1.6" fill="#fff"/><circle cx="35" cy="25" r="1.6" fill="#fff"/></g></g></svg>`;
}
function placeVan(svg, pct){ try { const path = $('.fx-road', svg), van = $('.fx-van', svg); const L = path.getTotalLength(); const pt = path.getPointAtLength(L * Math.max(0, Math.min(1, pct))); van.setAttribute('transform', `translate(${pt.x},${pt.y})`); } catch(e) {} }
const STEP_ICON2 = { collected:'syringe', pickup:'van', check:'thermo', handover:'flask', lab_received:'check' };
function chainCard(o){
  const sc = o.scans || []; const r = S.user.role;
  const canLog = ['nurse','courier','lab','admin','staff'].includes(r) && ['collected','in_transit','at_lab','processing'].includes(o.status) && !(S.user.is_demo && r === 'admin');
  if (!sc.length && !canLog) return '';
  const first = sc.find(x => x.step === 'collected'); const age = first ? Date.now() - new Date(first.at) : 0; const live = ['collected','in_transit'].includes(o.status);
  const tchip = v => v == null ? '' : `<span class="chip ${v >= 2 && v <= 8 ? 'teal' : 'red'} num">${ic('thermo',13)} ${esc(v)} °C</span>`;
  return `<div class="card chain"><div class="row between wrap"><h3 style="margin:0">${ic('thermo',20)} ${t('chain_t')}</h3>${first && live ? `<span class="chip ${age > 4 * 3600e3 ? 'red' : 'gray'}">${ic('clock',13)} ${t('chain_age',{d:durTxt(age)})}</span>` : ''}</div>
    <p class="xs muted" style="margin:6px 0 10px">${t('chain_p')} <a class="b" href="#/guarantee">${t('m_guarantee')}</a></p>
    ${first && live && age > 4 * 3600e3 ? `<div class="banner red small">${ic('clock',18)}<span>${t('chain_old')}</span></div>` : ''}
    <ol class="chain-l">${sc.map(x => `<li><span class="cd">${ic(STEP_ICON2[x.step] || 'check',15,2.2)}</span><div class="grow"><b>${t('step_' + x.step)}</b><div class="xs muted">${fmtDT(x.at)}</div></div>${tchip(x.temp)}</li>`).join('')}</ol>
    ${canLog ? `<button class="btn soft sm" data-act="chain" style="margin-top:10px">${ic('thermo',16)} ${t('chain_check')}</button>` : ''}</div>`;
}
function safetyRow(o){
  const r = S.user.role; const u = S.user;
  const nurseOn = r === 'nurse' && o.nurse_id === u.id && ['assigned','on_the_way','arrived','collected'].includes(o.status);
  const courierOn = r === 'courier' && o.courier_id === u.id && ['assigned','on_the_way','arrived','collected','in_transit'].includes(o.status);
  if (!nurseOn && !courierOn) return '';
  return `<div class="card safety"><div class="row" style="gap:12px;align-items:center"><button class="sos" data-sos aria-label="${t('sos_hold')}"><span class="sos-ring"></span>${t('sos_btn')}</button><div class="grow"><div class="small b">${t('sos_hold')}</div><button class="link small" data-act="incident">${ic('file',14)} ${t('inc_btn')}</button></div></div></div>`;
}
function drawOrder(o){
  const u = S.user, r = u.role;
  const idx = STATUS.indexOf(o.status);
  const ev = {}, by = {}; (o.events || []).forEach(e => { ev[e.status] = e.at; if (e.by) by[e.status] = e.by; });
  const pct = o.status === 'cancelled' ? 0 : Math.round(Math.max(0, idx) / (STATUS.length - 1) * 100);
  const created = new Date(ev.booked || o.created_at);
  let eta = '';
  if (o.status === 'on_the_way') { const m = Math.max(3, 18 - Math.round((Date.now() - new Date(ev.on_the_way)) / 60000)); eta = `<div class="banner blue">${ic('truck',22)}<div><b>${t('st_on_the_way')}</b><div class="small">${t('eta',{m})}</div></div></div>`; }
  let prev = null;
  const tl = `<ul class="tl tl2">${STATUS.map((s, i) => { const cls = o.status === 'cancelled' ? 'todo' : i < idx || o.status === 'completed' ? 'done' : i === idx ? 'now' : 'todo';
      const at = ev[s] ? new Date(ev[s]) : null; const gap = at && prev ? at - prev : null; if (at) prev = at;
      const exp = !at && cls === 'todo' && o.status !== 'cancelled' ? expectAt(o, s, ev) : null;
      return `<li class="${cls}"><span class="dotc">${cls === 'done' ? ic('check',16,2.6) : cls === 'now' ? ic(STEP_IC[s],15,2.2) : ic(STEP_IC[s],14,2)}</span><div class="grow"><div class="row between" style="gap:8px"><b>${stL(o, s)}</b>${at ? `<span class="tm">${fmtTime(at)}</span>` : exp ? `<span class="tm exp">≈ ${fmtTime(exp)}</span>` : ''}</div>
        <div class="xs muted">${at ? `${fmtDate(at, { day:'numeric', month:'short' })}${by[s] ? ' · ' + t('by_x',{x:esc(by[s])}) : ''}${gap != null && i ? ` · <span class="gap">+${durTxt(gap)}</span>` : ''}` : exp ? `${t('expected')} · ${fmtDate(exp, { weekday:'short', day:'numeric', month:'short' })}` : t('st_d_' + s)}</div></div></li>`; }).join('')}
    ${o.status === 'cancelled' ? `<li class="now"><span class="dotc" style="background:var(--red)">${ic('x',16,2.6)}</span><div><b>${t('st_cancelled')}</b><div class="xs muted">${fmtDT(ev.cancelled)}</div></div></li>` : ''}</ul>`;
  const totalTxt = o.status === 'completed' && ev.completed ? t('turnaround',{d:durTxt(new Date(ev.completed) - created)}) : o.status !== 'cancelled' ? t('elapsed',{d:durTxt(Date.now() - created)}) : '';
  const stDone = k => ({ nurse: idx >= 4, courier: idx >= 6, lab: idx >= 8 })[k];
  const stNow = k => ({ nurse: idx >= 1 && idx < 4, courier: idx >= 4 && idx < 6, lab: idx >= 6 && idx < 8 })[k];
  const team = o.status === 'cancelled' ? '' : `<div class="card"><div class="row between"><h3 style="margin:0">${t('care_team')}</h3><span class="xs muted">${t('care_team_p')}</span></div><div class="stack" style="--g:8px;margin-top:12px">
    ${(o.mode === 'self' ? ['courier','lab'] : ['nurse','courier','lab']).map(k => partyRow(k, o[k], o[k] ? (stDone(k) ? 'done' : stNow(k) ? 'now' : '') : '')).join('')}</div></div>`;
  const tests = `<div class="card"><h3>${t('tests')}</h3>${(o.tests || []).map(x => `<div class="vline"><div><b>${esc(LN(x,'name'))}</b><div class="xs muted">${t('tube')}: ${esc(x.tube)} · ${x.fasting_hours ? t('fasting',{h:x.fasting_hours}) : t('no_fasting')} · ${t('tat_x',{h:x.tat_hours || 24})}</div></div></div>`).join('')}</div>`;
  const pat = o.patient || {};
  const details = `<div class="card"><h3>${t('details')}</h3>
    <div class="vline"><span class="muted">${t('patient')}</span><b>${esc(pat.name)}${pat.relation && pat.relation !== 'self' ? ` <span class="chip gray">${t('rel_'+pat.relation)}</span>` : ''}</b></div>
    ${pat.civil_last4 ? `<div class="vline"><span class="muted">${ic('idcard',16)} ${t('civil_id')}</span><b class="ltr">•••• ${esc(pat.civil_last4)}${r === 'nurse' ? `<div class="xs muted" style="font-weight:500">${t('civil_verify')}</div>` : ''}</b></div>` : ''}
    <div class="vline"><span class="muted">${t('appointment')}</span><b>${fmtDate(o.slot_date)} · ${esc(o.slot_time)}</b></div>
    <div class="vline"><span class="muted">${t('booked_at')}</span><b>${fmtDT(created)}</b></div>
    <div class="vline"><span class="muted">${t('location')}</span><b style="text-align:end">${esc(wN(o.wilayat))}${o.address ? `<div class="small muted" style="font-weight:500">${esc(o.address)}</div>` : r === 'nurse' ? `<div class="xs muted" style="font-weight:500">${t('addr_hidden')}</div>` : ''}</b></div>
    ${o.notes && o.address ? `<div class="vline"><span class="muted">${t('notes_l')}</span><span>${esc(o.notes)}</span></div>` : ''}
    ${pat.phone && r !== 'patient' ? `<div class="vline"><span class="muted">${t('phone')}</span><a class="btn soft sm ltr" href="tel:${esc(pat.phone)}">${ic('phone',16)} ${esc(pat.phone)}</a></div>` : ''}
    ${r !== 'nurse' && r !== 'courier' && r !== 'lab' ? `<div class="vline"><span class="muted">${t('payment')}</span><b>${omr(o.total)} ${t('omr')} · <span class="chip ${o.paid_at ? 'teal' : 'amber'}">${o.payment_method === 'sponsored' ? t('sponsored') : o.paid_at ? t('paid') : t('pay_at_visit')}</span></b></div>` : ''}
    ${o.sample_temp != null ? `<div class="vline"><span class="muted">${ic('thermo',16)} ${t('temp')}</span><b class="num">${esc(o.sample_temp)} °C <span class="chip ${o.sample_temp >= 2 && o.sample_temp <= 8 ? 'teal' : 'red'}">${o.sample_temp >= 2 && o.sample_temp <= 8 ? t('in_range') : t('out_range')}</span></b></div>` : ''}
    ${o.reject_reason ? `<div class="banner red small" style="margin-top:10px">${ic('x',18)}<span>${esc(o.reject_reason)}</span></div>` : ''}</div>`;
  const fs = fastStart(o);
  const prep = r === 'patient' && fs && ['booked','assigned'].includes(o.status) ? `<div class="card prep"><div class="row" style="align-items:flex-start">${ic('timer',30)}<div class="grow"><b>${t('prep_t',{h:fs.h})}</b><div class="small">${t('prep_p',{t:fmtTime(fs.at), d:fmtDate(fs.at)})}</div>
      <ul class="small" style="margin:8px 0 0;padding-inline-start:18px"><li>${t('prep_1')}</li><li>${t('prep_2')}</li><li>${t('prep_3')}</li></ul></div></div></div>` : '';
  const acts = actionPanel(o);
  const tools = r === 'patient' ? `<div class="row wrap" style="margin-top:14px;gap:8px">
      ${o.status === 'completed' ? `<a class="btn teal sm" href="#/app/report/${o.id}">${ic('file',16)} ${t('view_report')}</a><button class="btn soft sm" data-again>${ic('plus',16)} ${t('book_again')}</button>` : ''}
      ${ACTIVE(o.status) && idx < 4 ? `<button class="btn soft sm" data-ics>${ic('cal',16)} ${t('add_cal')}</button>` : ''}
      <button class="btn ghost sm" data-copy>${ic('copy',16)} ${t('copy_code')}</button></div>` : o.status === 'completed' ? `<div class="row wrap" style="margin-top:14px"><a class="btn teal sm" href="#/app/report/${o.id}">${ic('file',16)} ${t('view_report')}</a></div>` : '';
  const head = `<div class="card ohead"><div class="row between wrap"><div><div class="small muted">${t('request')}</div><h2 style="margin:0" class="ltr">${esc(o.code)}</h2></div><div class="row" style="gap:8px">${ACTIVE(o.status) ? `<span class="live"><i></i>${t('live')}</span>` : ''}${o.mode === 'self' && I18N.en['st_k_' + o.status] ? `<span class="chip blue">${stL(o, o.status)}</span>` : stChip(o.status)}</div></div>
    ${o.status !== 'cancelled' ? rideSvg(pct) : `<div class="progress" style="margin-top:14px"><i style="width:${pct}%"></i></div>`}
    <div class="row between xs muted" style="margin-top:8px"><span>${ic('clock',13)} ${totalTxt}</span><span>${t('step_x',{a:Math.max(1, idx + 1), b:STATUS.length})}</span></div>${tools}</div>`;
  const map = o.lat && (r === 'nurse' || r === 'admin') ? `<div class="card" style="padding:0;overflow:hidden"><div class="mapbox" id="omap" style="border-radius:0;height:220px"></div>${o.address ? `<div style="padding:12px"><a class="btn soft sm" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${o.lat},${o.lng}">${ic('pin',16)} ${t('open_maps')}</a></div>` : ''}</div>` : '';
  app.innerHTML = shell(esc(o.code), `<div class="grid" id="og" style="grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:18px;align-items:start">
    <div class="stack">${head}${acts}${safetyRow(o)}${careBlock(o)}${eta}${prep}${o.status === 'completed' && r === 'patient' ? rateBox(o) : ''}${map}${team}${chainCard(o)}${details}${tests}</div>
    <div class="stack"><div class="card"><h3>${t('q_track')}</h3>${tl}</div></div></div>`, { back: true });
  if (innerWidth < 900) $('#og').style.gridTemplateColumns = 'minmax(0,1fr)';
  bindActions(o); bindCare(o, drawOrder);
  const rs = $('.ride'); if (rs) { placeVan(rs, pct / 100); if (window.FX && !o._rode) { o._rode = 1; placeVan(rs, 0); const go = () => window.gsap ? FX.ride(rs, pct / 100) : placeVan(rs, pct / 100); setTimeout(go, FX.ready ? 60 : 900); } }
  $$('[data-party]').forEach(b => b.onclick = () => partyModal(b.dataset.party, o));
  if ($('[data-ics]')) $('[data-ics]').onclick = () => { icsDownload(o); toast(t('cal_ok')); };
  if ($('[data-copy]')) $('[data-copy]').onclick = () => copyText(o.code);
  if ($('[data-again]')) $('[data-again]').onclick = async () => { await loadCatalog(); const ids = (o.tests || []).map(x => x.id).filter(id => S.catalog.T[id]); S.cart = { packages: [], tests: ids }; saveCart(); toast(t('again_ok')); go('app/cart'); };
  if ($('#omap')) { const draw = () => { if (!document.getElementById('omap')) return; if (!(needL(), window.L)) return setTimeout(draw, 200); const touch = matchMedia('(pointer:coarse)').matches; const m = L.map('omap', { scrollWheelZoom:false, dragging:!touch, tap:false }).setView([o.lat, o.lng], o.address ? 15 : 12); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19, attribution:'© OpenStreetMap' }).addTo(m); if (o.address) L.marker([o.lat, o.lng]).addTo(m); else L.circle([o.lat, o.lng], { radius:1500, color:'#2563eb' }).addTo(m); }; draw(); }
}

function rateBox(o){
  if (o.rating) return `<div class="card"><b>${t('rate_t')}</b><div style="color:var(--amber);font-size:1.4rem">${'★'.repeat(o.rating)}${'☆'.repeat(5 - o.rating)}</div></div>`;
  return `<div class="card" id="rate"><b>${t('rate_t')}</b><div class="row" style="margin:8px 0;font-size:2rem;color:#d3dbea;gap:4px">${[1,2,3,4,5].map(i => `<button class="link" data-star="${i}" style="font-size:2rem;color:inherit">★</button>`).join('')}</div><input class="input" id="rv" placeholder="…"><button class="btn sm" id="rs" style="margin-top:10px">${t('rate_send')}</button></div>`;
}
function actionPanel(o){
  const u = S.user, r = u.role; const s = o.status; let h = '';
  if (r === 'patient') {
    if (u.is_demo && ACTIVE(s)) h += `<div class="card" style="background:linear-gradient(120deg,#efeaff,#e8f1ff)"><div class="small" style="color:#3b2fa0">${ic('play',16)} ${t('demo_hint')}</div><div class="row wrap" style="margin-top:12px"><button class="btn sm" data-act="demo">${ic('next',16)} ${t('demo_next')}</button><button class="btn sm dark" data-act="demoall">${ic('play',16)} ${t('demo_auto')}</button></div></div>`;
    if (o.mode === 'self' && s === 'arrived') h += `<div class="card selfcol"><div class="row" style="gap:12px;align-items:flex-start"><span class="lv-ic" style="background:var(--teal-bg);color:var(--teal)">${ic('box',24)}</span><div class="grow"><b>${t('self_t')}</b><div class="small">${t('self_p')}</div>
      <ul class="small" style="margin:8px 0 0;padding-inline-start:18px">${(o.tests || []).map(x => `<li>${esc(LN(x,'name'))} · <span class="muted">${esc(x.tube)}</span></li>`).join('')}</ul>
      <label class="check" style="margin-top:10px"><input type="checkbox" id="selfck"> ${t('self_ck')}</label><button class="btn teal" style="margin-top:10px" data-act="selfdone">${ic('check',18)} ${t('self_btn')}</button></div></div></div>`;
    if (['booked','assigned','recollect'].includes(s)) h += `<button class="btn ghost sm" data-act="cancel" style="align-self:flex-start">${ic('x',16)} ${t('cancel_req')}</button>`;
  }
  if (r === 'nurse') {
    const mine = !!o.nurse;
    if (['booked','recollect'].includes(s) && !o.nurse) h = `<button class="btn teal block" data-act="accept">${ic('check',18)} ${t('accept')}</button>`;
    if (mine && s === 'assigned') h = `<button class="btn block" data-act="start">${ic('truck',18)} ${t('start_trip')}</button>`;
    if (mine && s === 'on_the_way') h = `<button class="btn block" data-act="arrive">${ic('pin',18)} ${t('arrived_btn')}</button>`;
    if (mine && s === 'arrived') h = `<button class="btn teal block" data-act="collect">${ic('syringe',18)} ${t('collect_btn')}</button>`;
  }
  if (r === 'courier') {
    if (o.mode === 'self' && ['booked','recollect'].includes(s) && !o.courier_id) h = `<button class="btn teal block" data-act="kit_accept">${ic('box',18)} ${t('kit_accept')}</button>`;
    if (o.mode === 'self' && o.courier_id === u.id && s === 'assigned') h = `<button class="btn block" data-act="kit_start">${ic('truck',18)} ${t('kit_start')}</button>`;
    if (o.mode === 'self' && o.courier_id === u.id && s === 'on_the_way') h = `<button class="btn teal block" data-act="kit_deliver">${ic('check',18)} ${t('kit_deliver')}</button>`;
    if (s === 'collected') h = `<button class="btn block" data-act="pickup">${ic('box',18)} ${t('pickup_btn')}</button>`;
    if (s === 'in_transit') h = `<button class="btn teal block" data-act="deliver">${ic('flask',18)} ${t('deliver_btn')}</button>`;
  }
  if (r === 'lab') {
    if (s === 'at_lab') h = `<div class="row"><button class="btn teal grow" data-act="receive">${ic('check',18)} ${t('receive_btn')}</button><button class="btn ghost" data-act="reject">${t('reject_btn')}</button></div>`;
    if (s === 'processing') h = resultsForm(o) + `<button class="btn ghost sm" data-act="reject" style="align-self:flex-start">${t('reject_btn')}</button>`;
  }
  if ((r === 'admin' || r === 'staff') && ['booked','recollect','assigned'].includes(s) && !u.is_demo) h = `<div class="row"><button class="btn sm" data-act="assign">${ic('syringe',16)} ${t('assign')}</button>${isOwner() ? `<button class="btn ghost sm" data-act="admincancel">${t('cancel_req')}</button>` : ''}</div>`;
  return h;
}
function resultsForm(o){
  const res = o.results || {};
  return `<div class="card" id="results-form"><h3>${t('enter_results')}</h3><div class="scroll-x"><table class="rtable"><thead><tr><th>${t('analyte')}</th><th>${t('result')}</th><th>${t('ref_range')}</th><th></th></tr></thead><tbody>
    ${(o.tests || []).map(x => `<tr class="grp"><td colspan="4">${esc(LN(x,'name'))}</td></tr>` + x.analytes.map(a => `<tr><td>${esc(S.lang === 'ar' ? a.na : a.n)}</td>
      <td><div class="row" style="gap:6px"><input class="input num" style="width:110px;min-height:40px;padding:8px 10px" inputmode="decimal" data-an="${a.c}" data-a='${esc(JSON.stringify(prA(a, o.patient)))}' value="${res[a.c] ? res[a.c].v : ''}"><span class="xs muted">${esc(a.u)}</span></div></td>
      <td class="small muted num">${rangeTxt(prA(a, o.patient))}</td><td><span class="flag" data-fl="${a.c}"></span></td></tr>`).join('')).join('')}</tbody></table></div>
    <label class="field" style="margin-top:12px"><span>${t('verifier')}</span><input class="input" id="vf" value="${esc(S.user.meta && S.user.meta.director || '')}" placeholder="Dr. … , Lab Director"></label>
    <div class="row" style="margin-top:12px"><button class="btn ghost" data-act="save">${t('save_draft')}</button><button class="btn teal grow" data-act="publish">${ic('shield',18)} ${t('publish')}</button></div></div>`;
}
/* the normal range for this person: adult women and children under 16 have their own ranges where it matters */
function prA(a, person){ const pp = person || {}; const ag = pp.dob ? age(pp.dob) : null; const k = ag != null && ag !== '' && +ag < 16 && a.k ? a.k : pp.gender === 'female' && a.f ? a.f : null; return k ? Object.assign({}, a, k) : a; }
/* flag for a value: L/H/N plus "slightly" when it sits in the small band next to the normal range */
function flagFor(a, v){ if (v == null || isNaN(v)) return { f:'' }; if (a.lo != null && v < a.lo) return { f:'L', m: a.rlo != null && v >= a.rlo }; if (a.hi != null && v > a.hi) return { f:'H', m: a.rhi != null && v <= a.rhi }; return { f:'N' }; }
function resFlag(a, r){ if (!r || r.v == null) return { f: r && r.f || '' }; if (r.m != null || !r.f || r.f === 'N') return { f: r.f, m: !!r.m, c: !!r.c }; const x = flagFor(a, +r.v); return { f: r.f, m: !!x.m, c: !!r.c }; }
function flagLbl(x){ return !x.f ? '' : x.f === 'N' ? t('f_N') : x.m ? t('f_s' + x.f) : t('f_' + x.f); }
function rangeTxt(a){ return a.lo != null && a.hi != null ? `${a.lo} – ${a.hi}` : a.lo != null ? `≥ ${a.lo}` : a.hi != null ? `≤ ${a.hi}` : '—'; }
function bindActions(o){
  const run = async (btn, a, p, msg) => { try { const n = await busy(btn, () => API.action(o.id, a, p)); if (msg) toast(msg); drawOrder(n); } catch(e) { toast(errMsg(e), true); } };
  /* SOS: press and hold 2 seconds (a quick tap cannot send it by mistake) */
  $$('[data-sos]').forEach(btn => { let tm = null; const start = e => { e.preventDefault(); btn.classList.add('hold'); tm = setTimeout(async () => { btn.classList.remove('hold'); btn.classList.add('sent');
      try { navigator.vibrate && navigator.vibrate([200, 80, 200]); } catch(x) {}
      const send = (lat, lng) => API.sos(o.id, lat, lng, null).then(() => toast(t('sos_sent'))).catch(err => toast(errMsg(err), true));
      if (navigator.geolocation) navigator.geolocation.getCurrentPosition(p => send(p.coords.latitude, p.coords.longitude), () => send(null, null), { timeout: 6000, enableHighAccuracy: true }); else send(null, null); }, 2000); };
    const stop = () => { clearTimeout(tm); btn.classList.remove('hold'); };
    btn.addEventListener('pointerdown', start); ['pointerup','pointerleave','pointercancel'].forEach(ev => btn.addEventListener(ev, stop)); btn.addEventListener('contextmenu', e => e.preventDefault()); });
  $$('[data-act]').forEach(b => b.onclick = async () => {
    const a = b.dataset.act;
    if (a === 'demo') { try { const n = await busy(b, () => API.demoAdvance(o.id)); drawOrder(n); } catch(e) {} return; }
    if (a === 'demoall') { b.disabled = true; let n = o; while (ACTIVE(n.status)) { try { n = await API.demoAdvance(o.id); drawOrder(n); } catch(e) { break; } await new Promise(r => setTimeout(r, 1300)); } return; }
    if (a === 'cancel') { if (await confirmBox(t('cancel_q'), t('yes_cancel'), t('keep'))) run(b, 'cancel'); return; }
    if (a === 'accept') return run(b, 'accept', {}, t('job_accepted'));
    if (['kit_accept','kit_start','kit_deliver'].includes(a)) return run(b, a, {}, a === 'kit_accept' ? t('job_accepted') : null);
    if (a === 'selfdone') { if (!$('#selfck').checked) { toast(t('self_ck'), true); return; } return run(b, 'self_collected', { labelled: true }, t('self_ok')); }
    if (a === 'chain') return modal(`<h3>${ic('thermo',20)} ${t('chain_check')}</h3><div class="stack" style="margin-top:12px">
        <label class="field"><span>${t('chain_code')}</span><input class="input ltr" id="chc" autocomplete="off" placeholder="${esc(o.code)}" style="text-transform:uppercase"></label>
        <label class="field"><span>${t('chain_temp')}</span><input class="input" id="cht" type="number" step="0.1" inputmode="decimal" placeholder="4.5"></label>
        <label class="field"><span>${t('chain_note')}</span><input class="input" id="chn" maxlength="200"></label><div class="err" id="che"></div>
        <button class="btn teal block" id="chok">${t('confirm')}</button></div>`, (el, close) => { $('#chok', el).onclick = async () => {
          try { await busy($('#chok', el), () => API.sampleLog(o.id, $('#chc', el).value, parseFloat($('#cht', el).value), $('#chn', el).value)); close(); toast(t('chain_saved')); drawOrder(await API.order(o.id)); } catch(e) { $('#che', el).textContent = errMsg(e); } }; });
    if (a === 'incident') return modal(`<h3>${t('inc_t')}</h3><div class="stack" style="margin-top:12px"><label class="field"><span>${t('inc_kind')}</span><select class="input" id="ik">${['needle','faint','sample','safety','vehicle','other'].map(k => `<option value="${k}">${t('inc_' + k)}</option>`).join('')}</select></label>
        <label class="field"><span>${t('inc_note')}</span><textarea class="input" id="in" rows="3" maxlength="1500"></textarea></label><div class="err" id="ie"></div><button class="btn red block" id="iok">${ic('send',18)} ${t('send')}</button></div>`, (el, close) => {
        $('#iok', el).onclick = async () => { const note = $('#in', el).value.trim(); if (!note) { $('#ie', el).textContent = t('inc_note'); return; }
          try { await busy($('#iok', el), () => API.incident(o.id, $('#ik', el).value, note)); close(); toast(t('inc_sent')); } catch(e) { $('#ie', el).textContent = errMsg(e); } }; });
    if (['start','arrive','deliver','receive'].includes(a)) return run(b, a);
    if (a === 'collect') return modal(`<h3>${t('checklist_t')}</h3><div class="stack" style="margin-top:12px">
        <label class="check"><input type="checkbox" id="c1"> ${t('ck_id')}</label><label class="check"><input type="checkbox" id="c2"> ${t('ck_label')}</label><label class="check"><input type="checkbox" id="c3"> ${t('ck_consent')}</label>
        ${(o.tests || []).some(x => x.fasting_hours) ? `<label class="check"><input type="checkbox" id="c5"> ${t('ck_fasting')}</label>` : ''}
        <label class="field"><span>${t('ck_tubes')}</span><input class="input" type="number" id="c4" min="1" max="10" value="${Math.min(4, new Set((o.tests || []).map(x => x.tube)).size)}"></label><div class="err" id="ce"></div>
        <button class="btn teal block" id="cok">${t('collect_btn')}</button></div>`, (el, close) => {
          $('#cok', el).onclick = async () => { const p = { id_verified: $('#c1', el).checked, labelled: $('#c2', el).checked, consent: $('#c3', el).checked, fasting: $('#c5', el) ? $('#c5', el).checked : null, tubes: $('#c4', el).value };
            if (!p.id_verified || !p.labelled) { $('#ce', el).textContent = t('e_CHECKLIST'); return; } close(); run(null, 'collect', p); }; });
    if (a === 'pickup') return modal(`<h3>${t('pickup_btn')}</h3><label class="field" style="margin-top:12px"><span>${t('temp')}</span><input class="input num" id="tp" inputmode="decimal" value="4.0"></label><div class="hint">2 – 8 °C</div><button class="btn block" id="tok" style="margin-top:14px">${t('confirm')}</button>`, (el, close) => { $('#tok', el).onclick = () => { close(); run(null, 'pickup', { temp: $('#tp', el).value }); }; });
    if (a === 'reject') { const rs = t('reasons').split('|'); return modal(`<h3>${t('reject_btn')}</h3><div class="stack" style="margin-top:12px">${rs.map((x, i) => `<label class="check"><input type="radio" name="rr" value="${esc(x)}" ${i ? '' : 'checked'}> ${esc(x)}</label>`).join('')}<button class="btn red block" id="rok">${t('reject_btn')}</button></div>`, (el, close) => { $('#rok', el).onclick = () => { close(); run(null, 'reject', { reason: $('input[name=rr]:checked', el).value }); }; }); }
    if (a === 'save' || a === 'publish') { const res = {}; $$('[data-an]').forEach(i => { if (i.value.trim() !== '') res[i.dataset.an] = i.value.trim().replace(',', '.'); });
      return run(b, a === 'save' ? 'save_results' : 'publish', { results: res, verifier: $('#vf').value }, a === 'publish' ? t('published_ok') : t('saved')); }
    if (a === 'assign') { const ns = await API.adminNurses(o.wilayat, o.patient_gender || (o.patient && o.patient.gender)); return modal(`<h3>${t('assign')}</h3><div class="stack" style="margin-top:12px">${ns.length ? ns.map(n => `<button class="btn ghost block" data-n="${n.id}">${esc(n.name)} · ${esc(wN(n.wilayat))}${n.today ? ' · ✓' : ''}</button>`).join('') : `<p class="muted">${t('none_yet')}</p>`}</div>`, (el, close) => { $$('[data-n]', el).forEach(x => x.onclick = () => { close(); run(null, 'assign_nurse', { nurse_id: x.dataset.n }); }); }); }
    if (a === 'admincancel') { if (await confirmBox(t('cancel_q'), t('yes_cancel'), t('keep'))) run(b, 'cancel'); }
  });
  $$('[data-an]').forEach(i => { let a = {}; try { a = JSON.parse(i.dataset.a); } catch(e) {} const upd = () => { const v = parseFloat(i.value.replace(',', '.')); const x = flagFor(a, v); const crit = !isNaN(v) && ((a.clo != null && v < a.clo) || (a.chi != null && v > a.chi)); const el = $(`[data-fl="${i.dataset.an}"]`); el.className = 'flag ' + x.f + (x.m ? ' mild' : '') + (crit ? ' crit' : ''); el.textContent = crit ? t('g_crit') : flagLbl(x); }; i.addEventListener('input', upd); upd(); });
  let star = 0; $$('[data-star]').forEach(s => s.onclick = () => { star = +s.dataset.star; $$('[data-star]').forEach(x => x.style.color = +x.dataset.star <= star ? 'var(--amber)' : '#d3dbea'); });
  if ($('#rs')) $('#rs').onclick = async () => { if (!star) return; try { const n = await busy($('#rs'), () => API.action(o.id, 'rate', { rating: star, review: $('#rv').value })); toast(t('thanks_rating')); drawOrder(n); } catch(e) {} };
}

/* report */
const INSIGHT = {
  VITD:{ L:['Low vitamin D is very common in Oman. Doctors often advise safe sun exposure and supplements.','نقص فيتامين د شائع جداً في عُمان، وغالباً ينصح الأطباء بالتعرض الآمن للشمس والمكملات.'] },
  B12:{ L:['Low B12 can cause tiredness and tingling. Your doctor may suggest diet changes or supplements.','قد يسبب نقص B12 التعب والتنميل، وقد يقترح طبيبك تعديل الغذاء أو مكملات.'] },
  FERR:{ L:['Low iron stores can cause fatigue. Ask your doctor whether iron treatment is needed.','انخفاض مخزون الحديد قد يسبب الإرهاق. اسأل طبيبك عن الحاجة لعلاج الحديد.'] },
  HGB:{ L:['Low haemoglobin may mean anaemia. Please review with your doctor.','انخفاض الهيموجلوبين قد يعني فقر الدم. يرجى مراجعة الطبيب.'] },
  GLU:{ H:['Fasting sugar is above the normal range. A doctor can confirm whether this is prediabetes or diabetes.','السكر الصائم أعلى من الطبيعي. يمكن للطبيب تأكيد ما إذا كان ذلك ما قبل السكري أو السكري.'] },
  A1C:{ H:['HbA1c above 5.6% suggests raised average sugar. 6.5% or more is in the diabetes range.','السكر التراكمي فوق 5.6% يشير لارتفاع متوسط السكر، و6.5% فأكثر ضمن نطاق السكري.'] },
  LDL:{ H:['High LDL raises heart risk. Diet, activity and sometimes medicine can lower it.','ارتفاع LDL يزيد مخاطر القلب، ويمكن خفضه بالغذاء والنشاط وأحياناً الدواء.'] },
  CHOL:{ H:['Total cholesterol is high. Review your heart risk with a doctor.','الكوليسترول الكلي مرتفع. راجع مخاطر القلب مع الطبيب.'] },
  TG:{ H:['Raised triglycerides are linked to diet and sugar. Make sure you were fasting.','ارتفاع الدهون الثلاثية مرتبط بالغذاء والسكر. تأكد أنك كنت صائماً.'] },
  TSH:{ H:['High TSH can mean an underactive thyroid.','ارتفاع TSH قد يعني خمول الغدة الدرقية.'], L:['Low TSH can mean an overactive thyroid.','انخفاض TSH قد يعني فرط نشاط الغدة الدرقية.'] }
};
async function viewReport(id){
  let o; try { o = await API.order(id); } catch(e) { app.innerHTML = shell('', emptyBox(errMsg(e))); return; }
  if (o.status !== 'completed') return go('app/order/' + id);
  const res = o.results || {}; const p = o.patient || {};
  let flags = 0; const notes = []; const r0 = a => prA(a, p);
  const rows = (o.tests || []).map(x => `<tr class="grp"><td colspan="5">${esc(LN(x,'name'))}</td></tr>` + x.analytes.map(a0 => { const a = r0(a0); const r = res[a.c] || {}; const fx = resFlag(a, r); if (r.f && r.f !== 'N') { flags++; const n = INSIGHT[a.c] && INSIGHT[a.c][r.f]; if (n) notes.push(`<li><b>${esc(S.lang === 'ar' ? a.na : a.n)}:</b> ${esc(n[S.lang === 'ar' ? 1 : 0])}</li>`); }
      const lo = a.lo != null ? a.lo : (a.hi != null ? 0 : null), hi = a.hi != null ? a.hi : (a.lo != null ? a.lo * 2.5 : null); let pos = 50;
      if (lo != null && hi != null && r.v != null) { const span = hi - lo; pos = Math.max(3, Math.min(97, 20 + (r.v - lo) / span * 60)); }
      return `<tr><td>${esc(S.lang === 'ar' ? a.na : a.n)}</td><td class="num b" style="color:${!r.f || r.f === 'N' ? 'inherit' : fx.m ? '#9a6400' : 'var(--red)'}">${r.v ?? '—'} <span class="xs muted" style="font-weight:500">${esc(a.u)}</span></td><td class="small muted num">${rangeTxt(a)}</td><td class="rb-col" style="width:120px"><div class="rangebar"><i style="left:${pos}%"></i></div></td><td>${r.f ? `<span class="flag ${r.f}${fx.m ? ' mild' : ''}${fx.c ? ' crit' : ''}">${fx.c ? t('g_crit') : flagLbl(fx)}</span>` : ''}</td></tr>`; }).join('')).join('');
  const ce = (o.events || []).find(e => e.status === 'collected'); const LVL = orderLevel(o).level;
  app.innerHTML = shell(t('report_t'), `<div class="row no-print rep-actions"><button class="btn grow" id="pr">${ic('download',18)} ${t('download_pdf')}</button>${navigator.share ? `<button class="btn ghost grow" id="sh">${ic('share',18)} ${t('share_pdf')}</button>` : ''}${S.user.role === 'patient' ? `<button class="btn soft grow" id="shd">${ic('steth',18)} ${t('share_doc')}</button>` : ''}<button class="btn ghost hide-sm" id="pp" aria-label="${t('print')}">${ic('file',18)} ${t('print')}</button></div>
  <div class="report"><div class="rh"><div class="row">${A.logo.replace('<svg','<svg width="46" height="46"')}<div><div class="wm-inline">${A.wordmark}</div><div class="small" style="opacity:.8">${t('report_t')}</div></div></div>
    <div class="small" style="text-align:end"><b>${esc(o.lab ? o.lab.name : '')}</b><br>${o.lab && o.lab.license ? t('licence') + ': ' + esc(o.lab.license) : ''}</div></div>
  <div class="rb"><div class="grid g4" style="gap:12px;margin-bottom:18px">
    <div><div class="xs muted">${t('patient')}</div><b>${esc(p.name)}</b></div><div><div class="xs muted">${t('age')} / ${t('sex')}</div><b>${p.dob ? age(p.dob) : '—'} / ${p.gender ? t(p.gender) : '—'}</b></div>
    <div><div class="xs muted">${t('request')}</div><b>${esc(o.code)}</b></div><div><div class="xs muted">${t('collected_at')}</div><b>${ce ? fmtDT(ce.at) : '—'}</b></div>
    <div><div class="xs muted">${t('reported_at')}</div><b>${fmtDT(o.published_at)}</b></div><div><div class="xs muted">${t('verified_by')}</div><b>${esc(o.verified_by || '')}</b></div></div>
  <div class="banner ${LVL === 'urgent' ? 'red' : flags ? 'amber' : 'teal'}${flags ? ' fx-alert' : ''}" id="repban" style="margin-bottom:16px">${ic(LVL === 'urgent' ? 'phone' : flags ? 'clock' : 'check',22)}<div><b>${t('lv_'+LVL+'_t')}</b><div class="small">${flags ? t('some_flags',{n:flags}) : t('all_normal')}</div></div></div>
  <div class="scroll-x"><table class="rtable"><thead><tr><th>${t('analyte')}</th><th>${t('result')}</th><th>${t('ref_range')}</th><th class="rb-col"></th><th>${t('flag')}</th></tr></thead><tbody>${rows}</tbody></table></div>
  ${notes.length ? `<div class="card flat" style="margin-top:18px"><h4>${t('insight_t')}</h4><ul class="small" style="margin:0;padding-inline-start:18px">${notes.join('')}</ul><a class="xs b" href="#/sources" style="display:inline-block;margin-top:8px">${ic('file',12)} ${t('sources_hint')} ›</a></div>` : ''}
  ${o.doctor_note ? `<div class="card flat" style="margin-top:18px"><h4>${t('doc_note_t')} · ${esc(o.doctor_note.name || '')}</h4><p class="small" style="white-space:pre-wrap;margin:0">${esc(o.doctor_note.note)}</p></div>` : ''}
  <p class="xs muted" style="margin-top:18px">${t('report_disclaimer')}</p></div></div><div class="stack no-print" style="margin-top:18px">${LVL !== 'urgent' ? wiseCard(!flags) : ''}${careBlock(o)}<div id="trd"></div></div>`, { back: true });
  bindCare(o, () => viewReport(id)); bindWise();
  if (S.user.role === 'patient') {
    /* celebrate a clean report once; a gentle red pulse when something needs attention */
    const ck = 'lah_cel_' + o.id; let seen = false; try { seen = !!localStorage.getItem(ck); localStorage.setItem(ck, '1'); } catch(e) {}
    if (window.FX) setTimeout(() => { if (!flags && !seen) FX.celebrate('big'); else if (flags) FX.alert($('#repban')); }, FX.ready ? 400 : 1600);
    const codes = [...new Set((o.tests || []).flatMap(x => x.analytes.map(a => a.c)))];
    API.trends(codes).then(tr => { const el = $('#trd'); if (el) { el.innerHTML = trendsHtml(tr, o.tests || [], p); if (window.FX) FX.scan(el); } }).catch(() => {});
  }
  /* real PDF file, made on the phone; prepared in advance so the tap opens the save/share sheet at once */
  const ar = S.lang === 'ar';
  const pdfData = { lang: S.lang, logo: A.markSvg({ fg:'#ffffff', still:true }), contact: `WhatsApp / Call ${CONTACT.phone}  ·  ${CONTACT.email}`, code: o.code, lab: o.lab ? o.lab.name : '', licence: o.lab && o.lab.license ? t('licence') + ': ' + o.lab.license : '', flags,
    title: `iLab@home ${o.code}`,
    t: { title: t('report_t'), analyte: t('analyte'), result: t('result'), range: t('ref_range'), flag: t('flag'), insight: t('insight_t'), disclaimer: t('report_disclaimer'), summary: t('lv_'+LVL+'_t') + ' · ' + (flags ? t('some_flags',{n:flags}) : t('all_normal')) },
    info: [[t('patient'), p.name || '—'], [t('age') + ' / ' + t('sex'), `${p.dob ? age(p.dob) : '—'} / ${p.gender ? t(p.gender) : '—'}`], [t('request'), o.code], [t('collected_at'), ce ? fmtDT(ce.at) : '—'], [t('reported_at'), fmtDT(o.published_at)], [t('verified_by'), o.verified_by || '—']],
    groups: (o.tests || []).map(x => ({ name: LN(x,'name'), rows: x.analytes.map(a0 => { const a = prA(a0, p); const r = res[a.c] || {}; const fx = resFlag(a, r); return { name: ar ? a.na : a.n, v: r.v ?? '—', u: a.u || '', range: rangeTxt(a), f: r.f ? (fx.m ? 'L' : r.f) : '', fl: r.f ? (fx.c ? t('g_crit') : flagLbl(fx)) : '' }; }) })),
    notes: (o.doctor_note ? [t('doc_note_t') + ' (' + (o.doctor_note.name || '') + '): ' + o.doctor_note.note] : []).concat(LVL === 'urgent' ? [t('lv_urgent_p')] : []).concat((o.tests || []).flatMap(x => x.analytes.map(a => { const r = res[a.c] || {}; const n = r.f && r.f !== 'N' && INSIGHT[a.c] && INSIGHT[a.c][r.f]; return n ? `${ar ? a.na : a.n}: ${n[ar ? 1 : 0]}` : null; })).filter(Boolean)) };
  const fname = `LabAtHome-${o.code}.pdf`; let pdfP = null, pdfBlob = null;
  const make = () => { if (!window.LAHPDF) return Promise.reject(new Error('pdf module missing'));
    return pdfP || (pdfP = Promise.race([window.LAHPDF.build(pdfData), new Promise((_, rj) => setTimeout(() => rj(new Error('timeout')), 25000))]).then(b => (pdfBlob = b)).catch(e => { pdfP = null; throw e; })); };
  (window.requestIdleCallback || (f => setTimeout(f, 1200)))(() => make().catch(() => {}));
  const readySheet = blob => { const url = URL.createObjectURL(blob);
    modal(`<div class="center"><div style="width:64px;height:64px;border-radius:50%;margin:0 auto 10px;display:grid;place-items:center;background:var(--teal-bg);color:var(--teal)">${ic('check',32,2.6)}</div><h3>${t('pdf_ready_t')}</h3><p class="muted small">${t('pdf_ready_p')}</p>
      <a class="btn block" href="${url}" download="${fname}" target="_blank" rel="noopener" data-x>${ic('download',18)} ${t('pdf_open')}</a><button class="btn ghost block" style="margin-top:10px" data-close>${t('close')}</button></div>`, (el, close) => { $('[data-x]', el).addEventListener('click', () => setTimeout(close, 300)); }); };
  const deliver = async (btn, share) => {
    if (btn.dataset.busy) return; btn.dataset.busy = '1'; const lbl = btn.innerHTML;
    if (!pdfBlob) btn.innerHTML = `<span class="spin" style="width:18px;height:18px;border-color:rgba(255,255,255,.35);border-top-color:currentColor"></span> ${t('pdf_making')}`;
    try { const ready = !!pdfBlob; const blob = await make(); const r = await window.LAHPDF.save(blob, fname, share, ready);
      if (r === 'downloaded') toast(t('pdf_ready')); else if (r === 'again') readySheet(blob); }
    catch(e) { console.error(e); toast(t('pdf_fail'), true); } finally { delete btn.dataset.busy; btn.innerHTML = lbl; } };
  $('#pr').onclick = () => deliver($('#pr'), false);
  if ($('#sh')) $('#sh').onclick = () => deliver($('#sh'), true);
  $('#pp').onclick = () => window.print();
  if ($('#shd')) $('#shd').onclick = () => shareModal(o);
}
function wiseCard(ok){
  const L = ok ? WISE_OK : WISE_CARE; const i = Math.floor(Math.random() * L.length); const w = L[i]; const ar = S.lang === 'ar';
  return `<div class="card wise ${ok ? 'ok' : 'care'}" data-wise="${ok ? 1 : 0}" data-i="${i}"><div class="wise-orn" aria-hidden="true">${ok ? '❁' : '❀'}</div><div class="xs b wise-t">${t(ok ? 'wise_ok_t' : 'wise_care_t')}</div>
    <p class="wise-q" lang="ar" dir="rtl">${esc(w.ar)}</p>${ar ? '' : `<p class="wise-en">${esc(w.en)}</p>`}<div class="row between"><span class="xs muted">${esc(ar ? w.sa : w.se)}</span><button class="link xs" data-wmore>${t('wise_more')} ↻</button></div></div>`;
}
function bindWise(){ $$('[data-wmore]').forEach(b => b.onclick = () => { const c = b.closest('.wise'); const ok = c.dataset.wise === '1'; const L = ok ? WISE_OK : WISE_CARE; let i = (+c.dataset.i + 1) % L.length; const tmp = document.createElement('div'); tmp.innerHTML = wiseCard(ok); const n = tmp.firstElementChild; n.dataset.i = i; const w = L[i];
  $('.wise-q', n).textContent = w.ar; if ($('.wise-en', n)) $('.wise-en', n).textContent = w.en; $('.row .muted', n).textContent = S.lang === 'ar' ? w.sa : w.se; c.replaceWith(n); bindWise(); if (window.FX) FX.pop(n); }); }
function trendsHtml(tr, tests, person){
  const names = {}; tests.forEach(x => x.analytes.forEach(a => { names[a.c] = prA(a, person); }));
  const keys = Object.keys(tr || {}).filter(k => (tr[k] || []).length >= 2 && names[k]).slice(0, 4); if (!keys.length) return '';
  const spark = (pts, a) => { const vs = pts.map(x => +x.v); const lo = Math.min(...vs, a.lo ?? Infinity), hi = Math.max(...vs, a.hi ?? -Infinity); const span = (hi - lo) || 1; const W = 220, H = 64;
    const xy = pts.map((x, i) => [8 + i * (W - 16) / Math.max(1, pts.length - 1), H - 8 - (x.v - lo) / span * (H - 16)]);
    const band = a.lo != null && a.hi != null ? `<rect x="0" y="${H - 8 - (a.hi - lo) / span * (H - 16)}" width="${W}" height="${Math.max(2, (a.hi - a.lo) / span * (H - 16))}" fill="#e3f7f4"/>` : '';
    return `<svg viewBox="0 0 ${W} ${H}" class="spark" data-draw>${band}<polyline points="${xy.map(p => p.join(',')).join(' ')}" fill="none" stroke="#1257d6" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>${xy.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="${pts[i].f && pts[i].f !== 'N' ? '#e2474f' : '#0fae9b'}"/>`).join('')}</svg>`; };
  return `<div class="card trend"><h3 style="margin-bottom:2px">${ic('chart',20)} ${t('trends_t')}</h3><div class="xs muted" style="margin-bottom:12px">${t('trends_p')}</div><div class="grid g2" style="gap:12px">${keys.map(k => { const a = names[k]; const pts = tr[k]; const last = pts[pts.length - 1];
    return `<div class="tr-c"><div class="row between"><b class="small">${esc(S.lang === 'ar' ? a.na : a.n)}</b><span class="num b">${esc(last.v)} <span class="xs muted">${esc(a.u || '')}</span></span></div>${spark(pts, a)}<div class="row between xs muted"><span>${fmtDate(pts[0].at, { month:'short', year:'2-digit' })}</span><span>${fmtDate(last.at, { month:'short', year:'2-digit' })}</span></div></div>`; }).join('')}</div></div>`;
}
function shareModal(o){
  modal(`<h3>${ic('steth',20)} ${t('share_t')}</h3><p class="small muted">${t('share_p')}</p>
    <label class="field"><span>${t('share_hours')}</span><select class="input" id="shh"><option value="24">24h</option><option value="72" selected>72h</option><option value="168">7 ${S.lang === 'ar' ? 'أيام' : 'days'}</option></select></label>
    <div id="shout"></div><div class="err" id="she"></div><button class="btn block" id="shmk">${ic('share',18)} ${t('share_make')}</button>`, (el, close) => {
    $('#shmk', el).onclick = async () => { try { const r = await busy($('#shmk', el), () => API.shareCreate(o.id, +$('#shh', el).value)); const url = location.origin + location.pathname + '#/r/' + r.token;
      $('#shout', el).innerHTML = `<div class="sharebox"><input class="input ltr" readonly value="${esc(url)}"><div class="xs muted">${t('share_until',{d:fmtDT(r.expires_at)})}</div><div class="row wrap" style="gap:8px;margin-top:10px"><button class="btn sm" id="shc">${ic('copy',16)} ${t('share_copy')}</button><a class="btn sm soft" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(url)}">WhatsApp</a>${navigator.share ? `<button class="btn sm ghost" id="shn">${ic('share',16)}</button>` : ''}</div></div>`;
      $('#shmk', el).remove(); $('#shc', el).onclick = () => copyText(url, 'share_copied');
      if ($('#shn', el)) $('#shn', el).onclick = () => navigator.share({ title: 'iLab@home ' + o.code, url }).catch(() => {}); } catch(e) { $('#she', el).textContent = errMsg(e); } }; });
}
/* read-only report opened from a doctor link (no account needed) */
async function viewShared(token){
  let d; try { d = await API.shareGet(token); } catch(e) { app.innerHTML = `${topbar()}<section class="section"><div class="wrap-w" style="max-width:640px">${emptyBox(errMsg(e), `<a class="btn" href="#/">${t('m_home')}</a>`)}</div></section>${footer()}`; return; }
  const person = { gender: d.sex, dob: d.age != null ? (new Date().getFullYear() - d.age) + '-06-30' : null }; const res = d.results || {};
  const rows = (d.tests || []).map(x => `<tr class="grp"><td colspan="4">${esc(LN(x,'name'))}</td></tr>` + x.analytes.map(a0 => { const a = prA(a0, person); const r = res[a.c] || {}; const fx = resFlag(a, r);
      return `<tr><td>${esc(S.lang === 'ar' ? a.na : a.n)}</td><td class="num b" style="color:${!r.f || r.f === 'N' ? 'inherit' : fx.m ? '#9a6400' : 'var(--red)'}">${r.v ?? '—'} <span class="xs muted">${esc(a.u)}</span></td><td class="small muted num">${rangeTxt(a)}</td><td>${r.f ? `<span class="flag ${r.f}${fx.m ? ' mild' : ''}${fx.c ? ' crit' : ''}">${fx.c ? t('g_crit') : flagLbl(fx)}</span>` : ''}</td></tr>`; }).join('')).join('');
  app.innerHTML = `${topbar()}<section class="section" style="padding-top:28px"><div class="wrap-w" style="max-width:860px">
    <div class="banner blue small" style="margin-bottom:14px">${ic('lock',18)}<span>${t('share_until',{d:fmtDT(d.expires_at)})}</span></div>
    <div class="report"><div class="rh"><div class="row">${A.logo.replace('<svg','<svg width="46" height="46"')}<div><div class="wm-inline">${A.wordmark}</div><div class="small" style="opacity:.8">${t('report_t')}</div></div></div><div class="small" style="text-align:end"><b>${esc(d.lab || '')}</b><br>${d.licence ? t('licence') + ': ' + esc(d.licence) : ''}</div></div>
    <div class="rb"><div class="grid g4" style="gap:12px;margin-bottom:18px"><div><div class="xs muted">${t('patient')}</div><b>${esc(d.name || '')}</b></div><div><div class="xs muted">${t('age')} / ${t('sex')}</div><b>${d.age ?? '—'} / ${d.sex ? t(d.sex) : '—'}</b></div><div><div class="xs muted">${t('request')}</div><b>${esc(d.code)}</b></div><div><div class="xs muted">${t('reported_at')}</div><b>${fmtDT(d.published_at)}</b></div></div>
    <div class="scroll-x"><table class="rtable"><thead><tr><th>${t('analyte')}</th><th>${t('result')}</th><th>${t('ref_range')}</th><th>${t('flag')}</th></tr></thead><tbody>${rows}</tbody></table></div>
    ${d.doctor_note ? `<div class="card flat" style="margin-top:18px"><h4>${t('doc_note_t')} · ${esc(d.doctor_note.name || '')}</h4><p class="small" style="white-space:pre-wrap;margin:0">${esc(d.doctor_note.note)}</p></div>` : ''}
    <p class="xs muted" style="margin-top:18px">${t('verified_by')}: ${esc(d.verified_by || '')} · ${t('report_disclaimer')}</p></div></div></div></section>${footer()}`;
}

/* ---------- nurse / courier / lab homes ---------- */
async function viewNurseHome(){
  loading(t('m_home'));
  const [st, av, mine] = await Promise.all([API.stats(), API.orders('available'), API.orders('mine')]);
  const u = S.user; const act = mine.filter(o => ['assigned','on_the_way','arrived'].includes(o.status));
  const g = (u.meta || {}).gender;
  app.innerHTML = shell(t('hello',{n:esc(u.full_name.split(' ')[0])}), `<div class="stack-lg">
    <div class="card today-card ${st.today ? 'on' : ''}"><div class="row between"><div class="row"><span class="avatar" style="background:${g === 'female' ? '#e8466f' : '#1257d6'}">${esc(initials(u.full_name))}</span><div><b style="font-size:1.1rem">${t('today_t')}</b><div class="small muted">${st.today ? t('today_on') : t('today_off')}</div></div></div>
      <label class="switch"><input type="checkbox" id="av" ${st.today ? 'checked' : ''}><i></i></label></div>
      <div class="row wrap" style="gap:6px;margin-top:10px"><span class="chip ${g === 'female' ? 'red' : ''}">${t(g || 'female')}</span>${((u.meta || {}).coverage || [u.wilayat]).filter(Boolean).map(w => `<span class="chip gray">${esc(wN(w))}</span>`).join('')}</div></div>
    <div class="grid g4"><div class="kpi blue"><span>${t('earnings')}</span><b>${omr(st.earnings)} <small style="font-size:.8rem">${t('omr')}</small></b>${st.base != null ? `<small class="xs" style="opacity:.85;display:block;margin-top:2px">${t('per_visit')}: ${omr(st.base)}${st.bonus ? ' + ' + omr(st.bonus) + ' ' + t('lvl_' + st.level) : ''}</small>` : ''}</div><div class="kpi"><span>${t('collected_n')}</span><b>${st.collected}</b></div><div class="kpi"><span>${t('this_month')}</span><b>${st.month}</b></div><div class="kpi"><span>${t('rating')}</span><b>${st.rating ? '★ ' + st.rating : '—'}</b></div></div>
    <div><h3>${t('my_visits')}</h3>${act.length ? `<div class="olist">${act.map(o => orderItem(o)).join('')}</div>` : emptyBox(t('none_yet'))}</div>
    <div><h3>${t('available_req')} <span class="chip">${av.length}</span></h3>${av.length ? `<div class="olist">${av.map(o => orderItem(o, `<div style="margin-top:8px"><span class="chip teal">+${omr(st.fee)} ${t('omr')}</span>${o.preferred ? ` <span class="chip purple">${ic('star',12)} ${t('chose_you')}</span>` : ''}${o.fasting ? ` <span class="chip amber">${t('fasting',{h:o.fasting})}</span>` : ''}</div>`)).join('')}</div>` : emptyBox(t('none_yet'))}</div></div>`);
  $('#av').onchange = async e => { try { S.user = await API.profile({ available: e.target.checked }); viewNurseHome(); } catch(err) { toast(errMsg(err), true); } };
}
async function viewCourierHome(){
  loading(t('m_home'));
  const [st, av, mine] = await Promise.all([API.stats(), API.orders('available'), API.orders('mine')]);
  const tr = mine.filter(o => o.status === 'in_transit'); const cm = S.user.meta || {};
  app.innerHTML = shell(t('hello',{n:esc(S.user.full_name.split(' ')[0])}), `<div class="stack-lg">
    ${cm.company ? `<div class="card row wrap" style="gap:10px">${ic('van',22)}<b class="grow">${esc(cm.company)}</b>${cm.vehicle ? `<span class="chip gray">${esc(cm.vehicle)}</span>` : ''}${cm.plate ? `<span class="chip gray ltr">${esc(cm.plate)}</span>` : ''}${(cm.coverage || []).map(w => `<span class="chip">${esc(wN(w))}</span>`).join('')}</div>` : ''}
    <div class="grid g4"><div class="kpi blue"><span>${t('pickups_ready')}</span><b>${st.waiting}</b></div><div class="kpi"><span>${t('in_transit_list')}</span><b>${st.in_transit}</b></div><div class="kpi"><span>${t('delivered_n')}</span><b>${st.delivered}</b></div><div class="kpi"><span>${t('avg_temp')}</span><b>${st.avg_temp != null ? st.avg_temp + ' °C' : '—'}</b></div></div>
    <div><h3>${t('in_transit_list')}</h3>${tr.length ? `<div class="olist">${tr.map(o => orderItem(o)).join('')}</div>` : emptyBox(t('none_yet'))}</div>
    <div><h3>${t('pickups_ready')}</h3>${av.length ? `<div class="olist">${av.map(o => orderItem(o)).join('')}</div>` : emptyBox(t('none_yet'))}</div></div>`);
}
async function viewLabHome(){
  loading(t('m_home'));
  const [st, list] = await Promise.all([API.stats(), API.orders()]);
  const exp = list.filter(o => ['booked','assigned','on_the_way','arrived','collected'].includes(o.status));
  const inc = list.filter(o => ['in_transit','at_lab'].includes(o.status)), pr = list.filter(o => o.status === 'processing'), pub = list.filter(o => o.status === 'completed');
  app.innerHTML = shell(esc(S.user.meta && S.user.meta.lab_name || S.user.full_name), `<div class="stack-lg">
    <div class="grid g4"><div class="kpi blue"><span>${t('incoming')}</span><b>${st.incoming}</b></div><div class="kpi"><span>${t('processing_list')}</span><b>${st.processing}</b></div><div class="kpi"><span>${t('published_list')}</span><b>${st.published}</b></div><div class="kpi"><span>${t('avg_tat')}</span><b>${st.avg_tat_h != null ? st.avg_tat_h + ' h' : '—'}</b></div></div>
    <div><h3>${t('incoming')}</h3>${inc.length ? `<div class="olist">${inc.map(o => orderItem(o)).join('')}</div>` : emptyBox(t('none_yet'))}</div>
    ${exp.length ? `<div><h3>${t('expected_samples')}</h3><p class="small muted" style="margin-top:-6px">${t('expected_samples_p')}</p><div class="olist">${exp.map(o => orderItem(o)).join('')}</div></div>` : ''}
    <div><h3>${t('processing_list')}</h3>${pr.length ? `<div class="olist">${pr.map(o => orderItem(o)).join('')}</div>` : emptyBox(t('none_yet'))}</div>
    ${pub.length ? `<div><h3>${t('published_list')}</h3><div class="olist">${pub.slice(0, 8).map(o => orderItem(o)).join('')}</div></div>` : ''}</div>`);
}

/* ---------- company ---------- */
async function viewCompanyHome(){
  loading(t('m_programs'));
  const [list] = await Promise.all([API.programs(), loadCatalog()]);
  const u = S.user;
  app.innerHTML = shell(esc(u.meta && u.meta.company_name || u.full_name), `<div class="stack-lg">
    <div class="welcome"><div class="art">${A.roleIcon('company', 160)}</div><h2>${t('programs_t')}</h2><p style="opacity:.85;max-width:460px">${t('r_company_d')} ${t('privacy_note')}</p><button class="btn" style="background:#fff;color:var(--blue)" id="np" ${u.status !== 'active' ? 'disabled' : ''}>${ic('plus',18)} ${t('new_program')}</button></div>
    ${list.length ? list.map(p => { const pct = Math.round(p.used / p.seats * 100); return `<div class="card"><div class="row between wrap"><div><h3 style="margin:0">${esc(p.name)}</h3><div class="small muted">${esc(p.package ? LN(p.package,'name') : '')} · ${p.package ? omr(p.package.price) + ' ' + t('omr') : ''}</div></div><span class="code-box">${esc(p.code)}</span></div>
      <div class="small muted" style="margin:12px 0 6px">${t('used_seats',{u:p.used,s:p.seats})}</div><div class="progress"><i style="width:${pct}%"></i></div>
      <div class="grid g3" style="margin-top:14px"><div class="kpi"><span>${t('booked_n')}</span><b>${p.booked}</b></div><div class="kpi"><span>${t('done_n')}</span><b>${p.completed}</b></div><div class="kpi"><span>${t('value')}</span><b>${omr(p.value)}</b></div></div>
      ${Object.keys(p.wilayats || {}).length ? `<div class="row wrap" style="gap:6px;margin-top:12px">${Object.entries(p.wilayats).map(([w, c]) => `<span class="chip gray">${esc(wN(w))} · ${c}</span>`).join('')}</div>` : ''}
      <div class="row wrap" style="margin-top:14px"><button class="btn soft sm" data-copy="${esc(p.code)}">${ic('share',16)} ${t('share_code')}</button></div></div>`; }).join('') : emptyBox(t('none_yet'))}</div>`);
  $$('[data-copy]').forEach(b => b.onclick = () => { const txt = `${S.lang === 'ar' ? 'رمز برنامجنا الصحي في آي لاب@هوم' : 'Our iLab@home wellness code'}: ${b.dataset.copy} · ${location.origin}`; if (navigator.share) navigator.share({ text: txt }).catch(() => {}); else navigator.clipboard.writeText(txt).then(() => toast('✓')); });
  if ($('#np')) $('#np').onclick = () => modal(`<h3>${t('new_program')}</h3><form id="pf" class="stack" style="margin-top:12px"><label class="field"><span>${t('program_name')}</span><input class="input" name="name" required placeholder="Wellness 2027"></label>
    <label class="field"><span>${t('program_pkg')}</span><select class="input" name="pkg">${S.catalog.packages.map(p => `<option value="${p.id}">${esc(LN(p,'name'))} · ${omr(p.price)}</option>`).join('')}</select></label>
    <label class="field"><span>${t('seats')}</span><input class="input" type="number" name="seats" min="1" max="5000" value="25"></label><div class="err" id="pe"></div><button class="btn block">${t('create')}</button></form>`, (el, close) => {
      $('#pf', el).onsubmit = async e => { e.preventDefault(); const f = e.target; try { await busy($('button', f), () => API.programCreate({ name: f.name.value, package_id: f.pkg.value, seats: +f.seats.value })); close(); viewCompanyHome(); } catch(err) { $('#pe', el).textContent = errMsg(err); } }; });
}

/* ---------- admin ---------- */
async function viewAdminHome(){
  loading(t('overview'));
  const [ov, pend] = await Promise.all([API.adminOverview(), API.adminUsers(null, 'pending'), loadCatalog()]);
  const days = []; const now = muscatNow(); const dm = {}; (ov.daily || []).forEach(d => dm[d.d] = d.n);
  for (let i = 13; i >= 0; i--) { const d = addDays(now.date, -i); days.push([d, dm[d] || 0]); }
  const mx = Math.max(1, ...days.map(d => d[1]));
  const bs = ov.by_status || {}; const bsMax = Math.max(1, ...Object.values(bs));
  app.innerHTML = shell(t('overview'), `<div class="stack-lg">
    <div class="lead-card ${isOwner() ? 'owner' : ''}"><span class="ic-round">${ic(isOwner() ? 'award' : 'eye',24)}</span><div class="grow"><b>${isOwner() ? t('owner_t',{n:esc(S.user.full_name)}) : S.user.role === 'staff' ? t('staff_t',{n:esc(S.user.full_name.split(' ')[0])}) : t('demo_admin_t')}</b><div class="small">${isOwner() ? t('owner_p') : t('staff_p')}</div></div>${isOwner() ? `<a class="btn sm" href="#/app/admin/users">${ic('plus',16)} ${t('add_user')}</a>` : `<a class="btn sm soft" href="#/app/admin/tickets">${ic('chat',16)} ${t('m_tickets')}</a>`}</div>
    <div class="grid g4"><div class="kpi blue"><span>${t('orders_today')}</span><b>${ov.today}</b></div><div class="kpi"><span>${t('active_orders')}</span><b>${ov.active}</b></div><div class="kpi"><span>${t('completed_orders')}</span><b>${ov.completed}</b></div><div class="kpi"><span>${t('revenue')}</span><b>${omr(ov.revenue)}</b></div>
    <div class="kpi"><span>${t('avg_tat')}</span><b>${ov.avg_tat_h != null ? ov.avg_tat_h + ' h' : '—'}</b></div><div class="kpi"><span>${t('rating')}</span><b>${ov.rating ? '★ ' + ov.rating : '—'}</b></div><div class="kpi"><span>${t('pending_verif')}</span><b>${ov.pending}</b></div><div class="kpi"><span>${t('waitlist_n')}</span><b>${ov.waitlist}</b></div></div>
    <div class="grid g2 collapse"><div class="card"><h3>${t('last14')}</h3><div class="bars" style="margin:18px 0 22px">${days.map(([d, n]) => `<div style="height:${n / mx * 100}%" title="${d}: ${n}"><span>${d.slice(8)}</span></div>`).join('')}</div></div>
      <div class="card"><h3>${t('by_status')}</h3>${Object.entries(bs).map(([s, n]) => `<div class="hbar"><span style="width:130px" class="small">${t('st_'+s)}</span><i style="width:${n / bsMax * 60}%"></i><b>${n}</b></div>`).join('') || `<p class="muted">${t('none_yet')}</p>`}</div></div>
    <div class="grid g2 collapse"><div class="card"><h3>${t('top_tests')}</h3>${(ov.top_tests || []).map(x => `<div class="vline"><span>${esc(LN(S.catalog.T[x.id],'name'))}</span><b>${x.n}</b></div>`).join('') || `<p class="muted">${t('none_yet')}</p>`}</div>
      <div class="card"><h3>${t('by_wilayat')}</h3>${Object.entries(ov.by_wilayat || {}).map(([w, n]) => `<div class="vline"><span>${esc(wN(w))}</span><b>${n}</b></div>`).join('') || `<p class="muted">${t('none_yet')}</p>`}</div></div>
    <div class="card"><h3>${t('pending_verif')} <span class="chip amber">${pend.length}</span></h3>${pend.length ? userTable(pend) : `<p class="muted">${t('none_yet')}</p>`}</div></div>`);
  bindUserActions(pend);
}
/* ---------- leader (owner) & staff ---------- */
const isOwner = () => S.user && S.user.role === 'admin' && !S.user.is_demo;
const isOps = () => S.user && (S.user.role === 'admin' || S.user.role === 'staff');
function userTable(list){
  const own = isOwner();
  return `<div class="scroll-x"><table class="table"><thead><tr><th>${t('full_name')}</th><th>${t('role')}</th><th>${t('wilayat')}</th><th>${t('details')}</th><th>${t('status')}</th>${own ? '<th></th>' : ''}</tr></thead><tbody>
    ${list.map(u => { const m = u.meta || {}; return `<tr><td><b>${esc(u.full_name)}</b><div class="xs muted ltr">${esc(u.email || '')} ${esc(u.phone || '')}</div>${u.civil_id ? `<div class="xs muted">${ic('idcard',11)} ${esc(u.civil_id)}</div>` : ''}</td>
      <td>${t('r_'+u.role)}${u.role === 'nurse' ? `<div class="xs muted">${t(m.gender === 'female' ? 'female' : 'male')}${m.manual ? ` · <span class="chip purple xs-chip">${t('manual')}</span>` : ` · <span class="chip gray xs-chip">${t('auto')}</span>`}</div>` : ''}${m.fleet_admin ? `<div class="xs muted">${t('r_fleet')}</div>` : ''}</td><td>${esc(wN(u.wilayat || ''))}</td>
      <td class="xs muted">${esc([m.license, m.lab_name, m.company_name, m.company, m.vehicle, m.plate, m.title].filter(Boolean).join(' · '))}${u.orders ? `<div>${t('orders_n',{n:u.orders})}</div>` : ''}</td>
      <td>${u.status === 'active' ? `<span class="chip teal">${t('active')}</span>` : `<span class="chip ${u.status === 'pending' ? 'amber' : 'red'}">${esc(t('us_' + u.status))}</span>`}</td>
      ${own ? `<td style="white-space:nowrap">${u.role === 'admin' ? '' : `${u.status !== 'active' ? `<button class="btn sm teal" data-us="${u.id}:active">${t('approve')}</button> ` : ''}${u.status === 'pending' ? `<button class="btn sm ghost" data-us="${u.id}:rejected">${t('reject')}</button> ` : u.status === 'active' && u.role !== 'patient' ? `<button class="btn sm ghost" data-us="${u.id}:suspended">${t('suspend')}</button> ` : ''}<button class="icon-btn sm" data-ue="${u.id}" title="${t('edit')}">${ic('gear',17)}</button><button class="icon-btn sm danger" data-ud="${u.id}" title="${t('delete')}">${ic('x',17)}</button>`}</td>` : ''}</tr>`; }).join('')}</tbody></table></div>`;
}
function bindUserActions(list){
  $$('[data-us]').forEach(b => b.onclick = async () => { const [id, s] = b.dataset.us.split(':'); try { await busy(b, () => API.adminSetStatus(id, s)); toast(t('saved')); render(); } catch(e) {} });
  $$('[data-ud]').forEach(b => b.onclick = async () => { const u = (list || []).find(x => x.id === b.dataset.ud); if (!await confirmBox(t('del_q',{n:u ? u.full_name : ''}), t('delete'), t('keep'))) return; try { await busy(b, () => API.adminUserDelete(b.dataset.ud)); toast(t('deleted')); render(); } catch(e) {} });
  $$('[data-ue]').forEach(b => b.onclick = () => { const u = (list || []).find(x => x.id === b.dataset.ue); if (u) userEditModal(u); });
}
function genPass(){ const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'; let s = 'Lah-'; for (let i = 0; i < 8; i++) s += a[Math.floor(Math.random() * a.length)]; return s; }
function wChecks(name, sel){ const W = S.catalog ? S.catalog.wilayats : Object.keys(WILAYAT_AR); return `<div class="row wrap" style="gap:6px">${W.map(w => `<label class="chip gray" style="cursor:pointer;padding:7px 10px"><input type="checkbox" name="${name}" value="${esc(w)}" ${(sel || []).includes(w) ? 'checked' : ''}> ${esc(wN(w))}</label>`).join('')}</div>`; }
function userEditModal(u){
  const m = u.meta || {}; const W = S.catalog ? S.catalog.wilayats : Object.keys(WILAYAT_AR);
  modal(`<h3>${t('edit')} · ${esc(u.full_name)}</h3><form class="stack" id="uef" style="margin-top:12px">
    <label class="field"><span>${t('full_name')}</span><input class="input" name="full_name" value="${esc(u.full_name)}"></label>
    <label class="field"><span>${t('wilayat')}</span><select class="input" name="wilayat">${W.map(w => `<option value="${esc(w)}" ${u.wilayat === w ? 'selected' : ''}>${esc(wN(w))}</option>`).join('')}</select></label>
    ${['nurse','courier'].includes(u.role) ? `<div class="field"><span>${t('coverage')}</span>${wChecks('cov', m.coverage)}</div><label class="check"><input type="checkbox" name="manual" ${m.manual ? 'checked' : ''}> <span><b>${t('manual')}</b> — ${t('manual_d')}</span></label>` : ''}
    <label class="field"><span>${t('reset_pw')}</span><div class="row"><input class="input grow ltr" name="password" placeholder="${t('reset_pw_ph')}"><button type="button" class="btn soft sm" data-gp>${t('generate')}</button></div></label>
    <div class="row"><button type="button" class="btn ghost grow" data-x>${t('cancel')}</button><button class="btn grow">${t('save_changes')}</button></div></form>`, (el, close) => {
    $('[data-x]', el).onclick = close; $('[data-gp]', el).onclick = () => { $('[name=password]', el).value = genPass(); };
    $('#uef', el).onsubmit = async e => { e.preventDefault(); const f = e.target; const meta = {};
      if (f.manual) meta.manual = f.manual.checked; if ($$('[name=cov]', f).length) meta.coverage = $$('[name=cov]:checked', f).map(x => x.value);
      try { await busy($('button.btn:not(.ghost):not(.soft)', f), () => API.adminUserUpdate(u.id, { full_name: f.full_name.value, wilayat: f.wilayat.value, meta, password: f.password.value.trim() })); close(); toast(t('saved')); render(); } catch(err) {} };
  });
}
function userAddModal(){
  const W = S.catalog ? S.catalog.wilayats : Object.keys(WILAYAT_AR); let role = 'nurse';
  const extra = r => ({
    nurse: `<div class="grid g2"><label class="field"><span>${t('gender')}</span><select class="input" name="gender"><option value="female">${t('female')}</option><option value="male">${t('male')}</option></select></label><label class="field"><span>${t('license')}</span><input class="input" name="license" placeholder="OMSB-RN-…"></label></div>
      <div class="grid g2"><label class="field"><span>${t('years')}</span><input class="input" type="number" name="years" min="0"></label><label class="field"><span>${t('civil_id')}</span><input class="input" name="civil_id" inputmode="numeric"></label></div>
      <div class="field"><span>${t('coverage')}</span>${wChecks('cov', ['Ibra'])}</div><label class="check"><input type="checkbox" name="manual"> <span><b>${t('manual')}</b> — ${t('manual_d')}</span></label>`,
    courier: `<label class="field"><span>${t('logistics_co')}</span><input class="input" name="company"></label><div class="grid g2"><label class="field"><span>${t('vehicle')}</span><input class="input" name="vehicle"></label><label class="field"><span>${t('plate')}</span><input class="input" name="plate"></label></div><label class="field"><span>${t('civil_id')}</span><input class="input" name="civil_id" inputmode="numeric"></label><div class="field"><span>${t('coverage')}</span>${wChecks('cov', ['Ibra'])}</div><label class="check"><input type="checkbox" name="fleet_admin"> <span>${t('r_fleet')}</span></label>`,
    lab: `<label class="field"><span>${t('lab_name')}</span><input class="input" name="lab_name"></label><div class="grid g2"><label class="field"><span>${t('lab_license')}</span><input class="input" name="license"></label><label class="field"><span>${t('accreditation')}</span><input class="input" name="accreditation"></label></div><div class="grid g2"><label class="field"><span>${t('director')}</span><input class="input" name="director"></label><label class="field"><span>${t('hours')}</span><input class="input" name="hours" placeholder="07:00–20:00"></label></div>`,
    company: `<label class="field"><span>${t('company_name')}</span><input class="input" name="company_name"></label><div class="grid g2"><label class="field"><span>${t('cr')}</span><input class="input" name="cr"></label><label class="field"><span>${t('employees')}</span><input class="input" type="number" name="employees"></label></div>`,
    doctor: `<div class="grid g2"><label class="field"><span>${t('license')}</span><input class="input" name="license" placeholder="OMSB-MD-…"></label><label class="field"><span>${t('gender')}</span><select class="input" name="gender"><option value="female">${t('female')}</option><option value="male">${t('male')}</option></select></label></div><label class="field"><span>Specialty</span><input class="input" name="specialty" placeholder="Family Medicine"></label>`,
    staff: `<label class="field"><span>${t('job_title')}</span><input class="input" name="title" placeholder="${t('r_staff')}"></label><div class="banner blue small">${ic('eye',18)}<span>${t('staff_note')}</span></div>`,
    patient: `<label class="field"><span>${t('civil_id')}</span><input class="input" name="civil_id" inputmode="numeric"></label><label class="field"><span>${t('gender')}</span><select class="input" name="gender"><option value="male">${t('male')}</option><option value="female">${t('female')}</option></select></label>`
  })[r];
  modal(`<h3>${t('add_user')}</h3><div class="cats" style="margin:10px 0" id="arole">${['nurse','doctor','courier','lab','company','staff','patient'].map(r => `<button type="button" data-ar="${r}" class="${r === role ? 'on' : ''}">${t('r_'+r)}</button>`).join('')}</div>
    <form class="stack" id="uaf"><label class="field"><span>${t('full_name')}</span><input class="input" name="full_name" required></label>
    <div class="grid g2"><label class="field"><span>${t('email')}</span><input class="input ltr" type="email" name="email"></label><label class="field"><span>${t('phone')}</span><input class="input ltr" name="phone" inputmode="tel"></label></div>
    <label class="field"><span>${t('wilayat')}</span><select class="input" name="wilayat">${W.map(w => `<option value="${esc(w)}">${esc(wN(w))}</option>`).join('')}</select></label>
    <div id="uax">${extra(role)}</div>
    <label class="field"><span>${t('password')}</span><div class="row"><input class="input grow ltr" name="password" value="${genPass()}"><button type="button" class="btn soft sm" data-gp>${t('generate')}</button></div></label>
    <div class="err" id="uae"></div><div class="row"><button type="button" class="btn ghost grow" data-x>${t('cancel')}</button><button class="btn grow" id="uas">${t('add_user')}</button></div></form>`, (el, close) => {
    $('[data-x]', el).onclick = close; $('[data-gp]', el).onclick = () => { $('[name=password]', el).value = genPass(); };
    $$('[data-ar]', el).forEach(b => b.onclick = () => { role = b.dataset.ar; $$('[data-ar]', el).forEach(x => x.classList.toggle('on', x === b)); $('#uax', el).innerHTML = extra(role); });
    $('#uaf', el).onsubmit = async e => { e.preventDefault(); const f = e.target; const g = n => f[n] ? (f[n].type === 'checkbox' ? f[n].checked : String(f[n].value || '').trim()) : undefined;
      const meta = {}; ['gender','license','years','company','vehicle','plate','lab_name','accreditation','director','hours','company_name','cr','employees','title','specialty'].forEach(k => { const v = g(k); if (v) meta[k] = v; });
      if (f.manual) meta.manual = f.manual.checked; if (f.fleet_admin) meta.fleet_admin = f.fleet_admin.checked; if ($$('[name=cov]', f).length) meta.coverage = $$('[name=cov]:checked', f).map(x => x.value);
      if (role === 'nurse') { meta.languages = ['Arabic','English']; }
      const ll = WILAYAT_LL[g('wilayat')] || [];
      const p = { role, full_name: role === 'lab' && meta.lab_name ? meta.lab_name : role === 'company' && meta.company_name ? meta.company_name : g('full_name'), email: g('email'), phone: g('phone'), wilayat: g('wilayat'), lat: ll[0], lng: ll[1], password: g('password'), civil_id: (g('civil_id') || '').replace(/\D/g, ''), meta };
      if (role === 'lab' || role === 'company') meta.contact = g('full_name');
      try { const u = await busy($('#uas', el), () => API.adminUserCreate(p)); close();
        modal(`<div class="center"><div class="ic-round" style="margin:0 auto 10px;color:var(--teal);background:var(--teal-bg)">${ic('check',26)}</div><h3>${t('user_added')}</h3><p class="muted small">${t('user_added_p')}</p></div>
          <div class="card flat" style="margin-top:10px"><div class="vline"><span class="muted">${t('r_'+role)}</span><b>${esc(u.full_name)}</b></div><div class="vline"><span class="muted">${t('email_or_phone')}</span><b class="ltr">${esc(p.email || p.phone)}</b></div><div class="vline" style="border:0"><span class="muted">${t('password')}</span><b class="ltr">${esc(p.password)}</b></div></div>
          <button class="btn block" data-x style="margin-top:12px">${t('done')}</button>`, (el2, c2) => { $('[data-x]', el2).onclick = () => { c2(); render(); }; });
      } catch(err) { $('#uae', el).textContent = errMsg(err); } };
  });
}
async function viewAdminUsers(){
  loading(t('m_users')); await loadCatalog().catch(() => {});
  const role = new URLSearchParams(location.hash.split('?')[1] || '').get('role') || '';
  const list = await API.adminUsers(role || null, null);
  app.innerHTML = shell(t('m_users'), `<div class="row between wrap" style="margin-bottom:12px;gap:10px"><div class="cats" style="margin:0">${['','patient','nurse','courier','lab','company','staff','admin'].map(r => `<button class="${r === role ? 'on' : ''}" data-r="${r}">${r ? t('r_'+r) : t('cat_all')}</button>`).join('')}</div>
    <div class="row" style="gap:8px"><input class="input" id="uq" placeholder="${t('search')}…" style="min-height:42px;width:200px">${isOwner() ? `<button class="btn" id="uadd">${ic('plus',18)} ${t('add_user')}</button>` : ''}</div></div>
    ${!isOwner() ? `<div class="banner blue small" style="margin-bottom:12px">${ic('eye',18)}<span>${t('readonly_note')}</span></div>` : ''}
    <div class="card" id="ut">${userTable(list)}</div>`);
  $$('[data-r]').forEach(b => b.onclick = () => go('app/admin/users' + (b.dataset.r ? '?role=' + b.dataset.r : '')));
  bindUserActions(list);
  if ($('#uadd')) $('#uadd').onclick = userAddModal;
  $('#uq').oninput = e => { const q = e.target.value.toLowerCase(); const l = list.filter(u => [u.full_name, u.email, u.phone, u.civil_id, u.wilayat].join(' ').toLowerCase().includes(q)); $('#ut').innerHTML = userTable(l); bindUserActions(l); };
}
async function viewAdminOrders(){
  loading(t('m_all_orders'));
  const list = await API.orders(); let f = 'all', q = '';
  const draw = () => { const l = list.filter(o => (f === 'all' || (f === 'active' ? ACTIVE(o.status) : o.status === f)) && (!q || [o.code, o.person, o.nurse, o.wilayat].join(' ').toLowerCase().includes(q)));
    $('#ot').innerHTML = `<table class="table"><thead><tr><th>${t('request')}</th><th>${t('patient')}</th><th>${t('r_nurse')}</th><th>${t('appointment')}</th><th>${t('wilayat')}</th><th>${t('total')}</th><th>${t('status')}</th><th>${t('last_update')}</th></tr></thead><tbody>
    ${l.map(o => `<tr style="cursor:pointer" data-o="${o.id}"><td><b class="ltr">${esc(o.code)}</b></td><td>${esc(o.person || '')}</td><td class="small">${esc(o.nurse || '—')}</td><td class="small">${fmtDate(o.slot_date)} · ${esc(o.slot_time)}</td><td>${esc(wN(o.wilayat))}</td><td class="num">${omr(o.total)}</td><td>${stChip(o.status)}</td><td class="xs muted">${o.updated_at ? ago(o.updated_at) : ''}</td></tr>`).join('')}</tbody></table>`;
    $$('[data-o]').forEach(r => r.onclick = () => go('app/order/' + r.dataset.o)); };
  app.innerHTML = shell(t('m_all_orders'), `<div class="row between wrap" style="margin-bottom:12px;gap:10px"><div class="cats" style="margin:0">${['all','active','booked','completed','cancelled'].map(x => `<button data-f="${x}" class="${x === f ? 'on' : ''}">${x === 'all' ? t('cat_all') : x === 'active' ? t('active_orders') : t('st_'+x)}</button>`).join('')}</div><input class="input" id="oq" placeholder="${t('search')}…" style="min-height:42px;width:220px"></div>
    <div class="card"><div class="scroll-x" id="ot"></div></div>`);
  $$('[data-f]').forEach(b => b.onclick = () => { f = b.dataset.f; $$('[data-f]').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  $('#oq').oninput = e => { q = e.target.value.toLowerCase(); draw(); };
  draw();
}
async function viewAdminPayments(){
  loading(t('m_payments'));
  const P = await API.adminPayments(); const own = isOwner();
  app.innerHTML = shell(t('m_payments'), `<div class="stack-lg">
    <div class="grid g4"><div class="kpi blue"><span>${t('pay_gross')}</span><b>${omr(P.gross)}</b></div><div class="kpi"><span>${t('pay_sponsored')}</span><b>${omr(P.sponsored)}</b></div><div class="kpi"><span>${t('pay_refunded')}</span><b>${omr(P.refunded)}</b></div><div class="kpi"><span>${t('pay_nurses')}</span><b>${omr(P.nurse_payout)}</b></div></div>
    ${P.lab_payout != null ? `<div class="card"><h3>${t('pay_split_t')}</h3><p class="xs muted" style="margin-top:-4px">${t('pay_split_p')}</p><div class="grid g4" style="margin-top:8px"><div class="kpi"><span>${t('bz_lab')}</span><b>${omr(P.lab_payout)}</b></div><div class="kpi"><span>${t('bz_courier')}</span><b>${omr(P.courier_payout)}</b></div><div class="kpi"><span>${t('bz_kit')} · ${t('bz_card')}</span><b>${omr(Number(P.kit_cost) + Number(P.card_fees))}</b></div><div class="kpi"><span>${t('bz_doctor')}</span><b>${omr(P.doctor_payout)}</b></div></div>
      <div class="vline" style="margin-top:10px"><span>${t('pay_consults')}</span><b class="num">${omr(P.consult_revenue)} ${t('omr')}</b></div><div class="vline" style="border:0"><span class="b">${t('pay_margin')}</span><b class="num" style="color:${P.platform_margin >= 0 ? '#0a7d70' : 'var(--red)'}">${omr(P.platform_margin)} ${t('omr')}</b></div><a class="b small" href="#/business">${t('m_business')} →</a></div>` : ''}
    <div class="card"><h3>${t('pay_by_method')}</h3>${Object.entries(P.by_method || {}).map(([k, v]) => `<div class="vline"><span>${t('pm_' + k)}</span><b class="num">${omr(v)} ${t('omr')}</b></div>`).join('') || `<p class="muted">${t('none_yet')}</p>`}<div class="banner blue small" style="margin-top:10px">${ic('shield',18)}<span>${t('epay_only')}</span></div></div>
    <div class="card"><h3>${t('pay_list')}</h3><div class="scroll-x"><table class="table"><thead><tr><th>${t('request')}</th><th>${t('patient')}</th><th>${t('payment')}</th><th>${t('total')}</th><th>${t('time')}</th><th>${t('status')}</th>${own ? '<th></th>' : ''}</tr></thead><tbody>
      ${P.list.map(x => `<tr><td><a class="b ltr" href="#/app/order/${x.id}">${esc(x.code)}</a></td><td>${esc(x.patient)}</td><td class="small">${t('pm_' + x.method)}</td><td class="num">${omr(x.total)}</td><td class="xs muted">${fmtDT(x.at)}</td>
        <td>${x.refunded ? `<span class="chip red">${t('refunded')}</span>` : x.paid ? `<span class="chip teal">${t('paid')}</span>` : x.method === 'sponsored' ? `<span class="chip purple">${t('sponsored')}</span>` : `<span class="chip amber">${t('unpaid')}</span>`}</td>
        ${own ? `<td>${x.paid && !x.refunded ? `<button class="btn sm ghost" data-rf="${x.id}">${t('refund')}</button>` : ''}</td>` : ''}</tr>`).join('')}</tbody></table></div></div></div>`);
  $$('[data-rf]').forEach(b => b.onclick = async () => { if (!await confirmBox(t('refund_q'), t('refund'), t('keep'))) return; try { await busy(b, () => API.adminRefund(b.dataset.rf)); toast(t('saved')); render(); } catch(e) {} });
}
async function viewAdminContracts(){
  loading(t('m_contracts')); await loadCatalog();
  const [list, cos] = await Promise.all([API.programs(), API.adminUsers('company', 'active')]); const own = isOwner();
  app.innerHTML = shell(t('m_contracts'), `<div class="stack-lg"><div class="row between wrap"><p class="muted" style="margin:0">${t('contracts_p')}</p>${own ? `<button class="btn" id="cadd">${ic('plus',18)} ${t('new_contract')}</button>` : ''}</div>
    ${list.length ? `<div class="grid g2 collapse">${list.map(p => `<div class="card"><div class="row between"><div><div class="xs muted b">${esc(p.company || '')}</div><h3 style="margin:2px 0">${esc(p.name)}</h3></div><span class="chip ${p.active ? 'teal' : 'gray'}">${p.active ? t('active') : t('inactive')}</span></div>
      <div class="vline"><span class="muted">${t('sponsor_code')}</span><b class="ltr code-sm">${esc(p.code)}</b></div><div class="vline"><span class="muted">${t('package')}</span><b>${esc(p.package ? LN(p.package,'name') : '')}</b></div>
      <div class="vline"><span class="muted">${t('seats_used')}</span><b>${p.booked} / ${p.seats}</b></div><div class="vline"><span class="muted">${t('completed_orders')}</span><b>${p.completed}</b></div>
      <div class="vline"><span class="muted">${t('contract_value')}</span><b class="num">${omr(p.price != null ? p.price : p.value)} ${t('omr')}</b></div>
      ${p.starts_on || p.ends_on ? `<div class="vline"><span class="muted">${t('period')}</span><b>${p.starts_on ? fmtDate(p.starts_on) : '—'} → ${p.ends_on ? fmtDate(p.ends_on) : '—'}</b></div>` : ''}
      <div class="progress" style="margin-top:10px"><i style="width:${Math.min(100, Math.round(p.booked / Math.max(1, p.seats) * 100))}%"></i></div>
      ${own ? `<div class="row" style="margin-top:12px"><button class="btn sm ghost" data-ct="${p.id}:${p.active ? 0 : 1}">${p.active ? t('pause') : t('activate')}</button></div>` : ''}</div>`).join('')}</div>` : emptyBox(t('none_yet'))}</div>`);
  $$('[data-ct]').forEach(b => b.onclick = async () => { const [id, a] = b.dataset.ct.split(':'); try { await busy(b, () => API.adminContractSave({ id, active: a === '1' })); toast(t('saved')); render(); } catch(e) {} });
  if ($('#cadd')) $('#cadd').onclick = () => modal(`<h3>${t('new_contract')}</h3><form class="stack" id="cf" style="margin-top:12px">
      <label class="field"><span>${t('r_company')}</span><select class="input" name="company_id" required>${cos.map(c => `<option value="${c.id}">${esc(c.full_name)}</option>`).join('')}</select></label>
      <label class="field"><span>${t('contract_name')}</span><input class="input" name="name" required placeholder="Employee Wellness 2027"></label>
      <div class="grid g2"><label class="field"><span>${t('package')}</span><select class="input" name="package_id">${S.catalog.packages.map(k => `<option value="${k.id}">${esc(LN(k,'name'))} · ${omr(k.price)}</option>`).join('')}</select></label><label class="field"><span>${t('employees')}</span><input class="input" type="number" name="seats" min="1" value="20"></label></div>
      <div class="grid g3"><label class="field"><span>${t('contract_value')} (${t('omr')})</span><input class="input num" name="price" inputmode="decimal"></label><label class="field"><span>${t('starts')}</span><input class="input" type="date" name="starts_on"></label><label class="field"><span>${t('ends')}</span><input class="input" type="date" name="ends_on"></label></div>
      <label class="field"><span>${t('notes_l')}</span><input class="input" name="notes"></label><div class="err" id="cfe"></div>
      <div class="row"><button type="button" class="btn ghost grow" data-x>${t('cancel')}</button><button class="btn grow" id="cfs">${t('save_changes')}</button></div></form>`, (el, close) => {
    $('[data-x]', el).onclick = close;
    $('#cf', el).onsubmit = async e => { e.preventDefault(); const f = e.target; const p = {}; ['company_id','name','package_id','seats','price','starts_on','ends_on','notes'].forEach(k => p[k] = f[k].value);
      try { const r = await busy($('#cfs', el), () => API.adminContractSave(p)); close(); toast(t('contract_ok',{c:r.code})); render(); } catch(err) { $('#cfe', el).textContent = errMsg(err); } }; });
}
async function viewAdminSettings(){
  loading(t('m_settings'));
  const st = await API.adminSettings(); const own = isOwner(); const v = k => String(st[k] == null ? '' : st[k]).replace(/"/g, '');
  app.innerHTML = shell(t('m_settings'), `<div class="grid g2 collapse" style="align-items:start">
    <div class="card stack"><h3>${ic('route',20)} ${t('auto_t')}</h3><p class="muted small" style="margin:0">${t('auto_p')}</p>
      <label class="check"><input type="checkbox" id="am" ${st.auto_mode !== false ? 'checked' : ''} ${own ? '' : 'disabled'}> <b>${t('auto_on')}</b></label>
      <div class="grid g2"><label class="field"><span>${t('auto_step')}</span><input class="input num" id="as" type="number" min="1" max="120" value="${v('auto_step_minutes')}" ${own ? '' : 'disabled'}></label><label class="field"><span>${t('auto_accept')}</span><input class="input num" id="aa" type="number" min="0" max="240" value="${v('auto_accept_minutes')}" ${own ? '' : 'disabled'}></label></div>
      <div class="banner blue small">${ic('users',18)}<span>${t('auto_manual_note')}</span></div></div>
    <div class="card stack"><h3>${ic('card',20)} ${t('fees_t')}</h3>
      <div class="grid g2"><label class="field"><span>${t('home_fee')} (${t('omr')})</span><input class="input num" id="hf" inputmode="decimal" value="${v('home_fee')}" ${own ? '' : 'disabled'}></label><label class="field"><span>${t('nurse_fee')} (${t('omr')})</span><input class="input num" id="nf" inputmode="decimal" value="${v('nurse_fee')}" ${own ? '' : 'disabled'}></label></div>
      <label class="field"><span>${t('fast_last')}</span><select class="input" id="fl" ${own ? '' : 'disabled'}>${['08:00','09:00','10:00','11:00'].map(x => `<option ${v('fasting_last_slot') === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label></div>
    <div class="card stack"><h3>${ic('file',20)} ${t('demo_res_l')}</h3><p class="muted small" style="margin:0">${t('demo_res_p')}</p><select class="input" id="dr" ${own ? '' : 'disabled'}>${['mixed','normal','review','urgent'].map(x => `<option value="${x}" ${(v('demo_results') || 'mixed') === x ? 'selected' : ''}>${t('dr_'+x)}</option>`).join('')}</select></div>
    ${own ? `<div><button class="btn" id="sts">${t('save_changes')}</button></div>` : `<div class="banner blue small">${ic('eye',18)}<span>${t('readonly_note')}</span></div>`}</div>`);
  if ($('#sts')) $('#sts').onclick = async () => { const b = $('#sts'); const sets = [['auto_mode', $('#am').checked], ['auto_step_minutes', +$('#as').value || 2], ['auto_accept_minutes', +$('#aa').value || 0], ['home_fee', +$('#hf').value], ['nurse_fee', +$('#nf').value], ['fasting_last_slot', $('#fl').value], ['demo_results', $('#dr').value]];
    try { await busy(b, () => Promise.all(sets.map(([k, x]) => API.adminSetting(k, x)))); S.catalog = null; toast(t('saved')); } catch(e) {} };
}

async function viewAdminCatalog(){
  await loadCatalog(true);
  app.innerHTML = shell(t('m_catalog'), `<div class="card"><div class="scroll-x"><table class="table"><thead><tr><th>${t('analyte')}</th><th>${t('tube')}</th><th>${t('price')} (${t('omr')})</th><th></th></tr></thead><tbody>
    ${S.catalog.tests.map(x => `<tr><td><b>${esc(LN(x,'name'))}</b><div class="xs muted">${x.analytes.length} · ${x.fasting_hours ? t('fasting',{h:x.fasting_hours}) : t('no_fasting')}</div></td><td class="small">${esc(x.tube)}</td><td><input class="input num" style="width:110px;min-height:38px;padding:6px 10px" inputmode="decimal" value="${omr(x.price)}" data-price="${x.id}"></td><td><button class="btn sm soft" data-sv="${x.id}">${t('save_changes')}</button></td></tr>`).join('')}</tbody></table></div></div>`);
  $$('[data-sv]').forEach(b => b.onclick = async () => { const v = parseFloat($(`[data-price="${b.dataset.sv}"]`).value); try { await busy(b, () => API.adminTest(b.dataset.sv, v, true)); toast(t('saved')); loadCatalog(true).catch(() => {}); } catch(e) {} });
}

/* ---------- profile & notifications ---------- */
async function viewProfile(){
  const u = S.user; const m = u.meta || {}; await loadCatalog().catch(() => {});
  const W = S.catalog ? S.catalog.wilayats : Object.keys(WILAYAT_AR);
  app.innerHTML = shell(t('profile_t'), `<div class="grid g2 collapse" style="align-items:start"><div class="stack">
    <div class="card row">${A.roleIcon(u.role, 60)}<div><h3 style="margin:0">${esc(u.full_name)}</h3><div class="small muted">${t('r_'+u.role)} · <span class="ltr">${esc(u.phone || u.email || '')}</span></div>${u.status === 'active' && u.role !== 'patient' ? `<span class="chip teal" style="margin-top:6px">${ic('shield',14)} ${t('active')}</span>` : ''}</div></div>
    <form class="card stack" id="pf"><h3>${t('details')}</h3><label class="field"><span>${t('full_name')}</span><input class="input" name="full_name" value="${esc(u.full_name)}"></label>
      <label class="field"><span>${t('phone')}</span><input class="input" name="phone" value="${esc(u.phone || '')}" inputmode="tel"></label>
      ${['patient','nurse','courier'].includes(u.role) ? `<label class="field"><span>${ic('idcard',15)} ${t('civil_id')}</span><input class="input ltr" name="civil_id" inputmode="numeric" maxlength="10" value="${esc(u.civil_id || '')}" placeholder="${t('civil_ph')}" ${u.is_demo ? 'readonly' : ''}><div class="hint">${t(u.is_demo ? 'civil_demo' : 'civil_hint')}</div></label>` : ''}
      <label class="field"><span>${t('wilayat')}</span><select class="input" name="wilayat">${W.map(w => `<option value="${esc(w)}" ${u.wilayat === w ? 'selected' : ''}>${esc(wN(w))}</option>`).join('')}</select></label>
      ${u.role === 'patient' ? `<label class="field"><span>${t('address')}</span><input class="input" name="address" value="${esc(u.address || '')}"></label>
      <h4 style="margin-top:8px">${t('medical')}</h4><div class="grid g3"><label class="field"><span>${t('blood')}</span><select class="input" name="blood">${['','A+','A-','B+','B-','AB+','AB-','O+','O-'].map(b => `<option ${m.blood === b ? 'selected' : ''}>${b}</option>`).join('')}</select></label>
      <label class="field"><span>${t('gender')}</span><select class="input" name="gender"><option value="male">${t('male')}</option><option value="female" ${m.gender === 'female' ? 'selected' : ''}>${t('female')}</option></select></label><label class="field"><span>${t('dob')}</span><input class="input" type="date" name="dob" value="${esc(m.dob || '')}"></label></div>
      <label class="field"><span>${t('allergies')}</span><input class="input" name="allergies" value="${esc(m.allergies || '')}"></label><label class="field"><span>${t('chronic')}</span><input class="input" name="chronic" value="${esc(m.chronic || '')}"></label>` : ''}
      <button class="btn">${t('save_changes')}</button></form></div>
    <div class="stack"><form class="card stack" id="pw"><h3>${t('change_pw')}</h3>${pwField('old', t('old_pw'))}${pwField('new1', t('new_pw'), t('pass_rule'))}<button class="btn ghost">${t('change_pw')}</button></form>
      ${mailCard()}${pushCard()}<div class="card"><h3>${t('install_t')}</h3><p class="muted small">${t('install_p')}</p><a class="btn" href="#/install">${ic('download',18)} ${t('ins_cta')}</a></div>
      <div class="card row between"><span class="b">${S.lang === 'ar' ? 'اللغة' : 'Language'}</span><button class="lang" data-lang>${t('lang')}</button></div>
      <button class="btn ghost block" data-logout>${ic('logout',18)} ${t('logout')}</button></div></div>`);
  bindPw(app);
  $('#pf').onsubmit = async e => { e.preventDefault(); const f = e.target; const meta = {}; ['blood','gender','dob','allergies','chronic'].forEach(k => { if (f[k]) meta[k] = f[k].value; });
    const ll = WILAYAT_LL[f.wilayat.value] || [];
    try { S.user = await busy($('button', f), () => API.profile({ full_name: f.full_name.value, phone: f.phone.value, wilayat: f.wilayat.value, address: f.address ? f.address.value : undefined, lat: u.lat || ll[0], lng: u.lng || ll[1], meta, civil_id: f.civil_id && !u.is_demo && f.civil_id.value.trim() ? f.civil_id.value.replace(/\D/g, '') : undefined })); toast(t('saved')); } catch(err) {} };
  $('#pw').onsubmit = async e => { e.preventDefault(); const f = e.target; try { await busy($('button', f), () => API.password(f.old.value, f.new1.value)); toast(t('saved')); f.reset(); } catch(err) {} };
  if ($('#inst')) $('#inst').onclick = async () => { S.installEvt.prompt(); S.installEvt = null; };
}
async function viewNotifs(){
  loading(t('notifs_t'));
  const list = await API.notifs();
  app.innerHTML = shell(t('notifs_t'), `<div class="card">${list.length ? `<div class="row between"><span></span><button class="link small" id="mr">${t('mark_read')}</button></div>` + list.map(n => `<a class="notif ${n.read ? '' : 'unread'}" ${n.order_id ? `href="#/app/order/${n.order_id}"` : ''} style="color:inherit"><span class="nd"></span><div class="grow"><b>${esc(S.lang === 'ar' ? n.title_ar : n.title_en)}</b><div class="small muted">${esc(S.lang === 'ar' ? n.body_ar : n.body_en)}</div></div><span class="xs muted">${ago(n.created_at)}</span></a>`).join('') : `<p class="muted center">${t('no_notifs')}</p>`}</div>`);
  API.notifsRead().then(() => { S.unread = 0; });
  if ($('#mr')) $('#mr').onclick = () => viewNotifs();
}

function toastCart(){
  const el = $('#toast'); el.innerHTML = `${esc(t('added_cart'))} · <a href="#/${S.user ? 'app/cart' : 'register'}" style="color:#9fd0ff;text-decoration:underline">${esc(t('view_cart'))}</a>`;
  el.className = 'show'; el.style.pointerEvents = 'auto'; clearTimeout(el._t); el._t = setTimeout(() => { el.className = ''; el.style.pointerEvents = 'none'; }, 3200);
}

function refreshCartBadges(){
  const n = cartCount();
  $$('a[aria-label="' + t('m_cart') + '"], .tabbar a[href="#/app/cart"]').forEach(a => { const d = $('.dot', a); if (n) { if (d) d.textContent = n; else a.insertAdjacentHTML('afterbegin', `<span class="dot">${n}</span>`); } else if (d) d.remove(); });
  $$('.side a[href="#/app/cart"], .drawer a[href="#/app/cart"], nav a[href="#/app/cart"]').forEach(a => { if (a.closest('.tabbar')) return; const c = $('.chip.red', a); if (n) { if (c) c.textContent = n; else a.insertAdjacentHTML('beforeend', `<span class="chip red">${n}</span>`); } else if (c) c.remove(); });
}

function menuItems(){
  const u = S.user; const r = u ? u.role : null; const n = cartCount();
  const it = (href, icon, label, extra) => `<a href="#/${href}" class="mi">${ic(icon)}<span class="grow">${esc(label)}</span>${extra || ''}</a>`;
  const grp = (title, body) => body ? `<div class="mg"><div class="mg-t">${esc(title)}</div><div class="mg-b">${body}</div></div>` : '';
  let sv = '', ac = '', co = '';
  if (!u || r === 'patient') {
    sv += it(u ? 'app' : '', 'home', t('m_home'));
    sv += it(u ? 'app/tests' : 'tests', 'flask', t('q_book'));
    sv += it(u ? 'app/tests?c=selfkit' : 'tests?c=selfkit', 'box', t('m_selfkit'), '<span class="chip teal">NEW</span>');
    sv += it(u ? 'app/consult' : 'consult', 'steth', t('m_consult'));
    sv += it('dental', 'tooth', t('m_dental'));
    sv += it('expat', 'building', t('m_expat'), '<span class="chip teal">NEW</span>');
    if (u) {
      ac += it('app/cart', 'cart', t('m_cart'), n ? `<span class="chip red">${n}</span>` : '');
      ac += it('app/orders', 'list', t('m_orders')); ac += it('app/orders?r=1', 'file', t('m_reports_all'));
      ac += it('app/loyalty', 'star', t('m_loyalty')); ac += it('app/notifs', 'bell', t('m_notifs'), S.unread ? `<span class="chip red">${S.unread}</span>` : '');
      ac += it('app/privacy', 'shield', t('m_privacy')); ac += it('app/profile', 'user', t('m_profile'));
    } else sv += it('tests', 'cart', t('m_cart'), n ? `<span class="chip red">${n}</span>` : '');
  } else {
    navFor(r).forEach(([h2, i, k]) => { ac += it(h2, i, t(k)); });
    if (r === 'admin') ac += it('app/admin/tickets', 'chat', t('m_tickets'));
    ac += it('app/privacy', 'shield', t('m_privacy'));
  }
  co += it('how', 'globe', t('nav_how')); co += it('new', 'play', t('m_new'));
  co += it('about', 'users', t('m_about') + ' · ' + t('m_team')); co += it('contact', 'phone', t('m_contact'));
  co += it('support', 'chat', t('m_support')); co += it('install', 'download', t('m_install'));
  co += it('guarantee', 'shield', t('m_guarantee'));
  co += it('sources', 'file', t('m_sources'));
  if (canBiz()) co += it('business', 'chart', t('m_business'));
  if (!u) co += it('register?partner=1', 'building', t('m_join'));
  const foot = `<div class="mg-foot"><button class="mi" data-lang>${ic('globe')}<span class="grow">${t('lang')}</span></button>${u ? `<button class="mi" data-logout>${ic('logout')}<span class="grow">${t('logout')}</span></button>` : ''}</div>`;
  return grp(t('mg_services'), sv) + grp(t('mg_account'), ac) + grp('iLab@home', co) + foot;
}

function openMenu(from){
  const root = $('#modal-root'); if ($('.dd-bg', root)) { $('.dd-bg', root)._close(); return; }
  const bg = document.createElement('div'); bg.className = 'dd-bg';
  const u = S.user;
  bg.innerHTML = `<div class="dd" role="dialog" aria-modal="true" aria-label="${t('menu')}"><span class="dd-grab"></span>
    <div class="row between dd-head"><a href="#/" class="brand">${brandInner()}</a><button class="icon-btn" data-x aria-label="${t('close')}">${ic('x')}</button></div>
    ${u ? `<div class="me-card"><span class="avatar">${esc(initials(u.full_name))}</span><div class="grow"><b>${esc(u.full_name)}</b><div class="xs muted">${t('r_'+u.role)}</div></div></div>` : `<div class="me-card dd-cta"><div class="grow"><b>${t('hero_t1')}</b><div class="small muted">${t('hero_t2')}</div></div><div class="row"><a class="btn sm" href="#/register">${t('signup')}</a><a class="btn sm ghost" href="#/login">${t('login')}</a></div></div>`}
    <nav class="menu dd-grid">${menuItems()}</nav></div>`;
  root.appendChild(bg);
  const dd = $('.dd', bg); const btn = from || $('.topbar [data-menu]') || $('[data-menu]');
  /* desktop: open next to the button that was pressed, always fully inside the window
     (v32: the side bar's "More" sits at the bottom of the screen, so the menu opens beside the side bar and upwards) */
  if (innerWidth >= 900 && btn) placeMenu(dd, btn);
  requestAnimationFrame(() => { bg.classList.add('open'); if (window.FX && FX.ready && window.gsap && !matchMedia('(prefers-reduced-motion: reduce)').matches) gsap.from($$('.mi', dd), { y: 10, opacity: 0, duration: .35, stagger: .018, ease: 'power2.out', clearProps: 'all' }); });
  document.body.classList.add('lock');
  const close = () => { bg.classList.remove('open'); setTimeout(() => { bg.remove(); if (!$('#modal-root .modal-bg') && !$('.dd-bg.open')) document.body.classList.remove('lock'); }, 220); };
  bg._close = close;
  bg.addEventListener('click', e => { if (e.target === bg || e.target.closest('[data-x]') || e.target.closest('a')) close(); });
  const esc2 = e => { if (e.key === 'Escape') { close(); removeEventListener('keydown', esc2); } }; addEventListener('keydown', esc2);
  $$('[data-lang]', bg).forEach(b => b.onclick = () => { close(); setLang(S.lang === 'ar' ? 'en' : 'ar'); render(); });
  $$('[data-logout]', bg).forEach(b => b.onclick = () => { close(); doLogout(); });
  const f = $('.mi', dd); if (f && innerWidth >= 900) f.focus({ preventScroll: true });
}

function placeMenu(dd, btn){
  const r = btn.getBoundingClientRect(), W = innerWidth, H = innerHeight, m = 12;
  dd.style.maxHeight = (H - m * 2) + 'px';
  const w = Math.min(dd.offsetWidth || 720, W - m * 2), h = Math.min(dd.offsetHeight || 500, H - m * 2);
  const side = btn.closest('.side-nav');
  let x, y;
  if (side) { const s = side.getBoundingClientRect(); x = s.left > W / 2 ? s.left - m - w : s.right + m; y = r.bottom - h; }
  else { x = S.lang === 'ar' ? r.left : r.right - w; y = r.bottom + 10; if (y + h > H - m) y = r.top - 10 - h; }
  x = Math.max(m, Math.min(x, W - m - w)); y = Math.max(m, Math.min(y, H - m - h));
  dd.style.left = Math.round(x) + 'px'; dd.style.right = 'auto'; dd.style.top = Math.round(y) + 'px';
}

/* v32: the hologram logo's SVG animations cost about 15% of the main thread for as long as they run (measured), which made weak phones stutter.
   They now play for a few seconds after each screen and on hover, then rest. */
let HOLO_T = 0;
function holoSet(on){ document.querySelectorAll('svg.holo-mark').forEach(sv => { try { on ? sv.unpauseAnimations() : sv.pauseAnimations(); } catch(e) {} }); }
function holoWake(){ HOLO_T = Date.now(); if (!document.hidden && !matchMedia('(prefers-reduced-motion: reduce)').matches) holoSet(true); }
function holoCalm(){
  setInterval(() => { if (Date.now() - HOLO_T > 6500) holoSet(false); }, 1500);
  document.addEventListener('visibilitychange', () => document.hidden ? holoSet(false) : holoWake());
  document.addEventListener('pointerover', e => { if (e.target.closest && e.target.closest('.brand, .holo, .dd-head')) holoWake(); }, { passive: true });
}

/* v32: Noor the nurse guide, only on the home screens; her script loads when the browser is idle */
let MASCOT_P = null;
function mascotSync(){
  const h = location.hash.split('?')[0]; const home = h === '' || h === '#/' || h === '#' || (h === '#/app' && S.user && S.user.role === 'patient');
  if (!home) { if (window.LAHMascot) LAHMascot.hide(); return; }
  if (!MASCOT_P) MASCOT_P = new Promise((res, rej) => { (window.requestIdleCallback || (f => setTimeout(f, 900)))(() => { const sc = document.createElement('script'); sc.src = 'js/mascot.js?v=' + APP_V; sc.async = true; sc.onload = res; sc.onerror = () => { MASCOT_P = null; rej(); }; document.head.appendChild(sc); }, { timeout: 2500 }); });
  MASCOT_P.then(() => { const now = location.hash.split('?')[0]; if (now !== h && !(h === '' && now === '#/')) return; const u = !!S.user;
    LAHMascot.show({ lang: S.lang, user: S.user, links: { book: u ? 'app/tests' : 'tests', kit: u ? 'app/tests?c=selfkit' : 'tests?c=selfkit', doc: u ? 'app/consult' : 'consult', cart: u ? 'app/cart' : 'register' } }); }).catch(() => {});
}

function viewStart(){
  const slides = [['start_t1','start_p1', A.hero], ['start_t2','start_p2', startArt('gender')], ['start_t3','start_p3', startArt('report')]];
  let i = 0;
  const draw = () => {
    app.innerHTML = `<div class="start"><div class="row between start-top"><button class="lang" data-lang>${t('lang')}</button><button class="link" data-skip style="color:#fff">${t('skip')}</button></div>
      <div class="start-art">${slides[i][2]}</div>
      <div class="start-body"><div class="dots">${slides.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
      <h1>${t(slides[i][0])}</h1><p>${t(slides[i][1])}</p>
      ${i < 2 ? `<button class="btn block" data-next>${t('next')} ${'<span class="flip">'+ic('arrow',18)+'</span>'}</button>` :
        `<a class="btn block" href="#/register" data-done>${t('start_go')}</a><a class="btn ghost block" href="#/login" data-done style="margin-top:10px">${t('login')}</a>`}
      <button class="link" data-skip style="margin-top:14px">${t('guest')}</button></div></div>`;
    $$('[data-lang]').forEach(b => b.onclick = () => { setLang(S.lang === 'ar' ? 'en' : 'ar'); draw(); });
    const done = () => localStorage.setItem('lah_seen', '1');
    if ($('[data-next]')) $('[data-next]').onclick = () => { i++; draw(); };
    $$('[data-done]').forEach(a => a.addEventListener('click', done));
    $$('[data-skip]').forEach(b => b.onclick = () => { done(); go(''); });
    let x0 = null; const el = $('.start'); el.addEventListener('touchstart', e => x0 = e.touches[0].clientX, { passive:true });
    el.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; const fwd = S.lang === 'ar' ? dx > 50 : dx < -50; const bwd = S.lang === 'ar' ? dx < -50 : dx > 50; if (fwd && i < 2) { i++; draw(); } else if (bwd && i > 0) { i--; draw(); } x0 = null; });
  };
  draw();
}

function startArt(kind){
  if (kind === 'gender') return `<svg viewBox="0 0 400 300" aria-hidden="true"><circle cx="200" cy="150" r="130" fill="#fff" opacity=".12"/>
    <g transform="translate(110 70)">${personSvg('#e8466f','#2b3b66', true)}</g><g transform="translate(220 70)">${personSvg('#1257d6','#fff', false)}</g>
    <g transform="translate(172 210)"><rect width="56" height="36" rx="18" fill="#fff"/><path d="M16 18l8 8 16-16" stroke="#0fae9b" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;
  return `<svg viewBox="0 0 400 300" aria-hidden="true"><circle cx="200" cy="150" r="130" fill="#fff" opacity=".12"/>
    <g transform="translate(140 40)"><rect width="120" height="210" rx="22" fill="#0b1730"/><rect x="8" y="8" width="104" height="194" rx="16" fill="#fff"/>
    <rect x="20" y="26" width="80" height="10" rx="5" fill="#1257d6"/><rect x="20" y="44" width="56" height="6" rx="3" fill="#9fb6e6"/>
    ${[0,1,2,3].map(k => `<rect x="20" y="${66 + k*26}" width="50" height="7" rx="3.5" fill="#cfe0ff"/><rect x="76" y="${64 + k*26}" width="24" height="11" rx="5" fill="${k === 1 ? '#fff4dc' : '#e3f7f4'}"/>`).join('')}
    <rect x="20" y="172" width="80" height="18" rx="8" fill="#0fae9b"/></g>
    <g transform="translate(262 70)"><circle r="28" fill="#0fae9b"/><path d="M-12 0l8 8 16-16" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;
}

function personSvg(c1, c2, hijab){
  return `<circle cx="35" cy="34" r="${hijab ? 26 : 22}" fill="${hijab ? '#2b3b66' : '#1b2b4f'}"/><ellipse cx="35" cy="38" rx="15" ry="17" fill="#c98b62"/>
    ${hijab ? '<path d="M14 40c0-18 9-28 21-28s21 10 21 28c-5-10-12-15-21-15s-16 5-21 15z" fill="#2b3b66"/>' : '<path d="M19 30c2-12 9-17 16-17s14 5 16 17c-6-6-11-8-16-8s-10 2-16 8z" fill="#1b2b4f"/>'}
    <path d="M0 140V100c0-22 16-38 35-38s35 16 35 38v40z" fill="${c1}"/><rect x="26" y="74" width="18" height="12" rx="2" fill="#fff"/><path d="M35 76v8M31 80h8" stroke="${c1}" stroke-width="2"/>`;
}

async function viewCart(){
  await loadCatalog(); const c = cartCalc();
  if (!c.items.length) { app.innerHTML = shell(t('cart_t'), emptyBox(t('cart_empty'), `<a class="btn" href="#/app/tests">${t('explore_tests')}</a>`)); return; }
  app.innerHTML = shell(t('cart_t'), `<div class="grid" id="cg" style="grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:18px;align-items:start">
    <div class="card"><h3>${t('cart_sub')}</h3>${c.items.map((i, k) => { const x = i.type === 'package' ? S.catalog.P[i.id] : S.catalog.T[i.id];
      return `<div class="vline">${A.catIcon(i.type === 'package' ? 'packages' : x.cat, 22)}<div class="grow" style="padding:0 12px"><b>${esc(i.name)}</b>${i.type === 'package' ? `<div class="xs muted">${t('tests_n',{n:x.test_ids.length})}</div>` : `<div class="xs muted">${x.fasting_hours ? t('fasting',{h:x.fasting_hours}) : t('no_fasting')}</div>`}</div><span class="price">${omr(i.price)}</span><button class="icon-btn" style="margin-inline-start:10px" data-rm="${k}" aria-label="${t('clear')}">${ic('x',18)}</button></div>`; }).join('')}
      ${c.fasting ? `<div class="banner amber small" style="margin-top:12px">${ic('clock',20)}<span>${t('fasting',{h:c.fasting})} · ${t('fasting_tip')}</span></div>` : ''}
      <a href="#/app/tests" class="btn soft sm" style="margin-top:14px">${ic('plus',16)} ${t('add_cart')}</a></div>
    <div class="card summary"><h3>${t('summary')}</h3><div class="line"><span>${t('lab_tests')}</span><span class="num">${omr(c.sub)}</span></div><div class="line"><span>${t('home_fee')}</span><span class="num">${omr(fee())}</span></div>
      <div class="line total"><span>${t('total')}</span><span class="num">${omr(c.sub + fee())} ${t('omr')}</span></div>
      <button class="btn block teal" style="margin-top:14px" data-go="app/book">${ic('syringe',18)} ${t('checkout')}</button></div></div>`);
  if (innerWidth < 900) $('#cg').style.gridTemplateColumns = 'minmax(0,1fr)';
  $$('[data-rm]').forEach(x => x.onclick = () => { const it = c.items[+x.dataset.rm]; toggleCart(it.type, it.id); viewCart(); });
}

Object.assign(I18N.en, { nurse_rule:'Our rule: a male nurse visits men, and a female nurse visits women and children.', nurse_rule_child:'Children under 12 are always visited by a female nurse.' });
Object.assign(I18N.ar, { nurse_rule:'قاعدتنا: الممرض يزور الرجال، والممرضة تزور النساء والأطفال.', nurse_rule_child:'الأطفال تحت 12 سنة تزورهم ممرضة دائماً.' });
function bkGender(b){ return b.who === 'family' ? b.person.gender : ((S.user.meta || {}).gender || 'male'); }
/* v32 rule (owner): a male nurse visits men; a female nurse visits women and children under 12 */
function ageOf(dob){ if (!dob) return null; const d = new Date(dob); if (isNaN(d)) return null; const n = new Date(); let a = n.getFullYear() - d.getFullYear(); if (n.getMonth() < d.getMonth() || (n.getMonth() === d.getMonth() && n.getDate() < d.getDate())) a--; return a; }
function bkChild(b){ const a = ageOf(b.who === 'family' ? b.person.dob : (S.user.meta || {}).dob); return a != null && a < 12; }
function bkNurseGender(b){ return bkChild(b) ? 'female' : bkGender(b); }

function nearestWilayat(lat, lng){ let best = null, bd = 1e9; for (const [w, ll] of Object.entries(WILAYAT_LL)) { const d = Math.hypot((ll[0]-lat) * 111, (ll[1]-lng) * 102); if (d < bd) { bd = d; best = w; } } return { w: best, km: bd }; }

function nurseCardHtml(n, sel){
  const col = n.gender === 'female' ? '#e8466f' : '#1257d6';
  return `<button type="button" class="ncard ${sel ? 'on' : ''}" data-nurse="${n.id}"><span class="avatar" style="background:${col}">${esc(initials(n.name))}</span>
    <span class="grow" style="text-align:start"><b>${esc(n.name)}</b><span class="xs muted" style="display:block">${n.rating ? '★ ' + n.rating + ' · ' : ''}${t('visits',{n:n.visits})}${n.years ? ' · ' + t('years_exp',{n:esc(n.years)}) : ''}</span>
    ${n.bio ? `<span class="small" style="display:block;margin-top:4px;color:#3b4a66">${esc(n.bio)}</span>` : ''}
    <span class="row wrap" style="gap:4px;margin-top:6px"><span class="chip teal">${ic('check',12,3)} ${t('today_t')}</span>${(n.languages || []).map(l => `<span class="chip gray">${esc(l)}</span>`).join('')}</span></span>
    <span class="np-link" data-np="${n.id}" role="button" tabindex="0">${ic('eye',13)} ${t('view_profile')}</span></span>
    <span class="radio"></span></button>`;
}

async function viewSupport(){
  const u = S.user;
  const mine = u ? await API.supportMine().catch(() => []) : [];
  const topics = ['booking','results','payment','nurse','partner','other'];
  const body = `<div class="stack-lg">
    <div class="welcome"><div class="art">${A.roleIcon('admin', 150)}</div><h2>${t('sup_t')}</h2><p style="opacity:.85;max-width:480px">${t('sup_p')}</p></div>${contactCard(true)}
    <div class="grid g2 collapse" style="align-items:start">
      <form class="card stack" id="sf"><h3>${t('sup_new')}</h3>
        ${!u ? `<div class="banner blue small">${ic('user',18)}<span>${t('sup_guest')}</span></div><div class="grid g2"><label class="field"><span>${t('your_name')}</span><input class="input" name="name"></label><label class="field"><span>${t('phone')}</span><input class="input" name="contact" inputmode="tel" required></label></div>` : ''}
        <div class="field"><span>${t('sup_topic')}</span><div class="row wrap" style="gap:6px">${topics.map((x, i) => `<label class="chip gray topic" style="cursor:pointer;padding:8px 12px"><input type="radio" name="topic" value="${x}" ${i ? '' : 'checked'} style="accent-color:var(--blue)"> ${t('tp_'+x)}</label>`).join('')}</div></div>
        <label class="field"><span>${t('sup_order')}</span><input class="input" name="order" placeholder="LAH-10241"></label>
        <label class="field"><span>${t('sup_msg')}</span><textarea class="input" name="msg" rows="4" required></textarea></label>
        <div class="err" id="se"></div><button class="btn block">${ic('chat',18)} ${t('sup_send')}</button></form>
      <div class="stack"><h3>${t('sup_quick')}</h3>${[1,2,3,4,5,6].map(i => `<details class="faq"><summary>${t('q'+i)}</summary><p>${t('a'+i)}</p></details>`).join('')}</div></div>
    ${u && mine.length ? `<div class="card"><h3>${t('sup_mine')}</h3>${mine.map(x => `<div class="vline" style="display:block"><div class="row between"><b>#${x.id} · ${esc(t('tp_'+x.topic))}</b><span class="chip ${x.status === 'answered' ? 'teal' : 'amber'}">${t(x.status === 'answered' ? 'sup_answered' : 'sup_open')}</span></div><div class="small">${esc(x.message)}</div>${x.reply ? `<div class="banner teal small" style="margin-top:8px">${ic('chat',18)}<div><b>${t('sup_reply')}:</b> ${esc(x.reply)}</div></div>` : ''}<div class="xs muted">${ago(x.created_at)}</div></div>`).join('')}</div>` : ''}</div>`;
  app.innerHTML = u ? shell(t('m_support'), body) : `${topbar()}<section class="section" style="padding-top:28px"><div class="wrap-w">${body}</div></section>${footer()}`;
  $('#sf').onsubmit = async e => { e.preventDefault(); const f = e.target; $('#se').textContent = '';
    const p = { topic: $('input[name=topic]:checked', f).value, order_code: f.order.value, message: f.msg.value, name: f.name ? f.name.value : '', contact: f.contact ? f.contact.value : '' };
    try { const r = await busy($('button.btn', f), () => API.supportCreate(p)); toast(t('sup_sent',{n:r.id})); viewSupport(); } catch(err) { $('#se').textContent = errMsg(err); } };
}

const STAR = '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" fill="currentColor"/></svg>';
async function viewAbout(){
  await loadCatalog().catch(() => {});
  const values = [['heart','v_care'],['shield','v_trust'],['pin','v_access'],['award','v_quality'],['eye','v_transp'],['spark','v_innov']];
  const goals = [['timer','g1'],['users','g2'],['thermo','g3'],['globe','g4']];
  const body = `<div class="stack-lg">
    <div class="about-hero"><div><span class="chip" style="background:rgba(255,255,255,.15);color:#fff">${t('m_about')}</span><h1>${t('about_t')}</h1><p>${t('about_p')}</p></div><div class="ah-art">${A.hero}</div></div>
    <div class="grid g2 collapse"><div class="card pad-lg vm dark"><div class="ic-round">${ic('eye',26)}</div><span class="eyebrow">${t('vision')}</span><p class="big">${t('vision_p')}</p></div><div class="card pad-lg vm"><div class="ic-round">${ic('target',26)}</div><span class="eyebrow">${t('mission')}</span><p class="big">${t('mission_p')}</p></div></div>
    <div class="card pad-lg story"><div class="story-l"><span class="eyebrow">${t('story_eyebrow')}</span><h2>${t('story_t')}</h2><p class="muted">${t('about_story_p')}</p><p class="muted">${t('about_sol_p')}</p></div>
      <div class="story-r">${[1,2,3,4].map(i => `<div class="ps"><div class="ps-p"><span class="xs b">${t('problem')}</span>${t('pb'+i)}</div><span class="ps-arrow">${ic('arrow',18)}</span><div class="ps-s"><span class="xs b">${t('our_answer')}</span>${t('sl'+i)}</div></div>`).join('')}</div></div>
    <div><div class="section-h" style="margin-bottom:20px"><span class="eyebrow">${t('values_eyebrow')}</span><h2>${t('values_t')}</h2></div>
      <div class="grid g3 values">${values.map(([i, k]) => `<div class="card val"><span class="ic-round">${ic(i,24)}</span><div><b>${t(k)}</b><div class="small muted">${t(k+'_d')}</div></div></div>`).join('')}</div></div>
    <div><div class="section-h" style="margin-bottom:20px"><span class="eyebrow">${t('goals_eyebrow')}</span><h2>${t('goals_t')}</h2></div>
      <div class="grid g4 goals">${goals.map(([i, k], n) => `<div class="card goal"><span class="gn">0${n+1}</span><span class="gi">${ic(i,26)}</span><b class="gk">${t(k+'_k')}</b><div class="small muted">${t(k)}</div></div>`).join('')}</div></div>
    <div><div class="section-h" style="margin-bottom:20px"><span class="eyebrow">${t('net_eyebrow')}</span><h2>${t('net_t')}</h2><p>${t('net_p')}</p></div><div id="netb"><div class="skel" style="height:180px"></div></div></div>
    <div><div class="section-h" style="margin-bottom:20px"><span class="eyebrow">${t('roles_eyebrow')}</span><h2>${t('roles_t')}</h2></div><div class="roles">${['patient','nurse','courier','lab','company'].map(r => `<div class="role" style="cursor:default">${A.roleIcon(r)}<h4>${t('r_'+r)}</h4><p>${t('r_'+r+'_d')}</p></div>`).join('')}</div></div>
    <div class="card pad-lg"><h3>${t('app_t')}</h3><div class="grid g3" style="margin-top:10px">${[['globe','app_f1'],['users','app_f2'],['pin','app_f3'],['file','app_f4'],['download','app_f5'],['shield','app_f6'],['bot','app_f7'],['idcard','app_f8'],['route','app_f9']].map(([i, k]) => `<div class="row" style="align-items:flex-start"><span class="ic-round sm">${ic(i,20)}</span><span class="b small" style="padding-top:8px">${t(k)}</span></div>`).join('')}</div></div>
    <div><div class="section-h" style="margin-bottom:20px"><span class="eyebrow">${t('m_team')}</span><h2>${t('team_t')}</h2><p>${t('team_p')}</p></div>
      <div class="grid g4 team">${TEAM.map(teamCard).join('')}</div></div>
    <div class="card pad-lg"><h3>${t('roadmap')}</h3>${['ph1','ph2','ph3'].map((p, i) => `<div class="phase"><span class="badge-n" style="${i ? 'background:#c4d4f2' : ''}">${i+1}</span><div><b>${t(p)}</b><div class="muted small">${t(p+'d')}</div></div></div>`).join('')}</div>
    <div class="welcome center" style="padding:30px"><h2>${t('contact_us')}</h2><p style="opacity:.85">${t('sup_p')}</p><div class="row wrap" style="justify-content:center"><a class="btn" style="background:#fff;color:var(--blue)" href="#/support">${ic('chat',18)} ${t('m_support')}</a><a class="btn ghost" style="background:transparent;color:#fff;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.5)" href="#/${S.user ? 'app/tests' : 'register'}">${t('book_now')}</a></div></div>
    <p class="xs muted center">${t('foot_note')}</p></div>`;
  app.innerHTML = S.user ? shell(t('m_about'), body) : `${topbar()}<section class="section" style="padding-top:28px"><div class="wrap-w">${body}</div></section>${footer()}`;
  if (!S.user) bindGlobal();
  partnersHtml().then(h => { const el = $('#netb'); if (el) el.innerHTML = h || ''; });
}

async function viewAdminTickets(){
  loading(t('m_tickets'));
  const list = await API.adminTickets();
  app.innerHTML = shell(t('m_tickets'), list.length ? `<div class="stack">${list.map(x => `<div class="card"><div class="row between wrap"><b>#${x.id} · ${esc(t('tp_'+x.topic))} ${x.order_code ? '· ' + esc(x.order_code) : ''}</b><span class="chip ${x.status === 'answered' ? 'teal' : 'amber'}">${t(x.status === 'answered' ? 'sup_answered' : 'sup_open')}</span></div>
    <div class="xs muted">${esc(x.name || '')} ${x.contact ? '· <span class="ltr">' + esc(x.contact) + '</span>' : ''} · ${ago(x.created_at)}</div><p style="margin:10px 0">${esc(x.message)}</p>
    ${x.reply ? `<div class="banner teal small">${ic('chat',18)}<span>${esc(x.reply)}</span></div>` : `<div class="row"><input class="input grow" placeholder="${t('sup_reply')}…" data-rp="${x.id}"><button class="btn sm" data-send="${x.id}">${t('sup_send')}</button></div>`}</div>`).join('')}</div>` : emptyBox(t('none_yet')));
  $$('[data-send]').forEach(b => b.onclick = async () => { const v = $(`[data-rp="${b.dataset.send}"]`).value; try { await busy(b, () => API.adminReply(+b.dataset.send, v)); toast(t('saved')); viewAdminTickets(); } catch(e) {} });
}

/* ---------- support assistant (auto replies) ---------- */
const BOT = { open: false, busy: false, stage: null, msgs: (() => { try { return JSON.parse(sessionStorage.getItem('lah_bot') || '[]'); } catch(e) { return []; } })() };
const BOT_INTENTS = [
  ['human', /human|agent|person|staff|someone|call me|موظف|انسان|إنسان|بشري|شخص|كلم|اتصل/],
  ['track', /track|status|where.*(order|nurse|sample)|my order|lah-\d+|طلب|وين|تتبع|حالة|الممرض.*وين/],
  ['fasting', /fast|empty stomach|صيام|صائم|اصوم|أصوم|الريق/],
  ['price', /price|cost|how much|fee|charge|سعر|اسعار|أسعار|كم|تكلف|رسوم/],
  ['results', /result|report|pdf|نتيج|نتائج|تقرير/],
  ['nurse', /nurse|female|male|woman|man|ممرض|نسائي|رجالي|امرأة/],
  ['area', /area|wilayat|cover|location|region|village|ولاي|منطق|تغطي|قري|مكان/],
  ['pay', /pay|card|cash|apple|دفع|بطاق|كاش|نقد|فلوس/],
  ['cancel', /cancel|reschedul|change.*time|الغ|إلغ|تأجيل|تغيير.*موعد/],
  ['partner', /partner|join|work with|courier|company|employer|شريك|انضم|اشتغل|شرك|مندوب/],
  ['privacy', /privacy|data|secure|civil|خصوص|بيانات|امان|أمان|مدني/],
  ['book', /book|appointment|schedule|حجز|احجز|موعد/],
  ['thanks', /thank|thx|شكر|مشكور|يعطيك/],
  ['greet', /^(hi|hello|hey|salam|good (morning|evening))|السلام|مرحب|هلا|اهلا|أهلا|صباح|مساء/]
];
const BOT_CHIPS = ['track','fasting','price','results','nurse','human'];
function botSave(){ try { sessionStorage.setItem('lah_bot', JSON.stringify(BOT.msgs.slice(-40))); } catch(e) {} }
function botMount(){
  if ($('#bot')) return botHead();
  document.body.insertAdjacentHTML('beforeend', `<div id="bot"><button class="bot-fab" aria-label="Chat">${ic('bot',28)}<span class="bot-ping"></span></button>
    <section class="bot-panel" role="dialog" aria-label="Support chat"><header></header><div class="bot-body" aria-live="polite"></div><div class="bot-chips"></div>
    <form class="bot-in"><input class="input" maxlength="400" autocomplete="off"><button class="btn" aria-label="Send">${ic('send',18)}</button></form></section></div>`);
  botDrag();
  $('#bot form').onsubmit = e => { e.preventDefault(); const i = $('#bot form input'); const v = i.value.trim(); if (!v || BOT.busy) return; i.value = ''; botUser(v); };
  botHead();
}
function botPos(){
  const f = $('#bot .bot-fab'); if (!f) return; const sz = innerWidth <= 700 ? 52 : 60, m = 14; /* size from the CSS: reading offsetWidth forced a full page layout on every screen */
  let p = null; try { p = JSON.parse(localStorage.getItem('lah_bot_pos') || 'null'); } catch(e) {}
  const bottomGap = (S.user && innerWidth <= 900 ? 84 : 20);
  const side = p ? p.side : (document.documentElement.dir === 'rtl' ? 'l' : 'r');
  const y = p ? Math.round(p.y * innerHeight) : innerHeight - sz - bottomGap;
  const top = Math.min(Math.max(y, 70), innerHeight - sz - bottomGap);
  f.style.left = (side === 'l' ? m : innerWidth - sz - m) + 'px'; f.style.top = top + 'px';
  $('#bot').classList.toggle('side-l', side === 'l');
}
function botDrag(){
  const f = $('#bot .bot-fab'); let st = null, moved = false;
  f.draggable = false; f.addEventListener('dragstart', e => e.preventDefault());
  f.addEventListener('pointerdown', e => { if (e.button > 0) return; e.preventDefault(); const r = f.getBoundingClientRect(); st = { x: e.clientX, y: e.clientY, ox: e.clientX - r.left, oy: e.clientY - r.top }; moved = false; try { f.setPointerCapture(e.pointerId); } catch(x) {} });
  f.addEventListener('pointermove', e => { if (!st) return; if (!moved && Math.hypot(e.clientX - st.x, e.clientY - st.y) < 6) return;
    moved = true; f.classList.add('dragging'); const sz = f.offsetWidth;
    f.style.left = Math.min(Math.max(e.clientX - st.ox, 4), innerWidth - sz - 4) + 'px'; f.style.top = Math.min(Math.max(e.clientY - st.oy, 4), innerHeight - sz - 4) + 'px'; });
  const end = e => { if (!st) return; st = null; f.classList.remove('dragging');
    if (!moved) { botToggle(); return; }
    const r = f.getBoundingClientRect(); const side = r.left + r.width / 2 < innerWidth / 2 ? 'l' : 'r';
    try { localStorage.setItem('lah_bot_pos', JSON.stringify({ side, y: r.top / innerHeight })); } catch(x) {}
    f.classList.add('snap'); botPos(); setTimeout(() => f.classList.remove('snap'), 260); };
  f.addEventListener('pointerup', end); f.addEventListener('pointercancel', end);
  /* keyboard (Enter / Space) gives a click with no pointer: open the chat too */
  f.addEventListener('click', e => { if (e.detail === 0) botToggle(); });
  f.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); botToggle(); } });
  addEventListener('resize', botPos); botPos();
}
function botHead(){
  const p = $('#bot .bot-panel'); if (!p) return;
  $('header', p).innerHTML = `<span class="bot-av">${ic('bot',22)}</span><div class="grow"><b>${t('bot_name')}</b><div class="xs"><i class="on"></i> ${t('bot_status')}</div></div><button class="icon-btn" data-bx aria-label="${t('close')}">${ic('x',20)}</button>`;
  $('[data-bx]', p).onclick = () => botToggle(false);
  $('form input', p).placeholder = t('bot_ph');
  $('#bot').classList.toggle('in-app', !!S.user);
  botPos(); botDraw();
}
function botToggle(v){
  BOT.open = v == null ? !BOT.open : v; $('#bot').classList.toggle('open', BOT.open);
  if (BOT.open && !BOT.msgs.length) botSay(t('bot_hi', { n: S.user ? ' ' + esc(S.user.full_name.split(' ')[0]) : '' }), BOT_CHIPS);
  if (BOT.open) setTimeout(() => { const i = $('#bot form input'); if (i && innerWidth > 700) i.focus(); }, 200);
}
function botDraw(){
  const b = $('#bot .bot-body'); if (!b) return;
  b.innerHTML = BOT.msgs.map(m => `<div class="bm ${m.from}"><div class="bb">${m.html}</div><span class="bt">${fmtTime(m.at)}</span></div>`).join('') + (BOT.busy ? `<div class="bm bot"><div class="bb typing"><i></i><i></i><i></i></div></div>` : '');
  const last = [...BOT.msgs].reverse().find(m => m.from === 'bot');
  $('#bot .bot-chips').innerHTML = (last && last.chips || []).map(c => `<button type="button" data-chip="${c}">${t('bc_' + c)}</button>`).join('');
  $$('#bot [data-chip]').forEach(x => x.onclick = () => botUser(t('bc_' + x.dataset.chip), x.dataset.chip));
  b.scrollTop = b.scrollHeight;
}
function botSay(html, chips){ BOT.msgs.push({ from:'bot', html, chips: chips || null, at: Date.now() }); botSave(); botDraw(); }
async function botUser(text, intent){
  BOT.msgs.push({ from:'me', html: esc(text), raw: text, at: Date.now() }); botSave(); BOT.busy = true; botDraw();
  if (intent === 'human' || BOT.stage === 'contact') await new Promise(r => setTimeout(r, 450));
  try { await botAnswer(text, intent); } catch(e) { botSay(t('bot_err'), ['human']); }
  BOT.busy = false; botDraw();
}
async function botTicket(contact, name){
  const transcript = BOT.msgs.slice(-10).map(m => (m.from === 'me' ? 'User: ' : 'Bot: ') + m.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()).join('\n');
  const r = await API.supportCreate({ topic:'other', order_code:'', message: '[Chat assistant]\n' + transcript, name: name || '', contact: contact || '' });
  BOT.stage = null; botSay(t('bot_ticket', { n: r.id }), ['track','results']);
}
function botFmt(txt){
  let h = esc(txt).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const lines = h.split(/\n+/); let out = '', inList = false;
  for (const l of lines) { const m = l.match(/^\s*[-•]\s+(.*)/); if (m) { if (!inList) { out += '<ul class="bot-ul">'; inList = true; } out += `<li>${m[1]}</li>`; } else { if (inList) { out += '</ul>'; inList = false; } if (l.trim()) out += `<p>${l}</p>`; } }
  if (inList) out += '</ul>';
  const ol = BOT.orders || [];
  return out.replace(/LAH-\d{4,}/g, c => { const o = ol.find(x => x.code === c); return o ? `<a class="bot-code" href="#/app/order/${o.id}">${c}</a>` : `<b class="ltr">${c}</b>`; });
}
async function botAI(){
  const hist = BOT.msgs.slice(-12).map(m => ({ role: m.from === 'me' ? 'user' : 'assistant', content: (m.raw || m.html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim() })).filter(m => m.content);
  while (hist.length && hist[0].role !== 'user') hist.shift();
  if (S.user && S.user.role === 'patient' && !BOT.orders) BOT.orders = await API.orders().catch(() => []);
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch('api/chat', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ messages: hist, lang: S.lang, token: localStorage.getItem('lah_token') || null }), signal: ctl.signal });
    if (!r.ok) throw new Error(r.status); const j = await r.json(); if (!j.reply) throw new Error('empty'); return j;
  } finally { clearTimeout(tm); }
}
async function botAnswer(text, intent){
  if (intent === 'human' || (BOT.stage === 'contact' && !intent)) return botLocal(text, intent);
  try { const j = await botAI(); BOT.msgs.push({ from:'bot', html: botFmt(j.reply), raw: j.reply, chips: j.human ? ['human'] : ['track','price','fasting'], at: Date.now() }); botSave(); return; }
  catch(e) { return botLocal(text, intent); }
}
async function botLocal(text, intent){
  const q = text.toLowerCase();
  if (BOT.stage === 'contact' && !intent) {
    const ph = text.replace(/[^\d+]/g, ''); if (ph.replace(/\D/g, '').length < 8) return botSay(t('bot_need_phone'));
    return botTicket(ph, '');
  }
  if (!intent) { const hit = BOT_INTENTS.find(([, re]) => re.test(q)); intent = hit ? hit[0] : null; }
  const C = S.catalog || await loadCatalog().catch(() => null);
  switch (intent) {
    case 'greet': return botSay(t('bot_greet'), BOT_CHIPS);
    case 'thanks': return botSay(t('bot_thanks'), ['book','track']);
    case 'track': {
      if (!S.user) return botSay(t('bot_track_guest'), ['book','human']);
      if (S.user.role !== 'patient') return botSay(t('bot_track_staff'), ['human']);
      const list = await API.orders(); const code = (q.match(/lah-\d+/) || [])[0];
      const pick = code ? list.filter(o => o.code.toLowerCase() === code) : list.filter(o => ACTIVE(o.status));
      if (!pick.length) return botSay(code ? t('bot_track_none_code') : t('bot_track_none'), ['book','results']);
      return botSay(t('bot_track_hdr') + pick.slice(0, 3).map(o => `<a class="bot-card" href="#/app/order/${o.id}"><b class="ltr">${esc(o.code)}</b> ${stChip(o.status)}<span class="xs">${fmtDate(o.slot_date)} · ${esc(o.slot_time)} · ${t('updated_x',{x:ago(o.updated_at)})}</span><span class="xs">${t('st_d_' + o.status)}</span></a>`).join(''), ['fasting','cancel','human']);
    }
    case 'fasting': { const fl = C ? String(C.fasting_last_slot || '10:00').replace(/"/g, '') : '10:00';
      const ft = C ? C.tests.filter(x => x.fasting_hours > 0).map(x => `${esc(LN(x,'name'))} (${x.fasting_hours} ${t('hours_s')})`).join('<br>') : '';
      return botSay(t('bot_fasting', { t: fl }) + (ft ? `<div class="bot-note">${ft}</div>` : ''), ['book','price']); }
    case 'price': { if (!C) return botSay(t('bot_price_na'));
      const pk = C.packages.map(p => `<div class="bot-row"><span>${esc(LN(p,'name'))}</span><b class="num">${omr(p.price)}</b></div>`).join('');
      const min = Math.min(...C.tests.map(x => Number(x.price)));
      return botSay(t('bot_price', { fee: omr(fee()), min: omr(min) }) + `<div class="bot-note">${pk}</div><a class="bot-link" href="#/${S.user ? 'app/tests' : 'tests'}">${t('explore_tests')} →</a>`, ['book','pay']); }
    case 'results': return botSay(t('bot_results'), ['track','privacy']);
    case 'nurse': { const st = C && C.stats || {}; return botSay(t('bot_nurse', { f: st.nurses_f || '—', m: st.nurses_m || '—' }), ['book','area']); }
    case 'area': return botSay(t('bot_area', { w: C ? C.wilayats.map(wN).join(' · ') : '' }), ['book','human']);
    case 'pay': return botSay(t('bot_pay'), ['price','cancel']);
    case 'cancel': return botSay(t('bot_cancel'), ['track','human']);
    case 'partner': return botSay(t('bot_partner') + `<a class="bot-link" href="#/register?partner=1">${t('partner_link')} →</a>`, ['human']);
    case 'privacy': return botSay(t('bot_privacy'), ['results','human']);
    case 'book': return botSay(t('bot_book') + `<a class="bot-link" href="#/${S.user ? 'app/tests' : 'register'}">${t('book_now')} →</a>`, ['price','fasting','nurse']);
    case 'human':
      if (S.user) return botTicket('', S.user.full_name);
      BOT.stage = 'contact'; return botSay(t('bot_ask_phone'));
    default: return botSay(t('bot_unknown'), ['human','track','price']);
  }
}

/* ---------- network / partners ---------- */
async function partnersHtml(){
  let P; try { P = await API.partnersPublic(); } catch(e) { return ''; }
  return `<div class="net">
    <div class="net-col"><div class="net-h">${ic('flask',22)} <b>${t('net_labs')}</b><span class="chip">${P.labs.length}</span></div>${P.labs.map(l => `<div class="net-item"><b>${esc(l.name)}</b><div class="xs muted">${esc(wN(l.wilayat))}${l.accreditation ? ' · ' + esc(l.accreditation) : ''}</div>${l.hours ? `<div class="xs muted">${ic('clock',12)} ${esc(l.hours)}</div>` : ''}</div>`).join('')}</div>
    <div class="net-col"><div class="net-h">${ic('van',22)} <b>${t('net_logistics')}</b><span class="chip">${P.logistics.length}</span></div>${P.logistics.map(c => `<div class="net-item"><b>${esc(c.company)}</b><div class="xs muted">${t('drivers_n',{n:c.drivers})} · 2–8 °C</div><div class="row wrap" style="gap:4px;margin-top:6px">${(c.coverage || []).map(w => `<span class="chip gray xs-chip">${esc(wN(w))}</span>`).join('')}</div></div>`).join('')}</div>
    <div class="net-col"><div class="net-h">${ic('syringe',22)} <b>${t('net_nurses')}</b><span class="chip">${P.nurses.female + P.nurses.male}</span></div>
      <div class="gbar"><div style="flex:${P.nurses.female}" class="f"><b>${P.nurses.female}</b> ${t('female')}</div><div style="flex:${P.nurses.male}" class="m"><b>${P.nurses.male}</b> ${t('male')}</div></div>
      <p class="small muted" style="margin:10px 0 0">${t('net_nurses_p')}</p></div></div>`;
}

/* ---------- fleet (logistics company) ---------- */
async function viewFleetHome(){
  loading(t('m_home'));
  const [fo, mine, av] = await Promise.all([API.fleet(), API.orders('mine'), API.orders('available')]);
  const tr = mine.filter(o => o.status === 'in_transit');
  app.innerHTML = shell(esc(fo.company || t('r_fleet')), `<div class="stack-lg">
    <div class="welcome"><div class="art">${A.roleIcon('courier', 150)}</div><span class="chip" style="background:rgba(255,255,255,.15);color:#fff">${t('r_fleet')}</span><h2>${esc(fo.company)}</h2><p style="opacity:.85;max-width:460px">${t('fleet_p')}</p></div>
    <div class="grid g4"><div class="kpi blue"><span>${t('drivers')}</span><b>${fo.drivers.length}</b></div><div class="kpi"><span>${t('in_transit_list')}</span><b>${tr.length}</b></div><div class="kpi"><span>${t('delivered_n')}</span><b>${fo.drivers.reduce((s, d) => s + d.delivered, 0)}</b></div><div class="kpi"><span>${t('pickups_ready')}</span><b>${av.length}</b></div></div>
    <div class="card"><h3>${t('drivers')}</h3><div class="scroll-x"><table class="rtable"><thead><tr><th>${t('full_name')}</th><th>${t('vehicle')}</th><th>${t('coverage')}</th><th>${t('in_transit_list')}</th><th>${t('delivered_n')}</th><th>${t('avg_temp')}</th></tr></thead><tbody>
      ${fo.drivers.map(d => `<tr><td><b>${esc(d.name)}</b><div class="xs muted ltr">${esc(d.plate || '')}</div></td><td class="small">${esc(d.vehicle || '—')}</td><td class="small">${(d.coverage || []).map(w => esc(wN(w))).join(' · ')}</td><td class="num">${d.in_transit}</td><td class="num">${d.delivered}</td><td class="num">${d.avg_temp != null ? d.avg_temp + ' °C' : '—'}</td></tr>`).join('')}</tbody></table></div></div>
    <div><h3>${t('fleet_jobs')}</h3>${mine.length ? `<div class="olist">${mine.slice(0, 20).map(o => orderItem(o, o.courier_name ? `<div class="xs" style="color:var(--blue)">${ic('van',12)} ${esc(o.courier_name)}</div>` : '')).join('')}</div>` : emptyBox(t('none_yet'))}</div>
    <div><h3>${t('pickups_ready')}</h3>${av.length ? `<div class="olist">${av.map(o => orderItem(o)).join('')}</div>` : emptyBox(t('none_yet'))}</div></div>`);
}


/* ---------- phone notifications (Web Push) ---------- */
const VAPID = 'BKVzZaXp4VQWDbl1BLtaeaw59hvvlP2SeslVjf-AV1FJcHMrjtzKUUMzfhhQDb73I0ZJJp0Yg54TCfqtxDXUhxo';
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
function pushState(){
  if (isIOS() && !isStandalone()) return 'ios_install';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.permission === 'granted' && localStorage.getItem('lah_push') === '1' ? 'on' : 'off';
}
function b64u(s){ const p = '='.repeat((4 - s.length % 4) % 4); const b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...b].map(c => c.charCodeAt(0))); }
async function pushEnable(quiet){
  if (location.protocol !== 'https:') throw new Error('https');
  const perm = quiet ? Notification.permission : await Notification.requestPermission();
  if (perm !== 'granted') { if (!quiet) toast(t('push_denied'), true); return false; }
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(VAPID) });
  await API.pushSubscribe(sub.toJSON(), S.lang); localStorage.setItem('lah_push', '1');
  return true;
}
async function pushDisable(){ try { const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription(); if (sub) { await API.pushUnsubscribe(sub.endpoint).catch(() => {}); await sub.unsubscribe(); } } catch(e) {} localStorage.setItem('lah_push', '0'); }
function pushBanner(){
  const st = pushState(); if (st === 'on' || st === 'unsupported' || st === 'denied' || sessionStorage.getItem('lah_push_x')) return '';
  return `<div class="push-banner" id="pushb"><span class="pb-ic">${ic('bell',22)}</span><div class="grow"><b>${t('push_t')}</b><div class="small">${st === 'ios_install' ? t('push_ios') : t('push_p')}</div></div>
    ${st === 'ios_install' ? '' : `<button class="btn sm" data-push-on>${t('push_btn')}</button>`}<button class="icon-btn sm" data-push-x aria-label="${t('close')}">${ic('x',16)}</button></div>`;
}
function bindPush(){
  $$('[data-push-on]').forEach(b => b.onclick = async () => { try { const ok = await busy(b, () => pushEnable(false)); if (ok) { toast(t('push_ok')); API.pushTest().catch(() => {}); const el = $('#pushb'); if (el) el.remove(); if (location.hash.includes('profile')) render(); } } catch(e) { toast(t('push_fail'), true); } });
  $$('[data-push-x]').forEach(b => b.onclick = () => { sessionStorage.setItem('lah_push_x', '1'); const el = $('#pushb'); if (el) el.remove(); });
  $$('[data-push-off]').forEach(b => b.onclick = async () => { await pushDisable(); toast(t('saved')); render(); });
  $$('[data-push-test]').forEach(b => b.onclick = async () => { try { await busy(b, () => API.pushTest()); toast(t('push_sent')); } catch(e) {} });
}
function pushCard(){
  const st = pushState();
  return `<div class="card"><h3>${ic('bell',20)} ${t('push_card')}</h3><p class="muted small">${t('push_card_p')}</p>
    ${st === 'on' ? `<div class="banner teal small">${ic('check',18)}<span>${t('push_on')}</span></div><div class="row" style="margin-top:10px"><button class="btn soft sm" data-push-test>${t('push_test')}</button><button class="btn ghost sm" data-push-off>${t('push_off_btn')}</button></div>`
    : st === 'ios_install' ? `<div class="banner amber small">${ic('download',18)}<span>${t('push_ios')}</span></div>`
    : st === 'denied' ? `<div class="banner red small">${ic('x',18)}<span>${t('push_blocked')}</span></div>`
    : st === 'unsupported' ? `<div class="banner amber small">${ic('x',18)}<span>${t('push_unsup')}</span></div>`
    : `<button class="btn" data-push-on>${ic('bell',18)} ${t('push_btn')}</button>`}</div>`;
}


/* ---------- email verification ---------- */
function emailBanner(){
  const u = S.user; if (!u || u.is_demo || !u.email || u.email_verified || sessionStorage.getItem('lah_mail_x')) return '';
  return `<div class="push-banner mail" id="mailb"><span class="pb-ic" style="background:#0fae9b">${ic('send',20)}</span><div class="grow"><b>${t('mail_t')}</b><div class="small">${t('mail_p',{e:`<span class="ltr">${esc(u.email)}</span>`})}</div></div>
    <button class="btn sm soft" data-mail-send>${t('mail_resend')}</button><button class="icon-btn sm" data-mail-x aria-label="${t('close')}">${ic('x',16)}</button></div>`;
}
async function mailSend(btn, quiet){
  try { const r = await (btn ? busy(btn, () => API.emailSendVerify()) : API.emailSendVerify()); toast(t('mail_sent',{e:esc(r.email)})); return true; }
  catch(e) { if (!quiet) toast(e.code === 'NO_MAIL' ? t('mail_not_ready') : e.code === 'TOO_SOON' ? t('mail_too_soon') : errMsg(e), true); return false; }
}
function bindMail(){
  $$('[data-mail-send]').forEach(b => b.onclick = () => mailSend(b));
  $$('[data-mail-x]').forEach(b => b.onclick = () => { sessionStorage.setItem('lah_mail_x', '1'); const el = $('#mailb'); if (el) el.remove(); });
  const f = $('#mailf'); if (f) f.onsubmit = async e => { e.preventDefault(); const v = f.em.value.trim(); if (!v) return;
    try { S.user = await busy($('button', f), () => API.emailSet(v)); toast(t('saved')); if (!S.user.email_verified) await mailSend(null); render(); } catch(err) {} };
}
function mailCard(){
  const u = S.user; if (u.is_demo) return '';
  return `<div class="card"><h3>${ic('send',20)} ${t('mail_card')}</h3><p class="muted small">${t('mail_card_p')}</p>
    <form id="mailf" class="row" style="gap:8px"><input class="input grow ltr" type="email" name="em" value="${esc(u.email || '')}" placeholder="name@email.com"><button class="btn soft sm">${t('save_changes')}</button></form>
    ${u.email ? (u.email_verified ? `<div class="banner teal small" style="margin-top:10px">${ic('check',18)}<span>${t('mail_ok')}</span></div>` : `<div class="banner amber small" style="margin-top:10px">${ic('clock',18)}<span class="grow">${t('mail_pending')}</span><button class="btn sm" data-mail-send>${t('mail_resend')}</button></div>`) : ''}</div>`;
}
async function viewVerify(code){
  app.innerHTML = authShell(`<div class="center" style="padding:30px 0"><span class="spin"></span></div>`);
  let ok = false, em = '', msg = '';
  try { const r = await API.emailConfirm(code); ok = true; em = r.email; if (S.user) { const me = await API.me().catch(() => null); if (me) S.user = me.user; } } catch(e) { msg = e.code === 'CODE_EXPIRED' ? t('mail_expired') : t('mail_bad'); }
  app.innerHTML = authShell(`<div class="center" style="padding:10px 0">
    <div style="width:84px;height:84px;border-radius:50%;margin:0 auto 14px;display:grid;place-items:center;background:${ok ? 'var(--teal-bg)' : '#fff1f1'};color:${ok ? 'var(--teal)' : '#d64550'}">${ic(ok ? 'check' : 'x', 44, 2.6)}</div>
    <h1>${ok ? t('mail_done_t') : t('mail_fail_t')}</h1><p class="muted">${ok ? t('mail_done_p',{e:`<b class="ltr">${esc(em)}</b>`}) : msg}</p>
    <a class="btn block" style="margin-top:16px" href="#/${S.user ? 'app' : 'login'}">${S.user ? t('m_home') : t('login')}</a></div>`);
  bindGlobal();
}

/* ---------- router ---------- */
async function doLogout(){ try { if ('serviceWorker' in navigator) { const reg = await navigator.serviceWorker.getRegistration(); const sub = reg && reg.pushManager && await reg.pushManager.getSubscription(); if (sub) await API.pushUnsubscribe(sub.endpoint).catch(() => {}); } } catch(e) {} await API.logout(); API.setToken(null); S.user = null; S.bk = null; go(''); }
function bindGo(){ $$('[data-go]').forEach(b => b.onclick = () => { const g = b.dataset.go; if (g === 'register' && !S.user) sessionStorage.setItem('lah_after', 'app/book'); go(g); }); }
function bindGlobal(){
  $$('[data-lang]').forEach(b => b.onclick = () => { setLang(S.lang === 'ar' ? 'en' : 'ar'); render(); if (S.user && localStorage.getItem('lah_push') === '1') pushEnable(true).catch(() => {}); });
  $$('[data-logout]').forEach(b => b.onclick = doLogout);
  $$('[data-goback]').forEach(b => b.onclick = () => history.length > 1 ? history.back() : go('app'));
  $$('[data-menu]').forEach(b => b.onclick = e => { e.preventDefault(); openMenu(b); });
  if ($('.van-strip.v32')) bindVan();
  /* v32: "Talk to a doctor" under a report / finished order (it had no handler before) */
  $$('[data-cspost]').forEach(b => b.onclick = e => { e.preventDefault(); csGoBook('post', b.dataset.cspost); });
  bindGo();
}
let rendering = false, rerender = false, lastRoute = null;
function saveUser(){ try { if (S.user) localStorage.setItem('lah_user', JSON.stringify(S.user)); else localStorage.removeItem('lah_user'); } catch(e) {} }
/* thin progress line at the top: shows at once that a tap was received while the next screen loads */
function navBar(on){ let b = document.getElementById('navbar'); if (!b) { b = document.createElement('div'); b.id = 'navbar'; document.body.appendChild(b); } clearTimeout(b._t); if (on) { b._t = setTimeout(() => b.classList.add('on'), 120); } else { b.classList.remove('on'); } }
async function render(){
  if (rendering) { rerender = true; navBar(true); if (API.abortReads) API.abortReads(); return; }
  rendering = true; rerender = false; navBar(true);
  try { await renderNow(); } finally { rendering = false; }
  if (rerender) render(); else navBar(false);
}
async function renderNow(){
  clearTimers(); saveUser();
  const route = location.hash.split('?')[0];
  if (route !== lastRoute) { lastRoute = route; app.classList.remove('pg'); void app.offsetWidth; app.classList.add('pg'); $$('#modal-root .modal-bg, #modal-root .drawer-bg, #modal-root .dd-bg').forEach(m => m._close ? m._close() : m.remove()); document.body.classList.remove('lock', 'kb'); }
  const h = (location.hash.slice(2) || '').split('#')[0];
  const [path] = h.split('?'); const seg = path.split('/');
  const standalone = window.matchMedia && matchMedia('(display-mode: standalone)').matches;
  try {
    if (seg[0] === 'start') { viewStart(); return; }
    if (seg[0] === 'verify' && seg[1]) { await viewVerify(seg[1]); return; }
    if (seg[0] === 'reset' && seg[1]) { viewReset(seg[1]); return; }
    if (seg[0] === 'forgot') { if (S.user) return go('app'); viewForgot(); return; }
    if (seg[0] === '' && !S.user && !localStorage.getItem('lah_seen') && (innerWidth < 760 || standalone)) { location.replace('#/start'); return; }
    if (seg[0] === 'install') await viewInstall();
    else if (seg[0] === 'contact') await viewContact();
    else if (seg[0] === 'support') await viewSupport();
    else if (seg[0] === 'about') await viewAbout();
    else if (seg[0] === 'how') await viewHow();
    else if (seg[0] === 'new') await viewNew();
    else if (seg[0] === 'consult') await viewConsultPublic(false);
    else if (seg[0] === 'sources') await viewSources();
    else if (seg[0] === 'guarantee') viewGuarantee();
    else if (seg[0] === 'expat') await viewExpat();
    else if (seg[0] === 'r' && seg[1]) await viewShared(seg[1]);
    else if (seg[0] === 'dental') await viewConsultPublic(true);
    else if (seg[0] === 'business') { if (canBiz()) await viewBusiness(); else go(''); }
    else if (seg[0] !== 'app') {
      if (seg[0] === 'login') { if (S.user) return go('app'); viewLogin(); }
      else if (seg[0] === 'register') { if (S.user) return go('app'); await loadCatalog().catch(() => {}); viewRegister(seg[1]); }
      else if (seg[0] === 'tests') await viewTestsPublic();
      else await viewLanding();
    } else {
      if (!S.user) { sessionStorage.setItem('lah_after', path); return go('login'); }
      const r = S.user.role; const sub = seg[1] || '';
      if (sub === '') await ({ patient: viewPatientHome, nurse: viewNurseHome, courier: (S.user.meta || {}).fleet_admin ? viewFleetHome : viewCourierHome, lab: viewLabHome, company: viewCompanyHome, admin: viewAdminHome, staff: viewAdminHome, doctor: viewDoctorHome }[r] || viewPatientHome)();
      else if (sub === 'kit' && r === 'nurse') await viewNurseKit();
      else if (sub === 'tests') await viewAppTests();
      else if (sub === 'cart') await viewCart();
      else if (sub === 'consult' && seg[2] === 'new' && r === 'patient') await viewConsultNew();
      else if (sub === 'consult' && seg[2]) await viewConsult(seg[2]);
      else if (sub === 'consult') await viewConsults();
      else if (sub === 'book') await viewBook();
      else if (sub === 'orders') await viewOrders();
      else if (sub === 'order') await viewOrder(seg[2]);
      else if (sub === 'report') await viewReport(seg[2]);
      else if (sub === 'profile') await viewProfile();
      else if (sub === 'notifs') await viewNotifs();
      else if (sub === 'programs') await viewCompanyHome();
      else if (sub === 'loyalty' && r === 'patient') await viewLoyalty();
      else if (sub === 'privacy') await viewPrivacy();
      else if (sub === 'camps' && r === 'company') await viewCamps();
      else if (sub === 'admin' && (r === 'admin' || r === 'staff')) await ((r === 'admin' ? { users: viewAdminUsers, catalog: viewAdminCatalog, tickets: viewAdminTickets, payments: viewAdminPayments, contracts: viewAdminContracts, settings: viewAdminSettings, kit: viewAdminKit, safety: viewAdminSafety, coupons: viewAdminCoupons, camps: viewAdminCamps } : { users: viewAdminUsers, tickets: viewAdminTickets, contracts: viewAdminContracts, settings: viewAdminSettings, kit: viewAdminKit, safety: viewAdminSafety, camps: viewAdminCamps })[seg[2]] || viewAdminHome)();
      else go('app');
    }
  } catch(e) {
    console.error(e);
    if (e && e.code === 'AUTH_REQUIRED') { S.user = null; return go('login'); }
    app.innerHTML = (S.user ? shell('', '') : topbar());
    const c = $('.content') || app; c.insertAdjacentHTML('beforeend', `<div class="card empty" style="margin:20px">${A.emptyArt}<p>${errMsg(e)}</p><button class="btn" onclick="location.reload()">${t('retry')}</button></div>`);
  }
  bindGlobal(); botMount(); bindPush(); bindMail(); holoWake(); mascotSync();
  if (window.FX) FX.scan(app);
  if (window.LAH_OFFLINE) toast(t('offline_t'));
  if (!location.hash.includes('#', 1)) window.scrollTo(0, 0); else { const el = document.getElementById(location.hash.split('#')[2]); if (el) setTimeout(() => el.scrollIntoView({ behavior:'smooth', block:'start' }), 120); }
}
async function poll(){ if (!S.user || document.hidden) return; try { const r = await API.me(); const before = S.unread; S.user = r.user; S.unread = r.unread; if (r.unread !== before) { $$('[data-go="app/notifs"] .dot').forEach(d => d.textContent = r.unread); if (r.unread > before) { const b = $('[data-go="app/notifs"]'); if (b && !$('.dot', b)) b.insertAdjacentHTML('beforeend', `<span class="dot">${r.unread}</span>`); } } } catch(e) { if (e.code === 'AUTH_REQUIRED') { S.user = null; go('login'); } } }

/* ---------- contact ---------- */
const CONTACT = { phone: '+968 9434 2557', tel: '+96894342557', wa: '96894342557', email: 'labathome.oman@gmail.com', ig: 'https://www.instagram.com/ilabathome', igh: '@ilabathome' };
const IGSVG = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>';
function contactCard(compact){
  const waTxt = encodeURIComponent(t('ct_wa_txt'));
  return `<div class="card ct-card${compact ? ' compact' : ''}"><h3>${ic('chat',20)} ${t('ct_title')}</h3>${compact ? '' : `<p class="muted small">${t('ct_p')}</p>`}
    <div class="ct-grid">
      <a class="ct-item wa" href="https://wa.me/${CONTACT.wa}?text=${waTxt}" target="_blank" rel="noopener"><span class="ct-ic"><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 4.9 4.9 0 0 0 1 2.6 11.2 11.2 0 0 0 4.3 3.8c1.6.7 2.2.7 3 .6a2.6 2.6 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .1-1.2c0-.1-.2-.2-.4-.3z"/></svg></span><div><b>${t('ct_wa')}</b><small class="ltr">${CONTACT.phone}</small></div></a>
      <a class="ct-item call" href="tel:${CONTACT.tel}"><span class="ct-ic">${ic('phone',20)}</span><div><b>${t('ct_call')}</b><small class="ltr">${CONTACT.phone}</small></div></a>
      <a class="ct-item mail" href="mailto:${CONTACT.email}?subject=${encodeURIComponent('iLab@home')}"><span class="ct-ic">${ic('mail',20)}</span><div><b>${t('ct_mail')}</b><small class="ltr">${CONTACT.email}</small></div></a>
      <a class="ct-item ig" href="${CONTACT.ig}" target="_blank" rel="noopener"><span class="ct-ic">${IGSVG}</span><div><b>Instagram</b><small class="ltr">${CONTACT.igh}</small></div></a>
    </div>${compact ? '' : `<div class="ig-qr"><div class="qr-box">${window.LAHQR ? LAHQR.svg({ code: 'ig', size: 150, accent: '#d62976' }) : ''}</div><div><b>${t('ig_follow')}</b><div class="small muted">${t('ig_scan')}</div><a class="btn sm" style="margin-top:8px;background:linear-gradient(45deg,#f58529,#dd2a7b,#8134af);color:#fff" href="${CONTACT.ig}" target="_blank" rel="noopener">${IGSVG} ${CONTACT.igh}</a></div></div>`}</div>`;
}
async function viewContact(){
  app.innerHTML = (S.user ? shell(t('m_contact'), '') : topbar()) + `${S.user ? '' : '<main>'}<section class="wrap-w ct-page"><div class="welcome"><div class="art">${A.roleIcon('admin', 150)}</div><h2>${t('ct_title')}</h2><p style="opacity:.85;max-width:480px">${t('ct_p')}</p></div>${contactCard(true)}
    <div class="card ig-qr" style="margin-top:0;border-top:0"><div class="qr-box">${window.LAHQR ? LAHQR.svg({ code: 'ig', size: 150, accent: '#d62976' }) : ''}</div><div><b>${t('ig_follow')}</b><div class="small muted">${t('ig_scan')}</div><a class="btn sm" style="margin-top:8px;background:linear-gradient(45deg,#f58529,#dd2a7b,#8134af);color:#fff" href="${CONTACT.ig}" target="_blank" rel="noopener">${IGSVG} ${CONTACT.igh}</a></div></div>
    <div class="card"><h3>${t('ct_hours_t')}</h3><p class="muted small">${t('ct_hours')}</p><a class="btn ghost" href="#/support">${ic('chat',18)} ${t('ct_ticket')}</a></div></section>${S.user ? '' : '</main>' + footer()}`;
  if (S.user && $('.content')) $('.content').appendChild($('.ct-page'));
}

/* ---------- install page: turns the site into an app on the phone ---------- */
function platform(){
  const ua = navigator.userAgent; const ios = /iP(hone|ad|od)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  const inApp = /Instagram|FBAN|FBAV|FB_IAB|Line\/|Snapchat|TikTok|WhatsApp|Twitter/i.test(ua);
  const iosSafari = ios && !inApp && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua);
  const android = /Android/i.test(ua);
  return { ios, iosSafari, android, standalone, inApp, desktop: !ios && !android };
}
function installSteps(kind){
  const step = (n, title, body, art) => `<li class="ist"><span class="ist-n">${n}</span><div class="grow"><b>${title}</b><p class="small muted">${body}</p>${art || ''}</div></li>`;
  const shareIc = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8"/></svg>`;
  const addIc = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="5"/><path d="M12 8v8M8 12h8"/></svg>`;
  if (kind === 'ios') return `<ol class="isteps">
    ${step(1, t('ins_i1'), t('ins_i1p'), `<div class="mock-bar"><span>‹</span><span>›</span><span class="hl">${shareIc}</span><span>${ic('list',18)}</span><span>${ic('home',18)}</span></div>`)}
    ${step(2, t('ins_i2'), t('ins_i2p'), `<div class="mock-row"><span>${t('ins_a2hs')}</span><span class="hl">${addIc}</span></div>`)}
    ${step(3, t('ins_i3'), t('ins_i3p'), `<div class="mock-row"><span class="muted">${t('cancel')}</span><b>iLab@home</b><span class="hl b">${t('ins_add')}</span></div>`)}
    ${step(4, t('ins_i4'), t('ins_i4p'))}</ol>`;
  return `<ol class="isteps">
    ${step(1, t('ins_a1'), t('ins_a1p'), `<div class="mock-bar"><span class="grow small ltr" style="text-align:start">labathome-oman.vercel.app</span><span class="hl">⋮</span></div>`)}
    ${step(2, t('ins_a2'), t('ins_a2p'), `<div class="mock-row"><span>${t('ins_inst_app')}</span><span class="hl">${ic('download',18)}</span></div>`)}
    ${step(3, t('ins_a3'), t('ins_a3p'))}</ol>`;
}
async function viewInstall(){
  const P = platform(); const url = window.LAHQR ? LAHQR.url : location.origin + '/#/install';
  const tab = new URLSearchParams(location.hash.split('?')[1] || '').get('os') || (P.ios ? 'ios' : P.android ? 'android' : 'ios');
  const head = S.user ? shell(t('ins_title'), '') : topbar();
  let primary = '';
  if (P.standalone) primary = `<div class="card ins-ok"><div class="ok-ic">${ic('check',30,2.6)}</div><h3>${t('ins_done_t')}</h3><p class="muted">${t('ins_done_p')}</p><a class="btn" href="#/${S.user ? 'app' : ''}">${t('ins_open')}</a></div>`;
  else if (P.ios && !P.iosSafari) primary = `<div class="card ins-warn"><h3>${ic('globe',20)} ${t('ins_safari_t')}</h3><p class="muted">${t('ins_safari_p')}</p><div class="row wrap" style="gap:10px"><button class="btn" data-copy-url>${ic('copy',18)} ${t('ins_copy')}</button></div><p class="xs muted ltr" style="margin-top:10px">${esc(url)}</p></div>`;
  else if (S.installEvt) primary = `<div class="card ins-one"><h3>${t('ins_one_t')}</h3><p class="muted">${t('ins_one_p')}</p><button class="btn block lg" id="instNow">${ic('download',20)} ${t('ins_btn')}</button></div>`;
  app.innerHTML = head + `${S.user ? '' : '<main>'}<section class="ins wrap-w">
    <div class="ins-hero">
      <div class="ins-phone" aria-hidden="true"><div class="ins-screen"><div class="ins-clock">9:41</div><div class="ins-icons">${'<b class="ph"></b>'.repeat(6)}<span class="ins-app"><span class="ins-ico">${A.logo}</span><small>iLab@home</small></span>${'<b class="ph"></b>'.repeat(5)}</div></div></div>
      <div><span class="chip t">${t('ins_free')}</span><h1>${t('ins_h1')}</h1><p class="lead">${t('ins_lead')}</p>
        <div class="ins-perks">${[['bell','ins_p1'],['clock','ins_p2'],['shield','ins_p3'],['box','ins_p4']].map(([i, k]) => `<span>${ic(i,18)} ${t(k)}</span>`).join('')}</div></div>
    </div>
    ${primary}
    ${`<div class="card">${P.standalone ? `<h3 style="margin-bottom:12px">${t('ins_others')}</h3>` : ''}<div class="seg ins-tabs" role="tablist"><button data-os="ios" class="${tab === 'ios' ? 'on' : ''}" role="tab">${ic('phone',16)} iPhone</button><button data-os="android" class="${tab === 'android' ? 'on' : ''}" role="tab">${ic('phone',16)} Android</button></div>
      <div id="isteps">${installSteps(tab)}</div>${tab === 'ios' ? `<p class="xs muted" style="margin-top:6px">${t('ins_ios_note')}</p>` : ''}</div>`}
    <div class="card ins-upd">${ic('check',20,2.4)}<div><b>${t('ins_auto_t')}</b><p class="small muted">${t('ins_auto_p')}</p></div></div>
    ${contactCard()}
    <div class="card ins-qr"><div class="qr-box">${window.LAHQR ? LAHQR.svg({ size: 200 }) : ''}</div><div class="grow"><h3>${t('ins_qr_t')}</h3><p class="muted small">${t('ins_qr_p')}</p>
      <div class="row wrap" style="gap:10px">${navigator.share ? `<button class="btn soft" data-share-url>${ic('share',18)} ${t('ins_share')}</button>` : ''}<button class="btn ghost" data-copy-url>${ic('copy',18)} ${t('ins_copy')}</button></div></div></div>
  </section>${S.user ? '' : '</main>' + footer()}`;
  if (S.user && $('.content')) { const sec = $('.ins'); $('.content').appendChild(sec); }
  $$('[data-os]').forEach(b => b.onclick = () => { $$('[data-os]').forEach(x => x.classList.toggle('on', x === b)); $('#isteps').innerHTML = installSteps(b.dataset.os); });
  $$('[data-copy-url]').forEach(b => b.onclick = () => copyText(url));
  $$('[data-share-url]').forEach(b => b.onclick = () => navigator.share({ title: 'iLab@home', text: t('ins_share_txt'), url }).catch(() => {}));
  if ($('#instNow')) $('#instNow').onclick = async () => { const ev = S.installEvt; if (!ev) return; ev.prompt(); const r = await ev.userChoice.catch(() => ({})); S.installEvt = null; if (r.outcome === 'accepted') { toast(t('ins_ok_toast')); setTimeout(render, 600); } };
}

/* native-app behaviour on phones: no pinch/double-tap zoom of the page, hide bars while typing */
function labelTables(root){ $$('table.table', root).forEach(tb => { const hs = $$('thead th', tb).map(th => th.textContent.trim()); $$('tbody tr', tb).forEach(tr => { [...tr.children].forEach((td, i) => { if (!td.hasAttribute('data-l')) td.setAttribute('data-l', hs[i] || ''); }); }); tb.classList.add('mcards'); }); }
const APP_V = 34;
let updChecking = false;
async function checkUpdate(){
  if (updChecking || location.protocol !== 'https:') return; updChecking = true;
  try { const r = await fetch('index.html?u=' + Date.now(), { cache:'no-store' }); const m = (await r.text()).match(/app\.js\?v=(\d+)/);
    if (m && +m[1] > APP_V) { try { const reg = await navigator.serviceWorker.getRegistration(); if (reg) await reg.update(); } catch(e) {}
      const busyNow = () => $('#modal-root .modal-bg') || (document.activeElement && document.activeElement.matches('input,textarea,select'));
      if (!busyNow()) location.reload(); else window.addEventListener('hashchange', () => location.reload(), { once:true }); } }
  catch(e) {} finally { updChecking = false; }
}
function appFeel(){
  let lt = 0; new MutationObserver(() => { if (lt) return; lt = requestAnimationFrame(() => { lt = 0; labelTables(app); }); }).observe(app, { childList:true, subtree:true });
  const inMap = e => e.target && e.target.closest && e.target.closest('.leaflet-container');
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(n => document.addEventListener(n, e => { if (!inMap(e)) e.preventDefault(); }, { passive:false }));
  const field = el => el && el.matches && el.matches('input:not([type=checkbox]):not([type=radio]):not([type=range]),textarea,select');
  document.addEventListener('focusin', e => { if (field(e.target) && matchMedia('(max-width:900px)').matches) document.body.classList.add('kb'); });
  document.addEventListener('focusout', () => setTimeout(() => { if (!field(document.activeElement)) document.body.classList.remove('kb'); }, 80));
  window.addEventListener('pageshow', e => { if (e.persisted) render(); });
  let st, on = false; window.addEventListener('scroll', () => { if (!on) { const f = $('.bot-fab'); if (!f || f.classList.contains('dragging')) return; f.classList.add('scrolling'); on = true; } clearTimeout(st); st = setTimeout(() => { on = false; const f = $('.bot-fab'); if (f) f.classList.remove('scrolling'); }, 650); }, { passive:true });
  /* always run the newest version: an app left open on the phone checks for updates when it comes back */
  checkUpdate(); document.addEventListener('visibilitychange', () => { if (!document.hidden) { checkUpdate(); navigator.serviceWorker && navigator.serviceWorker.getRegistration().then(r => r && r.update()).catch(() => {}); } }); window.addEventListener('focus', checkUpdate); setInterval(checkUpdate, 5 * 60000);
}
/* ================= v17: results care, hospitals, doctor, password reset, Google, kit ================= */
Object.assign(I18N.en, {
  r_doctor:'Doctor', r_doctor_d:'Online consultations (video, voice, messages) and advice on results.',
  lv_normal_t:'All results are in the normal range', lv_normal_p:'Keep up your healthy habits. A yearly check-up is a good routine.',
  lv_review_t:'Some results need a doctor’s review soon', lv_review_p:'This is not an emergency. Please see a doctor within 1–2 weeks. Until then, follow the advice below.',
  lv_urgent_t:'One result needs urgent medical care today', lv_urgent_p:'Please contact a doctor today. If you feel very unwell (chest pain, fainting, trouble breathing, confusion), call 9999 or go to the nearest emergency now.',
  call_999:'Call 9999', g_eat:'Eat more', g_avoid:'Avoid', g_do:'What to do now', g_see:'Get help at once if', g_crit:'Critical', g_until:'Until your doctor’s advice', g_general:'Drink water, sleep well, stay active and keep your follow-up appointment.',
  g_note:'General guidance only. It is not a diagnosis and does not replace your doctor.',
  doc_wait_t:'A doctor is reviewing your results', doc_wait_p:'{n} usually replies within 24 hours. You will get a notification.',
  doc_note_t:'Doctor’s advice', doc_plan_t:'My commitments', doc_plan_p:'Tick each one when done. Saved on this phone.', doc_retest:'Add retest reminder',
  hosp_t:'Nearest hospitals & health centres', hosp_p:'North Al Sharqiyah. Distances are straight-line.', hosp_open24:'Emergency open 24 h', hosp_hc:'Health centre · usually Sun–Thu 7:30–14:30', hosp_check:'Call before going', hosp_dir:'Directions', hosp_near:'Use my location', hosp_km:'{n} km',
  hosp_open_now:'Likely open now', hosp_closed_now:'Likely closed now',
  m_review:'Results to review', m_reviewed:'Reviewed', doc_home_t:'Results waiting for review', doc_empty:'No results waiting. Good work!', doc_write:'Write advice for the patient', doc_note_ph:'Explain the result in simple words and what the patient should do…',
  doc_plan_l:'Commitments for the patient', doc_send:'Send advice', doc_sent:'Advice sent to the patient', doc_by:'By {n}', doc_pending:'Waiting', doc_done:'Reviewed', doc_urgent:'Urgent',
  dp_retest2w:'Repeat the test in 2 weeks', dp_retest3m:'Repeat the test in 3 months', dp_visit:'Visit your health centre this week', dp_er:'Go to the emergency department today', dp_diet:'Follow the diet advice above', dp_walk:'Walk 30 minutes, 5 days a week', dp_meds:'Take your medicines as prescribed', dp_water:'Drink 8 glasses of water a day', dp_bp:'Check blood pressure at home every day',
  forgot:'Forgot your password?', forgot_t:'Reset your password', forgot_p:'Enter your email or phone. We will email you a link to set a new password.', forgot_send:'Send reset link', forgot_ok:'If an account exists, a reset link is on its way to the email on file. Check your inbox and spam folder.',
  reset_t:'Set a new password', reset_save:'Save password', reset_ok:'Password changed. You are signed in.', e_LINK_EXPIRED:'This link has expired or was already used. Ask for a new one.', e_NO_MAIL:'Email is not set up yet. Please contact us on WhatsApp.',
  or_with:'or', g_btn:'Continue with Google', needs_profile:'Complete your profile (phone, gender, date of birth, civil ID) before booking.', complete_now:'Complete now',
  cat_vitals:'Vital signs', cat_kids:'Children', cat_men:'Men', badge_kids:'For kids', badge_seniors:'60+',
  soon_t:'Coming soon', soon_p:'New home services we are preparing.', soon_1:'Vaccinations at home', soon_1d:'Children and adult vaccines given by a licensed nurse.', soon_2:'Home IV & treatment', soon_2d:'Drips, injections and dressings at home with a prescription.', soon_3:'Doctor video consult', soon_3d:'Talk to a doctor about your results from home.', soon_4:'ECG at home', soon_4d:'Heart tracing recorded at home and read by a doctor.', soon_chip:'Soon',
  m_kit:'My kit', kit_t:'My iLab@home kit', kit_p:'The navy iLab@home bag issued to every nurse. Items go down automatically after each collection.', kit_low:'Low', kit_ok:'OK', kit_req:'Request restock', kit_req_ok:'Restock request sent to operations.', kit_hist:'Recent requests', kit_pending:'Pending', kit_done:'Ready', kit_from_t:'Where does the kit come from?', kit_from_p:'iLab@home gives each nurse a branded navy kit (bag, tubes, needles, gloves, cold box, BP monitor) at onboarding. Refills are collected from the operations office or the partner lab. The branded coat with performance stars comes next.',
  stars_t:'My level', lvl_1:'Starter', lvl_2:'Silver', lvl_3:'Gold', lvl_4:'Platinum', lvl_next:'Next level: {v} visits and ★ {r}', lvl_top:'Top level reached. Thank you!',
  m_kits:'Nurse kits', kit_admin_t:'Nurse kits & restock', kit_fill:'Mark ready', kit_refill:'Refill full kit', kit_requests:'Restock requests', kit_nurses:'Stock by nurse', kit_items_low:'{n} low',
  demo_res_l:'Demo results', demo_res_p:'Which results demo and automatic requests produce.', dr_mixed:'Mixed (random)', dr_normal:'Always normal', dr_review:'Needs review', dr_urgent:'Urgent'
});
Object.assign(I18N.ar, {
  r_doctor:'طبيب', r_doctor_d:'استشارات أونلاين (فيديو، صوت، رسائل) وتوصيات على النتائج.',
  lv_normal_t:'كل النتائج ضمن المعدل الطبيعي', lv_normal_p:'استمر على عاداتك الصحية. الفحص السنوي روتين ممتاز.',
  lv_review_t:'بعض النتائج تحتاج مراجعة الطبيب قريباً', lv_review_p:'هذي ليست حالة طارئة. راجع الطبيب خلال أسبوع إلى أسبوعين، وإلى ذلك الحين اتبع النصائح التالية.',
  lv_urgent_t:'نتيجة تحتاج رعاية طبية عاجلة اليوم', lv_urgent_p:'تواصل مع طبيب اليوم. إذا تشعر بتعب شديد (ألم في الصدر، إغماء، ضيق تنفس، تشوّش) اتصل بـ 9999 أو توجّه لأقرب طوارئ فوراً.',
  call_999:'اتصل 9999', g_eat:'كُل أكثر', g_avoid:'تجنّب', g_do:'ماذا تفعل الآن', g_see:'اطلب المساعدة فوراً إذا', g_crit:'حرجة', g_until:'إلى أن تصلك توصية الطبيب', g_general:'اشرب ماء، نم جيداً، تحرّك، والتزم بموعد المتابعة.',
  g_note:'إرشادات عامة فقط، وليست تشخيصاً ولا تغني عن الطبيب.',
  doc_wait_t:'طبيب يراجع نتائجك الآن', doc_wait_p:'عادةً ترد {n} خلال 24 ساعة، وبيوصلك إشعار.',
  doc_note_t:'توصية الطبيب', doc_plan_t:'التزاماتي', doc_plan_p:'علّم على كل التزام بعد ما تنجزه. يُحفظ على هذا الجهاز.', doc_retest:'أضف تذكير إعادة الفحص',
  hosp_t:'أقرب المستشفيات والمراكز الصحية', hosp_p:'محافظة شمال الشرقية. المسافات خط مستقيم.', hosp_open24:'الطوارئ مفتوحة 24 ساعة', hosp_hc:'مركز صحي · عادةً الأحد–الخميس 7:30–2:30', hosp_check:'اتصل قبل الذهاب', hosp_dir:'الاتجاهات', hosp_near:'استخدم موقعي', hosp_km:'{n} كم',
  hosp_open_now:'غالباً مفتوح الآن', hosp_closed_now:'غالباً مغلق الآن',
  m_review:'نتائج للمراجعة', m_reviewed:'تمت المراجعة', doc_home_t:'نتائج تنتظر المراجعة', doc_empty:'لا توجد نتائج تنتظر. عمل ممتاز!', doc_write:'اكتب توصية للمريض', doc_note_ph:'اشرح النتيجة بكلمات بسيطة وماذا يجب على المريض أن يفعل…',
  doc_plan_l:'التزامات المريض', doc_send:'إرسال التوصية', doc_sent:'تم إرسال التوصية للمريض', doc_by:'بواسطة {n}', doc_pending:'بانتظار المراجعة', doc_done:'تمت المراجعة', doc_urgent:'عاجل',
  dp_retest2w:'أعد الفحص بعد أسبوعين', dp_retest3m:'أعد الفحص بعد 3 أشهر', dp_visit:'راجع المركز الصحي هذا الأسبوع', dp_er:'توجّه لقسم الطوارئ اليوم', dp_diet:'اتبع النصائح الغذائية أعلاه', dp_walk:'امشِ 30 دقيقة، 5 أيام في الأسبوع', dp_meds:'خذ أدويتك كما وصفها الطبيب', dp_water:'اشرب 8 أكواب ماء يومياً', dp_bp:'قِس الضغط في البيت كل يوم',
  forgot:'نسيت كلمة المرور؟', forgot_t:'استعادة كلمة المرور', forgot_p:'اكتب بريدك أو رقم هاتفك، وبنرسل لك رابطاً على الإيميل لتعيين كلمة مرور جديدة.', forgot_send:'إرسال الرابط', forgot_ok:'إذا كان الحساب موجوداً، فرابط الاستعادة في الطريق إلى بريده. تفقّد البريد الوارد والرسائل غير المرغوبة.',
  reset_t:'تعيين كلمة مرور جديدة', reset_save:'حفظ كلمة المرور', reset_ok:'تم تغيير كلمة المرور وتسجيل دخولك.', e_LINK_EXPIRED:'الرابط منتهي أو مستخدم من قبل. اطلب رابطاً جديداً.', e_NO_MAIL:'البريد غير مفعّل بعد. تواصل معنا على واتساب.',
  or_with:'أو', g_btn:'المتابعة بحساب Google', needs_profile:'أكمل ملفك (الهاتف، الجنس، تاريخ الميلاد، الرقم المدني) قبل الحجز.', complete_now:'أكمل الآن',
  cat_vitals:'العلامات الحيوية', cat_kids:'الأطفال', cat_men:'الرجال', badge_kids:'للأطفال', badge_seniors:'+60',
  soon_t:'قريباً', soon_p:'خدمات منزلية جديدة نجهّزها.', soon_1:'التطعيمات في البيت', soon_1d:'تطعيمات الأطفال والكبار على يد ممرض مرخّص.', soon_2:'المغذّي والعلاج في البيت', soon_2d:'مغذّيات وإبر وغيار جروح في البيت بوصفة طبية.', soon_3:'استشارة طبيب بالفيديو', soon_3d:'كلّم طبيباً عن نتائجك من البيت.', soon_4:'تخطيط القلب في البيت', soon_4d:'تخطيط قلب يُسجَّل في البيت ويقرأه طبيب.', soon_chip:'قريباً',
  m_kit:'حقيبتي', kit_t:'حقيبة آي لاب@هوم', kit_p:'الحقيبة الكحلية اللي تُسلَّم لكل ممرض. تنقص المستلزمات تلقائياً بعد كل سحب.', kit_low:'ناقص', kit_ok:'متوفر', kit_req:'طلب تعبئة', kit_req_ok:'تم إرسال طلب التعبئة للعمليات.', kit_hist:'آخر الطلبات', kit_pending:'قيد التجهيز', kit_done:'جاهز', kit_from_t:'من وين يجيب الممرض الحقيبة؟', kit_from_p:'آي لاب@هوم تسلّم كل ممرض حقيبة كحلية بالشعار (الحقيبة، الأنابيب، الإبر، القفازات، صندوق التبريد، جهاز الضغط) عند الانضمام، والتعبئة تُستلم من مكتب العمليات أو المختبر الشريك. والمعطف الطبي بالشعار ونجوم الأداء قريباً.',
  stars_t:'مستواي', lvl_1:'مبتدئ', lvl_2:'فضي', lvl_3:'ذهبي', lvl_4:'بلاتيني', lvl_next:'المستوى التالي: {v} زيارة وتقييم ★ {r}', lvl_top:'وصلت أعلى مستوى. شكراً لك!',
  m_kits:'حقائب الممرضين', kit_admin_t:'حقائب الممرضين والتعبئة', kit_fill:'تم التجهيز', kit_refill:'تعبئة كاملة', kit_requests:'طلبات التعبئة', kit_nurses:'المخزون لكل ممرض', kit_items_low:'{n} ناقص',
  demo_res_l:'نتائج التجربة', demo_res_p:'نوع النتائج اللي تطلع في الطلبات التجريبية والتلقائية.', dr_mixed:'متنوعة (عشوائي)', dr_normal:'طبيعية دائماً', dr_review:'تحتاج مراجعة', dr_urgent:'عاجلة'
});

/* --- hospitals of North Al Sharqiyah (MOH list, coordinates from OpenStreetMap) --- */
const HOSP = [
  { en:'Ibra Hospital', ar:'مستشفى إبراء', ll:[22.6632,58.59119], h:1, ref:1 },
  { en:'Sinaw Hospital', ar:'مستشفى سناو', ll:[22.49879,58.02886], h:1 },
  { en:'Bidiya Hospital', ar:'مستشفى بدية', ll:[22.45207,58.80244], h:1 },
  { en:'Wadi Bani Khalid Hospital', ar:'مستشفى وادي بني خالد', ll:[22.57947,59.09523], h:1 },
  { en:'Dima W’Attayeen Hospital (Mahlah)', ar:'مستشفى دماء والطائيين (محلاه)', ll:[23.03956,58.59459], h:1 },
  { en:'Samad Al Shan Hospital', ar:'مستشفى سمد الشأن', ll:[22.82095,58.16024], h:1, q:'Samad Al Shan Hospital Oman' },
  { en:'Ibra Health Centre', ar:'مركز إبراء الصحي', ll:[22.6921,58.54615] },
  { en:'New Ibra Health Centre', ar:'مركز إبراء الجديد الصحي', ll:[22.66644,58.59222] },
  { en:'Al Qabil Health Centre', ar:'مركز القابل الصحي', ll:[22.57874,58.69285] },
  { en:'Wadi Nam Health Centre', ar:'مركز وادي نام الصحي', ll:[22.72793,58.63969] },
  { en:'Dima Health Centre', ar:'مركز دماء الصحي', ll:[22.98453,58.50298] },
  { en:'Al Mudhaibi Health Centre', ar:'مركز المضيبي الصحي', ll:[22.56965,58.11502], q:'Al Mudhaibi Health Center Oman' }
];
function kmBetween(a, b){ const R = 6371, r = x => x * Math.PI / 180; const dLa = r(b[0]-a[0]), dLo = r(b[1]-a[1]); const s = Math.sin(dLa/2)**2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLo/2)**2; return 2 * R * Math.asin(Math.sqrt(s)); }
function hcOpenNow(){ const p = new Intl.DateTimeFormat('en-GB',{ timeZone:'Asia/Muscat', weekday:'short', hour:'2-digit', minute:'2-digit', hour12:false }).formatToParts(new Date()); const g = k => (p.find(x => x.type === k) || {}).value; const wd = g('weekday'); const m = (+g('hour') % 24) * 60 + (+g('minute')); return ['Sun','Mon','Tue','Wed','Thu'].includes(wd) && m >= 450 && m < 870; }
function hospList(from, urgent){
  let L = HOSP.map(x => Object.assign({ km: from ? kmBetween(from, x.ll) : null }, x));
  if (urgent) L = L.filter(x => x.h);
  L.sort((a, b) => from ? a.km - b.km : (b.ref || 0) - (a.ref || 0));
  const open = hcOpenNow();
  return L.slice(0, urgent ? 3 : 4).map(x => { const dest = x.q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(x.q)}` : `https://www.google.com/maps/dir/?api=1&destination=${x.ll[0]},${x.ll[1]}`;
    const st = x.h ? `<span class="chip teal">${ic('check',12,2.6)} ${t('hosp_open24')}</span>` : `<span class="chip ${open ? 'teal' : 'gray'}">${t(open ? 'hosp_open_now' : 'hosp_closed_now')}</span> <span class="xs muted">${t('hosp_hc')} · ${t('hosp_check')}</span>`;
    return `<div class="hosp"><span class="hi">${ic(x.h ? 'hosp' : 'plus', 20, 2.2)}</span><div class="grow"><b>${esc(S.lang === 'ar' ? x.ar : x.en)}</b>${x.km != null ? ` <span class="chip gray num">${t('hosp_km',{n:x.km < 10 ? x.km.toFixed(1) : Math.round(x.km)})}</span>` : ''}<div class="row wrap" style="gap:6px;margin-top:4px">${st}</div></div>
      <a class="btn soft sm" target="_blank" rel="noopener" href="${dest}">${ic('pin',15)} ${t('hosp_dir')}</a></div>`; }).join('');
}
function hospCard(o, urgent){
  const from = o && o.lat && o.address ? [o.lat, o.lng] : (S.user && S.user.lat ? [S.user.lat, S.user.lng] : (o && WILAYAT_LL[o.wilayat]) || null);
  return `<div class="card" id="hospc"><div class="row between wrap" style="gap:8px"><div><h3 style="margin:0">${ic('hosp',20)} ${t('hosp_t')}</h3><div class="xs muted">${t('hosp_p')}</div></div><button class="btn ghost sm" data-near>${ic('target',15)} ${t('hosp_near')}</button></div>
    <div class="stack" style="--g:8px;margin-top:12px" id="hospl" data-u="${urgent ? 1 : 0}">${hospList(from, urgent)}</div>
    <a class="btn red block" style="margin-top:12px" href="tel:9999">${ic('phone',18)} ${t('call_999')}</a></div>`;
}
function bindHosp(){
  const b = $('[data-near]'); if (!b) return;
  b.onclick = () => { if (!navigator.geolocation) return; b.disabled = true;
    navigator.geolocation.getCurrentPosition(p => { const l = $('#hospl'); if (l) l.innerHTML = hospList([p.coords.latitude, p.coords.longitude], l.dataset.u === '1'); b.disabled = false; }, () => { b.disabled = false; toast(t('e_GENERIC'), true); }, { enableHighAccuracy:false, timeout:10000, maximumAge:300000 }); };
}

/* --- result level + guidance + doctor advice --- */
const PLAN_KEYS = ['dp_retest2w','dp_retest3m','dp_visit','dp_er','dp_diet','dp_walk','dp_meds','dp_water','dp_bp'];
function orderLevel(o){ const g = window.LAHGUIDE ? LAHGUIDE.assess(o.tests, o.results) : { level:'normal', flagged:[] }; if (o.severity && ['normal','review','urgent'].includes(o.severity)) g.level = o.severity === 'urgent' || g.level === 'urgent' ? 'urgent' : o.severity === 'review' || g.level === 'review' ? 'review' : 'normal'; return g; }
function guideHtml(flagged){
  const ar = S.lang === 'ar'; const seen = new Set();
  return flagged.slice().sort((x, y) => (y.crit ? 1 : 0) - (x.crit ? 1 : 0)).map(({ a, r, crit }) => { const code = a.c === 'GLUR' ? 'GLU' : a.c; const dir = r.f === 'L' ? 'L' : 'H'; if (seen.has(code + dir)) return ''; seen.add(code + dir);
    const g = LAHGUIDE.forAnalyte(code, dir, S.lang);
    const sec = (k, arr, cls) => arr && arr.length ? `<div class="gsec ${cls}"><b>${t(k)}</b><ul>${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';
    return `<details class="gcard ${crit ? 'crit' : ''}" ${crit || flagged.length < 3 ? 'open' : ''}><summary><span class="flag ${r.f || 'H'}">${t('f_' + (r.f || 'H'))}</span><b class="grow">${esc(ar ? a.na : a.n)}</b><span class="num b">${esc(r.v)} <small class="muted">${esc(a.u || '')}</small></span>${crit ? `<span class="chip red">${t('g_crit')}</span>` : ''}</summary>
      ${g ? `<div class="ggrid">${sec('g_eat', g.eat, 'eat')}${sec('g_avoid', g.avoid, 'avoid')}${sec('g_do', g.do, 'do')}${sec('g_see', g.see, 'see')}</div>` : `<p class="small muted" style="margin:8px 0 0">${t('g_general')}</p>`}</details>`; }).join('');
}
function planStore(id){ try { return JSON.parse(localStorage.getItem('lah_plan_' + id) || '{}'); } catch(e) { return {}; } }
function retestIcs(o, days){
  const d = new Date(Date.now() + days * 86400000); const ymd = d.toISOString().slice(0,10).replace(/-/g,'');
  const ics = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//LabAtHome//EN','BEGIN:VEVENT','UID:retest-' + o.id + '@labathome','DTSTAMP:' + new Date().toISOString().replace(/[-:]/g,'').slice(0,15) + 'Z','DTSTART;VALUE=DATE:' + ymd,'SUMMARY:iLab@home – ' + (S.lang === 'ar' ? 'موعد إعادة الفحص' : 'Retest reminder') + ' (' + o.code + ')','DESCRIPTION:https://labathome-oman.vercel.app/#/app/tests','END:VEVENT','END:VCALENDAR'].join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics], { type:'text/calendar' })); a.download = 'LabAtHome-retest.ics'; document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 500);
}
function careBlock(o){
  if (o.status !== 'completed' || !o.results) return '';
  const r = S.user.role; const g = orderLevel(o); const lv = g.level; const dn = o.doctor_note;
  const icn = { normal:'check', review:'clock', urgent:'phone' }[lv]; const lk = lv === 'normal' && g.mild ? 'lv_mild' : 'lv_' + lv;
  let h = `<div class="card care lv-${lv}"><div class="row" style="align-items:flex-start;gap:12px"><span class="lv-ic">${ic(icn, 24, 2.4)}</span><div class="grow"><b class="lv-t">${t(lk+'_t')}</b><div class="small">${t(lk+'_p')}</div></div></div>
    ${lv === 'urgent' ? `<div class="row wrap" style="margin-top:12px;gap:8px"><a class="btn red" href="tel:9999">${ic('phone',18)} ${t('call_999')}</a><a class="btn ghost" href="#hospc" data-jump>${ic('hosp',18)} ${t('hosp_t')}</a></div>` : ''}</div>`;
  if (dn) {
    const done = planStore(o.id); const plan = Array.isArray(dn.plan) ? dn.plan : [];
    h += `<div class="card docnote"><div class="row" style="gap:12px">${A.roleIcon('doctor', 46)}<div class="grow"><div class="xs muted">${t('doc_note_t')}</div><b>${esc(dn.name || '')}</b><div class="xs muted">${fmtDT(dn.at)}</div></div><span class="chip teal">${ic('check',12,2.6)} ${t('doc_done')}</span></div>
      <p style="white-space:pre-wrap;margin:12px 0 0">${esc(dn.note)}</p>
      ${plan.length ? `<h4 style="margin:16px 0 2px">${t('doc_plan_t')}</h4><div class="xs muted" style="margin-bottom:8px">${r === 'patient' ? t('doc_plan_p') : ''}</div><div class="stack" style="--g:6px">${plan.map((k, i) => `<label class="check plan"><input type="checkbox" data-plan="${i}" ${done[i] ? 'checked' : ''} ${r === 'patient' ? '' : 'disabled'}> <span>${esc(PLAN_KEYS.includes(k) ? t(k) : k)}</span></label>`).join('')}</div>` : ''}
      ${r === 'patient' && plan.some(k => /retest/.test(k)) ? `<button class="btn soft sm" style="margin-top:12px" data-retest="${plan.includes('dp_retest2w') ? 14 : 90}">${ic('cal',16)} ${t('doc_retest')}</button>` : ''}</div>`;
  } else if (lv !== 'normal' && r === 'patient') {
    h += `<div class="card row" style="gap:12px;align-items:flex-start">${A.roleIcon('doctor', 46)}<div class="grow"><b>${t('doc_wait_t')}</b><div class="small muted">${t('doc_wait_p',{n: S.lang === 'ar' ? 'د. عائشة البلوشية' : 'Dr. Aisha Al Balushi'})}</div><span class="live" style="margin-top:8px"><i></i>${t('doc_pending')}</span></div></div>`;
  }
  if (g.flagged.length) h += `<div class="card"><h3 style="margin-bottom:4px">${t(lv === 'normal' ? 'g_tips' : 'g_until')}</h3><div class="xs muted" style="margin-bottom:10px">${t('g_note')}</div><div class="stack" style="--g:8px">${guideHtml(g.flagged)}</div></div>`;
  if (r === 'doctor') h += doctorForm(o, g);
  if (r === 'patient') h += csPostCta(o);
  if (lv !== 'normal' && r !== 'doctor') h += hospCard(o, lv === 'urgent');
  return h;
}
function doctorForm(o, g){
  const dn = o.doctor_note || {}; const sel = new Set(dn.plan || (g.level === 'urgent' ? ['dp_er','dp_visit'] : ['dp_visit','dp_diet','dp_retest3m']));
  return `<div class="card" id="docf"><h3>${ic('steth',20)} ${t('doc_write')}</h3>
    <textarea class="input" id="dnote" rows="5" placeholder="${t('doc_note_ph')}">${esc(dn.note || '')}</textarea>
    <div class="b small" style="margin:12px 0 6px">${t('doc_plan_l')}</div><div class="row wrap" style="gap:6px">${PLAN_KEYS.map(k => `<label class="chip gray" style="cursor:pointer;padding:7px 10px"><input type="checkbox" name="dplan" value="${k}" ${sel.has(k) ? 'checked' : ''}> ${t(k)}</label>`).join('')}</div>
    <div class="err" id="dfe"></div><button class="btn teal block" style="margin-top:12px" id="dsend">${ic('send',18)} ${t('doc_send')}</button></div>`;
}
function bindCare(o, redraw){
  bindHosp();
  $$('[data-jump]').forEach(a => a.onclick = e => { e.preventDefault(); const el = $('#hospc'); if (el) el.scrollIntoView({ behavior:'smooth', block:'start' }); });
  $$('[data-plan]').forEach(c => c.onchange = () => { const s = planStore(o.id); s[c.dataset.plan] = c.checked; localStorage.setItem('lah_plan_' + o.id, JSON.stringify(s)); });
  $$('[data-retest]').forEach(b => b.onclick = () => { retestIcs(o, +b.dataset.retest); toast(t('cal_ok')); });
  if ($('#dsend')) $('#dsend').onclick = async () => { const note = $('#dnote').value.trim(); if (!note) { $('#dfe').textContent = t('doc_note_ph'); return; }
    const plan = $$('input[name=dplan]:checked').map(x => x.value);
    try { const n = await busy($('#dsend'), () => API.doctorNote(o.id, note, plan)); toast(t('doc_sent')); redraw(n); } catch(e) { $('#dfe').textContent = errMsg(e); } };
}

/* --- doctor home --- */
async function viewDoctorHome(){
  loading(t('m_review'));
  const L = await API.orders('mine'); const u = S.user;
  const pend = L.filter(o => !o.reviewed), done = L.filter(o => o.reviewed);
  const urg = pend.filter(o => o.severity === 'urgent').length;
  const item = o => orderItem(o, `<div class="row wrap" style="gap:6px;margin-top:8px"><span class="chip ${o.severity === 'urgent' ? 'red' : 'amber'}">${o.severity === 'urgent' ? '🔴 ' + t('doc_urgent') : '🟡 ' + t('m_review')}</span>${o.reviewed ? `<span class="chip teal">${ic('check',12,2.6)} ${t('doc_done')}</span>` : ''}</div>`);
  app.innerHTML = shell(t('hello',{n:esc(u.full_name.replace(/^Dr\.?\s*/,'').split(' ')[0])}), `<div class="stack-lg">
    <div class="card row" style="gap:14px">${A.roleIcon('doctor', 56)}<div class="grow"><b style="font-size:1.1rem">${esc(u.full_name)}</b><div class="small muted">${esc(S.lang === 'ar' ? ((u.meta||{}).specialty_ar || t('r_doctor')) : ((u.meta||{}).specialty || t('r_doctor')))}${(u.meta||{}).license ? ' · ' + esc(u.meta.license) : ''}</div></div></div>
    ${(u.meta || {}).consult ? `<a class="card row cs-row" href="#/app/consult" style="gap:12px">${ic('video',24)}<div class="grow"><b>${t('cs_q')}</b><div class="xs muted">${t('cs_p')}</div></div><span class="flip">${ic('arrow',18)}</span></a>` : ''}
    <div class="grid g3"><div class="kpi" style="${urg ? 'background:#fdecec' : ''}"><span>🔴 ${t('doc_urgent')}</span><b>${urg}</b></div><div class="kpi"><span>🟡 ${t('doc_pending')}</span><b>${pend.length - urg}</b></div><div class="kpi blue"><span>${t('m_reviewed')}</span><b>${done.length}</b></div></div>
    <div><h3>${t('doc_home_t')} <span class="chip">${pend.length}</span></h3>${pend.length ? `<div class="olist">${pend.map(item).join('')}</div>` : emptyBox(t('doc_empty'))}</div>
    ${done.length ? `<div><h3>${t('m_reviewed')}</h3><div class="olist">${done.slice(0, 20).map(item).join('')}</div></div>` : ''}</div>`);
}

/* --- forgot / reset password --- */
function viewForgot(){
  app.innerHTML = authShell(`${thinker()}<h1>${t('forgot_t')}</h1><p class="muted">${t('forgot_p')}</p>
    <form id="ff" class="stack" style="margin-top:18px"><label class="field"><span>${t('email_or_phone')}</span><input class="input ltr" name="login" autocomplete="username" autocapitalize="off" required placeholder="name@email.com · 9XXXXXXX"></label><div class="err" id="fe"></div><button class="btn block">${t('forgot_send')}</button></form>
    <div id="fok"></div><p class="center muted" style="margin:16px 0"><a href="#/login" class="b">${t('login')}</a></p>`);
  const TH = bindThinker($('#ff'));
  $('#ff').onsubmit = async e => { e.preventDefault(); const f = e.target; $('#fe').textContent = '';
    try { await busy($('button', f), () => API.resetRequest(f.login.value.trim())); f.style.display = 'none'; if (TH) TH.happy(); $('#fok').innerHTML = `<div class="banner teal">${ic('mail',22)}<span>${t('forgot_ok')}</span></div>`; } catch(err) { $('#fe').textContent = errMsg(err); const th = $('#thk'); if (th) { th.classList.remove('th-no'); void th.offsetWidth; th.classList.add('th-no'); } } };
}
function viewReset(code){
  app.innerHTML = authShell(`${thinker()}<h1>${t('reset_t')}</h1><form id="rf" class="stack" style="margin-top:18px">${pwField('new1', t('new_pw'), t('pass_rule'))}<div class="err" id="re"></div><button class="btn block">${t('reset_save')}</button></form>
    <p class="center muted" style="margin:16px 0"><a href="#/forgot" class="b">${t('forgot')}</a></p>`);
  bindPw(app);
  $('#rf').onsubmit = async e => { e.preventDefault(); const f = e.target; $('#re').textContent = '';
    try { const r = await busy($('button', f), () => API.resetConfirm(code, f.new1.value)); toast(t('reset_ok')); history.replaceState(null, '', '#/app'); afterLogin(r); } catch(err) { $('#re').textContent = errMsg(err); } };
}

/* --- Google sign-in (shown only once a Google client ID is set on the server) --- */
let GCFG = null;
async function googleCfg(){ if (GCFG) return GCFG; try { const r = await fetch('api/google', { cache:'no-store' }); GCFG = r.ok ? await r.json() : {}; } catch(e) { GCFG = {}; } return GCFG; }
async function mountGoogle(){
  const box = $('#gbox'); if (!box) return; const c = await googleCfg(); if (!c.client_id || !$('#gbox')) return;
  box.innerHTML = `<div class="orline"><span>${t('or_with')}</span></div><div id="gbtn" style="display:flex;justify-content:center;min-height:44px"></div><div class="err center" id="ge"></div>`;
  const init = () => { if (!window.google || !google.accounts) return setTimeout(init, 200);
    google.accounts.id.initialize({ client_id: c.client_id, callback: async resp => { $('#ge').textContent = '';
      try { const r = await fetch('api/google', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ credential: resp.credential }) }); const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new API.ApiError(j.error || 'GENERIC'); afterLogin(j); } catch(e) { $('#ge').textContent = errMsg(e); } }, ux_mode:'popup', locale: S.lang });
    google.accounts.id.renderButton($('#gbtn'), { theme:'outline', size:'large', shape:'pill', text:'continue_with', width: Math.min(360, ($('#gbtn').clientWidth || 320)), locale: S.lang }); };
  if (!document.getElementById('gsi')) { const s = document.createElement('script'); s.id = 'gsi'; s.src = 'https://accounts.google.com/gsi/client'; s.async = true; document.head.appendChild(s); }
  init();
}
function profileBanner(){ const u = S.user; return u && u.role === 'patient' && (u.meta || {}).needs_profile && !(u.phone && (u.meta || {}).gender && (u.meta || {}).dob) ? `<div class="banner amber" style="margin-bottom:16px">${ic('user',22)}<div class="grow small">${t('needs_profile')}</div><a class="btn sm" href="#/app/profile">${t('complete_now')}</a></div>` : ''; }

/* --- coming soon --- */
function soonBlock(){
  const S4 = [['syringe','soon_1'],['drop','soon_2'],['heart','soon_4'],['dna','soon_dna1'],['dna','soon_dna2'],['dna','soon_dna3'],['dna','soon_dna4'],['tooth','soon_dent']];
  return `<div class="section-h" id="soon" style="margin:40px auto 18px;scroll-margin-top:80px"><span class="eyebrow">${t('soon_t')}</span><h2>${t('soon_t')}</h2><p>${t('soon_p')}</p></div>
    <div class="grid g4 soon">${S4.map(([i, k]) => `<div class="card soon-c"><span class="chip purple soon-chip">${t('soon_chip')}</span><span class="ic-round">${ic(i,24)}</span><b>${t(k)}</b><div class="small muted">${t(k+'d')}</div></div>`).join('')}</div>`;
}

/* --- nurse kit --- */
const KIT_ART = `<svg viewBox="0 0 220 150" class="kit-art" aria-hidden="true"><defs><linearGradient id="kg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d2f57"/><stop offset="1" stop-color="#0d1628"/></linearGradient></defs>
  <ellipse cx="110" cy="140" rx="86" ry="7" fill="#0d1628" opacity=".12"/><path d="M80 40c0-14 60-14 60 0" fill="none" stroke="#0d1628" stroke-width="8" stroke-linecap="round"/>
  <rect x="34" y="40" width="152" height="96" rx="18" fill="url(#kg)"/><rect x="34" y="62" width="152" height="6" fill="#2f7bff" opacity=".8"/>
  <circle cx="110" cy="100" r="22" fill="#fff"/><path d="M110 88v24M98 100h24" stroke="#e2474f" stroke-width="6" stroke-linecap="round"/>
  <text x="110" y="56" text-anchor="middle" font-family="Inter,Arial" font-weight="800" font-size="13" fill="#fff"><tspan fill="#60a5fa">i</tspan>Lab<tspan fill="#60a5fa">@</tspan>Home</text></svg>`;
function nurseLevel(visits, rating){
  const L = [[0,0],[50,4.5],[150,4.7],[300,4.8]]; let lv = 1;
  for (let i = 1; i < L.length; i++) if (visits >= L[i][0] && rating >= L[i][1]) lv = i + 1;
  return { lv, next: L[lv] || null };
}
function starsHtml(n){ return `<span class="lvl-stars">${'★'.repeat(n)}<span style="opacity:.25">${'★'.repeat(4 - n)}</span></span>`; }
async function viewNurseKit(){
  loading(t('m_kit'));
  const k = await API.kitMine(); const m = S.user.meta || {};
  const visits = (k.visits || 0) + (+m.visits_seed || 0); const rating = k.rating ? +k.rating : (+m.rating_seed || 0);
  const L = nurseLevel(visits, rating);
  app.innerHTML = shell(t('m_kit'), `<div class="grid g2 collapse" style="align-items:start"><div class="stack">
    <div class="card kit-hero"><div class="grow"><h3 style="margin:0">${t('kit_t')}</h3><p class="small muted" style="margin:6px 0 0">${t('kit_p')}</p></div>${KIT_ART}</div>
    <div class="card"><div class="row between"><h3 style="margin:0">${t('stars_t')}</h3>${starsHtml(L.lv)}</div><div class="row" style="gap:14px;margin-top:10px"><b style="font-size:1.4rem">${t('lvl_'+L.lv)}</b><span class="chip gray">${visits} ${t('collected_n')}</span><span class="chip amber">★ ${rating || '—'}</span></div>
      <div class="small muted" style="margin-top:8px">${L.next ? t('lvl_next',{v:L.next[0], r:L.next[1]}) : t('lvl_top')}</div></div>
    <div class="card"><h4>${t('kit_from_t')}</h4><p class="small muted" style="margin:0">${t('kit_from_p')}</p></div></div>
  <div class="stack"><form class="card" id="kf"><h3>${t('kit_t')}</h3><div class="stack" style="--g:8px">${k.items.map(x => { const full = Math.max(x.min * 3, 1); const pct = Math.min(100, Math.round(x.qty / full * 100));
      return `<div class="kit-row"><div class="grow"><div class="row between"><b class="small">${esc(LN(x,'name'))}</b><span class="chip ${x.low ? 'red' : 'teal'}">${x.qty} · ${t(x.low ? 'kit_low' : 'kit_ok')}</span></div><div class="progress" style="margin-top:6px;height:6px"><i style="width:${pct}%;${x.low ? 'background:var(--red)' : ''}"></i></div></div>
        <input class="input num" style="width:72px;min-height:40px" type="number" min="0" max="500" inputmode="numeric" name="${esc(x.id)}" value="${x.low ? Math.max(0, full - x.qty) : 0}"></div>`; }).join('')}</div>
    <div class="err" id="ke"></div><button class="btn block" style="margin-top:12px">${ic('box',18)} ${t('kit_req')}</button></form>
    ${k.requests.length ? `<div class="card"><h4>${t('kit_hist')}</h4>${k.requests.map(r => `<div class="vline"><span class="small">${fmtDT(r.created_at)}</span><span class="chip ${r.status === 'done' ? 'teal' : 'amber'}">${t(r.status === 'done' ? 'kit_done' : 'kit_pending')}</span></div>`).join('')}</div>` : ''}</div></div>`);
  $('#kf').onsubmit = async e => { e.preventDefault(); const items = {}; $$('#kf input[type=number]').forEach(i => { const v = parseInt(i.value, 10); if (v > 0) items[i.name] = v; });
    if (!Object.keys(items).length) { $('#ke').textContent = t('e_BAD_INPUT') !== 'e_BAD_INPUT' ? t('e_BAD_INPUT') : t('e_GENERIC'); return; }
    try { await busy($('button', e.target), () => API.kitRequest(items)); toast(t('kit_req_ok')); viewNurseKit(); } catch(err) { $('#ke').textContent = errMsg(err); } };
}
async function viewAdminKit(){
  loading(t('m_kits'));
  const k = await API.adminKit();
  app.innerHTML = shell(t('kit_admin_t'), `<div class="stack-lg">
    <div class="card kit-hero"><div class="grow"><h3 style="margin:0">${t('kit_admin_t')}</h3><p class="small muted" style="margin:6px 0 0">${t('kit_from_p')}</p></div>${KIT_ART}</div>
    <div><h3>${t('kit_requests')} <span class="chip">${k.requests.length}</span></h3>${k.requests.length ? `<div class="stack">${k.requests.map(r => `<div class="card row between wrap" style="gap:10px"><div><b>${esc(r.nurse)}</b><div class="xs muted">${fmtDT(r.created_at)}</div><div class="row wrap" style="gap:6px;margin-top:6px">${Object.entries(r.items).map(([id, q]) => `<span class="chip gray">${esc(id)} × ${q}</span>`).join('')}</div></div><button class="btn teal sm" data-fill="${r.id}">${ic('check',16)} ${t('kit_fill')}</button></div>`).join('')}</div>` : emptyBox(t('none_yet'))}</div>
    <div><h3>${t('kit_nurses')}</h3><div class="scroll-x"><table class="table"><thead><tr><th>${t('r_nurse')}</th><th>${t('wilayat')}</th><th>${t('kit_low')}</th><th></th></tr></thead><tbody>
      ${k.nurses.map(n => `<tr><td class="b">${esc(n.name)}</td><td>${esc(wN(n.wilayat))}</td><td>${n.low ? `<span class="chip red">${t('kit_items_low',{n:n.low})}</span>` : `<span class="chip teal">${t('kit_ok')}</span>`}</td><td><button class="btn soft sm" data-refill="${n.id}">${t('kit_refill')}</button></td></tr>`).join('')}</tbody></table></div></div></div>`);
  labelTables(app);
  $$('[data-fill]').forEach(b => b.onclick = async () => { try { await busy(b, () => API.adminKitFill(+b.dataset.fill, null)); toast(t('saved')); viewAdminKit(); } catch(e) { toast(errMsg(e), true); } });
  $$('[data-refill]').forEach(b => b.onclick = async () => { try { await busy(b, () => API.adminKitFill(null, b.dataset.refill)); toast(t('saved')); viewAdminKit(); } catch(e) { toast(errMsg(e), true); } });
}

/* ================= v18: standalone home, 3D banner carousel, opening splash ================= */
Object.assign(I18N.en, {
  h3_e1:'Home sample collection', h3_t1:'Lab tests at your doorstep', h3_p1:'A licensed nurse comes to you, your sample travels in a 2–8 °C cold box, and the verified report reaches your phone.', h3_c1:'Book a test',
  h3_e2:'Family packages', h3_t2:'A package for every member of the family', h3_p2:'Kids {k} OMR · Seniors 60+ {s} OMR · Blood pressure & sugar {b} OMR', h3_c2:'View packages',
  h3_e3:'Clear results', h3_t3:'Your results, with what to do next', h3_p3:'Normal, needs review or urgent, with diet tips, a doctor’s advice and the nearest hospital.', h3_c3:'My results', h3_c3v:'How it works',
  h3_e4:'Seniors 60+', h3_t4:'Check-ups for parents and grandparents at home', h3_p4:'Blood pressure, sugar, kidneys, heart and vitamins, with no trip to the hospital.', h3_c4:'Seniors package',
  h3_e5:'Coming soon', h3_t5:'Vaccinations and treatment at home', h3_p5:'Vaccines, drips and doctor video consults are on the way.', h3_c5:'See what’s coming',
  hm_quick:'What do you need today?', hm_pk:'Popular packages', hm_steps:'Three simple steps', hm_how_more:'How it works in detail', hm_st1:'Book in 2 minutes', hm_st1d:'Pick tests, a time and your location.', hm_st2:'Nurse at your door', hm_st2d:'A licensed nurse collects the sample at home.', hm_st3:'Results on your phone', hm_st3d:'Clear report with advice and a PDF.',
  qt_book:'Book a test', qt_pk:'Packages', qt_kids:'Kids', qt_seniors:'Seniors 60+', qt_bp:'BP & sugar', qt_vit:'Vitamins', qt_results:'My results', qt_help:'Help',
  hm_trust_t:'Trusted care, close to home', hm_app_t:'iLab@home on your phone', hm_app_p:'Install the app in 10 seconds. It updates itself.', prev:'Previous', next_s:'Next', skip_intro:'Skip'
});
Object.assign(I18N.ar, {
  h3_e1:'سحب العينات في البيت', h3_t1:'فحوصات المختبر عند باب بيتك', h3_p1:'ممرض مرخّص يجيك البيت، والعينة تنتقل في صندوق تبريد ٢–٨ °م، والتقرير الموثّق يوصلك على جوالك.', h3_c1:'احجز فحصك',
  h3_e2:'باقات العائلة', h3_t2:'باقة لكل فرد في العائلة', h3_p2:'الأطفال {k} ر.ع · كبار السن +60 {s} ر.ع · الضغط والسكر {b} ر.ع', h3_c2:'تصفح الباقات',
  h3_e3:'نتائج واضحة', h3_t3:'نتائجك… ومعها الخطوة التالية', h3_p3:'طبيعي أو يحتاج مراجعة أو عاجل، مع نصائح غذائية وتوصية الطبيب وأقرب مستشفى.', h3_c3:'نتائجي', h3_c3v:'كيف نشتغل',
  h3_e4:'كبار السن +60', h3_t4:'فحص الوالدين والأجداد في البيت', h3_p4:'الضغط والسكر والكلى والقلب والفيتامينات، بدون مشوار للمستشفى.', h3_c4:'باقة كبار السن',
  h3_e5:'قريباً', h3_t5:'التطعيمات والعلاج في البيت', h3_p5:'التطعيمات والمغذّيات واستشارة الطبيب بالفيديو قادمة قريباً.', h3_c5:'شوف الجديد',
  hm_quick:'ويش تحتاج اليوم؟', hm_pk:'الباقات الأكثر طلباً', hm_steps:'ثلاث خطوات بسيطة', hm_how_more:'كيف نشتغل بالتفصيل', hm_st1:'احجز في دقيقتين', hm_st1d:'اختر الفحوصات والوقت وموقعك.', hm_st2:'الممرض عند بابك', hm_st2d:'ممرض مرخّص يسحب العينة في البيت.', hm_st3:'النتائج على جوالك', hm_st3d:'تقرير واضح مع نصائح وملف PDF.',
  qt_book:'احجز فحص', qt_pk:'الباقات', qt_kids:'الأطفال', qt_seniors:'كبار السن', qt_bp:'الضغط والسكر', qt_vit:'الفيتامينات', qt_results:'نتائجي', qt_help:'المساعدة',
  hm_trust_t:'رعاية موثوقة، قريبة من بيتك', hm_app_t:'آي لاب@هوم على جوالك', hm_app_p:'ثبّت البرنامج في 10 ثواني، ويتحدث تلقائياً.', prev:'السابق', next_s:'التالي', skip_intro:'تخطي'
});
Object.assign(I18N.en, {
  h3_e6:'Self-collection kits', h3_t6:'Take your sample yourself, at home', h3_p6:'Urine, stool and swab kits come to your door for {f} OMR. You collect in private, a courier brings it to the lab.', h3_c6:'Order a kit',
  h3_e7:'Loyalty card', h3_t7:'Every 5th home visit is on us', h3_p7:'A stamp for every order, 1.000 OMR off when you invite a friend, and offers like WELCOME10 on your first order.', h3_c7:'My stamp card',
  h3_e8:'Doctor online', h3_t8:'Talk your results through with a doctor', h3_p8:'Video or voice call with a licensed doctor or dentist. Free when your results need attention.', h3_c8:'Talk to a doctor',
  h3_e9:'Companies & workers', h3_t9:'Health checks for your workers, on site', h3_p9:'Send your workers list. Our team visits your site and you see fit, follow-up or retest for each person, nothing more.', h3_c9:'For companies',
  h3_p5:'Vaccinations, drips, home ECG and DNA tests are on the way.' });
Object.assign(I18N.ar, {
  h3_e6:'عُدد السحب الذاتي', h3_t6:'خذ عينتك بنفسك وأنت في بيتك', h3_p6:'عُدد البول والبراز والمسحة توصلك لين الباب بـ {f} ر.ع. تاخذ العينة بخصوصية، والمندوب يوصلها للمختبر.', h3_c6:'اطلب عُدّة',
  h3_e7:'بطاقة الولاء', h3_t7:'كل زيارة خامسة علينا', h3_p7:'ختم مع كل طلب، وخصم 1.000 ر.ع لما تدعو صديق، وعروض مثل WELCOME10 لأول طلب.', h3_c7:'بطاقة أختامي',
  h3_e8:'طبيب أونلاين', h3_t8:'ناقش نتائجك مع طبيب', h3_p8:'مكالمة فيديو أو صوت مع طبيب أو طبيب أسنان مرخّص، ومجاناً إذا نتائجك تحتاج متابعة.', h3_c8:'كلّم طبيب',
  h3_e9:'الشركات والعمالة', h3_t9:'فحوصات عمّالك في موقع العمل', h3_p9:'أرسل قائمة العمّال، وفريقنا يزور موقعك، وتشوف لكل عامل: لائق أو يحتاج متابعة أو إعادة فحص، بس.', h3_c9:'للشركات',
  h3_p5:'التطعيمات والمغذّيات وتخطيط القلب في البيت وفحوصات الجينات قادمة قريباً.' });
function heroSlides(){
  const P = (S.catalog && S.catalog.P) || {}; const pr = id => P[id] ? omr(P[id].price) : '—'; const u = !!S.user; const B = (S.catalog && S.catalog.business) || {};
  /* a = picture / 3D scene number (img/hero/h{a}, clip{a}, hero3d BUILD[a]); v32 adds 5 self-kits, 6 loyalty, 7 doctor online, 8 companies */
  return [
    { a:0, k:'van', tone:'dark', e:'h3_e1', t:'h3_t1', p:t('h3_p1'), c:['h3_c1', u ? 'app/tests' : 'register'], c2:['nav_how', 'how'] },
    { a:5, k:'selfkit', tone:'light', e:'h3_e6', t:'h3_t6', p:t('h3_p6',{f:omr((S.catalog && S.catalog.self_fee) || 2)}), c:['h3_c6', u ? 'app/tests?c=selfkit' : 'tests?c=selfkit'] },
    { a:1, k:'kit', tone:'light', e:'h3_e2', t:'h3_t2', p:t('h3_p2',{k:pr('kids'), s:pr('seniors'), b:pr('bp_sugar')}), c:['h3_c2', u ? 'app/tests?c=packages' : 'tests'] },
    { a:7, k:'doctor', tone:'light', e:'h3_e8', t:'h3_t8', p:t('h3_p8'), c:['h3_c8', u ? 'app/consult' : 'consult'], c2:['m_dental', 'dental'] },
    { a:2, k:'phone', tone:'light', e:'h3_e3', t:'h3_t3', p:t('h3_p3'), c: u ? ['h3_c3', 'app/orders?r=1'] : ['h3_c3v', 'how'] },
    { a:6, k:'loyalty', tone:'light', e:'h3_e7', t:'h3_t7', p:t('h3_p7'), c:['h3_c7', u ? 'app/loyalty' : 'register'] },
    { a:3, k:'seniors', tone:'light', e:'h3_e4', t:'h3_t4', p:t('h3_p4'), c:['h3_c4', u ? 'app/tests?c=packages' : 'tests'] },
    { a:8, k:'company', tone:'light', e:'h3_e9', t:'h3_t9', p:t('h3_p9'), c:['h3_c9', 'expat'] },
    { a:4, k:'soon', tone:'light', e:'h3_e5', t:'h3_t5', p:t('h3_p5'), c:['h3_c5', u ? 'app/tests#soon' : 'tests#soon'] }
  ];
}
function heroHtml(compact){
  const sl = heroSlides(); const D = S.lang === 'ar' ? 'r' : 'd'; /* desktop pictures: 'r' has the scene on the left for Arabic */
  return `<section class="h3 ${compact ? 'compact' : ''}" id="h3" data-i="0"><div class="h3-bg"></div><div class="h3-imgs" aria-hidden="true">${sl.map((x, i) => { const a = i ? 'data-' : '', n = x.a; return `<picture class="h3-im ${i ? '' : 'on'}" data-a="${n}"><source media="(max-width:760px)" ${a}srcset="img/hero/h${n}m.webp?v=34" type="image/webp"><source ${a}srcset="img/hero/h${n}${D}.webp?v=34" type="image/webp"><source media="(max-width:760px)" ${a}srcset="img/hero/h${n}m.jpg?v=34"><img ${a}src="img/hero/h${n}${D}.jpg?v=34" alt="" ${i ? '' : 'fetchpriority="high"'} decoding="async"></picture>`; }).join('')}</div><canvas class="h3-c" aria-hidden="true"></canvas><div class="h3-scrim"></div>
    <div class="h3-in ${compact ? '' : 'wrap-w'}">${sl.map((x, i) => `<div class="h3-s ${x.tone} ${i ? '' : 'on'}" data-s="${i}" ${i ? 'aria-hidden="true"' : ''}><span class="h3-e">${t(x.e)}</span><h2>${t(x.t)}</h2><p>${esc(x.p)}</p>
      <div class="h3-cta"><a class="btn" href="#/${x.c[1]}">${t(x.c[0])} <span class="flip">${ic('arrow',18)}</span></a>${x.c2 ? `<a class="btn ghost" href="#/${x.c2[1]}">${t(x.c2[0])}</a>` : ''}</div></div>`).join('')}</div>
    <div class="h3-nav ${compact ? '' : 'wrap-w'}"><div class="h3-dots">${sl.map((_, i) => `<button class="${i ? '' : 'on'}" data-d="${i}" aria-label="${i + 1}"><i></i></button>`).join('')}</div>
      <div class="h3-arr"><button data-pv aria-label="${t('prev')}"><span class="flip">${ic('back',18)}</span></button><button data-nx aria-label="${t('next_s')}"><span class="flip">${ic('arrow',18)}</span></button></div></div></section>`;
}
let H3MOD = null;
function loadH3(){ if (!H3MOD) H3MOD = import('./hero3d.js?v=' + APP_V).catch(e => { H3MOD = null; throw e; }); return H3MOD; }
function liteMode(){ try { const nc = navigator.connection || {}; return /lite=1/.test(location.search) || (!/lite=0/.test(location.search) && (matchMedia('(max-width: 1024px)').matches || matchMedia('(pointer: coarse)').matches || (navigator.hardwareConcurrency || 8) < 6 || (navigator.deviceMemory || 8) < 4 || nc.saveData || matchMedia('(prefers-reduced-motion: reduce)').matches)); } catch(e) { return true; } }
function webglOk(){ try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch(e) { return false; } }
function bindHero(){
  const root = $('#h3'); if (!root) return; const n = $$('.h3-s', root).length; let i = 0, timer = null, paused = false;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; const DUR = 6500;
  let mod = null, vids = false; const asset = k => +($$('.h3-im', root)[k] || {}).dataset.a || 0;
  /* phones: the same 3D scenes as the computer, as short silent loops (only the visible one plays) */
  const playV = () => { if (!vids) return; $$('.h3-v', root).forEach((v, j) => { if (j === i) { if (!v.src) v.src = v.dataset.src; v.play().catch(() => {}); } else if (!v.paused) v.pause(); }); };
  /* banner pictures after the first are fetched only when needed (the next one a slide ahead) */
  const wake = k => { const pic = $$('.h3-im', root)[(k + n) % n]; if (!pic || pic._w) return; pic._w = true; $$('[data-srcset]', pic).forEach(x => { x.srcset = x.dataset.srcset; delete x.dataset.srcset; }); const im = $('img[data-src]', pic); if (im) { im.src = im.dataset.src; delete im.dataset.src; } };
  const go3 = k => { i = (k + n) % n; root.dataset.i = i; $$('.h3-s', root).forEach((s, j) => { s.classList.toggle('on', j === i); s.setAttribute('aria-hidden', j === i ? 'false' : 'true'); });
    $$('.h3-dots button', root).forEach((d, j) => { d.classList.toggle('on', j === i); d.classList.remove('run'); });
    /* restart the progress bar on the next frames instead of forcing a full-page layout (that caused a stutter at every slide change) */
    const dot = $$('.h3-dots button', root)[i]; if (dot && !reduce && !paused) requestAnimationFrame(() => requestAnimationFrame(() => dot.classList.add('run')));
    wake(i); wake(i + 1);
    $$('.h3-im', root).forEach((m, j) => m.classList.toggle('on', j === i)); playV();
    const cv = $('.h3-c', root); if (mod) { cv.classList.add('swap'); setTimeout(() => { mod.show(asset(i)); cv.classList.remove('swap'); }, 220); } };
  const arm = () => { clearInterval(timer); if (reduce) return; timer = setInterval(() => { if (!paused && !document.hidden) go3(i + 1); }, DUR); S.timers.push(timer); };
  $$('.h3-dots button', root).forEach(d => d.onclick = () => { go3(+d.dataset.d); arm(); });
  $('[data-pv]', root).onclick = () => { go3(i - 1); arm(); }; $('[data-nx]', root).onclick = () => { go3(i + 1); arm(); };
  root.addEventListener('mouseenter', () => { paused = true; $$('.h3-dots button.run', root).forEach(d => d.classList.add('hold')); });
  root.addEventListener('mouseleave', () => { paused = false; $$('.h3-dots button', root).forEach(d => d.classList.remove('hold')); });
  let x0 = null, y0 = null; root.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive:true });
  root.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) { const fwd = S.lang === 'ar' ? dx > 0 : dx < 0; go3(i + (fwd ? 1 : -1)); arm(); } x0 = null; }, { passive:true });
  go3(0);
  SPLASH.then(() => { if (!root.isConnected) return; go3(0); arm();
  if (liteMode() || !webglOk()) { root.classList.add('flat');
    const nc = navigator.connection || {};
    if (matchMedia('(max-width:760px)').matches && !reduce && !nc.saveData && !/2g/.test(nc.effectiveType || '')) { vids = true;
      $$('.h3-im', root).forEach((m, j) => { const v = document.createElement('video'); v.className = 'h3-v'; v.muted = true; v.loop = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('muted', ''); v.preload = 'none'; v.dataset.src = 'img/hero/clip' + (m.dataset.a || j) + '.mp4?v=' + APP_V; v.addEventListener('playing', () => v.classList.add('ok'), { once:true }); m.appendChild(v); });
      playV(); document.addEventListener('visibilitychange', () => { if (!root.isConnected) return; if (document.hidden) $$('.h3-v', root).forEach(v => v.pause()); else playV(); }); }
    return; }
  loadH3().then(m => m.init($('.h3-c', root)).then(() => { mod = m; m.show(asset(i)); root.classList.add('g3'); })).catch(e => { console.warn('3D off', e); root.classList.add('flat'); }); });
}
function quickTiles(){
  const u = !!S.user; const T = u ? 'app/tests' : 'tests';
  const tiles = [['flask','qt_book',T,'#1257d6','#eaf2ff'],['box','qt_pk',T + '?c=packages','#7a5af8','#efeaff'],['kid','qt_kids',T + '?c=kids','#f2a516','#fff4dc'],['heart','qt_seniors',T + '?c=packages','#e8466f','#fdeaf0'],
    ['steth','m_consult',u ? 'app/consult' : 'consult','#2563eb','#eaf2ff'],['tooth','m_dental','dental','#0ea5e9','#e0f4fd'],['ring','cat_premarital',T + '?c=premarital','#db2777','#fdeaf3'],['gauge','qt_bp',T + '?c=vitals','#0fae9b','#e3f7f4'],['file','qt_results',u ? 'app/orders?r=1' : 'login','#0d7c6c','#dff5ef'],['chat','qt_help','support','#0b2350','#e6ebf5']];
  return `<div class="qtiles">${tiles.map(([i, k, h, c, b], n) => `<a class="qt" href="#/${h}" style="--d:${n * 40}ms"><span class="qi" style="color:${c};background:${b}">${ic(i, 26, 2)}</span><span>${t(k)}</span></a>`).join('')}</div>`;
}
/* ---------- v32 home page: order journey, new-feature cards with small drawings, questions, closing call ---------- */
Object.assign(I18N.en, {
  jr_e:'Your order, step by step', jr_t:'From booking to your report', jr_p:'Every step is tracked in the app, so you always know where your sample is.',
  jr1:'Book on your phone', jr1d:'Pick tests, a time and your location.', jr2:'Nurse or kit at your door', jr2d:'A licensed male nurse for men, a female nurse for women and children, or a courier with a self-kit.',
  jr3:'2–8 °C cold chain', jr3d:'Every hand-over is logged with time and temperature.', jr4:'Accredited lab', jr4d:'Tested in a partner lab and checked before release.', jr5:'Report on your phone', jr5d:'Clear results with advice and a PDF.',
  ft_e:'New at iLab@home', ft_t:'More ways to look after your health', ft_kit:'Self-collection kits', ft_kitd:'No nurse needed: a courier brings the kit and takes it back.', ft_loy:'Stamp card', ft_loyd:'Every 5th home visit is free, and friends get 1.000 OMR off.',
  ft_doc:'Doctor online', ft_docd:'Video or voice, plus messages after the call.', ft_co:'Companies & workers', ft_cod:'Site visits and a simple fit / follow-up list.',
  ft_prv:'Your privacy', ft_prvd:'See who opened your report and download your data.', ft_cold:'Logged cold chain', ft_coldd:'Time and temperature for every hand-over.',
  fq_e:'Questions', fq_t:'Good to know before you book',
  fq1:'Who takes my sample?', fq1a:'A nurse licensed by the Ministry of Health: a male nurse for men, a female nurse for women and children. You see the name and licence in the app before the visit.',
  fq2:'When do my results come?', fq2a:'Our target is within 48 hours for most tests; a few take longer. You get a notification as soon as the report is published.',
  fq3:'Do I need to fast?', fq3a:'Some tests, such as fasting sugar and cholesterol, need 8–12 hours without food (water is fine). Each test says if it needs fasting, and those visits are booked in the morning.',
  fq4:'What is a self-collection kit?', fq4a:'A kit for tests such as urine, stool, a flu/COVID swab or an HPV self-swab. A courier brings it for {f} OMR, you collect the sample in private and the courier takes it to the lab.',
  fq5:'Is my data private?', fq5a:'We follow Oman’s Personal Data Protection Law (Royal Decree 6/2022): you can see who opened your report, download your data or ask us to delete it.',
  fq6:'How do I pay?', fq6a:'Electronically in the app, by card or Apple Pay.',
  fq7:'Can a doctor explain my results?', fq7a:'Yes. Book a video or voice call with a doctor or dentist. It is free when your results need attention.',
  cta_t:'Ready when you are', cta_p:'Book in two minutes and we come to you.', cta_b:'Book a test', cta_w:'WhatsApp us' });
Object.assign(I18N.ar, {
  jr_e:'طلبك خطوة بخطوة', jr_t:'من الحجز لين التقرير', jr_p:'كل خطوة تنسجّل في البرنامج، فتعرف دايماً وين عينتك.',
  jr1:'احجز من جوالك', jr1d:'اختر الفحوصات والوقت وموقعك.', jr2:'ممرض أو عُدّة عند بابك', jr2d:'ممرض مرخّص للرجال وممرضة مرخّصة للنساء والأطفال يسحبون العينة، أو مندوب يوصل لك عُدّة ذاتية.',
  jr3:'تبريد ٢–٨ °م', jr3d:'كل تسليم ينسجّل بالوقت والحرارة.', jr4:'مختبر معتمد', jr4d:'التحليل في مختبر شريك، ويتراجع قبل النشر.', jr5:'التقرير على جوالك', jr5d:'نتائج واضحة مع نصائح وملف PDF.',
  ft_e:'جديد آي لاب@هوم', ft_t:'طرق أكثر تهتم فيها بصحتك', ft_kit:'عُدد السحب الذاتي', ft_kitd:'بدون ممرض: المندوب يوصّل العُدّة ويرجّعها.', ft_loy:'بطاقة الأختام', ft_loyd:'كل زيارة خامسة مجاناً، وصديقك ياخذ خصم 1.000 ر.ع.',
  ft_doc:'طبيب أونلاين', ft_docd:'فيديو أو صوت، ورسائل بعد المكالمة.', ft_co:'الشركات والعمالة', ft_cod:'زيارات لموقع العمل وقائمة بسيطة: لائق أو متابعة.',
  ft_prv:'خصوصيتك', ft_prvd:'تشوف مين فتح تقريرك وتنزّل بياناتك.', ft_cold:'تبريد مسجّل', ft_coldd:'الوقت والحرارة لكل تسليم.',
  fq_e:'أسئلة', fq_t:'حلو تعرفها قبل الحجز',
  fq1:'منو ياخذ العينة؟', fq1a:'ممرض مرخّص من وزارة الصحة للرجال، وممرضة مرخّصة للنساء والأطفال، وتشوف الاسم والترخيص في البرنامج قبل الزيارة.',
  fq2:'متى توصل النتائج؟', fq2a:'هدفنا خلال 48 ساعة لأغلب الفحوصات، وبعضها ياخذ وقت أطول. يوصلك إشعار أول ما ينشر التقرير.',
  fq3:'لازم أصوم؟', fq3a:'بعض الفحوصات مثل السكر الصائم والدهون تحتاج صيام 8 إلى 12 ساعة (الماي مسموح). كل فحص مكتوب عنده إذا يحتاج صيام، ومواعيدها تكون الصبح.',
  fq4:'وش هي العُدّة الذاتية؟', fq4a:'عُدّة لفحوصات مثل البول والبراز ومسحة الإنفلونزا/كورونا ومسحة HPV الذاتية. يوصلها المندوب بـ {f} ر.ع، تاخذ العينة بخصوصية، والمندوب يوصلها للمختبر.',
  fq5:'بياناتي محمية؟', fq5a:'نتبع قانون حماية البيانات الشخصية العُماني (مرسوم سلطاني 6/2022): تشوف مين فتح تقريرك، وتقدر تنزّل بياناتك أو تطلب حذفها.',
  fq6:'كيف أدفع؟', fq6a:'إلكترونياً داخل البرنامج، بالبطاقة أو Apple Pay.',
  fq7:'أقدر أكلّم طبيب عن نتائجي؟', fq7a:'إيه، احجز مكالمة فيديو أو صوت مع طبيب أو طبيب أسنان، ومجاناً إذا نتائجك تحتاج متابعة.',
  cta_t:'جاهزين لك', cta_p:'احجز في دقيقتين، وإحنا نجيك.', cta_b:'احجز فحص', cta_w:'واتساب' });
const JR_PATH = 'M40 120 C 170 40, 260 170, 400 100 S 640 40, 760 100 S 900 150, 960 90';
function journeyBlock(){
  const st = [['cal','jr1'],['syringe','jr2'],['thermo','jr3'],['flask','jr4'],['file','jr5']];
  return `<section class="hm-sec jr hx-io" id="journey"><div class="wrap-w"><div class="section-h"><span class="eyebrow">${t('jr_e')}</span><h2>${t('jr_t')}</h2><p>${t('jr_p')}</p></div>
    <div class="jr-road"><svg viewBox="0 0 1000 170" class="jr-svg" aria-hidden="true"><defs><linearGradient id="jrg" x1="0" x2="1"><stop offset="0" stop-color="#1257d6"/><stop offset="1" stop-color="#0fae9b"/></linearGradient></defs>
      <path d="${JR_PATH}" fill="none" stroke="#e3e9f4" stroke-width="14" stroke-linecap="round"/><path class="fx-road" d="${JR_PATH}" fill="none" stroke="url(#jrg)" stroke-width="14" stroke-linecap="round" pathLength="100" style="stroke-dasharray:100 100"/>
      <path d="${JR_PATH}" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="10 12" opacity=".8"/>
      ${[0, .25, .5, .75, 1].map((f, i) => `<g class="jr-pin" data-f="${f}"><circle r="15" fill="#fff" stroke="#c9d6ea" stroke-width="3"/><text y="5" text-anchor="middle" font-size="14" font-weight="800" fill="#1257d6">${i + 1}</text></g>`).join('')}
      <g class="fx-van"><g transform="translate(-30,-40) scale(1.35)"><rect x="2" y="6" width="30" height="18" rx="4" fill="#1257d6"/><path d="M32 11h7l5 6v7H32z" fill="#2f7bff"/><rect x="6" y="10" width="9" height="6" rx="1.5" fill="#cfe0ff"/><path d="M19 11h6M22 8v6" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><circle cx="11" cy="25" r="4" fill="#0f1b33"/><circle cx="35" cy="25" r="4" fill="#0f1b33"/><circle cx="11" cy="25" r="1.6" fill="#fff"/><circle cx="35" cy="25" r="1.6" fill="#fff"/></g></g></svg></div>
    <div class="jr-steps">${st.map(([i, k], n) => `<div class="jr-st" data-n="${n}"><span class="qi">${ic(i, 24, 2)}</span><b>${t(k)}</b><span class="small muted">${t(k + 'd')}</span></div>`).join('')}</div>
    <div class="row wrap" style="justify-content:center;gap:10px;margin-top:20px"><a class="btn" href="#/new">${ic('play',18)} ${t('new_watch')}</a><a class="btn ghost" href="#/how">${ic('globe',18)} ${t('hm_how_more')}</a></div></div></section>`;
}
const FT_ART = {
  kit: `<ellipse cx="60" cy="82" rx="38" ry="5" fill="#0b2350" opacity=".08"/><g class="fa-rise"><rect x="53" y="20" width="12" height="36" rx="6" fill="#fff" stroke="#9fb3d6" stroke-width="2"/><rect x="52" y="15" width="14" height="9" rx="2.5" fill="#7a5af8"/><rect x="56" y="36" width="6" height="16" rx="3" fill="#18b5d8" opacity=".55"/></g><rect x="28" y="46" width="64" height="32" rx="7" fill="#fff" stroke="#c9d6ea" stroke-width="2"/><path d="M60 55v14M53 62h14" stroke="#18b5d8" stroke-width="3.4" stroke-linecap="round"/><g class="fa-lid"><rect x="25" y="39" width="70" height="10" rx="5" fill="#18b5d8"/></g>`,
  loy: `<defs><linearGradient id="fgl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2f7bff"/><stop offset="1" stop-color="#0b2350"/></linearGradient></defs><rect x="12" y="16" width="96" height="60" rx="11" fill="url(#fgl)"/><rect x="22" y="25" width="30" height="5" rx="2.5" fill="#fff" opacity=".7"/>${[0, 1, 2, 3, 4].map(i => `<circle cx="${26 + i * 17}" cy="56" r="6.5" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1.6"/>`).join('')}${[0, 1, 2, 3].map(i => `<g class="fa-st" style="--i:${i}"><circle cx="${26 + i * 17}" cy="56" r="6.5" fill="#fff"/><path d="M${22.5 + i * 17} 56l2.4 2.4 4.6-4.8" stroke="#1257d6" stroke-width="2" fill="none" stroke-linecap="round"/></g>`).join('')}<g class="fa-st" style="--i:4"><circle cx="94" cy="56" r="6.5" fill="#ffd166"/><path d="M94 51.5l1.4 2.9 3.2.4-2.3 2.2.6 3.1-2.9-1.5-2.9 1.5.6-3.1-2.3-2.2 3.2-.4z" fill="#b77a00"/></g>`,
  doc: `<rect x="20" y="14" width="66" height="46" rx="6" fill="#0b0f17"/><rect x="24" y="18" width="58" height="38" rx="3" fill="#dfe9ff"/><circle cx="53" cy="32" r="7" fill="#e9b48f"/><path d="M46 28a7 6 0 0 1 14 0z" fill="#2a2523"/><path d="M41 56c1-9 6-12 12-12s11 3 12 12z" fill="#fff"/><rect x="14" y="60" width="78" height="6" rx="3" fill="#c9d2de"/><g class="fa-b1"><rect x="66" y="8" width="44" height="18" rx="9" fill="#7a5af8"/><circle cx="78" cy="17" r="2" fill="#fff"/><circle cx="88" cy="17" r="2" fill="#fff"/><circle cx="98" cy="17" r="2" fill="#fff"/></g><g class="fa-b2"><rect x="62" y="66" width="48" height="18" rx="9" fill="#0fae9b"/><path d="M76 75l4 4 8-8" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/></g>`,
  co: `<rect x="10" y="30" width="44" height="46" rx="4" fill="#eef3fb" stroke="#c9d6ea" stroke-width="2"/>${[0, 1].map(r => [0, 1, 2].map(c => `<rect x="${16 + c * 13}" y="${38 + r * 16}" width="8" height="8" rx="1.5" fill="#2a4a7a"/>`).join('')).join('')}${[0, 1, 2].map(i => `<g transform="translate(${66 + i * 17},0)"><rect x="-6" y="52" width="12" height="24" rx="6" fill="${['#1e40af', '#0f766e', '#334155'][i]}"/><circle cy="45" r="6" fill="#c98d63"/><path d="M-6.5 44a6.5 6 0 0 1 13 0z" fill="#f2a516"/><g class="fa-ck" style="--i:${i}"><circle cy="28" r="7" fill="${i === 2 ? '#f2a516' : '#0fae9b'}"/>${i === 2 ? '<path d="M0 24v4.5M0 31.5v.2" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>' : '<path d="M-3 28l2 2 4-4.5" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>'}</g></g>`).join('')}`,
  prv: `<path d="M60 10l32 12v22c0 20-14 32-32 38-18-6-32-18-32-38V22z" fill="#eaf2ff" stroke="#1257d6" stroke-width="3"/><g class="fa-sh"><path d="M50 44v-7a10 10 0 0 1 20 0v7" fill="none" stroke="#0b2350" stroke-width="4" stroke-linecap="round"/></g><rect x="45" y="43" width="30" height="24" rx="5" fill="#0b2350"/><circle cx="60" cy="53" r="3.4" fill="#fff"/><path d="M60 55v6" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>`,
  cold: `<rect x="30" y="14" width="16" height="54" rx="8" fill="#fff" stroke="#9fb3d6" stroke-width="2.5"/><circle cx="38" cy="72" r="11" fill="#18b5d8"/><rect class="fa-liq" x="34" y="34" width="8" height="38" rx="4" fill="#18b5d8"/><path d="M50 30h8M50 42h8" stroke="#0fae9b" stroke-width="2.4" stroke-linecap="round"/><text x="62" y="40" font-size="11" font-weight="800" fill="#0fae9b">2–8°</text><g transform="translate(88 62)"><g class="fa-snow"><path d="M0-13v26M-11-6.5l22 13M-11 6.5l22-13" stroke="#18b5d8" stroke-width="2.6" stroke-linecap="round"/><circle r="3" fill="#18b5d8"/></g></g>`
};
function featBlock(){
  const u = !!S.user;
  const F = [['kit','ft_kit', u ? 'app/tests?c=selfkit' : 'tests?c=selfkit', '#e0f6fc'], ['loy','ft_loy', u ? 'app/loyalty' : 'register', '#eaf2ff'], ['doc','ft_doc', u ? 'app/consult' : 'consult', '#efeaff'],
    ['co','ft_co', 'expat', '#eef7e9'], ['prv','ft_prv', 'app/privacy', '#eaf2ff'], ['cold','ft_cold', 'how', '#e0f6fc']];
  return `<section class="hm-sec"><div class="wrap-w"><div class="section-h"><span class="eyebrow">${t('ft_e')}</span><h2>${t('ft_t')}</h2></div>
    <div class="ft-grid">${F.map(([k, l, h, bg]) => `<a class="ft-card hx-io" href="#/${h}"><span class="ft-art" style="background:${bg}"><svg viewBox="0 0 120 90" aria-hidden="true">${FT_ART[k]}</svg></span><b>${t(l)}</b><span class="small muted">${t(l + 'd')}</span></a>`).join('')}</div></div></section>`;
}
function faqBlock(){
  const f = omr((S.catalog && S.catalog.self_fee) || 2);
  return `<section class="hm-sec alt" id="faq"><div class="wrap-w"><div class="section-h"><span class="eyebrow">${t('fq_e')}</span><h2>${t('fq_t')}</h2></div>
    <div class="faq">${[1, 2, 3, 4, 5, 6, 7, 8].map(i => `<details class="fq"><summary><b>${t('fq' + i)}</b><span class="fq-i" aria-hidden="true">+</span></summary><p>${t('fq' + i + 'a', { f })}${i === 8 ? ` <a class="b" href="#/guarantee">${t('m_guarantee')}</a>` : ''}</p></details>`).join('')}</div></div></section>`;
}
function ctaBlock(){
  return `<section class="hm-sec"><div class="wrap-w"><div class="cta-band hx-io"><div class="cta-txt"><h2>${t('cta_t')}</h2><p>${t('cta_p')}</p><div class="row wrap" style="gap:10px"><a class="btn white" href="#/${S.user ? 'app/tests' : 'register'}">${ic('flask',18)} ${t('cta_b')}</a><a class="btn ghost-w" href="https://wa.me/${CONTACT.wa}" target="_blank" rel="noopener">${ic('chat',18)} ${t('cta_w')}</a></div></div>
    <div class="cta-art" aria-hidden="true"><svg viewBox="0 0 300 150"><path d="M0 128h300" stroke="rgba(255,255,255,.35)" stroke-width="3" stroke-dasharray="14 12" class="cta-road"/><g class="cta-house"><rect x="206" y="66" width="70" height="56" rx="4" fill="#f5efe2"/><path d="M198 70l43-30 43 30z" fill="#e2d3b5"/><rect x="232" y="92" width="18" height="30" rx="2" fill="#7a4a26"/><rect x="212" y="80" width="14" height="12" rx="2" fill="#2a4a7a"/><rect x="256" y="80" width="14" height="12" rx="2" fill="#2a4a7a"/></g>
      <g class="cta-van"><rect x="20" y="78" width="96" height="44" rx="10" fill="#fff"/><path d="M116 88h22l16 18v16h-38z" fill="#dbe7ff"/><rect x="122" y="92" width="16" height="12" rx="2" fill="#2a4a7a"/><rect x="30" y="88" width="34" height="18" rx="3" fill="#cfe0ff"/><path d="M84 92v18M75 101h18" stroke="#e2474f" stroke-width="5" stroke-linecap="round"/><circle cx="46" cy="124" r="10" fill="#0f1b33"/><circle cx="130" cy="124" r="10" fill="#0f1b33"/><circle cx="46" cy="124" r="4" fill="#c9d2de"/><circle cx="130" cy="124" r="4" fill="#c9d2de"/></g></svg></div></div></div></section>`;
}
/* everything here is visible from the start; the drawings only move once, when they reach the screen */
function bindHomeFx(root){
  const els = $$('.hx-io', root || app); if (!els.length) return;
  const jr = $('.jr', root || app); if (jr) rideJourney(jr, false, true);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const run = el => { el.classList.add('in'); if (el.classList.contains('jr')) rideJourney(el, reduce); };
  if (reduce || !('IntersectionObserver' in window)) { els.forEach(run); return; }
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { io.unobserve(e.target); run(e.target); } }), { threshold: .3 });
  els.forEach(el => io.observe(el));
}
function rideJourney(sec, reduce, still){
  const svg = $('.jr-svg', sec); if (!svg) return; const path = $('.fx-road', svg); let L = 0; try { L = path.getTotalLength(); } catch(e) { return; }
  $$('.jr-pin', svg).forEach(g => { const pt = path.getPointAtLength(L * +g.dataset.f); g.setAttribute('transform', `translate(${pt.x},${pt.y})`); });
  const steps = $$('.jr-st', sec), pins = $$('.jr-pin', svg); sec._set = null;
  const set = p => { placeVan(svg, p); path.style.strokeDasharray = `${(p * 100).toFixed(1)} 100`; const n = Math.floor(p * 4 + .02); steps.forEach((s, i) => s.classList.toggle('on', i <= n)); pins.forEach((g, i) => g.classList.toggle('on', i <= n)); };
  if (still) { set(0); return; }
  if (reduce) { set(1); return; }
  const D = 5200, t0 = performance.now(); const ease = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const step = now => { if (!sec.isConnected) return; const k = Math.min(1, (now - t0) / D); set(ease(k)); if (k < 1) requestAnimationFrame(step); };
  set(0); requestAnimationFrame(step);
}
async function viewLanding(){
  await loadCatalog().catch(() => null); const C = S.catalog;
  const steps = [['cal','hm_st1'],['syringe','hm_st2'],['file','hm_st3']];
  app.innerHTML = `${topbar()}${heroHtml(false)}
  <section class="hm-sec"><div class="wrap-w"><h2 class="hm-h">${t('hm_quick')}</h2>${quickTiles()}</div></section>
  ${C ? `<section class="hm-sec alt"><div class="wrap-w"><div class="row between"><h2 class="hm-h">${t('hm_pk')}</h2><a class="b small" href="#/tests">${t('view_all_tests')}</a></div><div class="hscroll" id="lp">${C.packages.map(p => pkgCard(p, S.cart.packages.includes(p.id))).join('')}</div></div></section>` : ''}
  ${featBlock()}
  ${journeyBlock()}
  <section class="hm-sec"><div class="wrap-w"><div class="band">
      <div><b>48 h</b><span>${t('band1')}</span></div><div><b>${omr(fee())}</b><span>${t('band2')} (${t('omr')})</span></div>
      <div><b data-count="${C ? C.wilayats.length : 7}">${C ? C.wilayats.length : 7}</b><span>${t('band3')}</span></div><div><b data-count="${C ? C.tests.length + C.packages.length : 30}">${C ? C.tests.length + C.packages.length : 30}</b><span>${t('band4')}</span></div></div></div></section>
  <section class="hm-sec alt"><div class="wrap-w">${soonBlock()}</div></section>
  <section class="hm-sec alt" id="whatsnew"><div class="wrap-w">${newBlock(true)}</div></section>
  ${faqBlock()}${ctaBlock()}
  <section class="hm-sec" id="contact"><div class="wrap-w">${contactCard(false)}</div></section>
  <section class="hm-sec alt"><div class="wrap-w"><div class="hm-app"><div class="grow"><h2>${t('hm_app_t')}</h2><p>${t('hm_app_p')}</p><div class="row wrap" style="gap:10px"><a class="btn" href="#/install">${ic('download',18)} ${t('ins_cta')}</a><a class="btn ghost" href="#/contact">${ic('phone',18)} ${t('m_contact')}</a></div></div><div class="hm-app-qr" id="hqr"></div></div></div></section>
  ${footer()}${cartBar()}`;
  bindHero(); bindHomeFx();
  const lp = $('#lp'); if (lp) { const rer = () => { lp.innerHTML = C.packages.map(p => pkgCard(p, S.cart.packages.includes(p.id))).join(''); bind(); refreshCartBadges(); const cb = $('.cart-bar'); const nb = cartBar(); if (cb) cb.outerHTML = nb || '<span></span>'; else if (nb) app.insertAdjacentHTML('beforeend', nb); bindGo(); };
    const bind = () => $$('[data-add]', lp).forEach(b => b.onclick = () => { const [ty, id] = b.dataset.add.split(':'); const was = S.cart.packages.includes(id); toggleCart(ty, id); rer(); if (!was) toastCart(); }); bind(); }
  try { if (window.LAHQR && $('#hqr')) $('#hqr').innerHTML = window.LAHQR.svg({ size: 132 }); } catch(e) {}
  const hash = location.hash.split('#')[2]; if (hash) setTimeout(() => { const el = document.getElementById(hash); if (el) el.scrollIntoView({ behavior:'smooth' }); }, 80);
}
/* opening splash: the iLab@home van drives in (once per session) */
let SPLASH = Promise.resolve();
async function splashIntro(){
  const force = /splash=1/.test(location.search), hold = /splashhold/.test(location.search);
  if (!force && (sessionStorage.getItem('lah_splash') || matchMedia('(prefers-reduced-motion: reduce)').matches || /^#\/(reset|verify)\//.test(location.hash) || navigator.webdriver)) return;
  let release; SPLASH = new Promise(r => release = r);
  sessionStorage.setItem('lah_splash', '1');
  const el = document.createElement('div'); el.id = 'splash'; el.innerHTML = `<canvas></canvas><div class="sp-brand"><span class="sp-logo">${A.logo}</span><span class="sp-wm">${A.wordmark}</span><small>${t('brand_sub')}</small></div><button class="sp-skip">${t('skip_intro')}</button>`;
  document.body.appendChild(el); document.body.classList.add('lock');
  let done = false; const end = () => { if (done) return; done = true; el.classList.add('out'); document.body.classList.remove('lock'); setTimeout(() => { el.remove(); release(); }, 450); };
  $('.sp-skip', el).onclick = end; el.addEventListener('click', e => { if (e.target === el) end(); });
  const lite = liteMode() || !webglOk();
  setTimeout(() => el.classList.add('brand'), lite ? 150 : 1500); if (!hold) setTimeout(end, lite ? 1500 : 3400);
  if (lite) { el.classList.add('flat'); return; }
  const race = Promise.race([loadH3(), new Promise((_, rj) => setTimeout(() => rj(new Error('slow')), 1800))]);
  race.then(m => { if (!done) { el.classList.add('g3'); return m.splash($('canvas', el), hold ? 1e9 : 3200); } }).catch(() => el.classList.add('flat'));
}

/* ================= v19: What's new (explainer video + changelog) ================= */
Object.assign(I18N.en, { ig_follow:'Follow us on Instagram', ig_scan:'Scan the code with your phone camera.', m_new:'What’s new', new_t:'What’s new in iLab@home', new_vid:'How iLab@home works, in one minute', new_sub:'English with Arabic subtitles', new_watch:'Watch the 1-minute video',
  nw18:'3D home screen', nw18d:'Rotating 3D banners, an opening intro with the iLab@home van, and quick service tiles.',
  nw17a:'Clear result levels', nw17ad:'Normal, needs review or urgent, with diet tips and what to do until the doctor replies.',
  nw17b:'Doctor’s advice', nw17bd:'A doctor reviews results that need attention and sends a plan to the patient.',
  nw17c:'Nearest hospital', nw17cd:'Hospitals and health centres in North Al Sharqiyah, with distance and directions.',
  nw17d:'New tests and packages', nw17dd:'Kids, seniors 60+, blood pressure & sugar, and 12 more tests.',
  nw17e:'Forgot password', nw17ed:'Reset your password from a link sent to your email.' });
Object.assign(I18N.ar, { ig_follow:'تابعنا على إنستغرام', ig_scan:'امسح الكود بكاميرا جوالك.', m_new:'حدث البرنامج', new_t:'الجديد في آي لاب@هوم', new_vid:'كيف يشتغل آي لاب@هوم في دقيقة', new_sub:'بالإنجليزي مع ترجمة عربية', new_watch:'شاهد الفيديو (دقيقة)',
  nw18:'واجهة رئيسية ثلاثية الأبعاد', nw18d:'بنرات ثلاثية الأبعاد تدور، ومقدمة افتتاحية بفان آي لاب@هوم، وأيقونات خدمات سريعة.',
  nw17a:'مستويات واضحة للنتائج', nw17ad:'طبيعي أو يحتاج مراجعة أو عاجل، مع نصائح غذائية وماذا تفعل لين يرد الطبيب.',
  nw17b:'توصية الطبيب', nw17bd:'طبيب يراجع النتائج اللي تحتاج متابعة ويرسل خطة للمريض.',
  nw17c:'أقرب مستشفى', nw17cd:'المستشفيات والمراكز الصحية في شمال الشرقية مع المسافة والاتجاهات.',
  nw17d:'فحوصات وباقات جديدة', nw17dd:'الأطفال، كبار السن +60، الضغط والسكر، و12 فحص إضافي.',
  nw17e:'نسيت كلمة المرور', nw17ed:'استعد كلمة المرور عبر رابط يوصلك على الإيميل.' });
const MEDIA = 'https://ufykiqxsegyuyablrjsq.supabase.co/storage/v1/object/public/media/';
const HOW_READY = true;
const NEWS = [['lock','nw34a','v34'],['shield','nw33a','v33'],['steth','nw33b','v33'],['heart','nw32a','v32'],['spark','nw32b','v32'],['video','nw32c','v32'],['check','nw32d','v32'],['steth','nw28a','v28'],['flask','nw28b','v28'],['ring','nw28c','v28'],['spark','nw28d','v28'],['phone','nw25','v25'],['users','nw25b','v25'],['spark','nw18','v18'],['check','nw17a','v17'],['steth','nw17b','v17'],['hosp','nw17c','v17'],['flask','nw17d','v17'],['lock','nw17e','v17']];
Object.assign(I18N.en, { nw34a:'Stronger protection for your data', nw34ad:'A full security review before launch: your requests, results and chats are visible only to you and the people caring for you, every partner is approved by our team, and the site blocks outside scripts.', nw33a:'Our sample guarantee', nw33ad:'If a sample is damaged or lost on our side, you never pay: a free home re-collection or a full refund, plus an apology gift.', nw33b:'The right nurse for every family member', nw33bd:'A male nurse visits men, a female nurse visits women and children under 12.',
  nw32a:'Meet Noor, your guide', nw32ad:'A small nurse on the home screen greets you, shares health tips and takes you where you need to go.',
  nw32b:'A new home page', nw32bd:'New banners for self-kits, the stamp card, doctor online and companies, your order journey step by step, and answers to common questions.',
  nw32c:'Three new films', nw32cd:'The idea of iLab@home, how to sign up and use the app, and a short film: a day with iLab@home.',
  nw32d:'Faster and smoother', nw32dd:'Every button checked on phone and computer. The doctor button after results and the More menu are fixed, and a slow screen never holds up the next one.' });
Object.assign(I18N.ar, { nw34a:'حماية أقوى لبياناتك', nw34ad:'مراجعة أمنية كاملة قبل الإطلاق: طلباتك ونتائجك ومحادثاتك ما يشوفها إلا أنت واللي يخدمونك، وكل شريك يعتمده فريقنا، والموقع يمنع أي سكربت خارجي.', nw33a:'ضمان العيّنة', nw33ad:'إذا تلفت العيّنة أو ضاعت بسببنا ما تدفع شي: إعادة سحب مجانية في البيت أو استرداد كامل، مع هدية اعتذار.', nw33b:'الممرض المناسب لكل فرد في العائلة', nw33bd:'الممرض يزور الرجال، والممرضة تزور النساء والأطفال تحت ١٢ سنة.',
  nw32a:'تعرّف على نور، مرشدتك', nw32ad:'ممرضة صغيرة في الصفحة الرئيسية تسلّم عليك، وتعطيك نصائح صحية، وتوديك للي تحتاجه.',
  nw32b:'صفحة رئيسية جديدة', nw32bd:'بنرات جديدة للعُدد الذاتية وبطاقة الأختام والطبيب أونلاين والشركات، ورحلة طلبك خطوة بخطوة، وأجوبة الأسئلة الشائعة.',
  nw32c:'ثلاث أفلام جديدة', nw32cd:'فكرة آي لاب@هوم، وطريقة التسجيل واستخدام البرنامج، وفلم قصير: يوم مع آي لاب@هوم.',
  nw32d:'أسرع وأسلس', nw32dd:'فحصنا كل زر على الجوال والكمبيوتر، وصلّحنا زر الطبيب بعد النتائج وقائمة المزيد، وما عادت صفحة بطيئة تأخّر اللي بعدها.' });
/* v32: three films, each with one job: the idea (story), how to sign up and use the app (how, real screens), a day with iLab@home (film) */
const VIDS = { story: ['media/iLabAtHome_Explainer.mp4', 'media/explainer_poster.jpg', 'new_vid3', 'new_sub3', '1:41'], how: ['media/iLabAtHome_Guide.mp4', 'media/guide_poster.jpg', 'vid_how', 'vid_how_s', '1:28'], film: ['media/iLabAtHome_Film.mp4', 'media/film_poster.jpg', 'vid_film', 'vid_film_s', '2:09'] };
Object.assign(I18N.en, { vid_how:'How to sign up and use the app', vid_how_s:'Real app screens, step by step · English voice, Arabic subtitles', vid_film:'A day with iLab@home (film)', vid_film_s:'From the first light to the report: male and female nurses, the lab, a dentist and a doctor online · Arabic subtitles',
  new_vid3:'The idea of iLab@home, in 100 seconds' });
Object.assign(I18N.ar, { vid_how:'طريقة التسجيل واستخدام البرنامج', vid_how_s:'شاشات البرنامج الحقيقية خطوة بخطوة · صوت إنجليزي مع ترجمة عربية', vid_film:'يوم مع آي لاب@هوم (فلم)', vid_film_s:'من أول الصبح لين التقرير: الممرض والممرضة والمختبر وطبيبة الأسنان والطبيب أونلاين · ترجمة عربية',
  new_vid3:'فكرة آي لاب@هوم في 100 ثانية' });
function vidCard(k){ const [src, poster, tt, st, dur] = VIDS[k]; return `<div class="card pad-lg vid-card"><div class="row between wrap" style="gap:8px;margin-bottom:12px"><div><h3 style="margin:0">${t(tt)}</h3><div class="small muted">${t(st)}</div></div><span class="chip teal">${ic('play',14)} ${dur}</span></div>
  <video class="vid" controls playsinline preload="none" poster="${poster}"><source src="${src}" type="video/mp4"></video></div>`; }
function newBlock(short){
  const items = short ? NEWS.slice(0, 4) : NEWS;
  return `<div class="stack-lg"><div class="row between wrap" style="gap:8px"><h2 class="hm-h" style="margin:0">${t('m_new')}</h2>${short ? `<a class="b small" href="#/new">${t('see_all')}</a>` : ''}</div>
    ${vidCard('film')}<div class="grid g2 collapse">${vidCard('story')}${HOW_READY ? vidCard('how') : ''}</div>
    <div class="stack" style="--g:10px">${items.map(([i, k, v]) => `<div class="card row" style="gap:14px;align-items:flex-start"><span class="qi" style="color:var(--blue);background:#eaf2ff;flex:none">${ic(i, 24, 2)}</span><div class="grow"><div class="row between"><b>${t(k)}</b><span class="chip gray">${v}</span></div><div class="small muted">${t(k + 'd')}</div></div></div>`).join('')}</div></div>`;
}
Object.assign(I18N.en, { new_vid:'How iLab@home works, and how to sign up', new_sub:'English narration with Arabic subtitles', new_vid2:'Meet the iLab@home family', new_sub2:'Eleven people, one journey · Arabic subtitles',
  nw25:'Faster on phones', nw25d:'A lighter home screen that loads instantly on any phone, with the latest news, Instagram code, email and phone right on the home page.',
  nw25b:'New team member', nw25bd:'Tasnim Al Hasani joins the iLab@home team.' });
Object.assign(I18N.ar, { new_vid:'كيف يشتغل آي لاب@هوم، وطريقة التسجيل', new_sub:'بالإنجليزي مع ترجمة عربية', new_vid2:'تعرّف على عائلة آي لاب@هوم', new_sub2:'إحدى عشر شخص ورحلة وحدة · ترجمة عربية',
  nw25:'أسرع على الجوال', nw25d:'واجهة رئيسية أخف تفتح فوراً على أي جوال، وفيها آخر التحديثات وكود الإنستغرام والبريد والرقم.',
  nw25b:'عضوة جديدة في الفريق', nw25bd:'انضمت تسنيم الحسني لفريق آي لاب@هوم.' });
async function viewNew(){
  const body = newBlock(false);
  app.innerHTML = S.user ? shell(t('m_new'), body) : `${topbar()}<section class="section" style="padding-top:28px"><div class="wrap-w" style="max-width:900px"><h1 style="margin-bottom:18px">${t('m_new')}</h1>${body}</div></section>${footer()}`;
  if (!S.user) bindGlobal();
}

/* ================= v28: doctor & dentist consultations, business model page ================= */
Object.assign(I18N.en, {
  e_TIMEOUT:'The connection is slow. Please try again.', e_SLOT_TAKEN:'That time was just taken. Please pick another.', e_BAD_DOCTOR:'Please choose a doctor.', e_NEED_NOTE:'Please write your advice first.',
  f_sL:'Slightly low', f_sH:'Slightly high', lv_mild_t:'Mostly normal', lv_mild_p:'One or more values are only slightly outside the normal range. This is common and not a disease. Follow the tips below and recheck at your next yearly check-up.',
  g_tips:'Simple tips', badge_new:'New', cat_premarital:'Premarital', cat_dental:'Dental',
  m_consult:'Doctor consult', m_consults:'Consultations', m_business:'Our business', m_dental:'Dental care',
  cs_t:'Talk to a doctor', cs_p:'A licensed doctor from home, before you book tests or after your results arrive. Choose a male or female doctor.',
  cs_pre:'Before testing', cs_pre_d:'Not sure which tests you need? A 15-minute call with a family doctor. The doctor adds the right tests to your cart.',
  cs_post:'After your results', cs_post_d:'Go through your report with a doctor. Free when your results need attention.',
  cs_dental:'Dentist online', cs_dental_d:'Tooth pain, a child’s teeth, braces questions. Show the dentist with your camera.',
  cs_dental_home:'Dental check at home', cs_dental_home_d:'A dentist visits: full check-up, cleaning advice and fluoride for children. Treatment is booked at a partner clinic if needed.',
  cs_free:'Free', cs_book:'Book', cs_book_t:'Book a consultation', cs_doctors:'Our doctors', cs_dentists:'Our dentists', cs_any:'Any', cs_female_dr:'Female doctor', cs_male_dr:'Male doctor',
  cs_s1:'Doctor', cs_s2:'How', cs_s3:'Time', cs_s4:'Details', cs_s5:'Confirm',
  cs_video:'Video call', cs_voice:'Voice call', cs_chat:'Chat (WhatsApp)', cs_home:'Home visit', cs_mode_d_video:'See the doctor face to face', cs_mode_d_voice:'Phone-style call, no camera', cs_mode_d_chat:'Write and send photos',
  cs_date:'Day', cs_time:'Time', cs_no_times:'No free times on this day. Try another day.', cs_reason:'What would you like to ask?', cs_reason_ph:'For example: always tired, want to check vitamins; or: my 6-year-old has a tooth ache…',
  cs_order:'Which results?', cs_pick_order:'Choose the report to discuss', cs_no_orders:'You have no completed reports yet.',
  cs_address:'Address for the home visit', cs_fee:'Consultation fee', cs_pay:'Pay {x} OMR & book', cs_confirm_free:'Book (free)',
  cs_booked_t:'Consultation booked', cs_booked_p:'{d} · {t}. You will get a reminder. Join from this page at the time.',
  cs_mine:'My consultations', cs_upcoming:'Upcoming', cs_past:'Past', cs_none:'No consultations yet.', cs_join:'Join the call', cs_join_soon:'The join button opens 10 minutes before', cs_wa:'Open WhatsApp chat',
  cs_st_booked:'Booked', cs_st_live:'Doctor is ready', cs_st_done:'Completed', cs_st_cancelled:'Cancelled', cs_cancel:'Cancel consultation', cs_cancel_q:'Cancel this consultation?',
  cs_advice:'Doctor’s advice', cs_suggested:'Suggested tests', cs_add_suggested:'Add suggested tests to cart', cs_added:'Added to your cart',
  cs_rate:'How was your consultation?', cs_q:'Consultation queue', cs_today:'Today', cs_start:'Start & join', cs_finish:'Finish & send advice', cs_note_ph:'Advice for the patient in simple words…',
  cs_pick_tests:'Suggest tests (optional)', cs_patient:'Patient', cs_reason_l:'Reason', cs_linked:'Linked report', cs_earn:'Earnings',
  cs_post_cta_t:'Questions about these results?', cs_post_cta_p:'Talk them through with a doctor by video or phone.', cs_post_cta:'Talk to a doctor',
  cs_free_note:'Free for you: your results need a doctor’s attention.', cs_privacy:'Private and confidential. Licensed doctors registered with OMSB (demo profiles).',
  cs_years:'{n} years', cs_reviews:'{n} consultations',
  dn_t:'Dental care at home', dn_p:'Online dentist advice and home dental check-ups for the whole family.', dn_note:'Fillings, root canals and extractions are done at a partner dental clinic; your home visit report goes with you.',
  bz_t:'iLab@home as a company', bz_p:'The idea, our goals, and exactly how every partner earns from each order. All money figures are planning numbers for the business plan.',
  bz_idea:'The idea', bz_idea_p:'People in North Al Sharqiyah drive 30–90 minutes and wait for hours for a simple blood test. iLab@home brings a licensed nurse to the home, a cold-chain courier carries the sample to an accredited partner lab, and the verified report arrives on the phone with clear advice and a doctor when needed.',
  bz_goals:'Our goals', bz_g1:'Year 1: 7 wilayats, 25 nurses, 400 home visits a month, break even by month 9.', bz_g2:'Year 2: all of Al Sharqiyah (North & South), 1,200 visits a month, 20 companies on wellness plans.', bz_g3:'Year 3: Muscat and Ad Dakhiliyah, home dental and vaccination services, 3,500 visits a month.', bz_g4:'Always: results in 24–48 h, 4.8★ rating, zero lost samples (2–8 °C cold chain).',
  bz_flow:'Where each rial goes', bz_flow_p:'Example order. Move the sliders to see the split.', bz_basket:'Tests in the order', bz_visit:'Home visit fee',
  bz_lab:'Partner laboratory', bz_lab_d:'65% of the test price (wholesale rate; the lab gets new patients without marketing).',
  bz_nurse:'Nurse', bz_nurse_d:'3.000 OMR per visit + level bonus up to 0.750 (Silver 0.250 · Gold 0.500 · Platinum 0.750).',
  bz_courier:'Logistics company', bz_courier_d:'1.000 OMR per sample delivered at 2–8 °C (batched routes).',
  bz_kit:'Kit & consumables', bz_kit_d:'Tubes, needles, labels and cold packs: about 0.500 OMR per visit.',
  bz_card:'Card fees', bz_card_d:'About 2.5% of the payment to the bank / payment gateway.',
  bz_us:'iLab@home', bz_us_d:'What stays with the company to pay salaries, the app, marketing and growth.',
  bz_doctor:'Doctors', bz_doctor_d:'75% of each 4.000 OMR consultation (3.000). Free results reviews are paid 2.000 by iLab@home.',
  bz_dentist:'Dentists', bz_dentist_d:'65% of the 12.000 OMR home dental check (7.800).',
  bz_company:'Companies (wellness)', bz_company_d:'Pay a package price per employee; nurses visit the workplace in one trip.',
  bz_month:'One month at this volume', bz_orders_day:'Home visits per day', bz_revenue:'Money collected', bz_partners:'Paid to partners', bz_gross:'iLab@home gross margin',
  bz_fixed:'Fixed monthly costs', bz_fixed_d:'Team (ops + customer service) 1,800 · App, SMS & hosting 150 · Marketing 600 · Insurance & licences 250 · Office & car 300',
  bz_profit:'Monthly profit', bz_loss:'Monthly loss', bz_breakeven:'Break-even: about {n} visits a month ({d} a day).',
  bz_nurse_calc:'A nurse’s month', bz_visits_day:'Visits per day', bz_days:'Working days', bz_level:'Level', bz_nurse_month:'Monthly income',
  bz_why:'Why partners join', bz_w_lab:'Labs: more samples with no extra staff; we deliver ready-labelled, cold samples.', bz_w_nurse:'Nurses: flexible extra income near home; choose your hours and wilayats.', bz_w_courier:'Logistics: steady daily routes with predictable volumes.', bz_w_doc:'Doctors: paid video consultations from home in the evening.',
  bz_rules:'Rules we follow', bz_r1:'Ministry of Health licensing for home health services and partner labs (ISO 15189 / CAP).', bz_r2:'Nurses and doctors registered with OMSB; nurse of the same gender as the patient.', bz_r3:'Personal Data Protection Law (Royal Decree 6/2022): data kept in secure servers, shared only with the people treating you.', bz_r4:'Cold chain 2–8 °C with temperature recorded at pickup; samples rejected and recollected free if out of range.',
  bz_note:'Planning figures for the business plan. Real contracts may differ.', bz_cta:'Become a partner'
});
Object.assign(I18N.ar, {
  e_TIMEOUT:'الاتصال بطيء. حاول مرة ثانية.', e_SLOT_TAKEN:'هذا الوقت انحجز الحين. اختر وقتاً ثانياً.', e_BAD_DOCTOR:'اختر الطبيب أولاً.', e_NEED_NOTE:'اكتب التوصية أولاً.',
  f_sL:'منخفض قليلاً', f_sH:'مرتفع قليلاً', lv_mild_t:'النتائج طبيعية في الغالب', lv_mild_p:'قيمة أو أكثر خارج المعدل الطبيعي بشكل بسيط فقط. هذا شائع وليس مرضاً. اتبع النصائح تحت وأعد الفحص في فحصك السنوي القادم.',
  g_tips:'نصائح بسيطة', badge_new:'جديد', cat_premarital:'ما قبل الزواج', cat_dental:'الأسنان',
  m_consult:'استشارة طبيب', m_consults:'الاستشارات', m_business:'نموذج الشركة', m_dental:'رعاية الأسنان',
  cs_t:'كلّم طبيب', cs_p:'طبيب مرخّص وأنت في بيتك، قبل ما تحجز الفحوصات أو بعد ما توصلك النتائج. تقدر تختار طبيب أو طبيبة.',
  cs_pre:'قبل الفحص', cs_pre_d:'مو متأكد أي فحوصات تحتاج؟ مكالمة 15 دقيقة مع طبيب أسرة، والطبيب يضيف الفحوصات المناسبة لسلتك.',
  cs_post:'بعد النتائج', cs_post_d:'راجع تقريرك مع طبيب. مجاناً إذا كانت نتائجك تحتاج متابعة.',
  cs_dental:'طبيب أسنان أونلاين', cs_dental_d:'ألم أسنان، أسنان الأطفال، أسئلة التقويم. وريه للطبيب بالكاميرا.',
  cs_dental_home:'فحص الأسنان في البيت', cs_dental_home_d:'طبيب أسنان يزورك: فحص كامل ونصائح التنظيف وفلورايد للأطفال. والعلاج يُحجز في عيادة شريكة إذا احتجت.',
  cs_free:'مجاناً', cs_book:'احجز', cs_book_t:'حجز استشارة', cs_doctors:'أطباؤنا', cs_dentists:'أطباء الأسنان', cs_any:'الكل', cs_female_dr:'طبيبة', cs_male_dr:'طبيب',
  cs_s1:'الطبيب', cs_s2:'الطريقة', cs_s3:'الوقت', cs_s4:'التفاصيل', cs_s5:'التأكيد',
  cs_video:'مكالمة فيديو', cs_voice:'مكالمة صوتية', cs_chat:'محادثة (واتساب)', cs_home:'زيارة منزلية', cs_mode_d_video:'شوف الطبيب وجهاً لوجه', cs_mode_d_voice:'مكالمة مثل الهاتف بدون كاميرا', cs_mode_d_chat:'اكتب وأرسل صور',
  cs_date:'اليوم', cs_time:'الوقت', cs_no_times:'ما في أوقات متاحة في هذا اليوم. جرّب يوماً ثانياً.', cs_reason:'وش تحب تسأل؟', cs_reason_ph:'مثلاً: تعبان دائماً وأبي أفحص الفيتامينات؛ أو: ولدي عمره 6 سنوات عنده ألم في ضرسه…',
  cs_order:'أي نتائج؟', cs_pick_order:'اختر التقرير اللي تبي تناقشه', cs_no_orders:'ما عندك تقارير مكتملة إلى الآن.',
  cs_address:'العنوان للزيارة المنزلية', cs_fee:'رسوم الاستشارة', cs_pay:'ادفع {x} ر.ع واحجز', cs_confirm_free:'احجز (مجاناً)',
  cs_booked_t:'تم حجز الاستشارة', cs_booked_p:'{d} · {t}. بيوصلك تذكير، وادخل للمكالمة من هذي الصفحة في الموعد.',
  cs_mine:'استشاراتي', cs_upcoming:'القادمة', cs_past:'السابقة', cs_none:'ما عندك استشارات إلى الآن.', cs_join:'ادخل المكالمة', cs_join_soon:'زر الدخول يفتح قبل الموعد بـ 10 دقائق', cs_wa:'افتح محادثة واتساب',
  cs_st_booked:'محجوزة', cs_st_live:'الطبيب جاهز', cs_st_done:'مكتملة', cs_st_cancelled:'ملغاة', cs_cancel:'إلغاء الاستشارة', cs_cancel_q:'تبي تلغي هذي الاستشارة؟',
  cs_advice:'توصية الطبيب', cs_suggested:'الفحوصات المقترحة', cs_add_suggested:'أضف الفحوصات المقترحة للسلة', cs_added:'انضافت لسلتك',
  cs_rate:'كيف كانت الاستشارة؟', cs_q:'قائمة الاستشارات', cs_today:'اليوم', cs_start:'ابدأ وادخل', cs_finish:'إنهاء وإرسال التوصية', cs_note_ph:'توصية للمريض بكلام بسيط…',
  cs_pick_tests:'اقترح فحوصات (اختياري)', cs_patient:'المريض', cs_reason_l:'السبب', cs_linked:'التقرير المرتبط', cs_earn:'الأرباح',
  cs_post_cta_t:'عندك أسئلة عن النتائج؟', cs_post_cta_p:'ناقشها مع طبيب بالفيديو أو الهاتف.', cs_post_cta:'كلّم طبيب',
  cs_free_note:'مجاناً لك: نتائجك تحتاج متابعة طبيب.', cs_privacy:'خاصة وسرية. أطباء مرخّصون ومسجلون في المجلس الطبي العماني (ملفات تجريبية).',
  cs_years:'{n} سنة خبرة', cs_reviews:'{n} استشارة',
  dn_t:'رعاية الأسنان في البيت', dn_p:'استشارة طبيب أسنان أونلاين وفحص أسنان منزلي لكل العائلة.', dn_note:'الحشوات وعلاج العصب والخلع تتم في عيادة أسنان شريكة، وتقرير الزيارة المنزلية يروح معك.',
  bz_t:'آي لاب@هوم كشركة', bz_p:'الفكرة وأهدافنا، وبالضبط كم يربح كل شريك من كل طلب. كل الأرقام المالية أرقام تخطيطية لخطة العمل.',
  bz_idea:'الفكرة', bz_idea_p:'أهل شمال الشرقية يسوقون 30–90 دقيقة وينتظرون ساعات عشان فحص دم بسيط. آي لاب@هوم يوصّل ممرض مرخّص للبيت، وشركة نقل مبرّد توصل العينة لمختبر شريك معتمد، والتقرير المعتمد يوصل على الجوال مع نصائح واضحة وطبيب عند الحاجة.',
  bz_goals:'أهدافنا', bz_g1:'السنة الأولى: 7 ولايات، 25 ممرض، 400 زيارة منزلية بالشهر، ونغطي التكاليف بحلول الشهر التاسع.', bz_g2:'السنة الثانية: كل محافظتي الشرقية (شمال وجنوب)، 1,200 زيارة بالشهر، و20 شركة في برامج صحة الموظفين.', bz_g3:'السنة الثالثة: مسقط والداخلية، وخدمات الأسنان والتطعيمات في البيت، 3,500 زيارة بالشهر.', bz_g4:'دائماً: النتائج خلال 24–48 ساعة، تقييم 4.8★، وصفر عينات ضايعة (تبريد 2–8 درجات).',
  bz_flow:'وين يروح كل ريال', bz_flow_p:'طلب كمثال. حرّك المؤشرات وشوف التقسيم.', bz_basket:'قيمة الفحوصات في الطلب', bz_visit:'رسوم الزيارة المنزلية',
  bz_lab:'المختبر الشريك', bz_lab_d:'65% من سعر الفحص (سعر الجملة؛ المختبر يحصل مرضى جدد بدون تسويق).',
  bz_nurse:'الممرض', bz_nurse_d:'3.000 ر.ع لكل زيارة + مكافأة مستوى لين 0.750 (فضي 0.250 · ذهبي 0.500 · بلاتيني 0.750).',
  bz_courier:'شركة النقل', bz_courier_d:'1.000 ر.ع لكل عينة توصل بتبريد 2–8 درجات (مسارات مجمّعة).',
  bz_kit:'الحقيبة والمستلزمات', bz_kit_d:'أنابيب وإبر وملصقات وأكياس تبريد: حوالي 0.500 ر.ع للزيارة.',
  bz_card:'رسوم البطاقة', bz_card_d:'حوالي 2.5% من المبلغ للبنك / بوابة الدفع.',
  bz_us:'آي لاب@هوم', bz_us_d:'اللي يبقى للشركة عشان الرواتب والتطبيق والتسويق والتوسع.',
  bz_doctor:'الأطباء', bz_doctor_d:'75% من كل استشارة بـ 4.000 ر.ع (3.000). ومراجعة النتائج المجانية يدفع للطبيب عنها آي لاب@هوم 2.000.',
  bz_dentist:'أطباء الأسنان', bz_dentist_d:'65% من فحص الأسنان المنزلي بـ 12.000 ر.ع (7.800).',
  bz_company:'الشركات (صحة الموظفين)', bz_company_d:'تدفع سعر باقة لكل موظف، والممرضين يزورون مقر العمل في رحلة وحدة.',
  bz_month:'شهر كامل بهذا الحجم', bz_orders_day:'زيارات منزلية باليوم', bz_revenue:'المبالغ المحصّلة', bz_partners:'المدفوع للشركاء', bz_gross:'هامش آي لاب@هوم الإجمالي',
  bz_fixed:'التكاليف الثابتة بالشهر', bz_fixed_d:'الفريق (العمليات + خدمة العملاء) 1,800 · التطبيق والرسائل والاستضافة 150 · التسويق 600 · التأمين والتراخيص 250 · المكتب والسيارة 300',
  bz_profit:'الربح الشهري', bz_loss:'الخسارة الشهرية', bz_breakeven:'نقطة التعادل: حوالي {n} زيارة بالشهر ({d} باليوم).',
  bz_nurse_calc:'شهر الممرض', bz_visits_day:'زيارات باليوم', bz_days:'أيام العمل', bz_level:'المستوى', bz_nurse_month:'الدخل الشهري',
  bz_why:'ليش ينضم الشركاء', bz_w_lab:'المختبرات: عينات أكثر بدون موظفين إضافيين؛ نوصلها مبردة وجاهزة بالملصقات.', bz_w_nurse:'الممرضين: دخل إضافي مرن قريب من البيت؛ اختار ساعاتك وولاياتك.', bz_w_courier:'شركات النقل: مسارات يومية ثابتة وكميات متوقعة.', bz_w_doc:'الأطباء: استشارات فيديو مدفوعة من البيت في المساء.',
  bz_rules:'القوانين اللي نلتزم فيها', bz_r1:'ترخيص وزارة الصحة لخدمات الرعاية المنزلية والمختبرات الشريكة (ISO 15189 / CAP).', bz_r2:'الممرضين والأطباء مسجلين في المجلس الطبي العماني؛ والممرض من نفس جنس المريض.', bz_r3:'قانون حماية البيانات الشخصية (المرسوم السلطاني 6/2022): البيانات في خوادم آمنة ولا تُشارك إلا مع اللي يعالجونك.', bz_r4:'سلسلة تبريد 2–8 درجات مع تسجيل الحرارة عند الاستلام؛ والعينة تُرفض وتُعاد مجاناً إذا خرجت عن المدى.',
  bz_note:'أرقام تخطيطية لخطة العمل، والعقود الفعلية قد تختلف.', bz_cta:'انضم كشريك'
});

Object.assign(I18N.en, { per_visit:'Per visit', pay_split_t:'Who was paid', pay_split_p:'From collected visits (planning rates: lab 65% of tests, courier 1.000, kit 0.500, card 2.5%).', pay_consults:'Consultation income', pay_margin:'iLab@home margin' });
Object.assign(I18N.ar, { per_visit:'لكل زيارة', pay_split_t:'لمن دفعنا', pay_split_p:'من الزيارات المجمّعة (أسعار تخطيطية: المختبر 65% من الفحوصات، النقل 1.000، الحقيبة 0.500، البطاقة 2.5%).', pay_consults:'دخل الاستشارات', pay_margin:'هامش آي لاب@هوم' });
Object.assign(I18N.en, { soon_dna1:'Couple DNA carrier test', soon_dna1d:'One cheek swab each checks 300+ inherited conditions (thalassaemia, sickle cell, SMA…) before marriage or pregnancy, with a genetic counsellor.',
  soon_dna2:'NIPT – baby DNA in pregnancy', soon_dna2d:'From the mother’s blood at 10+ weeks: screens for Down syndrome and other chromosome changes. No risk to the baby.',
  soon_dna3:'DNA & medicines', soon_dna3d:'Pharmacogenomics: how your genes handle common medicines (blood thinners, painkillers, antidepressants).',
  soon_dna4:'Newborn & family genetic panels', soon_dna4d:'Confirm thalassaemia or sickle cell genes in the family with a DNA test sent to an accredited reference lab.',
  soon_dent:'Teeth cleaning at home', soon_dentd:'Scaling and polishing by a dental hygienist with portable equipment.' });
Object.assign(I18N.ar, { soon_dna1:'فحص الجينات للمقبلين على الزواج', soon_dna1d:'مسحة من الخد لكل طرف تكشف أكثر من 300 مرض وراثي (الثلاسيميا، المنجلية، ضمور العضلات…) قبل الزواج أو الحمل، مع مستشار وراثي.',
  soon_dna2:'فحص NIPT – الحمض النووي للجنين', soon_dna2d:'من دم الأم بعد الأسبوع العاشر: يكشف متلازمة داون وتغيّرات الكروموسومات. بدون أي خطر على الجنين.',
  soon_dna3:'الجينات والأدوية', soon_dna3d:'كيف تتعامل جيناتك مع الأدوية الشائعة (مميعات الدم، المسكنات، مضادات الاكتئاب).',
  soon_dna4:'فحوصات وراثية للمواليد والعائلة', soon_dna4d:'تأكيد جينات الثلاسيميا أو المنجلية في العائلة بفحص DNA يُرسل لمختبر مرجعي معتمد.',
  soon_dent:'تنظيف الأسنان في البيت', soon_dentd:'تنظيف وتلميع على يد أخصائي صحة فم بأجهزة متنقلة.' });
Object.assign(I18N.en, { 
  nw28a:'Doctor & dentist consultations', nw28ad:'Video or voice calls with a male or female doctor before your tests or after your results, plus online and home dentists.',
  nw28b:'Results read like a real lab', nw28bd:'Separate ranges for women and children, “slightly outside” values stay normal with tips, and only true emergencies are marked urgent.',
  nw28c:'Premarital screening', nw28cd:'The Ministry of Health premarital tests at home, fully confidential. DNA tests are coming soon.',
  nw28d:'New team members', nw28dd:'Rahaf Al Wardi and Alzahraa Al Busaidi join the iLab@home team as nurses.' });
Object.assign(I18N.ar, { 
  nw28a:'استشارات الأطباء وأطباء الأسنان', nw28ad:'مكالمة فيديو أو صوت مع طبيب أو طبيبة قبل الفحص أو بعد النتائج، وطبيب أسنان أونلاين وفي البيت.',
  nw28b:'قراءة نتائج مثل المختبر الحقيقي', nw28bd:'معدلات خاصة للنساء والأطفال، والقيم الخارجة بشكل بسيط تبقى طبيعية مع نصائح، وما يُعتبر عاجلاً إلا الطوارئ الحقيقية.',
  nw28c:'فحص ما قبل الزواج', nw28cd:'فحوصات برنامج وزارة الصحة لما قبل الزواج في بيتك وبسرية تامة. وفحوصات الجينات قريباً.',
  nw28d:'أعضاء جدد في الفريق', nw28dd:'انضمت رهف الوردي والزهراء البوسعيدي لفريق آي لاب@هوم كممرضات.' });
Object.assign(I18N.en, { specialty:'Specialty', sp_family:'Family medicine', sp_internal:'Internal medicine', sp_peds:'Paediatrics', sp_dent:'Dentistry',
  cs_vcall:'Video call', cs_acall:'Voice call', cs_call_tip:'The call opens in a new tab (Jitsi Meet). Allow the camera / microphone when asked.', cs_chat_t:'Messages', cs_chat_empty:'No messages yet. Write to your doctor here.', cs_chat_ph:'Write a message…', send:'Send' });
Object.assign(I18N.ar, { specialty:'التخصص', sp_family:'طب الأسرة', sp_internal:'الطب الباطني', sp_peds:'طب الأطفال', sp_dent:'طب الأسنان',
  cs_vcall:'مكالمة فيديو', cs_acall:'مكالمة صوتية', cs_call_tip:'المكالمة تفتح في صفحة جديدة (Jitsi Meet). اسمح بالكاميرا أو المايك لما يطلب.', cs_chat_t:'الرسائل', cs_chat_empty:'ما في رسائل إلى الآن. اكتب لطبيبك هنا.', cs_chat_ph:'اكتب رسالة…', send:'إرسال' });
Object.assign(I18N.en, {
  new_vid3:'iLab@home in 100 seconds (new)', new_sub3:'Everything new: home visits, self-test kits, online doctor, loyalty card and more · English voice, Arabic subtitles',
  mg_services:'Services', mg_account:'My account', m_more:'More', m_selfkit:'Self-test kits', m_expat:'Workers & companies', m_loyalty:'Loyalty card', m_privacy:'Privacy & my data', m_sources:'Sources & references', m_camps:'Camp visits', m_safety:'Safety & privacy', m_coupons:'Offers & coupons',
  cat_selfkit:'Self-kits (no nurse)', cat_expat:'Workers', col_self:'No nurse needed', col_device:'Measured at home', col_nurse:'Nurse visit',
  kit_fee:'Kit delivery & pickup', kit_mode_t:'No nurse needed for this order', kit_mode_p:'A courier brings the kit, you take the sample yourself with the simple steps, and the courier takes it back to the lab.', b2_kit:'Kit',
  coupon:'Discount code', coupon_ph:'e.g. WELCOME10', coupon_ok:'Code applied: −{x} OMR', d_stamp:'Loyalty card: free visit', d_coupon:'Discount code', d_ref:'Friend’s invite', free_visit_t:'This is your 5th order: the visit is free 🎉', free_visit_p:'Thank you for staying with iLab@home.',
  ram_slots:'Ramadan nights', booked_free:'Your loyalty card made this visit free.',
  e_BAD_COUPON:'This code is not valid.', e_COUPON_EXPIRED:'This code has expired.', e_COUPON_FULL:'This code has been fully used.', e_COUPON_USED:'You already used this code.', e_COUPON_FIRST:'This code is for the first order only.', e_COUPON_MIN:'Your order is below the minimum for this code.',
  e_BAD_REF:'This invite code is not valid.', e_REF_DONE:'You already used an invite code.', e_REF_LATE:'Invite codes work before your first order only.', e_CODE_MISMATCH:'The code does not match this sample.', e_LINK_EXPIRED:'This link has expired or was stopped by the patient.', e_ALREADY_OPEN:'You already have an open request of this kind.', e_NEED_CONSENT:'Please confirm the workers agreed.', e_TOO_MANY:'Too many links today. Try tomorrow.',
  st_k_assigned:'Courier assigned', st_k_on_the_way:'Kit on the way', st_k_arrived:'Kit delivered: take your sample', st_k_collected:'Sample ready for pickup',
  kit_accept:'Accept kit delivery', kit_start:'Start: kit on the way', kit_deliver:'Kit delivered', self_t:'Take your sample now', self_p:'Follow the card inside the kit. Wash your hands, fill the container to the line, close it well and stick the name label.', self_ck:'I labelled the container with my name and date', self_btn:'I took my sample', self_ok:'Thank you. The courier will pick it up soon.',
  chain_t:'Sample journey (cold chain)', chain_p:'Every hand-over is recorded with the time and the box temperature (2–8 °C).', chain_check:'Log a temperature check', chain_code:'Scan or type the sample code', chain_temp:'Box temperature (°C)', chain_note:'Note (optional)', chain_saved:'Check saved', chain_age:'{d} since collection', chain_old:'Over 4 hours since collection: tell the lab.',
  step_collected:'Collected', step_pickup:'Picked up', step_check:'Temperature check', step_handover:'Handed to the lab', step_lab_received:'Received by the lab',
  sos_btn:'SOS', sos_hold:'Hold 2 seconds to send an emergency alert', sos_sent:'Alert sent to operations with your location.', inc_btn:'Report an incident', inc_t:'Incident report', inc_kind:'What happened?', inc_needle:'Needle-stick injury', inc_faint:'Patient fainted', inc_sample:'Sample problem', inc_safety:'Safety at the address', inc_vehicle:'Vehicle / road', inc_other:'Other', inc_note:'Describe briefly', inc_sent:'Report sent. Operations will contact you.',
  wise_ok_t:'All clear, alhamdulillah 🌿', wise_care_t:'A gentle reminder', wise_more:'Another one', share_doc:'Share with my doctor', share_t:'Private link for your doctor', share_p:'Anyone with this link can see this report until it expires. You can stop it any time from Privacy.', share_hours:'Link works for', share_make:'Create link', share_copy:'Copy link', share_copied:'Link copied', share_until:'Works until {d}',
  trends_t:'Your numbers over time', trends_p:'From your past reports with iLab@home.', sources_hint:'Where our health information comes from', src_link:'Sources',
  loy_t:'Your loyalty card', loy_p:'Every order adds a stamp. The 5th home visit is free.', loy_next:'{n} more to your free visit', loy_free_now:'Your next order: free home visit 🎉', loy_hist:'Your stamps', loy_how:'How it works', loy_how_p:'1 order = 1 stamp. Fill 5 stamps and the home-visit fee of that order is on us. Sponsored check-ups don’t count.', loy_free:'Free visit',
  ref_t:'Invite a friend', ref_p:'Your friend gets {x} OMR off the first order, and you get a bonus stamp when their result is ready.', ref_code:'Your invite code', ref_share:'Share code', ref_have:'Have a friend’s code?', ref_apply:'Use code', ref_ok:'Invite code saved: {x} OMR off your first order.', ref_count:'{n} friends joined with your code', ref_msg:'Book a home lab test with iLab@home and get {x} OMR off with my code: {c}',
  pv_t:'Privacy & your data', pv_p:'Your health data is protected under Oman’s Personal Data Protection Law (Royal Decree 6/2022). You decide.', pv_consent:'You agreed to the privacy terms on {d}.', pv_views:'Who opened your reports', pv_views_p:'Lab, doctor and shared-link views of your finished reports.', pv_none:'No one else has opened your reports yet.', pv_shares:'Your shared links', pv_stop:'Stop link', pv_stopped:'Stopped', pv_exp:'Download my data', pv_exp_p:'A file with your profile, orders, results and consultations.', pv_del:'Ask to delete my account', pv_del_p:'We delete what the law allows. Lab reports may have to be kept for the period health rules require; we will tell you what stays.', pv_fix:'Ask to correct my data', pv_req_t:'Your requests', pv_req_ok:'Request sent. We reply within 7 days.', pv_note:'Tell us more (optional)', pv_idle:'For safety, staff accounts sign out after 30 minutes without use.', role_share:'Shared link', role_lab:'Laboratory', role_doctor:'Doctor', role_admin:'iLab@home operations',
  src_t:'Sources & references', src_p:'The medical ranges, screening advice, rules and texts we use, with links. Partner-lab ranges take priority over general ones.',
  ex_t:'Medical checks for workers and companies', ex_p:'Know early, before the official residency medical. For companies, households and individuals across North Al Sharqiyah.', ex_note_t:'Important', ex_note:'The official residency (visa) medical certificate is issued through the Ministry of Health system (e-health portal or Sanad offices) at approved centres. iLab@home does not issue it. Our checks help you know early and avoid surprises.', ex_off_t:'The official steps (as published)', ex_off_1:'Register the medical fitness exam through the MOH e-health portal or a Sanad office.', ex_off_2:'Typical tests: HIV, hepatitis B and C, syphilis, blood count, urine, stool and a physical exam. Latent TB screening was added; a positive result leads to a chest X-ray.', ex_off_3:'Rules change: always check the latest list with the Ministry of Health.', ex_co_t:'Companies: camp visit', ex_co_p:'Send the workers list, choose the date and the package. A team of nurses visits the camp. You see fit / needs follow-up for each worker, never their medical details.', ex_home_t:'Households: domestic worker check', ex_home_p:'A female nurse visits your home for your domestic worker’s yearly check.', ex_req:'Request a camp visit', ex_login_co:'Sign in as a company',
  camp_t:'Camp visit requests', camp_new:'New camp visit', camp_site:'Camp / site address', camp_date:'Preferred date', camp_pkg:'Package', camp_workers:'Workers list', camp_workers_p:'One worker per line: name, ID or passport number, gender (M/F), nationality. You can paste from Excel or choose a CSV file.', camp_csv:'Choose CSV file', camp_consent:'Each worker agreed to the check and to sharing the fit / follow-up result with the company.', camp_send:'Send request', camp_sent:'Request sent. Our team will confirm the date.', camp_n:'{n} workers', r_fit:'Fit', r_unfit:'Needs follow-up', r_retest:'Retest', r_pending:'Pending', cs_requested:'Requested', cs_scheduled:'Scheduled', cs_visited:'Visited', cs_completed:'Completed', cs2_cancelled:'Cancelled',
  adm_sos:'SOS alerts', adm_inc:'Incident reports', adm_pv:'Privacy requests', adm_resolve:'Resolve', adm_close:'Close', adm_done:'Done', adm_reject:'Reject', adm_reply:'Reply to the user', adm_camps:'Camp visits', adm_coupons:'Discount codes', cp_code:'Code', cp_kind:'Type', cp_pct:'% off tests', cp_fixed:'OMR off', cp_value:'Value', cp_max:'Max uses', cp_min:'Minimum order (OMR)', cp_first:'First order only', cp_exp:'Expires', cp_save:'Save code', cp_used:'{a} / {b} used', nothing:'Nothing here.',
  ram_t:'Ramadan Kareem 🌙', ram_p:'Night visits after Iftar are open during Ramadan.', wa_book:'Book on WhatsApp', wa_txt:'Hello iLab@home, I would like to book a home test.', offline_t:'You are offline: showing your last saved copy.', idle_out:'Signed out after 30 minutes without use.',
  hm_loy:'Loyalty card', hm_selfkit_t:'New: self-test kits', hm_selfkit_p:'Urine, stool and swabs without a nurse visit. Delivery from {x} OMR.', hm_expat_t:'Workers & domestic staff', hm_expat_p:'Pre-checks and yearly checks at home or at the camp.'
});
Object.assign(I18N.ar, {
  new_vid3:'آي لاب@هوم في 100 ثانية (جديد)', new_sub3:'كل الجديد: الزيارة المنزلية، عُدد الفحص الذاتي، الطبيب أونلاين، بطاقة الولاء وأكثر · صوت إنجليزي مع ترجمة عربية',
  mg_services:'الخدمات', mg_account:'حسابي', m_more:'المزيد', m_selfkit:'عُدد الفحص الذاتي', m_expat:'العمالة والشركات', m_loyalty:'بطاقة الولاء', m_privacy:'الخصوصية وبياناتي', m_sources:'المصادر والمراجع', m_camps:'زيارات سكن العمال', m_safety:'السلامة والخصوصية', m_coupons:'العروض والكوبونات',
  cat_selfkit:'فحوصات ذاتية (بدون ممرض)', cat_expat:'العمالة', col_self:'بدون ممرض', col_device:'قياس في البيت', col_nurse:'زيارة ممرض',
  kit_fee:'توصيل واستلام العدة', kit_mode_t:'هذا الطلب ما يحتاج ممرض', kit_mode_p:'المندوب يوصل لك العدة، تاخذ العينة بنفسك بخطوات بسيطة، والمندوب يرجع ياخذها للمختبر.', b2_kit:'العدة',
  coupon:'كود الخصم', coupon_ph:'مثلاً WELCOME10', coupon_ok:'تم تطبيق الكود: −{x} ر.ع', d_stamp:'بطاقة الولاء: زيارة مجانية', d_coupon:'كود الخصم', d_ref:'دعوة صديق', free_visit_t:'هذا طلبك الخامس: الزيارة مجانية 🎉', free_visit_p:'شكراً لأنك معنا في آي لاب@هوم.',
  ram_slots:'ليالي رمضان', booked_free:'بطاقة الولاء خلت هذي الزيارة مجانية.',
  e_BAD_COUPON:'هذا الكود غير صالح.', e_COUPON_EXPIRED:'انتهت صلاحية هذا الكود.', e_COUPON_FULL:'هذا الكود انتهى عدد استخدامه.', e_COUPON_USED:'استخدمت هذا الكود من قبل.', e_COUPON_FIRST:'هذا الكود لأول طلب فقط.', e_COUPON_MIN:'طلبك أقل من الحد الأدنى لهذا الكود.',
  e_BAD_REF:'كود الدعوة غير صالح.', e_REF_DONE:'استخدمت كود دعوة من قبل.', e_REF_LATE:'كود الدعوة يشتغل قبل أول طلب فقط.', e_CODE_MISMATCH:'الكود ما يطابق هذي العينة.', e_LINK_EXPIRED:'انتهى هذا الرابط أو أوقفه المريض.', e_ALREADY_OPEN:'عندك طلب مفتوح من نفس النوع.', e_NEED_CONSENT:'أكد إن العمال موافقين.', e_TOO_MANY:'روابط كثيرة اليوم. جرّب بكرة.',
  st_k_assigned:'تم تعيين المندوب', st_k_on_the_way:'العدة في الطريق', st_k_arrived:'وصلت العدة: خذ العينة', st_k_collected:'العينة جاهزة للاستلام',
  kit_accept:'قبول توصيل العدة', kit_start:'ابدأ: العدة في الطريق', kit_deliver:'تم توصيل العدة', self_t:'خذ عينتك الحين', self_p:'اتبع البطاقة اللي داخل العدة. اغسل يدك، عبّ العلبة لين الخط، سكّرها زين، وألصق ملصق الاسم.', self_ck:'كتبت اسمي والتاريخ على العلبة', self_btn:'أخذت العينة', self_ok:'شكراً لك. المندوب بيمر ياخذها قريب.',
  chain_t:'رحلة العينة (السلسلة الباردة)', chain_p:'كل تسليم يتسجل بالوقت وحرارة الصندوق (2–8 °م).', chain_check:'سجّل فحص حرارة', chain_code:'امسح أو اكتب كود العينة', chain_temp:'حرارة الصندوق (°م)', chain_note:'ملاحظة (اختياري)', chain_saved:'تم حفظ الفحص', chain_age:'{d} من وقت السحب', chain_old:'مرّت أكثر من 4 ساعات من السحب: بلّغ المختبر.',
  step_collected:'تم السحب', step_pickup:'استلمها المندوب', step_check:'فحص حرارة', step_handover:'تسليم للمختبر', step_lab_received:'استلمها المختبر',
  sos_btn:'نجدة', sos_hold:'اضغط مطولاً ثانيتين لإرسال تنبيه طوارئ', sos_sent:'تم إرسال التنبيه للعمليات مع موقعك.', inc_btn:'بلّغ عن حادث', inc_t:'بلاغ حادث', inc_kind:'ويش صار؟', inc_needle:'وخزة إبرة', inc_faint:'المريض أغمي عليه', inc_sample:'مشكلة في العينة', inc_safety:'خطر في الموقع', inc_vehicle:'السيارة / الطريق', inc_other:'غير ذلك', inc_note:'اوصف باختصار', inc_sent:'تم إرسال البلاغ. العمليات بتتواصل معك.',
  wise_ok_t:'كل شي طيب، الحمد لله 🌿', wise_care_t:'تذكير لطيف', wise_more:'غيرها', share_doc:'شارك مع طبيبي', share_t:'رابط خاص لطبيبك', share_p:'أي شخص عنده الرابط يقدر يشوف هذا التقرير لين تنتهي مدته. تقدر توقفه أي وقت من صفحة الخصوصية.', share_hours:'مدة الرابط', share_make:'سوّ الرابط', share_copy:'نسخ الرابط', share_copied:'تم نسخ الرابط', share_until:'يشتغل لين {d}',
  trends_t:'أرقامك مع الوقت', trends_p:'من تقاريرك السابقة في آي لاب@هوم.', sources_hint:'من وين معلوماتنا الصحية', src_link:'المصادر',
  loy_t:'بطاقة الولاء', loy_p:'كل طلب يضيف ختم. الزيارة المنزلية الخامسة مجانية.', loy_next:'باقي {n} للزيارة المجانية', loy_free_now:'طلبك الجاي: زيارة منزلية مجانية 🎉', loy_hist:'أختامك', loy_how:'كيف تشتغل', loy_how_p:'كل طلب = ختم. لما تكمل 5 أختام، رسوم الزيارة في ذاك الطلب علينا. الفحوصات المدفوعة من الشركات ما تنحسب.', loy_free:'زيارة مجانية',
  ref_t:'ادعُ صديق', ref_p:'صديقك ياخذ خصم {x} ر.ع على أول طلب، وأنت تاخذ ختم إضافي لما تطلع نتيجته.', ref_code:'كود دعوتك', ref_share:'شارك الكود', ref_have:'عندك كود من صديق؟', ref_apply:'استخدم الكود', ref_ok:'تم حفظ كود الدعوة: خصم {x} ر.ع على أول طلب.', ref_count:'{n} أصدقاء انضموا بكودك', ref_msg:'احجز فحص في البيت مع آي لاب@هوم وخذ خصم {x} ر.ع بكودي: {c}',
  pv_t:'الخصوصية وبياناتك', pv_p:'بياناتك الصحية محمية حسب قانون حماية البيانات الشخصية العماني (المرسوم السلطاني 6/2022). القرار لك.', pv_consent:'وافقت على شروط الخصوصية بتاريخ {d}.', pv_views:'مين فتح تقاريرك', pv_views_p:'فتح التقارير المكتملة من المختبر أو الطبيب أو رابط المشاركة.', pv_none:'ما أحد غيرك فتح تقاريرك للحين.', pv_shares:'روابطك المشتركة', pv_stop:'أوقف الرابط', pv_stopped:'متوقف', pv_exp:'نزّل بياناتي', pv_exp_p:'ملف فيه حسابك وطلباتك ونتائجك واستشاراتك.', pv_del:'اطلب حذف حسابي', pv_del_p:'نحذف اللي يسمح فيه القانون. تقارير المختبر ممكن لازم تنحفظ للمدة اللي تطلبها الأنظمة الصحية، وبنخبرك ويش يبقى.', pv_fix:'اطلب تصحيح بياناتي', pv_req_t:'طلباتك', pv_req_ok:'تم إرسال الطلب. نرد خلال 7 أيام.', pv_note:'خبرنا أكثر (اختياري)', pv_idle:'للأمان، حسابات الموظفين تطلع تلقائياً بعد 30 دقيقة بدون استخدام.', role_share:'رابط مشترك', role_lab:'المختبر', role_doctor:'الطبيب', role_admin:'عمليات آي لاب@هوم',
  src_t:'المصادر والمراجع', src_p:'النطاقات الطبية ونصائح الكشف المبكر والأنظمة والنصوص اللي نستخدمها، مع الروابط. نطاقات المختبر الشريك لها الأولوية على النطاقات العامة.',
  ex_t:'فحوصات العمالة والشركات', ex_p:'اعرف مبكراً قبل فحص الإقامة الرسمي. للشركات والأسر والأفراد في شمال الشرقية.', ex_note_t:'مهم', ex_note:'شهادة اللياقة الطبية الرسمية للإقامة تصدر عن طريق نظام وزارة الصحة (البوابة الإلكترونية أو مكاتب سند) في المراكز المعتمدة. آي لاب@هوم ما يصدرها. فحوصاتنا تساعدك تعرف مبكراً وتتفادى المفاجآت.', ex_off_t:'الخطوات الرسمية (حسب المنشور)', ex_off_1:'سجّل فحص اللياقة الطبية عن طريق بوابة وزارة الصحة الإلكترونية أو مكتب سند.', ex_off_2:'الفحوصات المعتادة: الإيدز، التهاب الكبد B وC، الزهري، صورة الدم، البول، البراز وفحص جسدي. وانضاف فحص السل الكامن، واللي نتيجته إيجابية يسوي أشعة صدر.', ex_off_3:'الأنظمة تتغير: تأكد دائماً من آخر قائمة عند وزارة الصحة.', ex_co_t:'الشركات: زيارة سكن العمال', ex_co_p:'أرسل قائمة العمال واختر التاريخ والباقة. فريق ممرضين يزور السكن. تشوف "لائق" أو "يحتاج متابعة" لكل عامل، وما تشوف تفاصيله الطبية أبداً.', ex_home_t:'الأسر: فحص العاملة المنزلية', ex_home_p:'ممرضة تزورك في البيت للفحص السنوي للعاملة المنزلية.', ex_req:'اطلب زيارة سكن', ex_login_co:'سجّل دخول كشركة',
  camp_t:'طلبات زيارة سكن العمال', camp_new:'زيارة سكن جديدة', camp_site:'عنوان السكن / الموقع', camp_date:'التاريخ المفضل', camp_pkg:'الباقة', camp_workers:'قائمة العمال', camp_workers_p:'كل عامل في سطر: الاسم، رقم البطاقة أو الجواز، الجنس (M/F)، الجنسية. تقدر تلصق من Excel أو تختار ملف CSV.', camp_csv:'اختر ملف CSV', camp_consent:'كل عامل وافق على الفحص وعلى مشاركة نتيجة "لائق / يحتاج متابعة" مع الشركة.', camp_send:'أرسل الطلب', camp_sent:'تم إرسال الطلب. فريقنا بيأكد التاريخ.', camp_n:'{n} عامل', r_fit:'لائق', r_unfit:'يحتاج متابعة', r_retest:'إعادة فحص', r_pending:'بانتظار النتيجة', cs_requested:'مطلوب', cs_scheduled:'تم تحديد الموعد', cs_visited:'تمت الزيارة', cs_completed:'مكتمل', cs2_cancelled:'ملغي',
  adm_sos:'تنبيهات النجدة', adm_inc:'بلاغات الحوادث', adm_pv:'طلبات الخصوصية', adm_resolve:'تم الحل', adm_close:'إغلاق', adm_done:'تم', adm_reject:'رفض', adm_reply:'الرد على المستخدم', adm_camps:'زيارات السكن', adm_coupons:'أكواد الخصم', cp_code:'الكود', cp_kind:'النوع', cp_pct:'% من الفحوصات', cp_fixed:'ر.ع خصم', cp_value:'القيمة', cp_max:'أقصى عدد استخدام', cp_min:'أقل مبلغ للطلب (ر.ع)', cp_first:'لأول طلب فقط', cp_exp:'ينتهي', cp_save:'احفظ الكود', cp_used:'{a} / {b} مستخدم', nothing:'ما في شي هنا.',
  ram_t:'رمضان كريم 🌙', ram_p:'الزيارات الليلية بعد الإفطار متاحة طول رمضان.', wa_book:'احجز بالواتساب', wa_txt:'مرحبا آي لاب@هوم، أبغى أحجز فحص في البيت.', offline_t:'أنت بدون نت: نعرض آخر نسخة محفوظة.', idle_out:'تم تسجيل الخروج بعد 30 دقيقة بدون استخدام.',
  hm_loy:'بطاقة الولاء', hm_selfkit_t:'جديد: عُدد الفحص الذاتي', hm_selfkit_p:'بول وبراز ومسحات بدون زيارة ممرض. التوصيل من {x} ر.ع.', hm_expat_t:'العمالة والعاملات المنزليات', hm_expat_p:'فحوصات مبدئية وسنوية في البيت أو في السكن.'
});
/* words of comfort and wisdom shown with results (Quran, hadith and proverbs, with their source) */
const WISE_OK = [
  { ar:'نِعْمَتَانِ مَغْبُونٌ فِيهِمَا كَثِيرٌ مِنَ النَّاسِ: الصِّحَّةُ وَالْفَرَاغُ', sa:'حديث شريف · رواه البخاري', en:'“Two blessings many people lose out on: health and free time.”', se:'Hadith · Sahih al-Bukhari' },
  { ar:'مَنْ أَصْبَحَ مِنْكُمْ آمِنًا فِي سِرْبِهِ، مُعَافًى فِي جَسَدِهِ، عِنْدَهُ قُوتُ يَوْمِهِ، فَكَأَنَّمَا حِيزَتْ لَهُ الدُّنْيَا', sa:'حديث شريف · رواه الترمذي', en:'“Whoever wakes up safe at home, healthy in body, with food for the day, it is as if the whole world were his.”', se:'Hadith · at-Tirmidhi' },
  { ar:'وَكُلُوا وَاشْرَبُوا وَلَا تُسْرِفُوا', sa:'سورة الأعراف · الآية 31', en:'“Eat and drink, but do not be excessive.”', se:'Qur’an 7:31' },
  { ar:'إِنَّ لِجَسَدِكَ عَلَيْكَ حَقًّا', sa:'حديث شريف · رواه البخاري', en:'“Your body has a right over you.”', se:'Hadith · Sahih al-Bukhari' },
  { ar:'سَلُوا اللَّهَ الْعَفْوَ وَالْعَافِيَةَ، فَإِنَّ أَحَدًا لَمْ يُعْطَ بَعْدَ الْيَقِينِ خَيْرًا مِنَ الْعَافِيَةِ', sa:'حديث شريف · رواه الترمذي وأحمد', en:'“Ask Allah for pardon and well-being: after certainty of faith, no one is given anything better than well-being.”', se:'Hadith · at-Tirmidhi, Ahmad' },
  { ar:'الصحة تاج على رؤوس الأصحاء، لا يراه إلا المرضى', sa:'حكمة', en:'“Health is a crown on the heads of the healthy that only the sick can see.”', se:'Proverb' },
  { ar:'صحتك أغلى ما تملك، فحافظ عليها', sa:'حكمة', en:'Your health is the richest thing you own: look after it.', se:'Wisdom' },
  { ar:'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ', sa:'سورة الفاتحة · الآية 2', en:'“All praise is for Allah, Lord of the worlds.”', se:'Qur’an 1:2' },
  { ar:'لَئِن شَكَرْتُمْ لَأَزِيدَنَّكُمْ', sa:'سورة إبراهيم · الآية 7', en:'“If you are grateful, I will surely give you more.”', se:'Qur’an 14:7' },
  { ar:'وَإِن تَعُدُّوا نِعْمَةَ اللَّهِ لَا تُحْصُوهَا', sa:'سورة إبراهيم · الآية 34', en:'“If you tried to count Allah’s blessings, you could never number them.”', se:'Qur’an 14:34' },
  { ar:'فَاذْكُرُونِي أَذْكُرْكُمْ وَاشْكُرُوا لِي وَلَا تَكْفُرُونِ', sa:'سورة البقرة · الآية 152', en:'“Remember Me and I will remember you; be grateful to Me.”', se:'Qur’an 2:152' },
  { ar:'وَأَمَّا بِنِعْمَةِ رَبِّكَ فَحَدِّثْ', sa:'سورة الضحى · الآية 11', en:'“And speak of the blessings of your Lord.”', se:'Qur’an 93:11' },
  { ar:'وَقَلِيلٌ مِّنْ عِبَادِيَ الشَّكُورُ', sa:'سورة سبأ · الآية 13', en:'“Few of My servants are truly grateful.”', se:'Qur’an 34:13' },
  { ar:'وَمَن يَشْكُرْ فَإِنَّمَا يَشْكُرُ لِنَفْسِهِ', sa:'سورة لقمان · الآية 12', en:'“Whoever is grateful is grateful for his own good.”', se:'Qur’an 31:12' },
  { ar:'أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ', sa:'سورة الرعد · الآية 28', en:'“Surely, in the remembrance of Allah hearts find rest.”', se:'Qur’an 13:28' },
  { ar:'وَآخِرُ دَعْوَاهُمْ أَنِ الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ', sa:'سورة يونس · الآية 10', en:'“And their final prayer: all praise is for Allah, Lord of the worlds.”', se:'Qur’an 10:10' },
  { ar:'الطُّهُورُ شَطْرُ الْإِيمَانِ، وَالْحَمْدُ لِلَّهِ تَمْلَأُ الْمِيزَانَ', sa:'حديث شريف · رواه مسلم', en:'“Purity is half of faith, and ‘al-hamdu lillah’ fills the scale.”', se:'Hadith · Sahih Muslim' },
  { ar:'إِنَّ اللَّهَ لَيَرْضَى عَنِ الْعَبْدِ أَنْ يَأْكُلَ الْأَكْلَةَ فَيَحْمَدَهُ عَلَيْهَا، أَوْ يَشْرَبَ الشَّرْبَةَ فَيَحْمَدَهُ عَلَيْهَا', sa:'حديث شريف · رواه مسلم', en:'“Allah is pleased with a servant who eats a meal and praises Him for it, or drinks a drink and praises Him for it.”', se:'Hadith · Sahih Muslim' },
  { ar:'مَنْ لَا يَشْكُرُ النَّاسَ لَا يَشْكُرُ اللَّهَ', sa:'حديث شريف · رواه أبو داود والترمذي', en:'“Whoever does not thank people does not thank Allah.”', se:'Hadith · Abu Dawud, at-Tirmidhi' },
  { ar:'الْمُؤْمِنُ الْقَوِيُّ خَيْرٌ وَأَحَبُّ إِلَى اللَّهِ مِنَ الْمُؤْمِنِ الضَّعِيفِ، وَفِي كُلٍّ خَيْرٌ', sa:'حديث شريف · رواه مسلم', en:'“The strong believer is better and more beloved to Allah than the weak believer, and in both there is good.”', se:'Hadith · Sahih Muslim' },
  { ar:'اغْتَنِمْ خَمْسًا قَبْلَ خَمْسٍ … وَصِحَّتَكَ قَبْلَ سَقَمِكَ', sa:'حديث شريف · رواه الحاكم', en:'“Take advantage of five before five… your health before your illness.”', se:'Hadith · al-Hakim' },
  { ar:'مَا مَلَأَ آدَمِيٌّ وِعَاءً شَرًّا مِنْ بَطْنٍ', sa:'حديث شريف · رواه الترمذي', en:'“No human fills a vessel worse than his stomach.”', se:'Hadith · at-Tirmidhi' },
  { ar:'الشكر قَيْدُ النِّعَم', sa:'قول مأثور', en:'Gratitude is what keeps blessings with you.', se:'Saying' },
  { ar:'العقل السليم في الجسم السليم', sa:'حكمة', en:'A sound mind lives in a sound body.', se:'Proverb' },
  { ar:'درهم وقاية خير من قنطار علاج', sa:'مثل عربي', en:'An ounce of prevention is worth a pound of cure.', se:'Arabic proverb' },
  { ar:'الحمد لله على نعمة العافية، فهي تاج لا يُرى إلا بالشكر', sa:'حكمة', en:'Praise Allah for good health: a crown best seen through gratitude.', se:'Wisdom' }
];
const WISE_CARE = [
  { ar:'وَإِذَا مَرِضْتُ فَهُوَ يَشْفِينِ', sa:'سورة الشعراء · الآية 80', en:'“And when I am ill, it is He who cures me.”', se:'Qur’an 26:80' },
  { ar:'مَا أَنْزَلَ اللَّهُ دَاءً إِلَّا أَنْزَلَ لَهُ شِفَاءً', sa:'حديث شريف · رواه البخاري', en:'“Allah has not sent down a disease without sending down a cure for it.”', se:'Hadith · Sahih al-Bukhari' },
  { ar:'الوقاية خير من العلاج، والاكتشاف المبكر نصف العلاج', sa:'حكمة', en:'Prevention is better than cure, and finding it early is half the cure.', se:'Wisdom' },
  { ar:'فَإِنَّ مَعَ الْعُسْرِ يُسْرًا', sa:'سورة الشرح · الآية 5', en:'“Truly, with hardship comes ease.”', se:'Qur’an 94:5' },
  { ar:'وَبَشِّرِ الصَّابِرِينَ', sa:'سورة البقرة · الآية 155', en:'“And give good news to those who are patient.”', se:'Qur’an 2:155' },
  { ar:'وَلَا تَيْأَسُوا مِن رَّوْحِ اللَّهِ', sa:'سورة يوسف · الآية 87', en:'“Never lose hope in the mercy of Allah.”', se:'Qur’an 12:87' },
  { ar:'وَنُنَزِّلُ مِنَ الْقُرْآنِ مَا هُوَ شِفَاءٌ وَرَحْمَةٌ لِّلْمُؤْمِنِينَ', sa:'سورة الإسراء · الآية 82', en:'“We send down in the Qur’an what is healing and mercy for the believers.”', se:'Qur’an 17:82' },
  { ar:'حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ', sa:'سورة آل عمران · الآية 173', en:'“Allah is sufficient for us, and He is the best guardian.”', se:'Qur’an 3:173' },
  { ar:'لِكُلِّ دَاءٍ دَوَاءٌ، فَإِذَا أُصِيبَ دَوَاءُ الدَّاءِ بَرَأَ بِإِذْنِ اللَّهِ', sa:'حديث شريف · رواه مسلم', en:'“For every disease there is a cure; when the right cure is found, it heals by Allah’s permission.”', se:'Hadith · Sahih Muslim' },
  { ar:'عَجَبًا لِأَمْرِ الْمُؤْمِنِ، إِنَّ أَمْرَهُ كُلَّهُ خَيْرٌ … إِنْ أَصَابَتْهُ سَرَّاءُ شَكَرَ فَكَانَ خَيْرًا لَهُ، وَإِنْ أَصَابَتْهُ ضَرَّاءُ صَبَرَ فَكَانَ خَيْرًا لَهُ', sa:'حديث شريف · رواه مسلم', en:'“How wonderful is the affair of the believer: all of it is good… in good times he is grateful, in hard times he is patient, and both are good for him.”', se:'Hadith · Sahih Muslim' },
  { ar:'مَا يُصِيبُ الْمُسْلِمَ مِنْ نَصَبٍ وَلَا وَصَبٍ … إِلَّا كَفَّرَ اللَّهُ بِهَا مِنْ خَطَايَاهُ', sa:'حديث شريف · رواه البخاري', en:'“No tiredness or illness befalls a Muslim… but Allah removes some of his sins by it.”', se:'Hadith · Sahih al-Bukhari' },
  { ar:'اللَّهُمَّ رَبَّ النَّاسِ، أَذْهِبِ الْبَأْسَ، اشْفِ أَنْتَ الشَّافِي، لَا شِفَاءَ إِلَّا شِفَاؤُكَ، شِفَاءً لَا يُغَادِرُ سَقَمًا', sa:'دعاء نبوي · رواه البخاري ومسلم', en:'“O Allah, Lord of people, remove the harm and heal; You are the Healer, there is no healing but Yours, a healing that leaves no illness.”', se:'Prophetic supplication · al-Bukhari, Muslim' },
  { ar:'الصبر مفتاح الفرج', sa:'مثل عربي', en:'Patience is the key to relief.', se:'Arabic proverb' }
];
/* the business numbers are only for the team leader's account and the demo admin */
function canBiz(){ return !!(S.user && S.user.role === 'admin'); }
/* money rules (fallbacks match the database settings) */
let BIZ = null;
const BIZ0 = { home_fee:5, nurse_fee:3, courier_fee:1, kit_cost:0.5, lab_share:0.65, pay_fee_pct:0.025, nurse_bonus:[0,0.25,0.5,0.75], consult_fee:4, consult_post_fee:3, consult_doctor_share:0.75, dental_home_fee:12, dental_home_share:0.65,
  consult_slots:['16:00','16:20','16:40','17:00','17:20','17:40','18:00','18:20','18:40','19:00','19:20','19:40','20:00','20:20','20:40'] };
async function bizLoad(){ if (BIZ) return BIZ; try { const r = await API.business(); BIZ = Object.assign({}, BIZ0); for (const k in r || {}) BIZ[k] = typeof BIZ0[k] === 'number' ? Number(r[k]) : r[k]; } catch(e) { BIZ = Object.assign({}, BIZ0); } return BIZ; }
function splitOrder(basket, B){ const total = basket + B.home_fee; const lab = basket * B.lab_share, nurse = B.nurse_fee, courier = B.courier_fee, kit = B.kit_cost, card = total * B.pay_fee_pct;
  return { total, lab, nurse, courier, kit, card, us: total - lab - nurse - courier - kit - card }; }

/* doctor portrait (drawn, no photos) */
function docArt(g, size){ const s = size || 64; const f = g === 'female';
  return `<svg viewBox="0 0 64 64" width="${s}" height="${s}" aria-hidden="true" class="doc-art"><circle cx="32" cy="32" r="32" fill="${f ? '#fdeaf3' : '#e6efff'}"/>
  <path d="M10 64c2-14 11-20 22-20s20 6 22 20z" fill="#fff"/><path d="M26 44l6 10 6-10" fill="${f ? '#db2777' : '#2563eb'}" opacity=".85"/>
  <path d="M20 47c-3 4-3 9 1 11M44 47c3 4 3 9-1 11" stroke="#0d1628" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="43" cy="58" r="2.4" fill="#0d1628"/>
  ${f ? '<path d="M15 34c0-12 8-20 17-20s17 8 17 20c0 6-2 10-5 12H20c-3-2-5-6-5-12z" fill="#0d1628"/>' : ''}
  <circle cx="32" cy="30" r="11" fill="#e8b48f"/>${f ? '<path d="M21 28c1-8 6-12 11-12s10 4 11 12c-4-3-7-6-11-6s-7 3-11 6z" fill="#0d1628"/>' : '<path d="M21 27c0-7 5-11 11-11s11 4 11 11c-3-3-6-4-11-4s-8 1-11 4z" fill="#3a2a20"/>'}
  <circle cx="28" cy="31" r="1.3" fill="#0d1628"/><circle cx="36" cy="31" r="1.3" fill="#0d1628"/><path d="M29 36c2 1.5 4 1.5 6 0" stroke="#a0522d" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>`; }
function docCard(d, sel){ const ar = S.lang === 'ar';
  return `<button type="button" class="doc-card ${sel ? 'on' : ''}" data-doc="${d.id}">${docPic(d.name, d.gender, 64)}<span class="grow" style="text-align:start"><b>${esc(d.name)}</b>
    <span class="xs muted" style="display:block">${esc(ar ? (d.specialty_ar || d.specialty) : d.specialty)} · ${t('cs_years',{n:esc(d.years || '—')})}</span>
    <span class="small" style="display:block;margin-top:4px">${esc(ar ? (d.bio_ar || d.bio || '') : (d.bio || ''))}</span>
    <span class="row wrap" style="gap:6px;margin-top:6px"><span class="chip ${d.gender === 'female' ? 'red' : ''}">${t(d.gender === 'female' ? 'cs_female_dr' : 'cs_male_dr')}</span><span class="chip amber">★ ${d.rating || '—'}</span>${d.license ? `<span class="chip gray ltr">${esc(d.license)}</span>` : ''}</span></span>${sel ? `<span class="doc-tick">${ic('check',18,2.6)}</span>` : ''}</button>`; }
function csKinds(){ return [['pre','steth','cs_pre','consult_fee'],['post','file','cs_post','consult_post_fee'],['dental','tooth','cs_dental','consult_fee'],['dental_home','home','cs_dental_home','dental_home_fee']]; }
function csFee(kind, order, B){ if (kind === 'post' && order && ['review','urgent'].includes(order.severity)) return 0; return Number(B[{ pre:'consult_fee', post:'consult_post_fee', dental:'consult_fee', dental_home:'dental_home_fee' }[kind]]); }
function csGoBook(kind, orderId){ const h = 'app/consult/new?kind=' + kind + (orderId ? '&order=' + orderId : ''); if (S.user && S.user.role === 'patient') go(h); else if (S.user) toast(t('e_ONLY_PATIENTS')); else { sessionStorage.setItem('lah_after', h); go('register'); } }
function csStatus(c){ const m = { booked:'blue', live:'teal', done:'teal', cancelled:'gray' }; return `<span class="chip ${m[c.status] || ''}">${t('cs_st_' + c.status)}</span>`; }
function csWhen(c){ return `${fmtDate(c.slot_date)} · ${esc(c.slot_time)}`; }
function csJoinOpen(c){ const now = muscatNow(); if (c.status === 'live') return true; if (c.slot_date !== now.date) return false; const [h, m] = c.slot_time.split(':').map(Number); return now.mins >= h * 60 + m - 10 && now.mins <= h * 60 + m + 60; }

/* public page: consultations & dental (#/consult, #/dental) */
async function viewConsultPublic(dental){
  const B = await bizLoad(); let docs = [], dents = [];
  try { [docs, dents] = await Promise.all([API.doctors('pre'), API.doctors('dental')]); } catch(e) {}
  const kinds = csKinds().filter(k => dental ? /dental/.test(k[0]) : true);
  const body = `<div class="stack-lg">
    <div class="cs-hero ${dental ? 'dental' : ''}"><div class="grow"><span class="chip" style="background:rgba(255,255,255,.16);color:#fff">${ic(dental ? 'tooth' : 'video',14)} ${t(dental ? 'm_dental' : 'm_consult')}</span><h1>${t(dental ? 'dn_t' : 'cs_t')}</h1><p>${t(dental ? 'dn_p' : 'cs_p')}</p><div class="xs" style="opacity:.8">${t('cs_privacy')}</div></div><div class="cs-hero-art">${dental ? docPic('Dr. Rahma Al Shukaili', 'female', 104) + docPic('Dr. Talal Al Riyami', 'male', 104) : docPic('Dr. Aisha Al Balushi', 'female', 104) + docPic('Dr. Hilal Al Harthy', 'male', 104)}</div></div>
    <div class="grid g${kinds.length === 4 ? 4 : 2} cs-kinds">${kinds.map(([k, i, lk, fk]) => `<div class="card cs-kind"><span class="ic-round">${ic(i,24)}</span><b>${t(lk)}</b><div class="small muted grow">${t(lk + '_d')}</div>
      <div class="row between" style="margin-top:10px"><b class="num">${k === 'post' ? `${omr(B[fk])} <small class="muted">/ ${t('cs_free')}*</small>` : omr(B[fk])} <small>${t('omr')}</small></b><button class="btn sm" data-cs="${k}">${t('cs_book')}</button></div></div>`).join('')}</div>
    ${!dental ? `<p class="xs muted" style="margin-top:-10px">* ${t('cs_free_note')}</p>` : `<div class="banner blue small">${ic('tooth',18)}<span>${t('dn_note')}</span></div>`}
    ${!dental && docs.length ? `<div><h2 class="hm-h">${t('cs_doctors')}</h2><div class="grid g2 collapse">${docs.map(d => docCard(d)).join('')}</div></div>` : ''}
    ${dents.length ? `<div><h2 class="hm-h">${t('cs_dentists')}</h2><div class="grid g2 collapse">${dents.map(d => docCard(d)).join('')}</div></div>` : ''}</div>`;
  app.innerHTML = S.user ? shell(t(dental ? 'm_dental' : 'm_consult'), body) : `${topbar()}<section class="section" style="padding-top:24px"><div class="wrap-w">${body}</div></section>${footer()}`;
  if (!S.user) bindGlobal();
  $$('[data-cs]').forEach(b => b.onclick = () => csGoBook(b.dataset.cs));
  $$('[data-doc]').forEach(b => b.onclick = () => csGoBook(dents.some(d => d.id === b.dataset.doc) ? 'dental' : 'pre'));
}

/* booking wizard (#/app/consult/new?kind=pre&order=…) */
async function viewConsultNew(){
  const q = new URLSearchParams((location.hash.split('?')[1] || ''));
  const kind = ['pre','post','dental','dental_home'].includes(q.get('kind')) ? q.get('kind') : 'pre';
  if (!S.cb || S.cb.kind !== kind || (q.get('order') && S.cb.order !== q.get('order'))) S.cb = { kind, step: 1, doctor: null, gf: 'any', mode: kind === 'dental_home' ? 'home' : 'video', date: null, time: null, reason: '', order: q.get('order') || null, pay: 'card', address: (S.user && S.user.address) || '' };
  const b = S.cb; const B = await bizLoad();
  if (!b.docs) { loading(t('cs_book_t')); try { b.docs = await API.doctors(/dental/.test(kind) ? 'dental' : 'pre'); } catch(e) { app.innerHTML = shell(t('cs_book_t'), emptyBox(errMsg(e))); return; } }
  if (kind === 'post' && !b.orders) { try { b.orders = (await API.orders('mine')).filter(o => o.status === 'completed'); } catch(e) { b.orders = []; } }
  const order = kind === 'post' && b.orders ? b.orders.find(o => o.id === b.order) : null;
  const fee = csFee(kind, order, B); const steps = ['cs_s1','cs_s2','cs_s3','cs_s4','cs_s5'];
  const now = muscatNow(); const days = Array.from({ length: 7 }, (_, i) => addDays(now.date, i));
  if (!b.date) b.date = days[0];
  const doc = b.docs.find(d => d.id === b.doctor);
  const taken = new Set((doc && doc.taken) || []);
  const times = (B.consult_slots || []).filter(x => { const [h, m] = x.split(':').map(Number); return !taken.has(b.date + ' ' + x) && !(b.date === now.date && h * 60 + m <= now.mins + 30); });
  let inner = '';
  if (b.step === 1) {
    const list = b.docs.filter(d => b.gf === 'any' || d.gender === b.gf);
    inner = `<div class="card stack"><h3>${t('cs_s1')}</h3><div class="cats" style="margin:0">${[['any','cs_any'],['female','cs_female_dr'],['male','cs_male_dr']].map(([v, k]) => `<button class="${b.gf === v ? 'on' : ''}" data-gf="${v}">${t(k)}</button>`).join('')}</div>
      <div class="stack" style="--g:10px">${list.map(d => docCard(d, d.id === b.doctor)).join('')}</div></div>`;
  } else if (b.step === 2) {
    inner = kind === 'dental_home' ? `<div class="card stack"><h3>${t('cs_home')}</h3><label class="field"><span>${t('cs_address')}</span><textarea class="input" id="csa" rows="2">${esc(b.address)}</textarea></label><div class="banner blue small">${ic('tooth',18)}<span>${t('dn_note')}</span></div></div>`
      : `<div class="card stack"><h3>${t('cs_s2')}</h3><div class="paym">${[['video','video'],['voice','phone'],['chat','chat']].map(([v, i]) => `<label class="${b.mode === v ? 'on' : ''}"><input type="radio" name="csm" value="${v}" ${b.mode === v ? 'checked' : ''}> ${ic(i)} <span class="grow"><b>${t('cs_' + v)}</b><span class="xs muted" style="display:block">${t('cs_mode_d_' + v)}</span></span></label>`).join('')}</div></div>`;
  } else if (b.step === 3) {
    inner = `<div class="card stack"><h3>${t('cs_date')}</h3><div class="cal">${days.map(d => `<button class="${d === b.date ? 'on' : ''}" data-day="${d}"><div class="xs" style="opacity:.75">${fmtDate(d, { weekday:'short' })}</div>${fmtDate(d, { day:'numeric' })}</button>`).join('')}</div>
      <h3 style="margin-top:6px">${t('cs_time')}</h3>${times.length ? `<div class="slots">${times.map(x => `<button class="slot ${x === b.time ? 'on' : ''}" data-tm="${x}">${x}</button>`).join('')}</div>` : `<p class="muted">${t('cs_no_times')}</p>`}</div>`;
  } else if (b.step === 4) {
    inner = `<div class="card stack">${kind === 'post' ? `<h3>${t('cs_order')}</h3>${b.orders && b.orders.length ? `<div class="stack" style="--g:8px">${b.orders.map(o => `<label class="check ${o.id === b.order ? 'on' : ''}"><input type="radio" name="cso" value="${o.id}" ${o.id === b.order ? 'checked' : ''}><span class="grow"><b class="ltr">${esc(o.code)}</b> · ${fmtDate(o.slot_date)}${o.severity && o.severity !== 'normal' ? ` <span class="chip ${o.severity === 'urgent' ? 'red' : 'amber'}">${t(o.severity === 'urgent' ? 'doc_urgent' : 'm_review')}</span>` : ''}</span></label>`).join('')}</div>` : `<p class="muted">${t('cs_no_orders')}</p>`}` : ''}
      <label class="field"><span>${t('cs_reason')}</span><textarea class="input" id="csr" rows="4" placeholder="${t('cs_reason_ph')}">${esc(b.reason)}</textarea></label></div>`;
  } else {
    inner = `<div class="card stack"><h3>${t('cs_s5')}</h3>
      <div class="vline"><span class="muted">${t('cs_s1')}</span><b>${esc(doc ? doc.name : '')}</b></div><div class="vline"><span class="muted">${t('cs_s2')}</span><b>${t('cs_' + b.mode)}</b></div>
      <div class="vline"><span class="muted">${t('appointment')}</span><b>${fmtDate(b.date)} · ${b.time}</b></div><div class="vline" style="border:0"><span class="muted">${t('cs_fee')}</span><b class="num">${fee ? omr(fee) + ' ' + t('omr') : t('cs_free')}</b></div>
      ${fee ? `<div class="paym">${[['card','card','pay_card'],['applepay','phone','pay_apple']].map(([v, i, k]) => `<label class="${b.pay === v ? 'on' : ''}"><input type="radio" name="pay" value="${v}" ${b.pay === v ? 'checked' : ''}> ${ic(i)} <span class="grow b">${t(k)}</span></label>`).join('')}</div>
      ${b.pay === 'card' ? `<div class="grid g3"><label class="field" style="grid-column:1/-1"><span>${t('card_no')}</span><input class="input ltr" id="cn" inputmode="numeric" maxlength="23" placeholder="4242 4242 4242 4242" autocomplete="cc-number"></label><label class="field"><span>${t('exp')}</span><input class="input ltr" id="ce" inputmode="numeric" maxlength="5" placeholder="12/28"></label><label class="field"><span>${t('cvv')}</span><input class="input ltr" id="cv" inputmode="numeric" maxlength="4" placeholder="123"></label></div>` : ''}
      <div class="banner blue small">${ic('shield',20)}<span>${t('epay_only')} ${t('test_mode')}</span></div>` : `<div class="banner teal small">${ic('check',18)}<span>${t('cs_free_note')}</span></div>`}<div class="err" id="cse"></div></div>`;
  }
  const head = `<div class="stepper">${steps.map((k, i) => `<i class="${i < b.step ? 'on' : ''}"></i>`).join('')}</div><div class="steplabels">${steps.map((k, i) => `<span class="${i + 1 === b.step ? 'on' : ''}">${i + 1}. ${t(k)}</span>`).join('')}</div>`;
  const kindCard = `<div class="card row" style="gap:12px">${ic(csKinds().find(k => k[0] === kind)[1], 26)}<div class="grow"><b>${t('cs_' + kind)}</b><div class="xs muted">${t('cs_' + kind + '_d')}</div></div><b class="num">${fee ? omr(fee) : t('cs_free')}</b></div>`;
  app.innerHTML = shell(t('cs_book_t'), `${head}<div class="stack">${kindCard}${inner}
    <div class="row">${b.step > 1 ? `<button class="btn ghost" id="cpv">${t('back')}</button>` : `<a class="btn ghost" href="#/app/consult">${t('back')}</a>`}<div class="grow"></div>
    ${b.step < 5 ? `<button class="btn" id="cnx">${t('next')} <span class="flip">${ic('arrow',18)}</span></button>` : `<button class="btn teal" id="cpay">${fee ? t('cs_pay',{x:omr(fee)}) : t('cs_confirm_free')}</button>`}</div></div>`, { back: true });
  const err = m => { const e = $('#cse'); if (e) e.textContent = m; else toast(m, true); };
  $$('[data-gf]').forEach(x => x.onclick = () => { b.gf = x.dataset.gf; viewConsultNew(); });
  $$('[data-doc]').forEach(x => x.onclick = () => { b.doctor = x.dataset.doc; b.time = null; viewConsultNew(); });
  $$('input[name=csm]').forEach(x => x.onchange = () => { b.mode = x.value; viewConsultNew(); });
  $$('[data-day]').forEach(x => x.onclick = () => { b.date = x.dataset.day; b.time = null; viewConsultNew(); });
  $$('[data-tm]').forEach(x => x.onclick = () => { b.time = x.dataset.tm; $$('[data-tm]').forEach(y => y.classList.toggle('on', y === x)); });
  $$('input[name=cso]').forEach(x => x.onchange = () => { b.order = x.value; viewConsultNew(); });
  $$('input[name=pay]').forEach(x => x.onchange = () => { b.pay = x.value; viewConsultNew(); });
  if ($('#cn')) { $('#cn').oninput = e => { const d = e.target.value.replace(/\D/g, '').slice(0, 19); e.target.value = d.replace(/(\d{4})(?=\d)/g, '$1 '); }; $('#ce').oninput = e => { let d = e.target.value.replace(/\D/g, '').slice(0, 4); if (d.length >= 3) d = d.slice(0, 2) + '/' + d.slice(2); e.target.value = d; }; $('#cv').oninput = e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); }; }
  const keep = () => { if ($('#csr')) b.reason = $('#csr').value; if ($('#csa')) b.address = $('#csa').value; };
  if ($('#cpv')) $('#cpv').onclick = () => { keep(); b.step--; viewConsultNew(); window.scrollTo(0, 0); };
  if ($('#cnx')) $('#cnx').onclick = () => { keep();
    if (b.step === 1 && !b.doctor) return toast(t('e_BAD_DOCTOR'), true);
    if (b.step === 2 && kind === 'dental_home' && !b.address.trim()) return toast(t('e_NEED_ADDRESS'), true);
    if (b.step === 3 && !b.time) return toast(t('cs_time'), true);
    if (b.step === 4 && kind === 'post' && !b.order) return toast(t('cs_pick_order'), true);
    b.step++; viewConsultNew(); window.scrollTo(0, 0); };
  if ($('#cpay')) $('#cpay').onclick = async () => {
    if (fee && b.pay === 'card') { const n = ($('#cn').value || '').replace(/\D/g, ''); const ex = ($('#ce').value || '').trim(); const cv = ($('#cv').value || '').trim(); if (!luhn(n) || !/^(0[1-9]|1[0-2])\/\d{2}$/.test(ex) || !/^\d{3,4}$/.test(cv)) return err(t('e_CARD')); }
    try { const c = await busy($('#cpay'), () => API.consultCreate({ doctor_id: b.doctor, kind, mode: b.mode, slot_date: b.date, slot_time: b.time, reason: b.reason, order_id: b.order, payment_method: b.pay, address: b.address }));
      S.cb = null; toast(t('cs_booked_t')); go('app/consult/' + c.id); }
    catch(e) { if (e.code === 'SLOT_TAKEN') { b.docs = null; b.step = 3; b.time = null; } err(errMsg(e)); if (e.code === 'SLOT_TAKEN') setTimeout(viewConsultNew, 1200); }
  };
}

/* list (#/app/consult): patient = mine, doctor = queue */
async function viewConsults(){
  loading(t(S.user.role === 'doctor' ? 'cs_q' : 'cs_mine'));
  const L = await API.consults(); const u = S.user; const doc = u.role === 'doctor';
  const up = L.filter(c => ['booked','live'].includes(c.status)), past = L.filter(c => !['booked','live'].includes(c.status));
  const row = c => `<a class="card row cs-row" href="#/app/consult/${c.id}" style="gap:12px">${doc ? `<span class="avatar">${esc(initials(c.patient && c.patient.name))}</span>` : docPic(c.doctor && c.doctor.name, c.doctor && c.doctor.gender, 46)}
    <div class="grow"><b>${esc(doc ? (c.patient && c.patient.name) : (c.doctor && c.doctor.name))}</b><div class="xs muted">${t('cs_' + c.kind)} · ${t('cs_' + c.mode)}</div><div class="small">${csWhen(c)}</div></div>${csStatus(c)}</a>`;
  let st = null; if (doc) { try { st = await API.stats(); } catch(e) {} }
  app.innerHTML = shell(t(doc ? 'cs_q' : 'cs_mine'), `<div class="stack-lg">
    ${doc && st ? `<div class="grid g3"><div class="kpi blue"><span>${t('cs_today')}</span><b>${st.consults_today || 0}</b></div><div class="kpi"><span>${t('cs_st_done')}</span><b>${st.consults_done || 0}</b></div><div class="kpi"><span>${t('cs_earn')}</span><b>${omr(st.earnings)} <small style="font-size:.8rem">${t('omr')}</small></b></div></div>` : ''}
    ${!doc ? `<div class="grid g4 cs-kinds">${csKinds().map(([k, i, lk]) => `<button class="card cs-kind sm" data-cs="${k}"><span class="ic-round sm">${ic(i,20)}</span><b>${t(lk)}</b></button>`).join('')}</div>` : ''}
    <div><h3>${t('cs_upcoming')} <span class="chip">${up.length}</span></h3>${up.length ? `<div class="stack" style="--g:10px">${up.map(row).join('')}</div>` : emptyBox(t('cs_none'))}</div>
    ${past.length ? `<div><h3>${t('cs_past')}</h3><div class="stack" style="--g:10px">${past.slice(0, 30).map(row).join('')}</div></div>` : ''}</div>`);
  $$('[data-cs]').forEach(b => b.onclick = () => csGoBook(b.dataset.cs));
}

/* one consultation (#/app/consult/<id>) */
async function viewConsult(id){
  let c; try { c = await API.consult(id); } catch(e) { app.innerHTML = shell('', emptyBox(errMsg(e))); return; }
  const u = S.user; const doc = u.role === 'doctor' && c.doctor && c.doctor.id === u.id; const n = c.note;
  if (doc) await loadCatalog().catch(() => {});
  const room = c.room ? 'https://meet.jit.si/' + c.room : null; const open = ['booked','live'].includes(c.status) && c.mode !== 'home';
  const wa = `https://wa.me/${CONTACT.wa}?text=${encodeURIComponent((S.lang === 'ar' ? 'استشارة ' : 'Consultation ') + c.code)}`;
  const sug = n ? [...(n.packages || []).map(x => ['package', x]), ...(n.tests || []).map(x => ['test', x])] : [];
  const body = `<div class="stack-lg">
    <div class="card"><div class="row between wrap"><div><div class="small muted">${t('cs_' + c.kind)} · ${t('cs_' + c.mode)}</div><h2 class="ltr" style="margin:0">${esc(c.code)}</h2></div>${csStatus(c)}</div>
      <div class="row" style="gap:12px;margin-top:14px">${doc ? `<span class="avatar xl">${esc(initials(c.patient && c.patient.name))}</span>` : docPic(c.doctor && c.doctor.name, c.doctor && c.doctor.gender, 64)}<div class="grow"><b>${esc(doc ? (c.patient && c.patient.name) : (c.doctor && c.doctor.name))}</b>
        <div class="small muted">${doc ? `${c.patient && c.patient.gender ? t(c.patient.gender) : ''}${c.patient && c.patient.dob ? ' · ' + age(c.patient.dob) : ''}` : esc(S.lang === 'ar' ? (c.doctor.specialty_ar || '') : (c.doctor.specialty || ''))}</div><div class="small b">${csWhen(c)}</div></div></div>
      ${open && room ? `<div class="row wrap" style="gap:8px;margin-top:14px"><a class="btn" href="${esc(room)}" target="_blank" rel="noopener" ${doc && c.status === 'booked' ? 'data-start' : ''}>${ic('video',18)} ${t('cs_vcall')}</a><a class="btn soft" href="${esc(room)}#config.startWithVideoMuted=true" target="_blank" rel="noopener" ${doc && c.status === 'booked' ? 'data-start' : ''}>${ic('phone',18)} ${t('cs_acall')}</a>${!doc && c.status === 'booked' ? `<button class="btn ghost" data-ccancel>${t('cs_cancel')}</button>` : ''}</div><div class="xs muted" style="margin-top:8px">${t('cs_call_tip')}</div>` : ''}
      ${!doc && c.status === 'booked' && !(open && room) ? `<div class="row wrap" style="gap:8px;margin-top:14px"><button class="btn ghost" data-ccancel>${t('cs_cancel')}</button></div>` : ''}</div>
    ${c.status !== 'cancelled' ? `<div class="card chat-card"><h3 style="margin:0 0 10px">${ic('chat',20)} ${t('cs_chat_t')}</h3><div class="chat-list" id="chl"><div class="xs muted center">${t('cs_chat_empty')}</div></div>
      <form class="chat-form" id="chf"><input class="input grow" id="chi" maxlength="2000" autocomplete="off" placeholder="${t('cs_chat_ph')}"><button class="btn" aria-label="${t('send')}">${ic('send',18)}</button></form></div>` : ''}
    ${c.reason || c.order || c.address ? `<div class="card">${c.reason ? `<div class="vline"><span class="muted">${t('cs_reason_l')}</span><b style="white-space:pre-wrap;text-align:end">${esc(c.reason)}</b></div>` : ''}${c.order ? `<div class="vline"><span class="muted">${t('cs_linked')}</span><a class="b ltr" href="#/app/${doc ? 'order' : 'report'}/${c.order.id}">${esc(c.order.code)}</a></div>` : ''}${c.address ? `<div class="vline" style="border:0"><span class="muted">${t('location')}</span><b>${esc(c.address)}</b></div>` : ''}</div>` : ''}
    ${n ? `<div class="card docnote"><div class="row" style="gap:12px">${docPic(c.doctor && c.doctor.name, c.doctor && c.doctor.gender, 46)}<div class="grow"><div class="xs muted">${t('cs_advice')}</div><b>${esc(n.by || '')}</b><div class="xs muted">${fmtDT(n.at)}</div></div></div><p style="white-space:pre-wrap;margin:12px 0 0">${esc(n.note)}</p>
      ${sug.length ? `<h4 style="margin:14px 0 6px">${t('cs_suggested')}</h4><div class="row wrap" style="gap:6px">${sug.map(([ty, x]) => `<span class="chip">${esc(S.catalog ? LN(ty === 'package' ? S.catalog.P[x] : S.catalog.T[x], 'name') || x : x)}</span>`).join('')}</div>${!doc ? `<button class="btn teal" style="margin-top:12px" data-addsug>${ic('cart',18)} ${t('cs_add_suggested')}</button>` : ''}` : ''}</div>` : ''}
    ${!doc && c.status === 'done' && !c.rating ? `<div class="card"><b>${t('cs_rate')}</b><div class="row" style="gap:4px;margin-top:8px;color:#f2a516">${[1,2,3,4,5].map(i => `<button class="link" data-cstar="${i}" style="font-size:2rem;color:inherit">★</button>`).join('')}</div></div>` : ''}
    ${doc && ['booked','live'].includes(c.status) ? `<div class="card stack"><h3>${t('cs_finish')}</h3><textarea class="input" id="cnote" rows="5" placeholder="${t('cs_note_ph')}"></textarea>
      ${S.catalog ? `<div><div class="small b" style="margin-bottom:6px">${t('cs_pick_tests')}</div><div class="pick-tests">${S.catalog.packages.map(p => `<label class="check"><input type="checkbox" data-sp="${p.id}"> <span>${esc(LN(p,'name'))}</span></label>`).join('')}${S.catalog.tests.map(x => `<label class="check"><input type="checkbox" data-st="${x.id}"> <span>${esc(LN(x,'name'))}</span></label>`).join('')}</div></div>` : ''}
      <button class="btn teal" data-cfinish>${ic('send',18)} ${t('cs_finish')}</button></div>` : ''}
    <p class="xs muted center">${t('cs_privacy')}</p></div>`;
  app.innerHTML = shell(esc(c.code), body, { back: true });
  if (!S.catalog && n && sug.length) loadCatalog().then(() => { if (location.hash.includes(id)) viewConsult(id); }).catch(() => {});
  /* messages: load, then check for new ones every 4 seconds while this page is open */
  let lastId = 0; const chl = $('#chl');
  const addMsgs = list => { if (!chl || !list.length) return; if (!lastId) chl.innerHTML = ''; list.forEach(m => { lastId = Math.max(lastId, m.id); chl.insertAdjacentHTML('beforeend', `<div class="msg ${m.mine ? 'me' : ''}"><div class="bub">${esc(m.body)}</div><div class="xs muted">${m.mine ? '' : esc(m.who === 'doctor' ? (c.doctor && c.doctor.name || '') : (c.patient && c.patient.name || '')) + ' · '}${fmtTime(m.at)}</div></div>`); }); chl.scrollTop = chl.scrollHeight; };
  const pull = async () => { if (!chl || !chl.isConnected || document.hidden) return; try { addMsgs(await API.consultMsgs(c.id, lastId)); } catch(e) {} };
  if (chl) { pull(); S.timers.push(setInterval(pull, 4000)); }
  if ($('#chf')) $('#chf').onsubmit = async e => { e.preventDefault(); const i = $('#chi'); const v = i.value.trim(); if (!v) return; i.value = ''; try { const m = await API.consultSend(c.id, v); addMsgs([m]); } catch(err) { i.value = v; toast(errMsg(err), true); } };
  const act = async (btn, a, p) => { try { const r = await busy(btn, () => API.consultAction(c.id, a, p)); return r; } catch(e) { toast(errMsg(e), true); return null; } };
  $$('[data-start]').forEach(x => x.addEventListener('click', () => { API.consultAction(c.id, 'start').then(() => setTimeout(() => viewConsult(id), 600)).catch(() => {}); }));
  if ($('[data-ccancel]')) $('[data-ccancel]').onclick = async e => { if (!await confirmBox(t('cs_cancel_q'), t('yes_cancel'), t('keep'))) return; if (await act(e.target, 'cancel')) viewConsult(id); };
  if ($('[data-cfinish]')) $('[data-cfinish]').onclick = async e => { const note = $('#cnote').value.trim(); if (!note) return toast(t('e_NEED_NOTE'), true);
    const tests = $$('[data-st]:checked').map(x => x.dataset.st), packages = $$('[data-sp]:checked').map(x => x.dataset.sp);
    if (await act(e.target, 'finish', { note, tests, packages })) { toast(t('doc_sent')); viewConsult(id); } };
  if ($('[data-addsug]')) $('[data-addsug]').onclick = async () => { await loadCatalog().catch(() => {}); sug.forEach(([ty, x]) => { const k = ty === 'package' ? 'packages' : 'tests'; if (!S.cart[k].includes(x) && S.catalog && (ty === 'package' ? S.catalog.P[x] : S.catalog.T[x])) S.cart[k].push(x); }); saveCart(); toast(t('cs_added')); go('app/cart'); };
  $$('[data-cstar]').forEach(s => s.onclick = async () => { if (await act(null, 'rate', { rating: +s.dataset.cstar })) { toast(t('thanks_rating')); viewConsult(id); } });
}
function csPostCta(o){ return S.user && S.user.role === 'patient' ? `<div class="card row cs-cta" style="gap:12px;align-items:center">${docPic('Dr. Aisha Al Balushi', 'female', 52)}<div class="grow"><b>${t('cs_post_cta_t')}</b><div class="small muted">${t('cs_post_cta_p')}${['review','urgent'].includes(o.severity) ? ' <b class="teal-t">' + t('cs_free') + '</b>' : ''}</div></div><button class="btn sm" data-cspost="${o.id}">${ic('video',16)} ${t('cs_post_cta')}</button></div>` : ''; }

/* business page (#/business) */
async function viewBusiness(){
  const B = await bizLoad();
  const st = { basket: 25, perDay: 14, vd: 6, wd: 22, lv: 2 };
  const FIXED = 3100;
  const bar = (x, tot, c) => `<i style="width:${Math.max(1, x / tot * 100).toFixed(1)}%;background:${c}"></i>`;
  const COL = { lab:'#2563eb', nurse:'#14b8a6', courier:'#f97316', kit:'#94a3b8', card:'#cbd5e1', us:'#0d1628' };
  const draw = () => {
    const s = splitOrder(st.basket, B); const per = s.us; const month = st.perDay * 30;
    const rev = s.total * month, partners = (s.lab + s.nurse + s.courier) * month, other = (s.kit + s.card) * month, gross = per * month, profit = gross - FIXED;
    const be = Math.ceil(FIXED / per);
    const nb = (B.nurse_bonus || [0, .25, .5, .75])[st.lv - 1] || 0; const nurseM = (B.nurse_fee + nb) * st.vd * st.wd;
    $('#bz-split').innerHTML = `<div class="split-bar">${['lab','nurse','courier','kit','card','us'].map(k => bar(s[k], s.total, COL[k])).join('')}</div>
      <div class="split-rows">${[['lab','bz_lab'],['nurse','bz_nurse'],['courier','bz_courier'],['kit','bz_kit'],['card','bz_card'],['us','bz_us']].map(([k, lk]) => `<div class="sr"><span class="sw" style="background:${COL[k]}"></span><div class="grow"><b>${t(lk)}</b><div class="xs muted">${t(lk + '_d')}</div></div><b class="num">${omr(s[k])}</b><span class="xs muted num" style="width:44px;text-align:end">${Math.round(s[k] / s.total * 100)}%</span></div>`).join('')}
      <div class="sr tot"><span class="sw" style="background:transparent"></span><div class="grow"><b>${t('total')}</b></div><b class="num">${omr(s.total)} ${t('omr')}</b><span style="width:44px"></span></div></div>`;
    $('#bz-month').innerHTML = `<div class="grid g4"><div class="kpi"><span>${t('bz_revenue')}</span><b>${Math.round(rev).toLocaleString()}</b></div><div class="kpi"><span>${t('bz_partners')}</span><b>${Math.round(partners).toLocaleString()}</b></div><div class="kpi blue"><span>${t('bz_gross')}</span><b>${Math.round(gross).toLocaleString()}</b></div>
      <div class="kpi" style="background:${profit >= 0 ? '#e3f7f4' : '#fdecec'}"><span>${t(profit >= 0 ? 'bz_profit' : 'bz_loss')}</span><b>${Math.round(Math.abs(profit)).toLocaleString()}</b></div></div>
      <p class="small muted" style="margin:10px 0 0">${t('bz_fixed')}: <b>${FIXED.toLocaleString()} ${t('omr')}</b> — ${t('bz_fixed_d')}. ${t('bz_breakeven',{n:be, d:Math.ceil(be / 30)})}</p>`;
    $('#bz-nurse').innerHTML = `<div class="row between"><span>${t('bz_nurse_month')}</span><b class="num" style="font-size:1.4rem">${omr(nurseM)} ${t('omr')}</b></div><div class="xs muted">${st.vd} × ${st.wd} × (${omr(B.nurse_fee)} + ${omr(nb)})</div>`;
    $$('[data-out]').forEach(o => o.textContent = o.dataset.out === 'basket' ? omr(st.basket) : st[o.dataset.out]);
  };
  const sl = (k, min, max, step, lbl) => `<label class="field"><span class="row between">${t(lbl)} <b data-out="${k}"></b></span><input type="range" min="${min}" max="${max}" step="${step}" value="${st[k]}" data-sl="${k}"></label>`;
  const body = `<div class="stack-lg">
    <div class="about-hero"><div><span class="chip" style="background:rgba(255,255,255,.15);color:#fff">${t('m_business')}</span><h1>${t('bz_t')}</h1><p>${t('bz_p')}</p></div><div class="ah-art">${A.hero}</div></div>
    <div class="card pad-lg"><span class="eyebrow">${t('bz_idea')}</span><p class="big" style="margin:.4em 0 0">${t('bz_idea_p')}</p></div>
    <div><div class="section-h" style="margin-bottom:16px"><span class="eyebrow">${t('bz_goals')}</span><h2>${t('bz_goals')}</h2></div><div class="grid g4 goals">${['bz_g1','bz_g2','bz_g3','bz_g4'].map((k, i) => `<div class="card goal"><span class="gn">0${i + 1}</span><span class="gi">${ic(['target','chart','globe','award'][i], 26)}</span><div class="small">${t(k)}</div></div>`).join('')}</div></div>
    <div class="card pad-lg"><h2 style="margin:0">${t('bz_flow')}</h2><p class="muted small">${t('bz_flow_p')}</p>${sl('basket', 5, 60, 1, 'bz_basket')}<div class="small muted">${t('bz_visit')}: <b>${omr(B.home_fee)} ${t('omr')}</b></div><div id="bz-split" style="margin-top:14px"></div></div>
    <div class="card pad-lg"><h2 style="margin:0">${t('bz_month')}</h2>${sl('perDay', 2, 80, 1, 'bz_orders_day')}<div id="bz-month" style="margin-top:12px"></div></div>
    <div class="grid g2 collapse"><div class="card pad-lg"><h3 style="margin-top:0">${t('bz_nurse_calc')}</h3>${sl('vd', 1, 12, 1, 'bz_visits_day')}${sl('wd', 4, 26, 1, 'bz_days')}
      <div class="cats" style="margin:4px 0 10px">${[1,2,3,4].map(i => `<button data-lv="${i}" class="${st.lv === i ? 'on' : ''}">${t('lvl_' + i)}</button>`).join('')}</div><div id="bz-nurse"></div></div>
      <div class="card pad-lg"><h3 style="margin-top:0">${t('bz_why')}</h3>${[['flask','bz_w_lab'],['syringe','bz_w_nurse'],['van','bz_w_courier'],['steth','bz_w_doc']].map(([i, k]) => `<div class="row" style="gap:10px;align-items:flex-start;margin:8px 0"><span class="ic-round sm">${ic(i,18)}</span><span class="small">${t(k)}</span></div>`).join('')}</div></div>
    <div class="grid g3">${[['steth','bz_doctor'],['tooth','bz_dentist'],['building','bz_company']].map(([i, k]) => `<div class="card"><span class="ic-round">${ic(i,22)}</span><b style="display:block;margin-top:8px">${t(k)}</b><div class="small muted">${t(k + '_d')}</div></div>`).join('')}</div>
    <div class="card pad-lg"><h3 style="margin-top:0">${t('bz_rules')}</h3>${['bz_r1','bz_r2','bz_r3','bz_r4'].map(k => `<div class="row" style="gap:10px;align-items:flex-start;margin:8px 0"><span class="ic-round sm">${ic('shield',18)}</span><span class="small">${t(k)}</span></div>`).join('')}</div>
    <div class="welcome center" style="padding:28px"><h2>${t('bz_cta')}</h2><p class="xs" style="opacity:.8">${t('bz_note')}</p><div class="row wrap" style="justify-content:center"><a class="btn" style="background:#fff;color:var(--blue)" href="#/register?partner=1">${ic('hands',18)} ${t('bz_cta')}</a><a class="btn ghost" style="background:transparent;color:#fff;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.5)" href="#/contact">${t('m_contact')}</a></div></div></div>`;
  app.innerHTML = S.user ? shell(t('m_business'), body) : `${topbar()}<section class="section" style="padding-top:24px"><div class="wrap-w">${body}</div></section>${footer()}`;
  if (!S.user) bindGlobal();
  $$('[data-sl]').forEach(r => r.oninput = () => { st[r.dataset.sl] = +r.value; draw(); });
  $$('[data-lv]').forEach(b => b.onclick = () => { st.lv = +b.dataset.lv; $$('[data-lv]').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  draw();
}

/* ================= v32: livelier sign-in screens ================= */
Object.assign(I18N.en, { vs_m:['Your nurse is on the way', 'Prevention is better than cure', 'Health is a crown only the sick can see', 'No trip, no queue', 'Your results, straight to your phone', 'Cold box: 2–8 °C, all the way'], vs_honk:'Beep beep!',
  th_q:'Hmm… what was my password?', th_type:'Type your email or phone', th_ok:'Got it! Check your messages', th_err:'Forgot it? Tap “Forgot password”' });
Object.assign(I18N.ar, { vs_m:['ممرضك في الطريق', 'الوقاية خير من العلاج', 'الصحة تاج على رؤوس الأصحاء', 'بدون مشوار ولا طابور', 'نتيجتك توصلك على جوالك', 'صندوق التبريد ٢–٨ °م طول الطريق'], vs_honk:'بيب بيب!',
  th_q:'همم… وش كانت كلمة المرور؟', th_type:'اكتب إيميلك أو رقمك', th_ok:'تمام! شيّك رسائلك', th_err:'نسيتها؟ اضغط «نسيت كلمة المرور»' });
/* the van drives on: scenery scrolls behind it (transform-only layers, done by the graphics card) */
const VAN32 = `<svg viewBox="0 0 280 120" aria-hidden="true"><ellipse cx="140" cy="112" rx="122" ry="6" fill="#0b2350" opacity=".14"/><rect x="10" y="20" width="186" height="72" rx="16" fill="#fff" stroke="#dbe5f5" stroke-width="3"/>
  <path d="M196 30h44l30 34v26h-74z" fill="#1257d6"/><rect x="206" y="38" width="32" height="24" rx="5" fill="#cfe0ff"/><rect x="10" y="66" width="260" height="10" fill="#1257d6" opacity=".85"/>
  <g transform="translate(26,30)"></g><text x="74" y="56" font-family="Outfit,Inter,sans-serif" font-weight="700" font-size="20" fill="#0b2350">iLab<tspan fill="#1257d6">@</tspan>home</text><rect x="252" y="72" width="16" height="8" rx="3" fill="#ffd166"/><circle class="vs-beacon" cx="150" cy="16" r="5" fill="#e2474f"/></svg>`;
const WHEEL32 = `<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="19" fill="#1d2433"/><circle cx="20" cy="20" r="8" fill="#cfd8e8"/><path d="M20 12v16M12 20h16" stroke="#1d2433" stroke-width="3"/></svg>`;
const SCENE32 = (cls, w, h, body) => `<div class="vs-layer ${cls}"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${body}</svg><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${body}</svg></div>`;
function vanStrip(){
  const hills = `<path d="M0 60 L40 30 L70 46 L110 18 L150 44 L190 24 L230 50 L270 28 L300 40 L300 60Z" fill="#c9d8f2"/>`;
  const near = Array.from({ length: 4 }, (_, i) => `<g transform="translate(${20 + i * 75},58)"><path d="M0 0 Q2 -18 1 -34" stroke="#4a8c5c" stroke-width="3" fill="none"/>${[-1, -.4, .3, 1].map(k => `<path d="M1 -34 q${k * 14} -6 ${k * 22} 6" stroke="#4a8c5c" stroke-width="2.6" fill="none" stroke-linecap="round"/>`).join('')}</g>${i % 2 ? `<rect x="${55 + i * 75}" y="40" width="26" height="18" fill="#efe2c6"/><rect x="${53 + i * 75}" y="36" width="30" height="5" fill="#e2d1ad"/>` : ''}`).join('');
  const logo = A.markSvg({ still: true }).replace('<svg', '<svg width="40" height="40"');
  return `<div class="van-strip v32" aria-hidden="true"><div class="vs-sun"></div>${SCENE32('vs-far', 300, 60, hills)}${SCENE32('vs-near', 300, 60, near)}<div class="vs-road"><i></i></div>
    <div class="vs-van" data-honk>${VAN32.replace('<g transform="translate(26,30)"></g>', `<g transform="translate(26,30)">${logo}</g>`)}<span class="vs-wh w1">${WHEEL32}</span><span class="vs-wh w2">${WHEEL32}</span><span class="vs-puff p1"></span><span class="vs-puff p2"></span></div>
    <div class="vs-msg"><span class="vs-ic">${ic('pin',14)}</span><span class="vs-t">${esc(I18N[S.lang].vs_m[0])}</span></div></div>`;
}
let VS_T = null;
function bindVan(){
  const st = $('.van-strip.v32'); clearInterval(VS_T); if (!st) return;
  const msgs = I18N[S.lang].vs_m || []; let k = 0; const tx = $('.vs-t', st), box = $('.vs-msg', st);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce) VS_T = setInterval(() => { if (!st.isConnected) return clearInterval(VS_T); if (document.hidden) return; box.classList.add('swap'); setTimeout(() => { k = (k + 1) % msgs.length; tx.textContent = msgs[k]; box.classList.remove('swap'); }, 260); }, 3600);
  const van = $('[data-honk]', st); if (van) van.onclick = () => { van.classList.remove('honk'); void van.offsetWidth; van.classList.add('honk'); tx.textContent = t('vs_honk'); try { navigator.vibrate && navigator.vibrate(30); } catch(e) {} };
  const vis = () => st.classList.toggle('paused', document.hidden); document.addEventListener('visibilitychange', vis);
}
/* the brand name, letter by letter (used on the sign-in screens) */
function wmAnim(cls){ const parts = [['i', 1], ['L'], ['a'], ['b'], ['@', 1], ['h'], ['o'], ['m'], ['e']];
  return `<span class="wm wm-anim ${cls || ''}" dir="ltr" role="img" aria-label="iLab@home">${parts.map(([c, hl], n) => `<b class="${hl ? 'hl' : ''}${c === '@' ? ' at' : ''}" style="--n:${n}">${c}</b>`).join('')}<span class="wm-shine"></span></span>`; }
/* a person thinking about the password (forgot / reset) */
function thinker(){
  return `<div class="thinker" id="thk"><svg viewBox="0 0 220 210" aria-hidden="true">
    <g class="th-bub"><circle class="b1" cx="128" cy="92" r="6" fill="#fff" stroke="#c9d8f5" stroke-width="2"/><circle class="b2" cx="146" cy="70" r="9" fill="#fff" stroke="#c9d8f5" stroke-width="2"/>
      <g class="b3"><ellipse cx="176" cy="36" rx="40" ry="28" fill="#fff" stroke="#c9d8f5" stroke-width="2"/><text class="th-q" x="176" y="47" text-anchor="middle" font-family="Outfit,Inter,sans-serif" font-weight="800" font-size="30" fill="#1257d6">?</text>
      <g class="th-dots" fill="#0b2350">${[0, 1, 2, 3].map(i => `<circle cx="${158 + i * 12}" cy="38" r="4"/>`).join('')}</g><g class="th-bulb"><path d="M176 18a14 14 0 0 1 8 25v6h-16v-6a14 14 0 0 1 8-25z" fill="#ffd166" stroke="#e8a400" stroke-width="2"/><rect x="169" y="51" width="14" height="5" rx="2" fill="#9aa8c0"/></g></g></g>
    <g class="th-person" transform="translate(70,205)"><ellipse cx="0" cy="0" rx="46" ry="7" fill="#0b2350" opacity=".12"/>
      <path d="M-36 -110 Q-42 -50 -38 -4 L38 -4 Q42 -50 36 -110 Q0 -124 -36 -110Z" fill="#fff" stroke="#dfe6f2" stroke-width="2"/><path d="M0 -110 V-76" stroke="#c9b48a" stroke-width="3"/>
      <g class="th-arm"><path d="M30 -100 Q46 -70 22 -64" stroke="#fff" stroke-width="15" stroke-linecap="round" fill="none"/><path d="M30 -100 Q46 -70 22 -64" stroke="#dfe6f2" stroke-width="1.5" fill="none" opacity=".6"/><circle cx="18" cy="-66" r="8" fill="#c98d63"/></g>
      <path d="M-30 -100 Q-46 -66 -38 -46" stroke="#fff" stroke-width="15" stroke-linecap="round" fill="none"/><circle cx="-38" cy="-44" r="8" fill="#c98d63"/>
      <g class="th-head"><ellipse cx="0" cy="-142" rx="21" ry="25" fill="#c98d63"/><path d="M-19 -136 Q-18 -112 0 -108 Q18 -112 19 -136 Q12 -125 0 -124 Q-12 -125 -19 -136Z" fill="#2a2523"/>
        <path d="M-23 -160 Q0 -188 23 -160 L23 -153 L-23 -153Z" fill="#fff" stroke="#e1e7f1"/><path d="M-19 -160h38" stroke="#1257d6" stroke-width="2" stroke-dasharray="3 3"/>
        <g class="th-eyes"><ellipse cx="-8" cy="-146" rx="2.8" ry="3.6" fill="#1d2433"/><ellipse cx="8" cy="-146" rx="2.8" ry="3.6" fill="#1d2433"/></g>
        <path class="th-brow" d="M-13 -154 l8 -2 M5 -156 l8 2" stroke="#2a2523" stroke-width="2.4" stroke-linecap="round"/>
        <path class="th-mouth" d="M-6 -129 Q0 -127 6 -130" stroke="#8a3f33" stroke-width="2.4" fill="none" stroke-linecap="round"/><path class="th-smile" d="M-8 -131 Q0 -123 8 -131" stroke="#8a3f33" stroke-width="2.6" fill="none" stroke-linecap="round"/></g></g>
    <g class="th-mail" transform="translate(150,150)"><rect x="-22" y="-15" width="44" height="30" rx="5" fill="#1257d6"/><path d="M-22 -13 L0 4 L22 -13" stroke="#fff" stroke-width="3" fill="none"/></g></svg>
    <div class="th-say">${t('th_q')}</div></div>`;
}
function bindThinker(form){
  const th = $('#thk'); if (!th || !form) return; const say = $('.th-say', th); const inp = $('input', form);
  if (inp) { inp.addEventListener('focus', () => { th.classList.add('typing'); say.textContent = t('th_type'); }); inp.addEventListener('blur', () => { if (!th.classList.contains('happy')) { th.classList.remove('typing'); say.textContent = t('th_q'); } }); }
  return { happy(){ th.classList.remove('typing'); th.classList.add('happy'); say.textContent = t('th_ok'); } };
}
/* ================= v29: sign-up van, team icons, doctor pictures ================= */
Object.assign(I18N.en, { van_hi:'Your nurse is on the way', r_cyber:'Cybersecurity', r_hr:'Human resources', r_nurse_t:'Nurse', r_adv:'Advisor · Supervisor', r_devfull:'Platform developer · Computer engineer' });
Object.assign(I18N.ar, { van_hi:'ممرضك في الطريق', r_cyber:'الأمن السيبراني', r_hr:'الموارد البشرية', r_nurse_t:'ممرضة', r_adv:'المشرف والمستشار', r_devfull:'مطوّر المنصة · مهندس حاسوب' });
/* the iLab@home van drives in on the sign-in / sign-up screens (picture, not a drawing) */
const VAN_SVG = `<ellipse cx="120" cy="196" rx="104" ry="6" fill="#0d1628" opacity=".12"/><path d="M14 168V96c0-10 8-18 18-18h118c8 0 15 4 19 10l26 34 22 8c6 2 9 7 9 13v25z" fill="#fff" stroke="#dbe5f5" stroke-width="2"/><path d="M152 86h12l24 34h-36z" fill="#bfdbfe"/><rect x="14" y="138" width="214" height="12" fill="#2563eb"/><rect x="14" y="150" width="214" height="5" fill="#f97316"/><g transform="translate(30 92) scale(.6)" stroke="#2563eb" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M51.5 15.2 32 4 7.5 18.1v27.8L32 60l19.5-11.2" stroke-width="4"/><path d="M47.6 18.6 32 9.6 12.2 21v22L32 54.4l15.6-9" stroke-width="2"/><g transform="rotate(-32 32 34)" stroke-width="2.8"><path d="M28.6 20.5v8.1a9.6 9.6 0 1 0 6.8 0v-8.1"/><path d="M27 20.5h10"/><path d="M23.4 36.5c3-1.6 5.6 1.4 8.6 0s5.6-1.3 8.6.2" stroke-width="2.2"/></g></g><text x="108" y="120" font-family="Inter,Arial,sans-serif" font-weight="800" font-size="18" fill="#0d1628" text-anchor="middle" letter-spacing="-.5" direction="ltr"><tspan fill="#2563eb">i</tspan>Lab<tspan fill="#2563eb">@</tspan>home</text><text x="108" y="132" font-family="Inter,Arial" font-weight="600" font-size="8" fill="#64748b" text-anchor="middle">+968 9434 2557 · @ilabathome</text><circle cx="58" cy="170" r="17" fill="#0d1628"/><circle cx="58" cy="170" r="7" fill="#cbd5e1"/><circle cx="184" cy="170" r="17" fill="#0d1628"/><circle cx="184" cy="170" r="7" fill="#cbd5e1"/>`;
/* team: a small animated icon for each person's job (like emoji reactions) */
const TEAM = [
  ['Bilarab bin Suwailam Al Musallami','بلعرب بن سويلم المسلمي','dev','👨🏻‍💻','⚙️','r_devfull'],
  ['Jokha Al Rawahi','جوخة الرواحي','cyber','🧕🏻','🛡️','r_cyber'],
  ['Ansam Al Noumani','أنسام النعماني','hr','🧕🏻','📋','r_hr'],
  ['Tasnim Al Hasani','تسنيم الحسني','hr','🧕🏻','🤝','r_hr'],
  ['Rahaf Al Wardi','رهف الوردي','nurse','🧕🏻','🩺','r_nurse_t'],
  ['Alzahraa Al Busaidi','الزهراء البوسعيدي','nurse','🧕🏻','💉','r_nurse_t'],
  ['Dr. Salim Al Rashdi','د. سالم الراشدي','adv','👨🏻‍🏫','🎓','r_adv']];
function teamCard([en, ar, role, face, badge, lbl]){
  const c = { dev:'#2563eb', cyber:'#e8466f', hr:'#7a5af8', nurse:'#14b8a6', adv:'#0fae9b' }[role] || '#2563eb';
  return role === 'dev' ? `<div class="card center pad-lg"><span class="avatar xl" style="background:${c}">${esc(initials(en))}</span><h4 style="margin-top:12px">${esc(S.lang === 'ar' ? ar : en)} <span class="dev-s">★</span></h4><span class="chip">${t('dev_star')}</span></div>`
    : `<div class="card center pad-lg"><span class="avatar xl" style="background:${c}">${esc(initials(en.replace('Dr. ', '')))}</span><h4 style="margin-top:12px">${esc(S.lang === 'ar' ? ar : en)}</h4><span class="chip ${role === 'adv' ? 'teal' : ''}">${t(role === 'adv' ? 'supervisor' : 'member')}</span></div>`;
}
/* doctors: Pixar-style portraits (fall back to the drawn avatar) */
const DOC_PIC = { 'Dr. Aisha Al Balushi':'aisha', 'Dr. Hilal Al Harthy':'hilal', 'Dr. Rahma Al Shukaili':'rahma', 'Dr. Talal Al Riyami':'talal' };
function docPic(name, gender, size){ const k = DOC_PIC[name]; return k ? `<img class="doc-pic" src="img/doctors/${k}.webp" alt="" width="${size}" height="${size}" loading="lazy" decoding="async">` : docArt(gender, size); }


/* ---------- v31: small shared pieces ---------- */
function waChip(){ return `<a class="chip wa" target="_blank" rel="noopener" href="https://wa.me/${CONTACT.wa}?text=${encodeURIComponent(t('wa_txt'))}"><svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.4-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9 0-1.4.7-2 1-2.3.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.7-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.3z"/></svg> ${t('wa_book')}</a>`; }
function ramBanner(){ const C = S.catalog; if (!C || !C.ramadan) return ''; const d = muscatNow().date; if (d < C.ramadan.from || d > C.ramadan.to) return '';
  return `<div class="banner ram">${ic('moon',22)}<div><b>${t('ram_t')}</b><div class="small">${t('ram_p')}</div></div></div>`; }
function loyStrip(L){ const per = L.per || 5; return `<a class="loy-strip" href="#/app/loyalty"><span class="ls-ic">${ic('star',20)}</span><div class="grow"><b>${t('hm_loy')}</b><div class="xs">${L.free_next ? t('loy_free_now') : t('loy_next',{n: per - L.stamps})}</div></div>
  <span class="ls-dots">${Array.from({ length: per }, (_, i) => `<i class="${i < L.stamps ? 'on' : ''}"></i>`).join('')}</span></a>`; }

/* ---------- loyalty card + invite a friend ---------- */
async function viewLoyalty(){
  loading(t('m_loyalty'));
  let L; try { L = await API.loyalty(); S.loy = L; } catch(e) { app.innerHTML = shell(t('m_loyalty'), emptyBox(errMsg(e))); return; }
  const per = L.per || 5, n = L.stamps || 0, left = per - n; const rw = omr(L.reward || 1);
  const slot = i => `<span class="stamp ${i < n ? 'on' : ''} ${i === per - 1 ? 'gift' : ''}">${i < n ? A.markSvg({ fg:'#ffffff', still:true }) : i === per - 1 ? `${ic('star',20)}<small>${t('loy_free')}</small>` : `<b>${i + 1}</b>`}</span>`;
  const msg = t('ref_msg', { x: rw, c: L.ref_code || '' }) + ' ' + location.origin + location.pathname;
  app.innerHTML = shell(t('m_loyalty'), `<div class="stack-lg loy-page">
    <div class="loyal-wrap"><div class="loyal" id="lcard" tabindex="0" role="button" aria-label="${t('loy_how')}"><div class="lc-in">
      <div class="lc-front"><div class="row between"><div class="row" style="gap:10px"><span class="lc-logo">${A.markSvg({ fg:'#ffffff', still:true })}</span><div><b>iLab@home</b><div class="xs" style="opacity:.8">${t('loy_t')}</div></div></div><span class="lc-name">${esc(S.user.full_name.split(' ')[0])}</span></div>
        <div class="stamps">${Array.from({ length: per }, (_, i) => slot(i)).join('')}</div>
        <div class="lc-foot">${L.free_next ? t('loy_free_now') : t('loy_next', { n: left })}</div></div>
      <div class="lc-back"><b>${t('loy_how')}</b><p class="small" style="margin:8px 0 0">${t('loy_how_p')}</p></div></div></div>
      <div class="xs muted center" style="margin-top:8px">↻ ${t('loy_how')}</div></div>
    <div class="card refer"><div class="row" style="gap:12px;align-items:flex-start">${A.catIcon('packages', 28).replace('packages','')}<div class="grow"><h3 style="margin:0">${t('ref_t')}</h3><p class="small muted" style="margin:4px 0 12px">${t('ref_p', { x: rw })}</p>
      <div class="xs muted">${t('ref_code')}</div><div class="ref-code ltr" id="rcode">${esc(L.ref_code || '—')}</div>
      <div class="row wrap" style="gap:8px;margin-top:10px"><button class="btn sm" id="rcopy">${ic('copy',16)} ${t('copy_code')}</button><a class="btn sm soft" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(msg)}">WhatsApp</a>${navigator.share ? `<button class="btn sm ghost" id="rshare">${ic('share',16)} ${t('ref_share')}</button>` : ''}</div>
      ${L.referred ? `<div class="xs" style="margin-top:10px;color:var(--teal);font-weight:600">${ic('users',14)} ${t('ref_count', { n: L.referred })}</div>` : ''}</div></div>
      ${L.can_apply_ref ? `<hr class="sep"><div class="b small">${t('ref_have')}</div><div class="row" style="margin-top:8px"><input class="input grow ltr" id="rin" style="text-transform:uppercase" placeholder="IL•••••" autocomplete="off"><button class="btn soft" id="rapply">${t('ref_apply')}</button></div><div class="err" id="rerr"></div>` : ''}</div>
    <div class="card"><h3>${t('loy_hist')}</h3>${(L.history || []).length ? `<div class="stack" style="--g:8px">${L.history.map(h => `<div class="vline"><div><b class="ltr">${esc(h.code)}</b><div class="xs muted">${fmtDate(h.at)}</div></div>${h.free ? `<span class="chip teal">${ic('star',13)} ${t('loy_free')}</span>` : stChip(h.status)}</div>`).join('')}</div>` : `<p class="muted small" style="margin:0">${t('none_orders')}</p>`}</div>
  </div>`);
  const card = $('#lcard'); card.onclick = card.onkeydown = e => { if (e.type === 'keydown' && !['Enter',' '].includes(e.key)) return; card.classList.toggle('flip'); };
  $('#rcopy').onclick = () => copyText(L.ref_code);
  if ($('#rshare')) $('#rshare').onclick = () => navigator.share({ title: 'iLab@home', text: msg }).catch(() => {});
  if ($('#rapply')) $('#rapply').onclick = async () => { try { await busy($('#rapply'), () => API.referralApply($('#rin').value)); toast(t('ref_ok', { x: rw })); S.loy = undefined; viewLoyalty(); } catch(e) { $('#rerr').textContent = errMsg(e); } };
  /* stamps land one by one */
  const ons = $$('.stamp.on'); if (window.FX && ons.length) { const go = () => { ons.forEach((st, i) => setTimeout(() => FX.stamp(st), 250 + i * 220)); if (L.free_next) setTimeout(() => FX.celebrate('small'), 300 + ons.length * 220); }; if (window.gsap) go(); else setTimeout(() => { if (window.gsap) go(); }, 1400); }
}

/* ---------- privacy & my data ---------- */
async function viewPrivacy(){
  loading(t('m_privacy'));
  let d; try { d = await API.privacy(); } catch(e) { app.innerHTML = shell(t('m_privacy'), emptyBox(errMsg(e))); return; }
  const u = S.user; const isP = u.role === 'patient';
  const roleName = r => ({ share: t('role_share'), lab: t('role_lab'), doctor: t('role_doctor'), admin: t('role_admin'), staff: t('role_admin') })[r] || t('r_' + r);
  const reqKind = k => ({ export: t('pv_exp'), delete: t('pv_del'), correct: t('pv_fix') })[k] || esc(k);
  app.innerHTML = shell(t('m_privacy'), `<div class="stack-lg">
    <div class="card pv-head"><div class="row" style="gap:14px;align-items:flex-start"><span class="pv-ic">${ic('shield',30)}</span><div class="grow"><h2 style="margin:0">${t('pv_t')}</h2><p class="small muted" style="margin:6px 0 0">${t('pv_p')}</p>${d.consent_at ? `<div class="xs" style="margin-top:8px;color:var(--teal);font-weight:600">${ic('check',13)} ${t('pv_consent', { d: fmtDate(d.consent_at) })}</div>` : ''}</div></div></div>
    ${isP ? `<div class="card"><h3>${ic('eye',20)} ${t('pv_views')}</h3><p class="xs muted">${t('pv_views_p')}</p>${d.views.length ? `<div class="stack" style="--g:6px">${d.views.map(v => `<div class="vline"><div><b>${esc(v.who || roleName(v.role))}</b><div class="xs muted">${roleName(v.role)} · <span class="ltr">${esc(v.code)}</span></div></div><span class="xs muted">${fmtDT(v.at)}</span></div>`).join('')}</div>` : `<p class="small muted" style="margin:0">${t('pv_none')}</p>`}</div>
    ${d.shares.length ? `<div class="card"><h3>${ic('share',20)} ${t('pv_shares')}</h3><div class="stack" style="--g:6px">${d.shares.map(x => { const live = !x.revoked && new Date(x.expires_at) > new Date(); return `<div class="vline"><div><b class="ltr">${esc(x.code)}</b><div class="xs muted">${t('share_until', { d: fmtDT(x.expires_at) })} · 👁 ${x.views}</div></div>${live ? `<button class="btn ghost sm" data-stop="${esc(x.token)}">${t('pv_stop')}</button>` : `<span class="chip gray">${t('pv_stopped')}</span>`}</div>`; }).join('')}</div></div>` : ''}` : ''}
    <div class="card"><div class="stack" style="--g:10px">
      <div class="pv-act"><div class="grow"><b>${ic('download',18)} ${t('pv_exp')}</b><div class="xs muted">${t('pv_exp_p')}</div></div><button class="btn sm" id="pvx">${ic('download',16)}</button></div>
      <div class="pv-act"><div class="grow"><b>${ic('edit',18)} ${t('pv_fix')}</b></div><button class="btn sm soft" data-req="correct">${t('send')}</button></div>
      <div class="pv-act"><div class="grow"><b>${ic('x',18)} ${t('pv_del')}</b><div class="xs muted">${t('pv_del_p')}</div></div><button class="btn sm ghost" data-req="delete">${t('send')}</button></div></div></div>
    ${d.requests.length ? `<div class="card"><h3>${t('pv_req_t')}</h3>${d.requests.map(r => `<div class="vline"><div><b>${reqKind(r.kind)}</b><div class="xs muted">${fmtDT(r.created_at)}${r.reply ? ' · ' + esc(r.reply) : ''}</div></div><span class="chip ${r.status === 'open' ? 'amber' : r.status === 'done' ? 'teal' : 'gray'}">${esc(r.status)}</span></div>`).join('')}</div>` : ''}
    ${isP ? '' : `<div class="banner blue small">${ic('clock',18)}<span>${t('pv_idle')}</span></div>`}
    <a class="small b" href="#/sources#privacy">${ic('file',14)} ${t('sources_hint')} ›</a>
  </div>`);
  $('#pvx').onclick = async () => { try { const data = await busy($('#pvx'), () => API.dataExport()); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); a.download = 'iLabAtHome-my-data.json'; document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 600); } catch(e) { toast(errMsg(e), true); } };
  $$('[data-req]').forEach(b => b.onclick = () => modal(`<h3>${reqKind(b.dataset.req)}</h3>${b.dataset.req === 'delete' ? `<p class="small muted">${t('pv_del_p')}</p>` : ''}<label class="field"><span>${t('pv_note')}</span><textarea class="input" id="pvn" rows="3" maxlength="1000"></textarea></label><div class="err" id="pve"></div><button class="btn block" id="pvs">${t('send')}</button>`, (el, close) => {
    $('#pvs', el).onclick = async () => { try { await busy($('#pvs', el), () => API.privacyRequest(b.dataset.req, $('#pvn', el).value)); close(); toast(t('pv_req_ok')); viewPrivacy(); } catch(e) { $('#pve', el).textContent = errMsg(e); } }; }));
  $$('[data-stop]').forEach(b => b.onclick = async () => { try { await busy(b, () => API.shareRevoke(b.dataset.stop)); viewPrivacy(); } catch(e) { toast(errMsg(e), true); } });
}

/* ---------- sources & references ---------- */
const SOURCES = [
  { id:'ranges', t:['Lab ranges and result reading','النطاقات وقراءة النتائج'], items:[
    ['KDIGO 2024 Clinical Practice Guideline for CKD (eGFR, albumin/creatinine)', 'https://kdigo.org/guidelines/ckd-evaluation-and-management/'],
    ['American Diabetes Association · Standards of Care in Diabetes (HbA1c, glucose)', 'https://professional.diabetes.org/standards-of-care'],
    ['NIH Office of Dietary Supplements · Vitamin D fact sheet', 'https://ods.od.nih.gov/factsheets/VitaminD-HealthProfessional/'],
    ['WHO · Haemoglobin concentrations for the diagnosis of anaemia', 'https://www.who.int/publications/i/item/WHO-NMH-NHD-MNM-11.1'] ] },
  { id:'screening', t:['Screening and self-collection','الكشف المبكر والفحص الذاتي'], items:[
    ['American Cancer Society · Colorectal cancer screening from age 45 (FIT)', 'https://www.cancer.org/cancer/types/colon-rectal-cancer/detection-diagnosis-staging/acs-recommendations.html'],
    ['US Preventive Services Task Force · Colorectal cancer screening (2021)', 'https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/colorectal-cancer-screening'],
    ['WHO · Guideline for screening and treatment of cervical pre-cancer (HPV self-sampling)', 'https://www.who.int/publications/i/item/9789240030824'] ] },
  { id:'samples', t:['Sample transport and safety','نقل العينات والسلامة'], items:[
    ['WHO · Laboratory biosafety manual, 4th edition', 'https://www.who.int/publications/i/item/9789240011311'],
    ['WHO · Guidance on regulations for the transport of infectious substances', 'https://www.who.int/publications/i/item/9789240089778'] ] },
  { id:'oman', t:['Oman rules and expat medicals','أنظمة عمان وفحص العمالة'], items:[
    ['Ministry of Health Oman · Licensing and assessing nursing categories', 'https://moh.gov.om/media/tklpor0j/licensing-and-assessing-nursing-categories.pdf'],
    ['Oman Medical Specialty Board (OMSB)', 'https://omsb.gov.om'],
    ['Oman Observer · New guidelines for visa medical certification', 'https://www.omanobserver.om/article/1147865/oman/health/new-guidelines-for-visa-medical-certification'],
    ['Oman Observer · Visa medical to include latent TB screening', 'https://www.omanobserver.om/article/1157277/oman/health/visa-medical-to-include-latent-tb-screening-moh'] ] },
  { id:'privacy', t:['Privacy and data protection','الخصوصية وحماية البيانات'], items:[
    ['Royal Decree 6/2022 · Personal Data Protection Law (Oman)', 'https://decree.om/2022/rd20220006/'],
    ['Al Tamimi & Co · The Omani Personal Data Protection Law comes into force', 'https://tamimi.com/news/new-omani-personal-data-protection-law-comes-into-force'] ] },
  { id:'texts', t:['Qur’an and hadith shown with results','الآيات والأحاديث المعروضة مع النتائج'], items:[
    ['Qur’an 26:80 · «وإذا مرضت فهو يشفين»', 'https://quran.com/26/80'],
    ['Qur’an 7:31 · «وكلوا واشربوا ولا تسرفوا»', 'https://quran.com/7/31'],
    ['Sahih al-Bukhari 6412 · «نعمتان مغبون فيهما…»', 'https://sunnah.com/bukhari:6412'],
    ['Sahih al-Bukhari 5678 · «ما أنزل الله داء إلا أنزل له شفاء»', 'https://sunnah.com/bukhari:5678'],
    ['Sahih al-Bukhari 1975 · «إن لجسدك عليك حقا»', 'https://sunnah.com/bukhari:1975'],
    ['Jami at-Tirmidhi 2346 · «من أصبح منكم آمنا في سربه…»', 'https://sunnah.com/tirmidhi:2346'],
    ['Qur’an 14:7 · «لئن شكرتم لأزيدنكم» (and 1:2, 2:152, 2:155, 3:173, 10:10, 12:87, 13:28, 14:34, 17:82, 31:12, 34:13, 93:11, 94:5)', 'https://quran.com/14/7'],
    ['Sahih Muslim 2999 · «عجبا لأمر المؤمن…»', 'https://sunnah.com/muslim:2999'],
    ['Sahih Muslim 223 · «الطهور شطر الإيمان والحمد لله تملأ الميزان»', 'https://sunnah.com/muslim:223'],
    ['Sahih Muslim 2734 · «إن الله ليرضى عن العبد أن يأكل الأكلة فيحمده عليها»', 'https://sunnah.com/muslim:2734'],
    ['Sahih Muslim 2664 · «المؤمن القوي خير…»', 'https://sunnah.com/muslim:2664'],
    ['Sahih Muslim 2204 · «لكل داء دواء»', 'https://sunnah.com/muslim:2204'],
    ['Sahih al-Bukhari 5641 · «ما يصيب المسلم من نصب ولا وصب…»', 'https://sunnah.com/bukhari:5641'],
    ['Sahih al-Bukhari 5743 · «اللهم رب الناس أذهب البأس…»', 'https://sunnah.com/bukhari:5743'],
    ['Sunan Abi Dawud 4811 · «من لا يشكر الناس لا يشكر الله»', 'https://sunnah.com/abudawud:4811'],
    ['Jami at-Tirmidhi 2380 · «ما ملأ آدمي وعاء شرا من بطن»', 'https://sunnah.com/tirmidhi:2380'] ] }
];
/* ================= v32: sample guarantee and our responsibilities (#/guarantee) ================= */
const GUAR = {
  en: { t:'Sample guarantee & our policy', p:'If something goes wrong with your sample on our side, you never pay for it. Here is exactly what we cover, what we do not, and how it works.',
    promise:'Our promise', pr:[['refresh','Free re-collection','We take a new sample at home, at a time you choose, with no fees at all.'],['card','Or a full refund','Prefer not to redo it? We refund the affected tests and the visit fee to your original payment method.'],['star','An apology gift','A code that waives the fee of your next home visit.']],
    when:'When the guarantee applies (our responsibility)', wl:['The sample is lost, broken or leaks during transport.','The cold box goes outside 2–8 °C, or the sample reaches the lab after its safe time.','A labelling or identity mix-up on our side, at the visit, in transport or at the lab.','The lab cannot test the sample because of how it was taken, stored or handled (for example haemolysed or not enough blood).','An error or instrument failure at our partner lab.','The nurse or courier does not come, or is more than 60 minutes late without telling you: free new time and the visit fee back.'],
    who:'Who is responsible?', whop:'iLab@home is your single point of responsibility. You deal only with us: we fix it first, and then settle with the nurse, courier or partner lab under our contracts and our professional liability insurance. You never have to chase anyone.',
    how:'What happens if something goes wrong', hs:[['Detected','Every hand-over is scanned with time and temperature, so we usually know before you do. You can also report a problem from your order.'],['We tell you','We contact you as soon as we know, at the latest within 24 hours, and explain what happened.'],['You choose','Free re-collection or a full refund. Your choice is final.'],['Done','Re-collection is booked at no cost. Refunds are sent the same day and reach you within 5–10 working days, depending on your bank.']],
    not:'What we are not responsible for', nl:[['Wrong or missing details','An address, phone number or patient details entered incorrectly that stop the visit or mix up your own records.'],['Preparation not followed','Not fasting when asked, or taking medicine or supplements against the test instructions. We can take a new sample, but the visit fee applies.'],['Missed appointment','Nobody at the address after the nurse waits 15 minutes. Tests are refunded; the visit fee is not.'],['Self-kits used incorrectly','A self-collection kit not used as instructed, or not handed back on time.'],['A sample that cannot be taken','For medical reasons (for example after two gentle attempts). You pay nothing for the tests and we offer another time or advise you where to go.'],['Medical decisions','Reports explain your results but are not a diagnosis. Treatment decisions are made with your doctor.'],['Events outside our control','Severe weather, road closures or network outages: we reschedule for free, without further compensation.'],['Indirect costs','Time off work, transport or other providers’ fees.']],
    can:'Cancelling and changing your visit', cl:['Free change or cancellation up to 2 hours before the visit.','Later than that, or a missed visit: the home visit fee is kept; tests that were not taken are always refunded.','Self-kits: once the kit is delivered, the courier fee is kept; tests are refunded if the kit is returned unopened.'],
    ct:'Questions or a complaint?', ctp:'Write to us on WhatsApp or email. We answer within 2 working days and keep a record of every complaint.', upd:'Last updated 25 November 2026 · Pilot version' },
  ar: { t:'ضمان العينة وسياستنا', p:'إذا صار شي لعينتك من جهتنا، أنت ما تدفع شي أبداً. هنا بالضبط وش نتحمّل، ووش ما نتحمّل، وكيف تمشي الأمور.',
    promise:'وعدنا لك', pr:[['refresh','إعادة السحب مجاناً','ناخذ عينة جديدة في البيت، في الوقت اللي يناسبك، وبدون أي رسوم.'],['card','أو استرجاع المبلغ كامل','ما تبي تعيد؟ نرجّع لك قيمة الفحوصات المتأثرة ورسوم الزيارة على نفس طريقة الدفع.'],['star','هدية اعتذار','كود يلغي رسوم زيارتك المنزلية القادمة.']],
    when:'متى ينطبق الضمان (مسؤوليتنا)', wl:['العينة ضاعت أو انكسرت أو تسرّبت أثناء النقل.','صندوق التبريد طلع عن ٢–٨ °م، أو العينة وصلت المختبر بعد الوقت الآمن.','خطأ في الملصق أو الهوية من جهتنا، في الزيارة أو النقل أو المختبر.','المختبر ما قدر يحلل العينة بسبب طريقة السحب أو الحفظ أو النقل (مثل تكسّر الدم أو كمية غير كافية).','خطأ أو عطل في أجهزة المختبر الشريك.','الممرض أو المندوب ما وصل، أو تأخر أكثر من 60 دقيقة بدون ما يبلغك: موعد جديد مجاناً ونرجّع رسوم الزيارة.'],
    who:'منو يتحمّل المسؤولية؟', whop:'آي لاب@هوم هي الجهة الوحيدة المسؤولة قدامك. تتعامل معنا بس: نصلّح المشكلة أول، وبعدين نتحاسب مع الممرض أو المندوب أو المختبر الشريك حسب عقودنا وتأمين المسؤولية المهنية. أنت ما تلاحق أحد أبداً.',
    how:'وش يصير إذا صار خطأ', hs:[['نكتشفه','كل تسليم ينمسح بالوقت والحرارة، فغالباً نعرف قبلك. وتقدر بعد تبلّغ عن مشكلة من صفحة طلبك.'],['نبلّغك','نتواصل معك أول ما نعرف، وبحد أقصى خلال 24 ساعة، ونشرح لك وش صار.'],['أنت تختار','إعادة السحب مجاناً أو استرجاع المبلغ كامل، والقرار لك.'],['نخلّصها','نحجز إعادة السحب بدون تكلفة، أو نرسل المبلغ نفس اليوم ويوصلك خلال 5 إلى 10 أيام عمل حسب بنكك.']],
    not:'الأشياء اللي ما نتحمّلها', nl:[['بيانات غلط أو ناقصة','عنوان أو رقم أو بيانات مريض مكتوبة غلط تمنع الزيارة أو تلخبط سجلاتك.'],['عدم الالتزام بالتحضير','ما صمت لما طلبنا، أو أخذت أدوية أو مكملات عكس تعليمات الفحص. نقدر نعيد السحب، بس تنطبق رسوم الزيارة.'],['عدم التواجد في الموعد','ما في أحد في العنوان بعد ما ينتظر الممرض 15 دقيقة. نرجّع قيمة الفحوصات، ورسوم الزيارة ما ترجع.'],['استخدام العُدّة الذاتية غلط','العُدّة الذاتية ما انستخدمت حسب التعليمات، أو ما انسلّمت في الوقت.'],['عينة ما ينفع تنسحب','لأسباب طبية (مثلاً بعد محاولتين بلطف). ما تدفع شي للفحوصات، ونعطيك موعد ثاني أو ننصحك وين تروح.'],['القرارات الطبية','التقرير يشرح نتائجك بس مو تشخيص، والعلاج يتقرر مع طبيبك.'],['ظروف خارجة عن إرادتنا','طقس شديد أو إغلاق طرق أو انقطاع الشبكة: نغيّر الموعد مجاناً بدون تعويض إضافي.'],['التكاليف غير المباشرة','الإجازة من الدوام أو المواصلات أو رسوم جهات ثانية.']],
    can:'إلغاء الزيارة أو تغييرها', cl:['التغيير أو الإلغاء مجاناً لين قبل الزيارة بساعتين.','بعدها، أو إذا ما كنت موجود: رسوم الزيارة ما ترجع، والفحوصات اللي ما انسحبت ترجع دايماً.','العُدّة الذاتية: بعد ما توصلك، رسوم المندوب ما ترجع، والفحوصات ترجع إذا رجّعت العُدّة بدون ما تنفتح.'],
    ct:'عندك سؤال أو شكوى؟', ctp:'راسلنا على الواتساب أو الإيميل، ونرد خلال يومين عمل، ونسجّل كل شكوى.', upd:'آخر تحديث 25 نوفمبر 2026 · نسخة المرحلة التجريبية' }
};
Object.assign(I18N.en, { m_guarantee:'Sample guarantee', guar_link:'Sample guarantee: free re-collection or a full refund if anything goes wrong on our side.', guar_book:'By confirming you agree to our sample guarantee and policy.',
  fq8:'What if my sample gets damaged?', fq8a:'It is never your loss: we take a new sample at home for free, or refund you in full. See our sample guarantee.' });
Object.assign(I18N.ar, { m_guarantee:'ضمان العينة', guar_link:'ضمان العينة: إعادة السحب مجاناً أو استرجاع المبلغ كامل إذا صار أي خطأ من جهتنا.', guar_book:'بالتأكيد أنت موافق على ضمان العينة وسياستنا.',
  fq8:'وش يصير إذا تخربت عينتي؟', fq8a:'ما تتحمّل شي أبداً: نعيد السحب في البيت مجاناً، أو نرجّع لك المبلغ كامل. شوف ضمان العينة.' });
function viewGuarantee(){
  const G = GUAR[S.lang === 'ar' ? 'ar' : 'en'];
  app.innerHTML = `${topbar()}<section class="section gu" style="padding-top:28px"><div class="wrap-w" style="max-width:960px">
    <div class="gu-hero"><div class="gu-shield" aria-hidden="true"><svg viewBox="0 0 120 130"><path d="M60 6 108 24v34c0 32-21 54-48 64C33 112 12 90 12 58V24Z" fill="#e3f7f4" stroke="#0fae9b" stroke-width="5"/><path class="gu-ck" d="M38 64l15 15 30-32" stroke="#0fae9b" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <div><h1 data-split>${G.t}</h1><p class="muted">${G.p}</p></div></div>
    <h2 class="hm-h">${G.promise}</h2><div class="grid g3 gu-pr">${G.pr.map(([i, a, b]) => `<div class="card"><span class="ic-round">${ic(i === 'refresh' ? 'van' : i === 'card' ? 'card' : 'star', 22)}</span><b>${a}</b><p class="small muted">${b}</p></div>`).join('')}</div>
    <div class="card gu-when"><h3>${ic('shield',20)} ${G.when}</h3><ul class="gu-l ok">${G.wl.map(x => `<li>${x}</li>`).join('')}</ul></div>
    <div class="card gu-who"><h3>${ic('users',20)} ${G.who}</h3><p>${G.whop}</p></div>
    <h2 class="hm-h">${G.how}</h2><div class="gu-steps">${G.hs.map(([a, b], n) => `<div class="gu-st"><span class="n">${n + 1}</span><b>${a}</b><span class="small muted">${b}</span></div>`).join('')}</div>
    <div class="card gu-not"><h3>${ic('shield',20)} ${G.not}</h3><div class="grid g2">${G.nl.map(([a, b]) => `<div class="gu-n"><b>${a}</b><span class="small muted">${b}</span></div>`).join('')}</div></div>
    <div class="card"><h3>${ic('cal',20)} ${G.can}</h3><ul class="gu-l">${G.cl.map(x => `<li>${x}</li>`).join('')}</ul></div>
    <div class="card"><h3>${ic('chat',20)} ${G.ct}</h3><p>${G.ctp}</p><div class="row wrap" style="gap:10px"><a class="btn" href="https://wa.me/${CONTACT.wa}" target="_blank" rel="noopener">WhatsApp</a><a class="btn ghost" href="#/contact">${t('m_contact')}</a></div></div>
    <p class="xs muted center">${G.upd}</p></div></section>${footer()}`;
}
async function viewSources(){
  const ar = S.lang === 'ar';
  app.innerHTML = `${topbar()}<section class="section" style="padding-top:32px"><div class="wrap-w" style="max-width:900px">
    <div class="section-h"><h2 data-split>${t('src_t')}</h2><p>${t('src_p')}</p></div>
    <div class="stack-lg">${SOURCES.map(g => `<div class="card src" id="${g.id}"><h3>${esc(g.t[ar ? 1 : 0])}</h3><ol class="src-l">${g.items.map(([n, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(n)}</a><div class="xs muted ltr">${esc(new URL(u).hostname)}</div></li>`).join('')}</ol></div>`).join('')}</div>
    <p class="xs muted" style="margin-top:18px">${t('report_disclaimer')}</p></div></section>${footer()}`;
}

/* ---------- workers & companies ---------- */
async function viewExpat(){
  await loadCatalog().catch(() => {}); const C = S.catalog; const P = id => C && C.P[id];
  const u = S.user; const coBtn = u && u.role === 'company' ? `<a class="btn" href="#/app/camps">${ic('building',18)} ${t('ex_req')}</a>` : `<a class="btn" href="#/${u ? 'app' : 'login'}">${ic('building',18)} ${t('ex_login_co')}</a><a class="btn ghost" href="#/register/company">${t('r_company')}</a>`;
  const pk = id => { const p = P(id); if (!p) return ''; const inC = S.cart.packages.includes(id); return pkgCard(p, inC); };
  app.innerHTML = `${topbar()}<section class="hero ex-hero"><div class="wrap-w"><div class="ex-in"><div><span class="chip purple">${ic('building',14)} ${t('m_expat')}</span><h1 data-split>${t('ex_t')}</h1><p class="muted">${t('ex_p')}</p><div class="row wrap" style="gap:10px;margin-top:16px">${coBtn}</div></div>
    <svg class="ex-art" viewBox="0 0 320 220" data-draw aria-hidden="true"><rect x="20" y="90" width="120" height="100" rx="10" fill="none" stroke="#1257d6" stroke-width="4"/><path d="M20 110h120M50 90V60h60v30" fill="none" stroke="#1257d6" stroke-width="4" stroke-linejoin="round"/><rect x="40" y="128" width="22" height="22" rx="4" fill="none" stroke="#18b5d8" stroke-width="3"/><rect x="98" y="128" width="22" height="22" rx="4" fill="none" stroke="#18b5d8" stroke-width="3"/><rect x="170" y="70" width="130" height="120" rx="14" fill="none" stroke="#0fae9b" stroke-width="4"/><path d="M205 70V52a30 30 0 0 1 60 0v18" fill="none" stroke="#0fae9b" stroke-width="4"/><path d="M235 105v40M215 125h40" stroke="#0fae9b" stroke-width="7" stroke-linecap="round"/><path d="M10 196h300" stroke="#c9d8f5" stroke-width="4" stroke-linecap="round"/></svg></div></div></section>
    <section class="section" style="padding-top:8px"><div class="wrap-w stack-lg">
      <div class="banner amber">${ic('shield',22)}<div><b>${t('ex_note_t')}</b><div class="small">${t('ex_note')}</div></div></div>
      <div class="grid g2"><div class="card feat"><h3>${ic('building',20)} ${t('ex_co_t')}</h3><p class="small muted">${t('ex_co_p')}</p><div class="row wrap" style="gap:8px">${coBtn}</div></div>
        <div class="card feat"><h3>${ic('home',20)} ${t('ex_home_t')}</h3><p class="small muted">${t('ex_home_p')}</p><a class="btn soft" href="#/${u ? 'app/tests' : 'tests'}?c=expat">${t('q_book')}</a></div></div>
      <div class="grid g3" id="expk">${pk('expat_pre')}${pk('housemaid')}</div>
      <div class="card"><h3>${t('ex_off_t')}</h3><ol class="small" style="margin:0;padding-inline-start:20px;line-height:1.9"><li>${t('ex_off_1')}</li><li>${t('ex_off_2')}</li><li>${t('ex_off_3')}</li></ol><a class="xs b" href="#/sources#oman" style="display:inline-block;margin-top:8px">${t('src_link')} ›</a></div>
    </div><div id="cbar"></div></section>${footer()}`;
  $$('#expk [data-add]').forEach(b => b.onclick = () => { const [ty, id] = b.dataset.add.split(':'); const was = S.cart.packages.includes(id); const rect = b.getBoundingClientRect(); toggleCart(ty, id); viewExpat().then(() => { if (!was && window.FX) { toastCart(); FX.flyToCart(rect); } }); });
  if ($('#cbar')) { $('#cbar').innerHTML = cartBar(); bindGo(); }
}
function parseWorkers(txt){
  return String(txt || '').split(/\r?\n/).map(l => l.trim()).filter(l => l && !/^name\b|^الاسم/i.test(l)).map(l => { const c = l.split(/\t|;|,/).map(x => x.trim());
    const g = (c[2] || '').toLowerCase(); return { n: c[0], id: c[1] || '', g: /^(m|male|ذكر|م)$/.test(g) ? 'male' : /^(f|female|أنثى|انثى|ث)$/.test(g) ? 'female' : null, nat: c[3] || '' }; }).filter(w => w.n);
}
async function viewCamps(){
  loading(t('m_camps'));
  const [list] = await Promise.all([API.campsMine(), loadCatalog()]); const C = S.catalog;
  const min = addDays(muscatNow().date, 2);
  const rchip = r => `<span class="chip ${r === 'fit' ? 'teal' : r === 'unfit' ? 'red' : r === 'retest' ? 'amber' : 'gray'}">${t('r_' + (r || 'pending'))}</span>`;
  app.innerHTML = shell(t('camp_t'), `<div class="stack-lg">
    <div class="card"><h3>${ic('plus',20)} ${t('camp_new')}</h3><div class="stack">
      <div class="grid g2"><label class="field"><span>${t('camp_pkg')}</span><select class="input" id="cpk">${C.packages.filter(p => ['expat_pre','housemaid','basic','annual'].includes(p.id)).map(p => `<option value="${p.id}">${esc(LN(p,'name'))} · ${omr(p.price)} ${t('omr')}</option>`).join('')}</select></label>
        <label class="field"><span>${t('camp_date')}</span><input class="input" type="date" id="cdt" min="${min}" value="${min}"></label></div>
      <div class="grid g2"><label class="field"><span>${t('wilayat')}</span><select class="input" id="cwl">${C.wilayats.map(w => `<option value="${esc(w)}">${esc(wN(w))}</option>`).join('')}</select></label>
        <label class="field"><span>${t('camp_site')}</span><input class="input" id="cst" maxlength="200"></label></div>
      <label class="field"><span>${t('camp_workers')}</span><textarea class="input ltr" id="cwk" rows="6" placeholder="Ram Kumar, P1234567, M, India&#10;Ali Khan, P7654321, M, Pakistan"></textarea><span class="hint">${t('camp_workers_p')}</span></label>
      <div class="row wrap" style="gap:8px"><label class="btn soft sm" style="cursor:pointer">${ic('file',16)} ${t('camp_csv')}<input type="file" id="ccsv" accept=".csv,.txt,text/csv" hidden></label><span class="small b" id="ccount"></span></div>
      <label class="check"><input type="checkbox" id="ccons"> ${t('camp_consent')}</label><div class="err" id="cerr"></div>
      <button class="btn teal" id="csend">${ic('send',18)} ${t('camp_send')}</button></div></div>
    ${list.length ? list.map(c => `<div class="card camp"><div class="row between wrap"><div><b class="ltr">${esc(c.code)}</b> · ${esc(LN(C.P[c.package_id] || {name_en:c.package_id, name_ar:c.package_id}, 'name'))}<div class="xs muted">${fmtDate(c.visit_date)} · ${esc(c.site)}${c.wilayat ? ' · ' + esc(wN(c.wilayat)) : ''}</div></div><span class="chip ${c.status === 'completed' ? 'teal' : c.status === 'cancelled' ? 'gray' : 'blue'}">${t(c.status === 'cancelled' ? 'cs2_cancelled' : 'cs_' + c.status)}</span></div>
      <details style="margin-top:10px"><summary class="small b">${t('camp_n', { n: (c.workers || []).length })}</summary><div class="scroll-x"><table class="rtable small"><tbody>${(c.workers || []).map(w => `<tr><td>${esc(w.n)}</td><td class="ltr muted">•••${esc(w.id || '')}</td><td>${rchip(w.r)}</td></tr>`).join('')}</tbody></table></div></details></div>`).join('') : ''}
  </div>`);
  const upd = () => { const n = parseWorkers($('#cwk').value).length; $('#ccount').textContent = n ? t('camp_n', { n }) : ''; };
  $('#cwk').oninput = upd;
  $('#ccsv').onchange = e => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { $('#cwk').value = String(rd.result || ''); upd(); }; rd.readAsText(f); };
  $('#csend').onclick = async () => { const workers = parseWorkers($('#cwk').value); if (!workers.length) { $('#cerr').textContent = t('camp_workers_p'); return; }
    if (!$('#ccons').checked) { $('#cerr').textContent = t('e_NEED_CONSENT'); return; }
    try { await busy($('#csend'), () => API.campCreate({ package_id: $('#cpk').value, visit_date: $('#cdt').value, wilayat: $('#cwl').value, site: $('#cst').value, consent: true, workers })); toast(t('camp_sent')); if (window.FX) FX.celebrate('small'); viewCamps(); } catch(e) { $('#cerr').textContent = errMsg(e); } };
}

/* ---------- admin: safety & privacy, coupons, camps ---------- */
async function viewAdminSafety(){
  loading(t('m_safety'));
  const [sf, pv] = await Promise.all([API.adminSafety(), API.adminPrivacy()]); const ro = S.user.is_demo;
  const reqKind = k => ({ export: t('pv_exp'), delete: t('pv_del'), correct: t('pv_fix') })[k] || esc(k);
  app.innerHTML = shell(t('m_safety'), `<div class="stack-lg">
    <div class="card"><h3>🚨 ${t('adm_sos')}</h3>${sf.sos.length ? sf.sos.map(x => `<div class="vline ${x.resolved_at ? '' : 'sos-open'}"><div><b>${esc(x.who)}</b> <span class="chip gray">${t('r_' + x.role)}</span><div class="xs muted">${fmtDT(x.at)}${x.order ? ' · ' + esc(x.order) : ''}${x.note ? ' · ' + esc(x.note) : ''}</div>
      <div class="row wrap" style="gap:6px;margin-top:6px">${x.lat ? `<a class="btn sm soft" target="_blank" rel="noopener" href="https://maps.google.com/?q=${x.lat},${x.lng}">${ic('pin',14)} Map</a>` : ''}${x.phone ? `<a class="btn sm soft ltr" href="tel:${esc(x.phone)}">${ic('phone',14)} ${esc(x.phone)}</a>` : ''}</div></div>
      ${x.resolved_at ? `<span class="chip teal">${t('adm_resolve')}</span>` : `<button class="btn sm red" data-close="sos:${x.id}" ${ro ? 'disabled' : ''}>${t('adm_resolve')}</button>`}</div>`).join('') : `<p class="small muted" style="margin:0">${t('nothing')}</p>`}</div>
    <div class="card"><h3>${ic('file',20)} ${t('adm_inc')}</h3>${sf.incidents.length ? sf.incidents.map(x => `<div class="vline"><div><b>${t('inc_' + x.kind)}</b> · ${esc(x.who)}<div class="xs muted">${fmtDT(x.at)}${x.order ? ' · ' + esc(x.order) : ''}</div><div class="small">${esc(x.note)}</div></div>${x.status === 'open' ? `<button class="btn sm ghost" data-close="incident:${x.id}" ${ro ? 'disabled' : ''}>${t('adm_close')}</button>` : `<span class="chip gray">${t('adm_close')}</span>`}</div>`).join('') : `<p class="small muted" style="margin:0">${t('nothing')}</p>`}</div>
    <div class="card"><h3>${ic('shield',20)} ${t('adm_pv')}</h3>${pv.length ? pv.map(r => `<div class="vline"><div><b>${reqKind(r.kind)}</b> · ${esc(r.user)}<div class="xs muted">${fmtDT(r.created_at)}${r.note ? ' · ' + esc(r.note) : ''}${r.reply ? ' · ↳ ' + esc(r.reply) : ''}</div></div>${r.status === 'open' ? `<div class="row" style="gap:6px"><button class="btn sm" data-pv="${r.id}:done" ${ro ? 'disabled' : ''}>${t('adm_done')}</button><button class="btn sm ghost" data-pv="${r.id}:rejected" ${ro ? 'disabled' : ''}>${t('adm_reject')}</button></div>` : `<span class="chip gray">${esc(r.status)}</span>`}</div>`).join('') : `<p class="small muted" style="margin:0">${t('nothing')}</p>`}</div>
  </div>`);
  $$('[data-close]').forEach(b => b.onclick = async () => { const [k, id] = b.dataset.close.split(':'); try { await busy(b, () => API.adminSafetyClose(k, +id)); viewAdminSafety(); } catch(e) { toast(errMsg(e), true); } });
  $$('[data-pv]').forEach(b => b.onclick = () => { const [id, st] = b.dataset.pv.split(':'); modal(`<h3>${t('adm_reply')}</h3><textarea class="input" id="pvr" rows="3"></textarea><button class="btn block" style="margin-top:10px" id="pvok">${t('send')}</button>`, (el, close) => {
    $('#pvok', el).onclick = async () => { try { await busy($('#pvok', el), () => API.adminPrivacyDone(+id, st, $('#pvr', el).value)); close(); viewAdminSafety(); } catch(e) { toast(errMsg(e), true); } }; }); });
}
async function viewAdminCoupons(){
  loading(t('m_coupons'));
  const list = await API.adminCoupons(); const ro = S.user.is_demo;
  app.innerHTML = shell(t('m_coupons'), `<div class="stack-lg">
    <div class="card"><h3>${ic('plus',20)} ${t('adm_coupons')}</h3><div class="grid g3">
      <label class="field"><span>${t('cp_code')}</span><input class="input ltr" id="kc" maxlength="20" style="text-transform:uppercase"></label>
      <label class="field"><span>${t('cp_kind')}</span><select class="input" id="kk"><option value="pct">${t('cp_pct')}</option><option value="fixed">${t('cp_fixed')}</option></select></label>
      <label class="field"><span>${t('cp_value')}</span><input class="input" id="kv" type="number" step="0.5" min="0.5"></label>
      <label class="field"><span>${t('cp_max')}</span><input class="input" id="km" type="number" min="1"></label>
      <label class="field"><span>${t('cp_min')}</span><input class="input" id="kn" type="number" step="0.5" min="0" value="0"></label>
      <label class="field"><span>${t('cp_exp')}</span><input class="input" id="ke" type="date"></label></div>
      <label class="check" style="margin-top:8px"><input type="checkbox" id="kf"> ${t('cp_first')}</label><div class="err" id="kerr"></div>
      <button class="btn" style="margin-top:10px" id="ksave" ${ro ? 'disabled' : ''}>${t('cp_save')}</button></div>
    <div class="card"><div class="scroll-x"><table class="rtable"><thead><tr><th>${t('cp_code')}</th><th>${t('cp_value')}</th><th>${t('cp_min')}</th><th>${t('cp_exp')}</th><th></th></tr></thead><tbody>${list.map(c => `<tr><td class="ltr b">${esc(c.code)}${c.first_order ? ` <span class="chip teal">${t('cp_first')}</span>` : ''}</td><td>${c.kind === 'pct' ? esc(c.value) + '%' : omr(c.value) + ' ' + t('omr')}</td><td>${omr(c.min_sub)}</td><td>${c.expires_on ? fmtDate(c.expires_on) : '—'}</td><td class="xs muted">${t('cp_used', { a: c.used, b: c.max_uses || '∞' })}</td></tr>`).join('')}</tbody></table></div></div>
  </div>`);
  $('#ksave').onclick = async () => { try { await busy($('#ksave'), () => API.adminCouponSave({ code: $('#kc').value, kind: $('#kk').value, value: $('#kv').value, max_uses: $('#km').value, min_sub: $('#kn').value, expires_on: $('#ke').value, first_order: $('#kf').checked, active: true })); viewAdminCoupons(); } catch(e) { $('#kerr').textContent = errMsg(e); } };
}
async function viewAdminCamps(){
  loading(t('m_camps'));
  const [list] = await Promise.all([API.adminCamps(), loadCatalog()]); const C = S.catalog; const ro = S.user.is_demo;
  app.innerHTML = shell(t('m_camps'), `<div class="stack-lg">${list.length ? list.map(c => `<div class="card camp" data-camp="${c.id}"><div class="row between wrap"><div><b class="ltr">${esc(c.code)}</b> · ${esc(c.company)}<div class="xs muted">${esc(LN(C.P[c.package_id] || {name_en:c.package_id, name_ar:c.package_id}, 'name'))} · ${fmtDate(c.visit_date)} · ${esc(c.site)} · ${t('camp_n', { n: c.workers_n })}</div></div>
      <select class="input sm" data-st style="width:auto">${['requested','scheduled','visited','completed','cancelled'].map(x => `<option value="${x}" ${c.status === x ? 'selected' : ''}>${t(x === 'cancelled' ? 'cs2_cancelled' : 'cs_' + x)}</option>`).join('')}</select></div>
      <details style="margin-top:10px"><summary class="small b">${t('camp_workers')}</summary><div class="scroll-x"><table class="rtable small"><tbody>${(c.workers || []).map((w, i) => `<tr><td>${esc(w.n)}</td><td class="ltr muted">${esc(w.id || '')}</td><td>${esc(w.nat || '')}</td><td><select class="input sm" data-r="${i}">${['','fit','unfit','retest'].map(r => `<option value="${r}" ${(c.results || {})[i] === r ? 'selected' : ''}>${r ? t('r_' + r) : '—'}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div></details>
      <button class="btn sm" style="margin-top:10px" data-save ${ro ? 'disabled' : ''}>${t('confirm')}</button></div>`).join('') : emptyBox(t('nothing'))}</div>`);
  $$('[data-camp]').forEach(card => { const b = $('[data-save]', card); if (b) b.onclick = async () => { const results = {}; $$('[data-r]', card).forEach(s => { if (s.value) results[s.dataset.r] = s.value; });
    try { await busy(b, () => API.campUpdate(card.dataset.camp, { status: $('[data-st]', card).value, results })); toast(t('done')); viewAdminCamps(); } catch(e) { toast(errMsg(e), true); } }; });
}
/* staff accounts sign out after 30 minutes without use (privacy of patient data on shared devices) */
let IDLE_T = null, IDLE_AT = 0;
function armIdle(){ const now = Date.now(); if (now - IDLE_AT < 20000) return; IDLE_AT = now; clearTimeout(IDLE_T);
  if (S.user && !['patient','company'].includes(S.user.role)) IDLE_T = setTimeout(() => { if (S.user) { toast(t('idle_out')); doLogout(); } }, 30 * 60 * 1000); }
['pointerdown','keydown','touchstart','scroll'].forEach(ev => addEventListener(ev, armIdle, { passive: true }));

async function boot(){
  setLang(S.lang);
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.installEvt = e; if (location.hash.startsWith('#/install')) render(); });
  window.addEventListener('appinstalled', () => { S.installEvt = null; if (location.hash.startsWith('#/install')) render(); });
  /* signed in before: open at once with the saved profile and check it with the server in the background.
     Only a real "session ended" answer signs the person out; a weak signal no longer does. */
  if (API.hasToken()) {
    let cu = null; try { cu = JSON.parse(localStorage.getItem('lah_user') || 'null'); } catch(e) {}
    const check = API.me().then(r => { S.user = r.user; S.unread = r.unread; saveUser(); return true; }).catch(e => { if (e.code === 'AUTH_REQUIRED') { S.user = null; saveUser(); return false; } return null; });
    if (cu && cu.id) { S.user = cu; check.then(ok => { if (ok === false && location.hash.startsWith('#/app')) go('login'); }); }
    else await check;
  }
  window.addEventListener('hashchange', render);
  document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[href^="#/"]'); if (a && !e.defaultPrevented && a.getAttribute('href') === location.hash && !a.hasAttribute('data-menu')) { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); } });
  holoCalm();
  appFeel();
  splashIntro();
  render();
  setInterval(poll, 20000);
  if (S.user && 'Notification' in window && Notification.permission === 'granted' && localStorage.getItem('lah_push') === '1') setTimeout(() => pushEnable(true).catch(() => {}), 3000);
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
}
boot();
})();
