/* Lab@Home – single-page app (vanilla JS, no build step) */
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
function t(k, v){ let s = (I18N[S.lang]||{})[k]; if (s == null) s = I18N.en[k]; if (s == null) return k; if (v) for (const x in v) s = s.split('{'+x+'}').join(v[x]); return s; }
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
function toast(msg, bad){ const el = $('#toast'); el.textContent = msg; el.className = 'show' + (bad ? ' bad' : ''); clearTimeout(el._t); el._t = setTimeout(() => el.className = '', 3200); }
function errMsg(e){ const c = e && e.code ? e.code : 'GENERIC'; const k = 'e_' + c; return (I18N[S.lang][k] || I18N.en[k]) ? t(k) : t('e_GENERIC'); }
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
function setLang(l){ S.lang = l; localStorage.setItem('lah_lang', l); document.documentElement.lang = l; document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr'; document.title = 'Lab@Home · ' + t('brand_sub'); }
async function loadCatalog(){ if (!S.catalog) { S.catalog = await API.catalog(); S.catalog.T = {}; S.catalog.tests.forEach(x => S.catalog.T[x.id] = x); S.catalog.P = {}; S.catalog.packages.forEach(x => S.catalog.P[x.id] = x); } return S.catalog; }
const fee = () => S.catalog ? Number(S.catalog.home_fee) : 5;
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
    <button class="icon-btn" data-menu aria-label="${t('menu')}">${ic('menu')}</button>
    <a href="#/" class="brand">${brandInner(t('brand_sub'))}</a>
    <nav class="nav"><a href="#/how">${t('nav_how')}</a><a href="#/tests">${t('nav_tests')}</a><a href="#/install">${t('m_install')}</a><a href="#/contact">${t('m_contact')}</a><a href="#/about">${t('m_about')}</a></nav>
    <div class="grow"></div>
    <button class="lang hide-sm" data-lang>${t('lang')}</button>
    <a class="icon-btn ${S.user ? '' : 'hide-sm'}" href="#/${S.user ? 'app/cart' : 'tests'}" aria-label="${t('m_cart')}">${ic('box')}${n ? `<span class="dot">${n}</span>` : ''}</a>
    ${S.user ? `<a class="btn sm" href="#/app">${ic('home',18)} <span class="hide-sm">${esc(t('m_home'))}</span></a>` : `<a class="btn sm" href="#/login">${t('login')}</a>`}
  </div></header>`;
}
function testCard(x, inCart){
  return `<div class="tcard">${A.catIcon(x.cat)}
    <div class="grow"><h4>${esc(LN(x,'name'))}</h4><div class="muted small">${esc(LN(x,'desc'))}</div>
    <div class="meta"><span class="chip ${x.fasting_hours ? 'amber' : 'teal'}">${x.fasting_hours ? t('fasting',{h:x.fasting_hours}) : t('no_fasting')}</span><span class="chip gray">${t('results_in',{h:x.tat_hours})}</span></div></div>
    <div style="text-align:end;display:flex;flex-direction:column;align-items:flex-end;gap:8px"><div class="price">${omr(x.price)} <small>${t('omr')}</small></div>
    <button class="btn sm ${inCart ? 'teal' : 'soft'}" data-add="test:${x.id}">${inCart ? ic('check',16,2.6) + ' ' + t('in_cart') : ic('plus',16,2.6) + ' ' + t('add_cart')}</button></div></div>`;
}
function pkgCard(p, inCart){
  const full = pkgFull(p);
  return `<div class="pkg ${inCart ? 'on' : ''}">
    ${p.badge ? `<span class="chip ${p.badge === 'best' ? 'purple' : p.badge === 'kids' || p.badge === 'seniors' ? 'teal' : 'amber'} tag">${t(p.badge === 'best' ? 'best' : p.badge === 'kids' ? 'badge_kids' : p.badge === 'seniors' ? 'badge_seniors' : 'popular')}</span>` : ''}
    ${A.catIcon('packages')}<h3>${esc(LN(p,'name'))}</h3><p class="muted small" style="margin:0">${esc(LN(p,'desc'))}</p>
    <ul>${p.test_ids.map(id => `<li>${esc(LN(S.catalog.T[id],'name'))}</li>`).join('')}</ul>
    <div class="foot"><div><div class="price" style="font-size:1.3rem">${omr(p.price)} <small>${t('omr')}</small><span class="strike">${omr(full)}</span></div><span class="chip teal" style="margin-top:4px">${t('save',{x:omr(full - p.price)})}</span></div>
    <button class="btn ${inCart ? 'teal' : ''} sm" data-add="package:${p.id}">${inCart ? ic('check',18,2.4) + ' ' + t('in_cart') : ic('plus',18,2.4) + ' ' + t('add_cart')}</button></div></div>`;
}
function catalogBlock(cat, limit){
  const C = S.catalog;
  const cats = ['all','packages','vitals','kids','vitamins','blood','diabetes','heart','thyroid','organs','men'];
  const tabs = `<div class="cats">${cats.map(c => `<button class="${c === cat ? 'on' : ''}" data-cat="${c}">${t('cat_'+c)}</button>`).join('')}</div>`;
  const pk = (cat === 'all' || cat === 'packages') ? C.packages : cat === 'kids' ? C.packages.filter(p => p.badge === 'kids') : [];
  let ts = cat === 'packages' ? [] : C.tests.filter(x => cat === 'all' || x.cat === cat);
  if (limit) ts = ts.slice(0, limit);
  return `${tabs}${pk.length ? `<div class="grid g3" style="margin:14px 0 22px">${pk.slice(0, limit ? 3 : 99).map(p => pkgCard(p, S.cart.packages.includes(p.id))).join('')}</div>` : ''}
    <div class="grid g2 collapse" style="margin-top:14px">${ts.map(x => testCard(x, S.cart.tests.includes(x.id))).join('')}</div>`;
}
function bindCatalog(root, rerender){
  $$('[data-cat]', root).forEach(b => b.onclick = () => rerender(b.dataset.cat));
  $$('[data-add]', root).forEach(b => b.onclick = () => { const [ty, id] = b.dataset.add.split(':'); const k = ty === 'package' ? 'packages' : 'tests'; const was = S.cart[k].includes(id);
    toggleCart(ty, id); rerender(); refreshCartBadges(); if (!was) toastCart(); });
}
function cartBar(){
  const n = cartCount(); if (!n || !S.catalog) return '';
  const c = cartCalc();
  return `<div class="cart-bar"><div class="in">${ic('box',22)}<div class="grow"><b>${t('items_n',{n:c.items.length})} · ${omr(c.sub)} ${t('omr')}</b><div class="small" style="opacity:.8">+ ${omr(fee())} ${t('home_fee')}</div></div><button class="btn sm" data-go="${S.user ? 'app/cart' : 'register'}">${t('view_cart')} ${'<span class="flip">'+ic('arrow',18)+'</span>'}</button></div></div>`;
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
    <div class="roles">${['patient','nurse','courier','lab','company'].map(r => `<a class="role" href="#/register/${r}">${A.roleIcon(r)}<h4>${t('r_'+r)}</h4><p>${t('r_'+r+'_d')}</p></a>`).join('')}</div>
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
    <div class="stack small"><a href="#/tests">${t('nav_tests')}</a><a href="#/support">${t('m_support')}</a><a href="#/about">${t('m_about')}</a></div><div class="stack small ft-ct"><b>${t('m_contact')}</b><a href="https://wa.me/${CONTACT.wa}" target="_blank" rel="noopener" class="ltr">WhatsApp ${CONTACT.phone}</a><a href="tel:${CONTACT.tel}" class="ltr">${CONTACT.phone}</a><a href="mailto:${CONTACT.email}" class="ltr">${CONTACT.email}</a></div><div class="stack small"><a href="#/install">${t('m_install')}</a><a href="#/register/nurse">${t('r_nurse')}</a><a href="#/register/lab">${t('r_lab')}</a><a href="#/register/company">${t('r_company')}</a></div></div>
    <p class="xs" style="opacity:.6;margin-top:24px">© 2026 Lab@Home · Oman</p></div></footer>`;
}
function covMap(){
  const el = $('#cov-map'); if (!el) return;
  const draw = () => { if (!window.L || !S.catalog) return setTimeout(draw, 200);
    const touch = matchMedia('(pointer:coarse)').matches; const m = L.map(el, { scrollWheelZoom:false, attributionControl:true, dragging:!touch, touchZoom:!touch, doubleClickZoom:!touch, tap:false }).setView([22.72, 58.55], 9);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:18, attribution:'© OpenStreetMap' }).addTo(m);
    S.catalog.wilayats.forEach(w => { const ll = WILAYAT_LL[w]; if (!ll) return;
      L.circle(ll, { radius: w === 'Ibra' ? 9000 : 6000, color:'#1257d6', weight:2, fillColor:'#2f7bff', fillOpacity:.18 }).addTo(m).bindTooltip(wN(w), { permanent: w === 'Ibra', direction:'top' }); });
  }; draw();
}
async function viewTestsPublic(){
  await loadCatalog();
  let cat = 'all';
  app.innerHTML = `${topbar()}<section class="section" style="padding-top:32px"><div class="wrap-w"><div class="section-h"><h2>${t('tests_t')}</h2><p>${t('tests_p',{fee:omr(fee())})}</p></div><div id="cb"></div><div id="cbar"></div></div></section>${footer()}`;
  const rer = c => { if (c) cat = c; $('#cb').innerHTML = catalogBlock(cat); bindCatalog($('#cb'), rer); $('#cbar').innerHTML = cartBar(); bindGo(); };
  rer();
}

/* ---------- auth ---------- */
function authShell(inner){
  return `<div class="auth"><div class="side"><a href="#/" class="brand on-dark">${brandInner()}</a>
    <div><h2>${t('hero_t1')} ${t('hero_t2')}</h2><p style="opacity:.85">${t('hero_p')}</p></div>
    <div style="max-width:420px;opacity:.95">${A.welcomeArt}</div></div>
    <div class="main"><div class="box"><div class="row between" style="margin-bottom:22px"><a href="#/" class="brand">${brandInner()}</a><button class="lang" data-lang>${t('lang')}</button></div>${inner}</div></div></div>`;
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
    try { const r = await busy($('button.btn', f), () => API.login(f.login.value, f.password.value)); afterLogin(r); } catch(err) { $('#le').textContent = errMsg(err); } };
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
        <div class="grid g2 collapse" style="margin-top:16px">${['nurse','lab','courier','company'].map(r => `<button class="role" style="text-align:start;display:flex;gap:12px;align-items:center;padding:14px" data-role="${r}">${A.roleIcon(r, 46)}<span><b>${t('r_'+r)}</b><span class="muted small" style="display:block">${t('r_'+r+'_d')}</span></span></button>`).join('')}</div>`);
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
      lab: `<label class="field"><span>${t('lab_name')}</span><input class="input" name="lab_name" required></label><div class="grid g2"><label class="field"><span>${t('lab_license')}</span><input class="input" name="license" required></label><label class="field"><span>${t('accreditation')}</span><input class="input" name="accreditation" placeholder="ISO 15189 / CAP"></label></div>
        <label class="field"><span>${t('wilayat')}</span>${wsel('wilayat')}</label>`,
      company: `<label class="field"><span>${t('company_name')}</span><input class="input" name="company_name" required></label><div class="grid g2"><label class="field"><span>${t('cr')}</span><input class="input" name="cr"></label><label class="field"><span>${t('employees')}</span><input class="input" type="number" min="1" name="employees"></label></div><label class="field"><span>${t('wilayat')}</span>${wsel('wilayat')}</label>`
    }[r];
    app.innerHTML = authShell(`${r !== 'patient' ? `<button class="link" data-back>${'<span class="flip">'+ic('back',18)+'</span>'} ${t('back')}</button>` : ''}
      <div class="row" style="margin:10px 0 4px">${A.roleIcon(r, 48)}<div><h1 style="margin:0">${t('reg_t')}</h1><div class="muted small">${t('r_'+r)} · ${t('r_'+r+'_d')}</div></div></div>
      <form id="rf" class="stack" style="margin-top:16px" novalidate>
        <label class="field"><span>${r === 'company' || r === 'lab' ? t('contact_person') : t('full_name')}</span><input class="input" name="full_name" autocomplete="name" required></label>
        ${r === 'patient' || r === 'nurse' ? genderPick : ''}
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
      if ((r === 'patient' || r === 'nurse') && !st.gender) { $('#re').textContent = t('e_NEED_GENDER'); return; }
      const civ = val('civil_id').replace(/\D/g,'');
      if (['patient','nurse','courier'].includes(r) && !/^\d{6,10}$/.test(civ)) { $('#re').textContent = t(civ ? 'e_BAD_CIVIL' : 'e_NEED_CIVIL'); return; }
      const meta = {}; if (st.gender) meta.gender = st.gender;
      ['license','years','lab_name','accreditation','company_name','cr','employees','vehicle','company','plate'].forEach(k => { if (f[k] && f[k].value) meta[k] = f[k].value.trim(); });
      if (r === 'nurse' || r === 'courier') meta.coverage = $$('input[name=coverage]:checked', f).map(x => x.value);
      if (r === 'lab' && !meta.lab_name) { $('#re').textContent = t('e_NEED_NAME'); return; }
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
    patient: [['app','home','m_home'],['app/tests','flask','m_tests'],['app/cart','cart','m_cart'],['app/orders','list','m_orders'],['app/profile','user','m_profile']],
    nurse: [['app','home','m_home'],['app/orders','syringe','m_jobs'],['app/kit','box','m_kit'],['app/notifs','bell','m_notifs'],['app/profile','user','m_profile']],
    doctor: [['app','steth','m_review'],['app/notifs','bell','m_notifs'],['support','chat','m_support'],['app/profile','user','m_profile']],
    courier: [['app','home','m_home'],['app/orders','van','m_pickups'],['app/notifs','bell','m_notifs'],['app/profile','user','m_profile']],
    lab: [['app','home','m_home'],['app/orders','flask','m_samples'],['app/notifs','bell','m_notifs'],['app/profile','user','m_profile']],
    company: [['app','home','m_programs'],['app/notifs','bell','m_notifs'],['support','chat','m_support'],['app/profile','user','m_profile']],
    admin: [['app','chart','overview'],['app/orders','list','m_all_orders'],['app/admin/users','users','m_users'],['app/admin/tickets','chat','m_tickets'],['app/admin/payments','card','m_payments'],['app/admin/contracts','building','m_contracts'],['app/admin/catalog','flask','m_catalog'],['app/admin/kit','box','m_kits'],['app/admin/settings','gear','m_settings'],['app/profile','user','m_profile']],
    staff: [['app','chart','overview'],['app/admin/tickets','chat','m_tickets'],['app/orders','list','m_all_orders'],['app/admin/users','users','m_users'],['app/admin/contracts','building','m_contracts'],['app/admin/kit','box','m_kits'],['app/admin/settings','gear','m_settings'],['app/profile','user','m_profile']]
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
    <a href="#/support">${ic('chat')} <span class="grow">${t('m_support')}</span></a><a href="#/about">${ic('users')} <span class="grow">${t('m_about')}</span></a>
    <div class="me"><span class="avatar">${esc(initials(u.full_name))}</span><div class="grow"><div class="b small" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(u.full_name)}</div><button class="link small" data-logout>${t('logout')}</button></div></div></aside>
  <main class="main-area"><div class="app-top">${opts && opts.back ? `<button class="icon-btn" data-goback aria-label="${t('back')}"><span class="flip">${ic('back')}</span></button>` : `<button class="icon-btn" data-menu aria-label="${t('menu')}">${ic('menu')}</button>`}<h1 class="grow">${title}</h1>
    <button class="icon-btn" data-go="app/notifs" aria-label="${t('m_notifs')}">${ic('bell')}${S.unread ? `<span class="dot">${S.unread}</span>` : ''}</button>${opts && opts.back ? `<button class="icon-btn" data-menu aria-label="${t('menu')}">${ic('menu')}</button>` : ''}</div>
  <div class="content">${profileBanner()}${emailBanner()}${pushBanner()}${u.status === 'pending' ? `<div class="banner amber" style="margin-bottom:16px">${ic('clock',22)}<div><b>${t('pending_t')}</b><div class="small">${t('pending_p')}</div></div></div>` : ''}${body}</div></main></div>
  <nav class="tabbar">${items.slice(0, 4).map(([h, i, k]) => `<a href="#/${h}" class="${isOn(h) ? 'on' : ''}">${ic(i)}${h === 'app/cart' && n ? `<span class="dot">${n}</span>` : ''}<span>${t(k)}</span></a>`).join('')}<a href="#" data-menu>${ic('menu')}<span>${t('menu')}</span></a></nav>`;
}
function loading(title){ app.innerHTML = shell(title || '', `<div class="loading"><span class="spin"></span></div>`); }
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
  const [list] = await Promise.all([API.orders(), loadCatalog()]);
  const active = list.filter(o => ACTIVE(o.status)); const done = list.filter(o => o.status === 'completed');
  const C = S.catalog;
  app.innerHTML = shell(t('m_home'), `<div class="stack-lg">
    ${heroHtml(true)}
    <div><h3 class="hm-h">${t('hello',{n:esc(S.user.full_name.split(' ')[0])})} 👋 <span class="muted small" style="font-weight:500">${t('hm_quick')}</span></h3>${quickTiles()}</div>
    <div><div class="row between"><h3>${t('upcoming')}</h3>${list.length ? `<a href="#/app/orders" class="small b">${t('see_all')}</a>` : ''}</div>
      ${active.length ? `<div class="olist">${active.map(o => orderItem(o)).join('')}</div>` : emptyBox(t('none_orders'), `<a class="btn" href="#/app/tests">${t('book_now')}</a>`)}</div>
    ${done.length ? `<div><h3>${t('q_reports')}</h3><div class="olist">${done.slice(0, 3).map(o => orderItem(o)).join('')}</div></div>` : ''}
    <div><div class="row between"><h3>${t('hm_pk')}</h3><a href="#/app/tests?c=packages" class="small b">${t('see_all')}</a></div><div class="hscroll" id="hp">${C.packages.map(p => pkgCard(p, S.cart.packages.includes(p.id))).join('')}</div></div>
  </div>${cartBar()}`);
  bindHero();
  $$('#hp [data-add]').forEach(b => b.onclick = () => { const [ty, id] = b.dataset.add.split(':'); toggleCart(ty, id); viewPatientHome(); });
}
async function viewAppTests(){
  await loadCatalog();
  let cat = new URLSearchParams(location.hash.split('?')[1] || '').get('c') || 'all';
  app.innerHTML = shell(t('m_tests'), `<p class="muted">${t('tests_p',{fee:omr(fee())})}</p><div id="cb"></div>${soonBlock()}<div id="cbar"></div>`);
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
  const c = cartCalc();
  if (!b.program && !c.items.length) { app.innerHTML = shell(t('q_book'), emptyBox(t('cart_empty'), `<a class="btn" href="#/app/tests">${t('explore_tests')}</a>`)); return; }
  const stepNames = ['b2_who','b2_loc','b2_nurse','b2_time','b2_pay'];
  const head = `<div class="stepper">${stepNames.map((s, i) => `<i class="${i < b.step ? 'on' : ''}"></i>`).join('')}</div><div class="steplabels">${stepNames.map((s, i) => `<span class="${i + 1 === b.step ? 'on' : ''}">${i + 1}. ${t(s)}</span>`).join('')}</div>`;
  const items = b.program ? [{ name: LN(C.P[b.program.package_id],'name'), price: Number(C.P[b.program.package_id].price) }] : c.items;
  const sub = b.program ? Number(C.P[b.program.package_id].price) : c.sub;
  const total = b.program ? 0 : sub + fee();
  const g = bkGender(b);
  const fastH = b.program ? Math.max(0, ...C.P[b.program.package_id].test_ids.map(id => (C.T[id] || {}).fasting_hours || 0)) : (c.fasting || 0);
  const summary = `<div class="card summary"><h3>${t('summary')}</h3>${items.map(i => `<div class="line"><span>${esc(i.name)}</span><span class="num">${omr(i.price)}</span></div>`).join('')}
    <div class="line"><span>${t('home_fee')}</span><span class="num">${omr(fee())}</span></div>
    ${b.program ? `<div class="line" style="color:var(--teal)"><span>${t('discount')}</span><span class="num">−${omr(sub + fee())}</span></div>` : ''}
    <div class="line total"><span>${t('total')}</span><span class="num">${omr(total)} ${t('omr')}</span></div>
    <hr class="sep"><div class="small muted stack" style="--g:6px">${b.step > 1 ? `<div>${ic('user',14)} ${esc(b.who === 'family' ? b.person.name : S.user.full_name)} · ${t(g)}</div>` : ''}${b.step > 2 ? `<div>${ic('pin',14)} ${esc(wN(b.wilayat))}</div>` : ''}${b.step > 3 ? `<div>${ic('syringe',14)} ${b.nurse ? esc(b.nurse.name) : t('any_nurse')}</div>` : ''}${b.step > 4 ? `<div>${ic('cal',14)} ${fmtDate(b.date)} · ${b.time}</div>` : ''}${fastH ? `<div style="color:var(--amber)">${ic('timer',14)} ${t('fasting',{h:fastH})}</div>` : ''}</div></div>`;
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
    body = `<div class="card stack"><h3>${t('nurse_t')}</h3><p class="muted small" style="margin:0">${t('nurse_p',{w:esc(wN(b.wilayat)), g:t(g === 'female' ? 'g_female' : 'g_male')})}</p>
      <button type="button" class="ncard ${!b.nurse ? 'on' : ''}" data-nurse=""><span class="avatar" style="background:var(--teal)">${ic('users',20)}</span><span class="grow" style="text-align:start"><b>${t('any_nurse')}</b><span class="xs muted" style="display:block">${t('any_nurse_d')}</span></span><span class="radio"></span></button>
      <div id="nlist" class="stack"><div class="skel" style="height:90px"></div></div></div>`;
  } else if (b.step === 4) {
    const now = muscatNow(); const days = Array.from({ length: 14 }, (_, i) => addDays(now.date, i));
    const slots = C.slots; const dis = s => b.date === now.date && (parseInt(s) * 60 <= now.mins + 60);
    const fl = String(C.fasting_last_slot || '10:00').replace(/"/g, ''); const lock = s => fastH > 0 && s > fl;
    if (b.time && lock(b.time)) b.time = '';
    const sbtn = s => `<button data-slot="${s}" class="${b.time === s ? 'on' : ''}${lock(s) ? ' locked' : ''}" ${dis(s) ? 'disabled' : ''} ${lock(s) ? `aria-disabled="true" title="${esc(t('fast_locked',{t:fl}))}"` : ''}>${lock(s) ? ic('lock',13) + ' ' : ''}${s}</button>`;
    body = `<div class="card stack"><h3>${t('date_t')}</h3><div class="cal">${days.map(d => { const x = new Date(d+'T12:00:00'); return `<button data-date="${d}" class="${b.date === d ? 'on' : ''}"><div class="xs" style="opacity:.75">${x.toLocaleDateString(loc(),{ weekday:'short' })}</div>${x.getDate()}</button>`; }).join('')}</div>
      <h3 style="margin-top:8px">${t('time_t')}</h3>${fastH ? `<div class="banner amber small" id="fastb">${ic('timer',20)}<span><b>${t('fast_banner_t',{h:fastH})}</b><br>${t('fast_banner_p',{t:fl})}</span></div>` : ''}
      <div class="small b muted">${ic('sun',14)} ${t('morning')}</div><div class="slots">${slots.filter(s => parseInt(s) < 13).map(sbtn).join('')}</div>
      <div class="small b muted">${t('evening')}${fastH ? ` · <span style="color:var(--amber)">${t('fast_evening')}</span>` : ''}</div><div class="slots">${slots.filter(s => parseInt(s) >= 13).map(sbtn).join('')}</div></div>`;
  } else {
    body = `<div class="card stack"><h3>${t('review_t')}</h3>
      <div class="vline"><span class="muted">${t('patient')}</span><b>${esc(b.who === 'family' ? b.person.name : S.user.full_name)} · ${t(g)}</b></div>
      <div class="vline"><span class="muted">${t('location')}</span><b>${esc(wN(b.wilayat))}</b></div>
      <div class="vline"><span class="muted">${t('chosen_nurse')}</span><b>${b.nurse ? esc(b.nurse.name) : t('any_nurse')}</b></div>
      <div class="vline"><span class="muted">${t('appointment')}</span><b>${fmtDate(b.date)} · ${b.time}</b></div></div>
      <div class="card stack"><h3>${t('pay_t')}</h3>
      <div class="row"><input class="input grow" id="code" placeholder="${t('sponsor_code')}" value="${esc(b.code)}" style="text-transform:uppercase"><button class="btn soft" id="apply">${t('apply')}</button></div>
      ${b.program ? `<div class="banner teal">${ic('check',20)}<b>${t('sponsored_by',{c:esc(b.program.company)})} · ${esc(b.program.name)}</b></div>` : `
      <div class="paym">${[['card','card','pay_card'],['applepay','phone','pay_apple']].map(([v, i, k]) => `<label class="${b.pay === v ? 'on' : ''}"><input type="radio" name="pay" value="${v}" ${b.pay === v ? 'checked' : ''}> ${ic(i)} <span class="grow b">${t(k)}</span></label>`).join('')}</div>
      ${b.pay === 'card' ? `<div class="grid g3"><label class="field" style="grid-column:1/-1"><span>${t('card_no')}</span><input class="input ltr" id="cn" inputmode="numeric" maxlength="23" placeholder="4242 4242 4242 4242" autocomplete="cc-number" style="width:100%"></label><label class="field"><span>${t('exp')}</span><input class="input ltr" id="ce" inputmode="numeric" maxlength="5" placeholder="12/28" autocomplete="cc-exp"></label><label class="field"><span>${t('cvv')}</span><input class="input ltr" id="cv" inputmode="numeric" maxlength="4" placeholder="123" autocomplete="cc-csc"></label></div>` : ''}
      <div class="banner blue small">${ic('shield',20)}<span>${t('epay_only')} ${t('test_mode')}</span></div>`}</div>`;
  }
  const next = b.step < 5 ? `<button class="btn" id="nx">${t('next')} ${'<span class="flip">'+ic('arrow',18)+'</span>'}</button>` : `<button class="btn teal" id="pay">${b.program ? t('confirm_book') : t('confirm_pay',{x:omr(total)})}</button>`;
  app.innerHTML = shell(t('q_book'), `${head}<div class="grid" style="grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:18px" id="bkg">
    <div class="stack">${body}<div class="err" id="be"></div><div class="row">${b.step > 1 ? `<button class="btn ghost" id="pv">${t('back')}</button>` : `<a class="btn ghost" href="#/app/cart">${t('m_cart')}</a>`}<div class="grow"></div>${next}</div></div><div>${summary}</div></div>`, { back: true });
  if (innerWidth < 900) $('#bkg').style.gridTemplateColumns = '1fr';
  const err = m => $('#be').textContent = m;
  $$('[data-who]').forEach(x => x.onclick = () => { b.who = x.dataset.who; b.nurse = null; viewBook(); });
  $$('[data-pg]').forEach(x => x.onclick = () => { b.person.name = $('#pn').value; b.person.gender = x.dataset.pg; b.nurse = null; viewBook(); });
  $$('[data-date]').forEach(x => x.onclick = () => { b.date = x.dataset.date; b.time = ''; viewBook(); });
  $$('[data-slot]').forEach(x => x.onclick = () => { if (x.classList.contains('locked')) { err(t('fast_locked',{t:String(C.fasting_last_slot || '10:00').replace(/"/g, '')})); x.classList.remove('shake'); void x.offsetWidth; x.classList.add('shake'); const fb = $('#fastb'); if (fb) { fb.classList.remove('flash'); void fb.offsetWidth; fb.classList.add('flash'); } return; } b.time = x.dataset.slot; viewBook(); });
  $$('input[name=pay]').forEach(x => x.onchange = () => { b.pay = x.value; viewBook(); });
  if (b.step === 2) bookMap(b);
  if (b.step === 3) API.nursesToday(b.wilayat, g).then(list => { const el = $('#nlist'); if (!el) return;
      el.innerHTML = list.length ? list.map(n => nurseCardHtml(n, b.nurse && b.nurse.id === n.id)).join('') : `<div class="banner amber small">${ic('clock',20)}<span>${t('no_nurses')}</span></div>`;
      bindNurses(list); }).catch(e => { $('#nlist').innerHTML = `<div class="err">${errMsg(e)}</div>`; });
  function bindNurses(list){ $$('[data-np]').forEach(x => x.onclick = e => { e.stopPropagation(); const n = list.find(y => y.id === x.dataset.np); if (n) partyModal('nurse', { nurse: n }); }); $$('[data-nurse]').forEach(x => x.onclick = () => { const id = x.dataset.nurse; b.nurse = id ? { id, name: (list.find(n => n.id === id) || {}).name } : null; $$('[data-nurse]').forEach(y => y.classList.toggle('on', y === x)); }); }
  if (b.step === 3) bindNurses([]);
  const keep = () => {
    if (b.step === 1 && b.who === 'family') { b.person = { name: $('#pn').value.trim(), relation: $('#pr').value, gender: b.person.gender, dob: $('#pd').value, civil_id: $('#pc').value.replace(/\D/g, '') || undefined }; }
    if (b.step === 2) { b.wilayat = $('#bw').value; b.address = $('#ba').value.trim(); b.notes = $('#bn').value.trim(); }
  };
  if ($('#pv')) $('#pv').onclick = () => { keep(); b.step--; viewBook(); };
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
    if (b.program) p.program_code = b.code;
    p.person = b.who === 'family' ? b.person : { name: S.user.full_name, gender: g, dob: (S.user.meta || {}).dob, relation: 'self' };
    try { const o = await busy($('#pay'), () => API.orderCreate(p)); S.cart = { packages:[], tests:[] }; saveCart(); S.bk = null; bookedScreen(o); } catch(e) { err(errMsg(e)); }
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
  const draw = () => { if (!document.body.contains(el)) return; if (!window.L) { if (!b.gps) { b.gps = 'asked'; askGps(null); } $('#gps').onclick = () => askGps(null); return setTimeout(draw, 300); }
    const ll = b.lat && b.lng ? [b.lat, b.lng] : (WILAYAT_LL[b.wilayat] || WILAYAT_LL.Ibra);
    const m = L.map(el, { zoomControl:true, tap:false }).setView(ll, b.lat ? 16 : 13); el.classList.add('map-touch');
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
    <h2>${t('booked_t')}</h2><p class="muted">${t('booked_p',{c:esc(o.code)})}</p>
    <div class="card flat" style="text-align:start;margin:16px 0"><div class="vline"><span class="muted">${t('appointment')}</span><b>${fmtDate(o.slot_date)} · ${esc(o.slot_time)}</b></div><div class="vline"><span class="muted">${t('location')}</span><b>${esc(wN(o.wilayat))}</b></div><div class="vline" style="border:0"><span class="muted">${t('total')}</span><b class="num">${omr(o.total)} ${t('omr')}</b></div></div>
    <a class="btn block" href="#/app/order/${o.id}">${t('track_btn')}</a></div>`);
}

/* order detail – shared by all roles */
async function viewOrder(id){
  clearTimers();
  let o;
  try { o = await API.order(id); } catch(e) { app.innerHTML = shell('', emptyBox(errMsg(e))); return; }
  drawOrder(o);
  if (ACTIVE(o.status)) S.timers.push(setInterval(async () => { if (!location.hash.includes('/order/' + id) || document.hidden) return; try { const n = await API.order(id); if (n.updated_at !== o.updated_at && !$('.modal-bg') && !$('#results-form')) { o = n; drawOrder(o); } } catch(e) {} }, 8000));
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
  const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Lab@Home//Oman//EN','CALSCALE:GREGORIAN','BEGIN:VEVENT','UID:' + o.id + '@labathome.om','DTSTAMP:' + f(new Date()),'DTSTART:' + f(st),'DTEND:' + f(en),
    'SUMMARY:Lab@Home ' + o.code + ' – nurse home visit','LOCATION:' + String(o.address || wN(o.wilayat)).replace(/[,;\n]/g, ' '),
    'DESCRIPTION:' + (fs ? 'Fasting ' + fs.h + 'h – stop eating by ' + fmtTime(fs.at) + '. ' : '') + 'Track: ' + link, 'URL:' + link,
    'BEGIN:VALARM','TRIGGER:' + (fs ? '-PT' + (fs.h + 1) + 'H' : '-PT2H'),'ACTION:DISPLAY','DESCRIPTION:Lab@Home ' + o.code,'END:VALARM','END:VEVENT','END:VCALENDAR'];
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([lines.join('\r\n')], { type:'text/calendar' })); a.download = o.code + '.ics'; document.body.appendChild(a); a.click(); a.remove();
}
function partyRow(kind, p, state){
  const col = kind === 'nurse' ? (p && p.gender === 'female' ? '#e8466f' : '#2563eb') : kind === 'courier' ? '#f59e0b' : '#0fae9b';
  if (!p) return `<div class="party wait"><span class="pav" style="background:#e6ecf6;color:#8a97b0">${ic(kind === 'nurse' ? 'syringe' : kind === 'courier' ? 'van' : 'flask', 22)}</span><div class="grow"><div class="xs muted b">${t('pt_' + kind)}</div><b class="muted">${t('pt_wait_' + kind)}</b></div><span class="pulse"></span></div>`;
  const sub = kind === 'nurse' ? `${p.rating ? '★ ' + p.rating + ' · ' : ''}${t('visits',{n:p.visits})}${p.years ? ' · ' + t('years_exp',{n:p.years}) : ''}`
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
      <div class="pm-stats"><div><b>${n.visits}</b><span>${t('visits_l')}</span></div><div><b>${n.years || '—'}</b><span>${t('years')}</span></div><div><b>${esc(n.since || '—')}</b><span>${t('since')}</span></div></div>
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
      return `<li class="${cls}"><span class="dotc">${cls === 'done' ? ic('check',16,2.6) : cls === 'now' ? ic(STEP_IC[s],15,2.2) : ic(STEP_IC[s],14,2)}</span><div class="grow"><div class="row between" style="gap:8px"><b>${t('st_'+s)}</b>${at ? `<span class="tm">${fmtTime(at)}</span>` : exp ? `<span class="tm exp">≈ ${fmtTime(exp)}</span>` : ''}</div>
        <div class="xs muted">${at ? `${fmtDate(at, { day:'numeric', month:'short' })}${by[s] ? ' · ' + t('by_x',{x:esc(by[s])}) : ''}${gap != null && i ? ` · <span class="gap">+${durTxt(gap)}</span>` : ''}` : exp ? `${t('expected')} · ${fmtDate(exp, { weekday:'short', day:'numeric', month:'short' })}` : t('st_d_' + s)}</div></div></li>`; }).join('')}
    ${o.status === 'cancelled' ? `<li class="now"><span class="dotc" style="background:var(--red)">${ic('x',16,2.6)}</span><div><b>${t('st_cancelled')}</b><div class="xs muted">${fmtDT(ev.cancelled)}</div></div></li>` : ''}</ul>`;
  const totalTxt = o.status === 'completed' && ev.completed ? t('turnaround',{d:durTxt(new Date(ev.completed) - created)}) : o.status !== 'cancelled' ? t('elapsed',{d:durTxt(Date.now() - created)}) : '';
  const stDone = k => ({ nurse: idx >= 4, courier: idx >= 6, lab: idx >= 8 })[k];
  const stNow = k => ({ nurse: idx >= 1 && idx < 4, courier: idx >= 4 && idx < 6, lab: idx >= 6 && idx < 8 })[k];
  const team = o.status === 'cancelled' ? '' : `<div class="card"><div class="row between"><h3 style="margin:0">${t('care_team')}</h3><span class="xs muted">${t('care_team_p')}</span></div><div class="stack" style="--g:8px;margin-top:12px">
    ${['nurse','courier','lab'].map(k => partyRow(k, o[k], o[k] ? (stDone(k) ? 'done' : stNow(k) ? 'now' : '') : '')).join('')}</div></div>`;
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
  const head = `<div class="card ohead"><div class="row between wrap"><div><div class="small muted">${t('request')}</div><h2 style="margin:0" class="ltr">${esc(o.code)}</h2></div><div class="row" style="gap:8px">${ACTIVE(o.status) ? `<span class="live"><i></i>${t('live')}</span>` : ''}${stChip(o.status)}</div></div>
    <div class="progress" style="margin-top:14px"><i style="width:${pct}%"></i></div>
    <div class="row between xs muted" style="margin-top:8px"><span>${ic('clock',13)} ${totalTxt}</span><span>${t('step_x',{a:Math.max(1, idx + 1), b:STATUS.length})}</span></div>${tools}</div>`;
  const map = o.lat && (r === 'nurse' || r === 'admin') ? `<div class="card" style="padding:0;overflow:hidden"><div class="mapbox" id="omap" style="border-radius:0;height:220px"></div>${o.address ? `<div style="padding:12px"><a class="btn soft sm" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${o.lat},${o.lng}">${ic('pin',16)} ${t('open_maps')}</a></div>` : ''}</div>` : '';
  app.innerHTML = shell(esc(o.code), `<div class="grid" id="og" style="grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:18px;align-items:start">
    <div class="stack">${head}${acts}${careBlock(o)}${eta}${prep}${o.status === 'completed' && r === 'patient' ? rateBox(o) : ''}${map}${team}${details}${tests}</div>
    <div class="stack"><div class="card"><h3>${t('q_track')}</h3>${tl}</div></div></div>`, { back: true });
  if (innerWidth < 900) $('#og').style.gridTemplateColumns = '1fr';
  bindActions(o); bindCare(o, drawOrder);
  $$('[data-party]').forEach(b => b.onclick = () => partyModal(b.dataset.party, o));
  if ($('[data-ics]')) $('[data-ics]').onclick = () => { icsDownload(o); toast(t('cal_ok')); };
  if ($('[data-copy]')) $('[data-copy]').onclick = () => { (navigator.clipboard ? navigator.clipboard.writeText(o.code) : Promise.reject()).then(() => toast(t('copied'))).catch(() => toast(o.code)); };
  if ($('[data-again]')) $('[data-again]').onclick = async () => { await loadCatalog(); const ids = (o.tests || []).map(x => x.id).filter(id => S.catalog.T[id]); S.cart = { packages: [], tests: ids }; saveCart(); toast(t('again_ok')); go('app/cart'); };
  if ($('#omap')) { const draw = () => { if (!window.L) return setTimeout(draw, 200); const touch = matchMedia('(pointer:coarse)').matches; const m = L.map('omap', { scrollWheelZoom:false, dragging:!touch, tap:false }).setView([o.lat, o.lng], o.address ? 15 : 12); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19, attribution:'© OpenStreetMap' }).addTo(m); if (o.address) L.marker([o.lat, o.lng]).addTo(m); else L.circle([o.lat, o.lng], { radius:1500, color:'#2563eb' }).addTo(m); }; draw(); }
}

function rateBox(o){
  if (o.rating) return `<div class="card"><b>${t('rate_t')}</b><div style="color:var(--amber);font-size:1.4rem">${'★'.repeat(o.rating)}${'☆'.repeat(5 - o.rating)}</div></div>`;
  return `<div class="card" id="rate"><b>${t('rate_t')}</b><div class="row" style="margin:8px 0;font-size:2rem;color:#d3dbea;gap:4px">${[1,2,3,4,5].map(i => `<button class="link" data-star="${i}" style="font-size:2rem;color:inherit">★</button>`).join('')}</div><input class="input" id="rv" placeholder="…"><button class="btn sm" id="rs" style="margin-top:10px">${t('rate_send')}</button></div>`;
}
function actionPanel(o){
  const u = S.user, r = u.role; const s = o.status; let h = '';
  if (r === 'patient') {
    if (u.is_demo && ACTIVE(s)) h += `<div class="card" style="background:linear-gradient(120deg,#efeaff,#e8f1ff)"><div class="small" style="color:#3b2fa0">${ic('play',16)} ${t('demo_hint')}</div><div class="row wrap" style="margin-top:12px"><button class="btn sm" data-act="demo">${ic('next',16)} ${t('demo_next')}</button><button class="btn sm dark" data-act="demoall">${ic('play',16)} ${t('demo_auto')}</button></div></div>`;
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
      <td><div class="row" style="gap:6px"><input class="input num" style="width:110px;min-height:40px;padding:8px 10px" inputmode="decimal" data-an="${a.c}" data-lo="${a.lo ?? ''}" data-hi="${a.hi ?? ''}" value="${res[a.c] ? res[a.c].v : ''}"><span class="xs muted">${esc(a.u)}</span></div></td>
      <td class="small muted num">${rangeTxt(a)}</td><td><span class="flag" data-fl="${a.c}"></span></td></tr>`).join('')).join('')}</tbody></table></div>
    <label class="field" style="margin-top:12px"><span>${t('verifier')}</span><input class="input" id="vf" value="${esc(S.user.meta && S.user.meta.director || '')}" placeholder="Dr. … , Lab Director"></label>
    <div class="row" style="margin-top:12px"><button class="btn ghost" data-act="save">${t('save_draft')}</button><button class="btn teal grow" data-act="publish">${ic('shield',18)} ${t('publish')}</button></div></div>`;
}
function rangeTxt(a){ return a.lo != null && a.hi != null ? `${a.lo} – ${a.hi}` : a.lo != null ? `≥ ${a.lo}` : a.hi != null ? `≤ ${a.hi}` : '—'; }
function bindActions(o){
  const run = async (btn, a, p, msg) => { try { const n = await busy(btn, () => API.action(o.id, a, p)); if (msg) toast(msg); drawOrder(n); } catch(e) {} };
  $$('[data-act]').forEach(b => b.onclick = async () => {
    const a = b.dataset.act;
    if (a === 'demo') { try { const n = await busy(b, () => API.demoAdvance(o.id)); drawOrder(n); } catch(e) {} return; }
    if (a === 'demoall') { b.disabled = true; let n = o; while (ACTIVE(n.status)) { try { n = await API.demoAdvance(o.id); drawOrder(n); } catch(e) { break; } await new Promise(r => setTimeout(r, 1300)); } return; }
    if (a === 'cancel') { if (await confirmBox(t('cancel_q'), t('yes_cancel'), t('keep'))) run(b, 'cancel'); return; }
    if (a === 'accept') return run(b, 'accept', {}, t('job_accepted'));
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
  $$('[data-an]').forEach(i => { const upd = () => { const v = parseFloat(i.value.replace(',', '.')); const lo = i.dataset.lo === '' ? null : +i.dataset.lo, hi = i.dataset.hi === '' ? null : +i.dataset.hi; const f = isNaN(v) ? '' : lo != null && v < lo ? 'L' : hi != null && v > hi ? 'H' : 'N'; const el = $(`[data-fl="${i.dataset.an}"]`); el.className = 'flag ' + f; el.textContent = f ? t('f_'+f) : ''; }; i.addEventListener('input', upd); upd(); });
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
  let flags = 0; const notes = [];
  const rows = (o.tests || []).map(x => `<tr class="grp"><td colspan="5">${esc(LN(x,'name'))}</td></tr>` + x.analytes.map(a => { const r = res[a.c] || {}; if (r.f && r.f !== 'N') { flags++; const n = INSIGHT[a.c] && INSIGHT[a.c][r.f]; if (n) notes.push(`<li><b>${esc(S.lang === 'ar' ? a.na : a.n)}:</b> ${esc(n[S.lang === 'ar' ? 1 : 0])}</li>`); }
      const lo = a.lo != null ? a.lo : (a.hi != null ? 0 : null), hi = a.hi != null ? a.hi : (a.lo != null ? a.lo * 2.5 : null); let pos = 50;
      if (lo != null && hi != null && r.v != null) { const span = hi - lo; pos = Math.max(3, Math.min(97, 20 + (r.v - lo) / span * 60)); }
      return `<tr><td>${esc(S.lang === 'ar' ? a.na : a.n)}</td><td class="num b" style="color:${r.f === 'N' ? 'inherit' : r.f === 'H' ? 'var(--red)' : '#9a6400'}">${r.v ?? '—'} <span class="xs muted" style="font-weight:500">${esc(a.u)}</span></td><td class="small muted num">${rangeTxt(a)}</td><td class="rb-col" style="width:120px"><div class="rangebar"><i style="left:${pos}%"></i></div></td><td>${r.f ? `<span class="flag ${r.f}">${t('f_'+r.f)}</span>` : ''}</td></tr>`; }).join('')).join('');
  const ce = (o.events || []).find(e => e.status === 'collected'); const LVL = orderLevel(o).level;
  app.innerHTML = shell(t('report_t'), `<div class="row no-print rep-actions"><button class="btn grow" id="pr">${ic('download',18)} ${t('download_pdf')}</button>${navigator.share ? `<button class="btn ghost grow" id="sh">${ic('share',18)} ${t('share_pdf')}</button>` : ''}<button class="btn ghost hide-sm" id="pp" aria-label="${t('print')}">${ic('file',18)} ${t('print')}</button></div>
  <div class="report"><div class="rh"><div class="row">${A.logo.replace('<svg','<svg width="46" height="46"')}<div><div class="wm-inline">${A.wordmark}</div><div class="small" style="opacity:.8">${t('report_t')}</div></div></div>
    <div class="small" style="text-align:end"><b>${esc(o.lab ? o.lab.name : '')}</b><br>${o.lab && o.lab.license ? t('licence') + ': ' + esc(o.lab.license) : ''}</div></div>
  <div class="rb"><div class="grid g4" style="gap:12px;margin-bottom:18px">
    <div><div class="xs muted">${t('patient')}</div><b>${esc(p.name)}</b></div><div><div class="xs muted">${t('age')} / ${t('sex')}</div><b>${p.dob ? age(p.dob) : '—'} / ${p.gender ? t(p.gender) : '—'}</b></div>
    <div><div class="xs muted">${t('request')}</div><b>${esc(o.code)}</b></div><div><div class="xs muted">${t('collected_at')}</div><b>${ce ? fmtDT(ce.at) : '—'}</b></div>
    <div><div class="xs muted">${t('reported_at')}</div><b>${fmtDT(o.published_at)}</b></div><div><div class="xs muted">${t('verified_by')}</div><b>${esc(o.verified_by || '')}</b></div></div>
  <div class="banner ${LVL === 'urgent' ? 'red' : flags ? 'amber' : 'teal'}" style="margin-bottom:16px">${ic(LVL === 'urgent' ? 'phone' : flags ? 'clock' : 'check',22)}<div><b>${t('lv_'+LVL+'_t')}</b><div class="small">${flags ? t('some_flags',{n:flags}) : t('all_normal')}</div></div></div>
  <div class="scroll-x"><table class="rtable"><thead><tr><th>${t('analyte')}</th><th>${t('result')}</th><th>${t('ref_range')}</th><th class="rb-col"></th><th>${t('flag')}</th></tr></thead><tbody>${rows}</tbody></table></div>
  ${notes.length ? `<div class="card flat" style="margin-top:18px"><h4>${t('insight_t')}</h4><ul class="small" style="margin:0;padding-inline-start:18px">${notes.join('')}</ul></div>` : ''}
  ${o.doctor_note ? `<div class="card flat" style="margin-top:18px"><h4>${t('doc_note_t')} · ${esc(o.doctor_note.name || '')}</h4><p class="small" style="white-space:pre-wrap;margin:0">${esc(o.doctor_note.note)}</p></div>` : ''}
  <p class="xs muted" style="margin-top:18px">${t('report_disclaimer')}</p></div></div><div class="stack no-print" style="margin-top:18px">${careBlock(o)}</div>`, { back: true });
  bindCare(o, () => viewReport(id));
  /* real PDF file, made on the phone; prepared in advance so the tap opens the save/share sheet at once */
  const ar = S.lang === 'ar';
  const pdfData = { lang: S.lang, logo: A.logo, contact: `WhatsApp / Call ${CONTACT.phone}  ·  ${CONTACT.email}`, code: o.code, lab: o.lab ? o.lab.name : '', licence: o.lab && o.lab.license ? t('licence') + ': ' + o.lab.license : '', flags,
    title: `Lab@Home ${o.code}`,
    t: { title: t('report_t'), analyte: t('analyte'), result: t('result'), range: t('ref_range'), flag: t('flag'), insight: t('insight_t'), disclaimer: t('report_disclaimer'), summary: t('lv_'+LVL+'_t') + ' · ' + (flags ? t('some_flags',{n:flags}) : t('all_normal')) },
    info: [[t('patient'), p.name || '—'], [t('age') + ' / ' + t('sex'), `${p.dob ? age(p.dob) : '—'} / ${p.gender ? t(p.gender) : '—'}`], [t('request'), o.code], [t('collected_at'), ce ? fmtDT(ce.at) : '—'], [t('reported_at'), fmtDT(o.published_at)], [t('verified_by'), o.verified_by || '—']],
    groups: (o.tests || []).map(x => ({ name: LN(x,'name'), rows: x.analytes.map(a => { const r = res[a.c] || {}; return { name: ar ? a.na : a.n, v: r.v ?? '—', u: a.u || '', range: rangeTxt(a), f: r.f || '', fl: r.f ? t('f_' + r.f) : '' }; }) })),
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
    <div class="grid g4"><div class="kpi blue"><span>${t('earnings')}</span><b>${omr(st.earnings)} <small style="font-size:.8rem">${t('omr')}</small></b></div><div class="kpi"><span>${t('collected_n')}</span><b>${st.collected}</b></div><div class="kpi"><span>${t('this_month')}</span><b>${st.month}</b></div><div class="kpi"><span>${t('rating')}</span><b>${st.rating ? '★ ' + st.rating : '—'}</b></div></div>
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
  $$('[data-copy]').forEach(b => b.onclick = () => { const txt = `${S.lang === 'ar' ? 'رمز برنامجنا الصحي في لاب@هوم' : 'Our Lab@Home wellness code'}: ${b.dataset.copy} · ${location.origin}`; if (navigator.share) navigator.share({ text: txt }).catch(() => {}); else navigator.clipboard.writeText(txt).then(() => toast('✓')); });
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
  S.catalog = null; await loadCatalog();
  app.innerHTML = shell(t('m_catalog'), `<div class="card"><div class="scroll-x"><table class="table"><thead><tr><th>${t('analyte')}</th><th>${t('tube')}</th><th>${t('price')} (${t('omr')})</th><th></th></tr></thead><tbody>
    ${S.catalog.tests.map(x => `<tr><td><b>${esc(LN(x,'name'))}</b><div class="xs muted">${x.analytes.length} · ${x.fasting_hours ? t('fasting',{h:x.fasting_hours}) : t('no_fasting')}</div></td><td class="small">${esc(x.tube)}</td><td><input class="input num" style="width:110px;min-height:38px;padding:6px 10px" inputmode="decimal" value="${omr(x.price)}" data-price="${x.id}"></td><td><button class="btn sm soft" data-sv="${x.id}">${t('save_changes')}</button></td></tr>`).join('')}</tbody></table></div></div>`);
  $$('[data-sv]').forEach(b => b.onclick = async () => { const v = parseFloat($(`[data-price="${b.dataset.sv}"]`).value); try { await busy(b, () => API.adminTest(b.dataset.sv, v, true)); toast(t('saved')); S.catalog = null; } catch(e) {} });
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
  $$('a[aria-label="' + t('m_cart') + '"]').forEach(a => { const d = $('.dot', a); if (n) { if (d) d.textContent = n; else a.insertAdjacentHTML('beforeend', `<span class="dot">${n}</span>`); } else if (d) d.remove(); });
}

function menuItems(){
  const u = S.user; const r = u ? u.role : null; const n = cartCount();
  const it = (href, icon, label, extra) => `<a href="#/${href}" class="mi">${ic(icon)}<span class="grow">${esc(label)}</span>${extra || ''}</a>`;
  let h = '';
  if (!u || r === 'patient') {
    h += it(u ? 'app' : '', 'home', t('m_home'));
    h += it(u ? 'app/tests' : 'tests', 'flask', t('q_book'));
    h += it(u ? 'app/cart' : 'tests', 'box', t('m_cart'), n ? `<span class="chip red">${n}</span>` : '');
    if (u) { h += it('app/orders', 'list', t('m_orders')); h += it('app/orders?r=1', 'file', t('m_reports_all')); h += it('app/notifs', 'bell', t('m_notifs'), S.unread ? `<span class="chip red">${S.unread}</span>` : ''); }
  } else {
    navFor(r).forEach(([h2, i, k]) => { h += it(h2, i, t(k)); });
    if (r === 'admin') h += it('app/admin/tickets', 'chat', t('m_tickets'));
  }
  h += '<hr class="sep">';
  h += it('install', 'download', t('m_install'));
  h += it('contact', 'phone', t('m_contact'));
  h += it('support', 'chat', t('m_support'));
  h += it('about', 'users', t('m_about') + ' · ' + t('m_team'));
  h += it('how', 'globe', t('nav_how'));
  if (!u) h += it('register?partner=1', 'building', t('m_join'));
  h += '<hr class="sep">';
  h += `<button class="mi" data-lang>${ic('globe')}<span class="grow">${t('lang')}</span></button>`;
  h += u ? it('app/profile', 'user', t('m_profile')) + `<button class="mi" data-logout>${ic('logout')}<span class="grow">${t('logout')}</span></button>`
         : it('login', 'user', t('login')) + it('register', 'plus', t('signup'));
  return h;
}

function openMenu(){
  const root = $('#modal-root'); const bg = document.createElement('div'); bg.className = 'drawer-bg';
  const u = S.user;
  bg.innerHTML = `<aside class="drawer" role="dialog" aria-modal="true" aria-label="${t('menu')}">
    <div class="row between" style="margin-bottom:14px"><a href="#/" class="brand">${brandInner()}</a><button class="icon-btn" data-x aria-label="${t('close')}">${ic('x')}</button></div>
    ${u ? `<div class="me-card"><span class="avatar">${esc(initials(u.full_name))}</span><div class="grow"><b>${esc(u.full_name)}</b><div class="xs muted">${t('r_'+u.role)}</div></div></div>` : `<div class="me-card" style="display:block"><b>${t('hero_t1')}</b><div class="small muted">${t('hero_t2')}</div><div class="row" style="margin-top:10px"><a class="btn sm grow" href="#/register">${t('signup')}</a><a class="btn sm ghost grow" href="#/login">${t('login')}</a></div></div>`}
    <nav class="menu">${menuItems()}</nav></aside>`;
  root.appendChild(bg);
  requestAnimationFrame(() => bg.classList.add('open')); document.body.classList.add('lock');
  const close = () => { bg.classList.remove('open'); setTimeout(() => { bg.remove(); if (!$('#modal-root .modal-bg') && !$('.drawer-bg.open')) document.body.classList.remove('lock'); }, 220); };
  bg.addEventListener('click', e => { if (e.target === bg || e.target.closest('[data-x]') || e.target.closest('a')) close(); });
  $$('[data-lang]', bg).forEach(b => b.onclick = () => { close(); setLang(S.lang === 'ar' ? 'en' : 'ar'); render(); });
  $$('[data-logout]', bg).forEach(b => b.onclick = () => { close(); doLogout(); });
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
  if (innerWidth < 900) $('#cg').style.gridTemplateColumns = '1fr';
  $$('[data-rm]').forEach(x => x.onclick = () => { const it = c.items[+x.dataset.rm]; toggleCart(it.type, it.id); viewCart(); });
}

function bkGender(b){ return b.who === 'family' ? b.person.gender : ((S.user.meta || {}).gender || 'male'); }

function nearestWilayat(lat, lng){ let best = null, bd = 1e9; for (const [w, ll] of Object.entries(WILAYAT_LL)) { const d = Math.hypot((ll[0]-lat) * 111, (ll[1]-lng) * 102); if (d < bd) { bd = d; best = w; } } return { w: best, km: bd }; }

function nurseCardHtml(n, sel){
  const col = n.gender === 'female' ? '#e8466f' : '#1257d6';
  return `<button type="button" class="ncard ${sel ? 'on' : ''}" data-nurse="${n.id}"><span class="avatar" style="background:${col}">${esc(initials(n.name))}</span>
    <span class="grow" style="text-align:start"><b>${esc(n.name)}</b><span class="xs muted" style="display:block">${n.rating ? '★ ' + n.rating + ' · ' : ''}${t('visits',{n:n.visits})}${n.years ? ' · ' + t('years_exp',{n:n.years}) : ''}</span>
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
    ${u && mine.length ? `<div class="card"><h3>${t('sup_mine')}</h3>${mine.map(x => `<div class="vline" style="display:block"><div class="row between"><b>#${x.id} · ${t('tp_'+x.topic)}</b><span class="chip ${x.status === 'answered' ? 'teal' : 'amber'}">${t(x.status === 'answered' ? 'sup_answered' : 'sup_open')}</span></div><div class="small">${esc(x.message)}</div>${x.reply ? `<div class="banner teal small" style="margin-top:8px">${ic('chat',18)}<div><b>${t('sup_reply')}:</b> ${esc(x.reply)}</div></div>` : ''}<div class="xs muted">${ago(x.created_at)}</div></div>`).join('')}</div>` : ''}</div>`;
  app.innerHTML = u ? shell(t('m_support'), body) : `${topbar()}<section class="section" style="padding-top:28px"><div class="wrap-w">${body}</div></section>${footer()}`;
  $('#sf').onsubmit = async e => { e.preventDefault(); const f = e.target; $('#se').textContent = '';
    const p = { topic: $('input[name=topic]:checked', f).value, order_code: f.order.value, message: f.msg.value, name: f.name ? f.name.value : '', contact: f.contact ? f.contact.value : '' };
    try { const r = await busy($('button.btn', f), () => API.supportCreate(p)); toast(t('sup_sent',{n:r.id})); viewSupport(); } catch(err) { $('#se').textContent = errMsg(err); } };
}

async function viewAbout(){
  await loadCatalog().catch(() => {});
  const team = [['Bilarab bin Suwailam Al Musallami','بلعرب بن سويلم المسلمي','dev','#2563eb'],['Jokha Al Rawahi','جوخة الرواحي','member','#e8466f'],['Ansam Al Noumani','أنسام النعماني','member','#7a5af8'],['Dr. Salim Al Rashdi','د. سالم الراشدي','supervisor','#0fae9b']];
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
      <div class="grid g4 team">${team.map(([en, ar, role, c]) => `<div class="card center pad-lg"><span class="avatar xl" style="background:${c}">${esc(initials(en.replace('Dr. ', '')))}</span><h4 style="margin-top:12px">${esc(S.lang === 'ar' ? ar : en)}</h4><span class="chip ${role === 'supervisor' ? 'teal' : ''}">${t(role)}</span></div>`).join('')}</div></div>
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
  app.innerHTML = shell(t('m_tickets'), list.length ? `<div class="stack">${list.map(x => `<div class="card"><div class="row between wrap"><b>#${x.id} · ${t('tp_'+x.topic)} ${x.order_code ? '· ' + esc(x.order_code) : ''}</b><span class="chip ${x.status === 'answered' ? 'teal' : 'amber'}">${t(x.status === 'answered' ? 'sup_answered' : 'sup_open')}</span></div>
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
  const f = $('#bot .bot-fab'); if (!f) return; const sz = f.offsetWidth || 60, m = 14;
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
  try { const r = await (btn ? busy(btn, () => API.emailSendVerify()) : API.emailSendVerify()); toast(t('mail_sent',{e:r.email})); return true; }
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
  $$('[data-menu]').forEach(b => b.onclick = e => { e.preventDefault(); openMenu(); });
  bindGo();
}
let rendering = false, rerender = false, lastRoute = null;
async function render(){
  if (rendering) { rerender = true; return; }
  rendering = true; rerender = false;
  try { await renderNow(); } finally { rendering = false; }
  if (rerender) render();
}
async function renderNow(){
  clearTimers();
  const route = location.hash.split('?')[0];
  if (route !== lastRoute) { lastRoute = route; app.classList.remove('pg'); void app.offsetWidth; app.classList.add('pg'); $$('#modal-root .modal-bg, #modal-root .drawer-bg').forEach(m => m._close ? m._close() : m.remove()); document.body.classList.remove('lock', 'kb'); }
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
      else if (sub === 'book') await viewBook();
      else if (sub === 'orders') await viewOrders();
      else if (sub === 'order') await viewOrder(seg[2]);
      else if (sub === 'report') await viewReport(seg[2]);
      else if (sub === 'profile') await viewProfile();
      else if (sub === 'notifs') await viewNotifs();
      else if (sub === 'programs') await viewCompanyHome();
      else if (sub === 'admin' && (r === 'admin' || r === 'staff')) await ((r === 'admin' ? { users: viewAdminUsers, catalog: viewAdminCatalog, tickets: viewAdminTickets, payments: viewAdminPayments, contracts: viewAdminContracts, settings: viewAdminSettings, kit: viewAdminKit } : { users: viewAdminUsers, tickets: viewAdminTickets, contracts: viewAdminContracts, settings: viewAdminSettings, kit: viewAdminKit })[seg[2]] || viewAdminHome)();
      else go('app');
    }
  } catch(e) {
    console.error(e);
    if (e && e.code === 'AUTH_REQUIRED') { S.user = null; return go('login'); }
    app.innerHTML = (S.user ? shell('', '') : topbar());
    const c = $('.content') || app; c.insertAdjacentHTML('beforeend', `<div class="card empty" style="margin:20px">${A.emptyArt}<p>${errMsg(e)}</p><button class="btn" onclick="location.reload()">${t('retry')}</button></div>`);
  }
  bindGlobal(); botMount(); bindPush(); bindMail();
  if (!location.hash.includes('#', 1)) window.scrollTo(0, 0); else { const el = document.getElementById(location.hash.split('#')[2]); if (el) setTimeout(() => el.scrollIntoView({ behavior:'smooth', block:'start' }), 120); }
}
async function poll(){ if (!S.user || document.hidden) return; try { const r = await API.me(); const before = S.unread; S.user = r.user; S.unread = r.unread; if (r.unread !== before) { $$('[data-go="app/notifs"] .dot').forEach(d => d.textContent = r.unread); if (r.unread > before) { const b = $('[data-go="app/notifs"]'); if (b && !$('.dot', b)) b.insertAdjacentHTML('beforeend', `<span class="dot">${r.unread}</span>`); } } } catch(e) { if (e.code === 'AUTH_REQUIRED') { S.user = null; go('login'); } } }

/* ---------- contact ---------- */
const CONTACT = { phone: '+968 9434 2557', tel: '+96894342557', wa: '96894342557', email: 'labathome.oman@gmail.com' };
function contactCard(compact){
  const waTxt = encodeURIComponent(t('ct_wa_txt'));
  return `<div class="card ct-card${compact ? ' compact' : ''}"><h3>${ic('chat',20)} ${t('ct_title')}</h3>${compact ? '' : `<p class="muted small">${t('ct_p')}</p>`}
    <div class="ct-grid">
      <a class="ct-item wa" href="https://wa.me/${CONTACT.wa}?text=${waTxt}" target="_blank" rel="noopener"><span class="ct-ic"><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 4.9 4.9 0 0 0 1 2.6 11.2 11.2 0 0 0 4.3 3.8c1.6.7 2.2.7 3 .6a2.6 2.6 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .1-1.2c0-.1-.2-.2-.4-.3z"/></svg></span><div><b>${t('ct_wa')}</b><small class="ltr">${CONTACT.phone}</small></div></a>
      <a class="ct-item call" href="tel:${CONTACT.tel}"><span class="ct-ic">${ic('phone',20)}</span><div><b>${t('ct_call')}</b><small class="ltr">${CONTACT.phone}</small></div></a>
      <a class="ct-item mail" href="mailto:${CONTACT.email}?subject=${encodeURIComponent('Lab@Home')}"><span class="ct-ic">${ic('mail',20)}</span><div><b>${t('ct_mail')}</b><small class="ltr">${CONTACT.email}</small></div></a>
    </div></div>`;
}
async function viewContact(){
  app.innerHTML = (S.user ? shell(t('m_contact'), '') : topbar()) + `${S.user ? '' : '<main>'}<section class="wrap-w ct-page"><div class="welcome"><div class="art">${A.roleIcon('admin', 150)}</div><h2>${t('ct_title')}</h2><p style="opacity:.85;max-width:480px">${t('ct_p')}</p></div>${contactCard(true)}
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
    ${step(3, t('ins_i3'), t('ins_i3p'), `<div class="mock-row"><span class="muted">${t('cancel')}</span><b>Lab@Home</b><span class="hl b">${t('ins_add')}</span></div>`)}
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
      <div class="ins-phone" aria-hidden="true"><div class="ins-screen"><div class="ins-clock">9:41</div><div class="ins-icons">${'<b class="ph"></b>'.repeat(6)}<span class="ins-app"><span class="ins-ico">${A.logo}</span><small>Lab@Home</small></span>${'<b class="ph"></b>'.repeat(5)}</div></div></div>
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
  $$('[data-copy-url]').forEach(b => b.onclick = async () => { try { await navigator.clipboard.writeText(url); toast(t('copied')); } catch(e) { prompt('', url); } });
  $$('[data-share-url]').forEach(b => b.onclick = () => navigator.share({ title: 'Lab@Home', text: t('ins_share_txt'), url }).catch(() => {}));
  if ($('#instNow')) $('#instNow').onclick = async () => { const ev = S.installEvt; if (!ev) return; ev.prompt(); const r = await ev.userChoice.catch(() => ({})); S.installEvt = null; if (r.outcome === 'accepted') { toast(t('ins_ok_toast')); setTimeout(render, 600); } };
}

/* native-app behaviour on phones: no pinch/double-tap zoom of the page, hide bars while typing */
function labelTables(root){ $$('table.table', root).forEach(tb => { const hs = $$('thead th', tb).map(th => th.textContent.trim()); $$('tbody tr', tb).forEach(tr => { [...tr.children].forEach((td, i) => { if (!td.hasAttribute('data-l')) td.setAttribute('data-l', hs[i] || ''); }); }); tb.classList.add('mcards'); }); }
const APP_V = 18;
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
  r_doctor:'Doctor', r_doctor_d:'Reviews results that need attention and writes advice for the patient.',
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
  m_kit:'My kit', kit_t:'My Lab@Home kit', kit_p:'The navy Lab@Home bag issued to every nurse. Items go down automatically after each collection.', kit_low:'Low', kit_ok:'OK', kit_req:'Request restock', kit_req_ok:'Restock request sent to operations.', kit_hist:'Recent requests', kit_pending:'Pending', kit_done:'Ready', kit_from_t:'Where does the kit come from?', kit_from_p:'Lab@Home gives each nurse a branded navy kit (bag, tubes, needles, gloves, cold box, BP monitor) at onboarding. Refills are collected from the operations office or the partner lab. The branded coat with performance stars comes next.',
  stars_t:'My level', lvl_1:'Starter', lvl_2:'Silver', lvl_3:'Gold', lvl_4:'Platinum', lvl_next:'Next level: {v} visits and ★ {r}', lvl_top:'Top level reached. Thank you!',
  m_kits:'Nurse kits', kit_admin_t:'Nurse kits & restock', kit_fill:'Mark ready', kit_refill:'Refill full kit', kit_requests:'Restock requests', kit_nurses:'Stock by nurse', kit_items_low:'{n} low',
  demo_res_l:'Demo results', demo_res_p:'Which results demo and automatic requests produce.', dr_mixed:'Mixed (random)', dr_normal:'Always normal', dr_review:'Needs review', dr_urgent:'Urgent'
});
Object.assign(I18N.ar, {
  r_doctor:'طبيب', r_doctor_d:'يراجع النتائج اللي تحتاج متابعة ويكتب التوصيات للمريض.',
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
  m_kit:'حقيبتي', kit_t:'حقيبة لاب@هوم', kit_p:'الحقيبة الكحلية اللي تُسلَّم لكل ممرض. تنقص المستلزمات تلقائياً بعد كل سحب.', kit_low:'ناقص', kit_ok:'متوفر', kit_req:'طلب تعبئة', kit_req_ok:'تم إرسال طلب التعبئة للعمليات.', kit_hist:'آخر الطلبات', kit_pending:'قيد التجهيز', kit_done:'جاهز', kit_from_t:'من وين يجيب الممرض الحقيبة؟', kit_from_p:'لاب@هوم تسلّم كل ممرض حقيبة كحلية بالشعار (الحقيبة، الأنابيب، الإبر، القفازات، صندوق التبريد، جهاز الضغط) عند الانضمام، والتعبئة تُستلم من مكتب العمليات أو المختبر الشريك. والمعطف الطبي بالشعار ونجوم الأداء قريباً.',
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
  const ics = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//LabAtHome//EN','BEGIN:VEVENT','UID:retest-' + o.id + '@labathome','DTSTAMP:' + new Date().toISOString().replace(/[-:]/g,'').slice(0,15) + 'Z','DTSTART;VALUE=DATE:' + ymd,'SUMMARY:Lab@Home – ' + (S.lang === 'ar' ? 'موعد إعادة الفحص' : 'Retest reminder') + ' (' + o.code + ')','DESCRIPTION:https://labathome-oman.vercel.app/#/app/tests','END:VEVENT','END:VCALENDAR'].join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics], { type:'text/calendar' })); a.download = 'LabAtHome-retest.ics'; document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 500);
}
function careBlock(o){
  if (o.status !== 'completed' || !o.results) return '';
  const r = S.user.role; const g = orderLevel(o); const lv = g.level; const dn = o.doctor_note;
  const icn = { normal:'check', review:'clock', urgent:'phone' }[lv];
  let h = `<div class="card care lv-${lv}"><div class="row" style="align-items:flex-start;gap:12px"><span class="lv-ic">${ic(icn, 24, 2.4)}</span><div class="grow"><b class="lv-t">${t('lv_'+lv+'_t')}</b><div class="small">${t('lv_'+lv+'_p')}</div></div></div>
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
  if (g.flagged.length) h += `<div class="card"><h3 style="margin-bottom:4px">${t('g_until')}</h3><div class="xs muted" style="margin-bottom:10px">${t('g_note')}</div><div class="stack" style="--g:8px">${guideHtml(g.flagged)}</div></div>`;
  if (r === 'doctor') h += doctorForm(o, g);
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
    <div class="grid g3"><div class="kpi" style="${urg ? 'background:#fdecec' : ''}"><span>🔴 ${t('doc_urgent')}</span><b>${urg}</b></div><div class="kpi"><span>🟡 ${t('doc_pending')}</span><b>${pend.length - urg}</b></div><div class="kpi blue"><span>${t('m_reviewed')}</span><b>${done.length}</b></div></div>
    <div><h3>${t('doc_home_t')} <span class="chip">${pend.length}</span></h3>${pend.length ? `<div class="olist">${pend.map(item).join('')}</div>` : emptyBox(t('doc_empty'))}</div>
    ${done.length ? `<div><h3>${t('m_reviewed')}</h3><div class="olist">${done.slice(0, 20).map(item).join('')}</div></div>` : ''}</div>`);
}

/* --- forgot / reset password --- */
function viewForgot(){
  app.innerHTML = authShell(`<h1>${t('forgot_t')}</h1><p class="muted">${t('forgot_p')}</p>
    <form id="ff" class="stack" style="margin-top:18px"><label class="field"><span>${t('email_or_phone')}</span><input class="input ltr" name="login" autocomplete="username" autocapitalize="off" required placeholder="name@email.com · 9XXXXXXX"></label><div class="err" id="fe"></div><button class="btn block">${t('forgot_send')}</button></form>
    <div id="fok"></div><p class="center muted" style="margin:16px 0"><a href="#/login" class="b">${t('login')}</a></p>`);
  $('#ff').onsubmit = async e => { e.preventDefault(); const f = e.target; $('#fe').textContent = '';
    try { await busy($('button', f), () => API.resetRequest(f.login.value.trim())); f.style.display = 'none'; $('#fok').innerHTML = `<div class="banner teal">${ic('mail',22)}<span>${t('forgot_ok')}</span></div>`; } catch(err) { $('#fe').textContent = errMsg(err); } };
}
function viewReset(code){
  app.innerHTML = authShell(`<h1>${t('reset_t')}</h1><form id="rf" class="stack" style="margin-top:18px">${pwField('new1', t('new_pw'), t('pass_rule'))}<div class="err" id="re"></div><button class="btn block">${t('reset_save')}</button></form>
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
  const S4 = [['syringe','soon_1'],['drop','soon_2'],['chat','soon_3'],['heart','soon_4']];
  return `<div class="section-h" id="soon" style="margin:40px auto 18px;scroll-margin-top:80px"><span class="eyebrow">${t('soon_t')}</span><h2>${t('soon_t')}</h2><p>${t('soon_p')}</p></div>
    <div class="grid g4 soon">${S4.map(([i, k]) => `<div class="card soon-c"><span class="chip purple soon-chip">${t('soon_chip')}</span><span class="ic-round">${ic(i,24)}</span><b>${t(k)}</b><div class="small muted">${t(k+'d')}</div></div>`).join('')}</div>`;
}

/* --- nurse kit --- */
const KIT_ART = `<svg viewBox="0 0 220 150" class="kit-art" aria-hidden="true"><defs><linearGradient id="kg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d2f57"/><stop offset="1" stop-color="#0d1628"/></linearGradient></defs>
  <ellipse cx="110" cy="140" rx="86" ry="7" fill="#0d1628" opacity=".12"/><path d="M80 40c0-14 60-14 60 0" fill="none" stroke="#0d1628" stroke-width="8" stroke-linecap="round"/>
  <rect x="34" y="40" width="152" height="96" rx="18" fill="url(#kg)"/><rect x="34" y="62" width="152" height="6" fill="#2f7bff" opacity=".8"/>
  <circle cx="110" cy="100" r="22" fill="#fff"/><path d="M110 88v24M98 100h24" stroke="#e2474f" stroke-width="6" stroke-linecap="round"/>
  <text x="110" y="56" text-anchor="middle" font-family="Inter,Arial" font-weight="800" font-size="13" fill="#fff">Lab<tspan fill="#60a5fa">@</tspan>Home</text></svg>`;
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
  hm_trust_t:'Trusted care, close to home', hm_app_t:'Lab@Home on your phone', hm_app_p:'Install the app in 10 seconds. It updates itself.', prev:'Previous', next_s:'Next', skip_intro:'Skip'
});
Object.assign(I18N.ar, {
  h3_e1:'سحب العينات في البيت', h3_t1:'فحوصات المختبر عند باب بيتك', h3_p1:'ممرض مرخّص يجيك البيت، والعينة تنتقل في صندوق تبريد ٢–٨ °م، والتقرير الموثّق يوصلك على جوالك.', h3_c1:'احجز فحصك',
  h3_e2:'باقات العائلة', h3_t2:'باقة لكل فرد في العائلة', h3_p2:'الأطفال {k} ر.ع · كبار السن +60 {s} ر.ع · الضغط والسكر {b} ر.ع', h3_c2:'تصفح الباقات',
  h3_e3:'نتائج واضحة', h3_t3:'نتائجك… ومعها الخطوة التالية', h3_p3:'طبيعي أو يحتاج مراجعة أو عاجل، مع نصائح غذائية وتوصية الطبيب وأقرب مستشفى.', h3_c3:'نتائجي', h3_c3v:'كيف نشتغل',
  h3_e4:'كبار السن +60', h3_t4:'فحص الوالدين والأجداد في البيت', h3_p4:'الضغط والسكر والكلى والقلب والفيتامينات، بدون مشوار للمستشفى.', h3_c4:'باقة كبار السن',
  h3_e5:'قريباً', h3_t5:'التطعيمات والعلاج في البيت', h3_p5:'التطعيمات والمغذّيات واستشارة الطبيب بالفيديو قادمة قريباً.', h3_c5:'شوف الجديد',
  hm_quick:'ويش تحتاج اليوم؟', hm_pk:'الباقات الأكثر طلباً', hm_steps:'ثلاث خطوات بسيطة', hm_how_more:'كيف نشتغل بالتفصيل', hm_st1:'احجز في دقيقتين', hm_st1d:'اختر الفحوصات والوقت وموقعك.', hm_st2:'الممرض عند بابك', hm_st2d:'ممرض مرخّص يسحب العينة في البيت.', hm_st3:'النتائج على جوالك', hm_st3d:'تقرير واضح مع نصائح وملف PDF.',
  qt_book:'احجز فحص', qt_pk:'الباقات', qt_kids:'الأطفال', qt_seniors:'كبار السن', qt_bp:'الضغط والسكر', qt_vit:'الفيتامينات', qt_results:'نتائجي', qt_help:'المساعدة',
  hm_trust_t:'رعاية موثوقة، قريبة من بيتك', hm_app_t:'لاب@هوم على جوالك', hm_app_p:'ثبّت البرنامج في 10 ثواني، ويتحدث تلقائياً.', prev:'السابق', next_s:'التالي', skip_intro:'تخطي'
});
function heroSlides(){
  const P = (S.catalog && S.catalog.P) || {}; const pr = id => P[id] ? omr(P[id].price) : '—'; const u = !!S.user;
  return [
    { k:'van', tone:'dark', e:'h3_e1', t:'h3_t1', p:t('h3_p1'), c:['h3_c1', u ? 'app/tests' : 'register'], c2:['nav_how', 'how'] },
    { k:'kit', tone:'light', e:'h3_e2', t:'h3_t2', p:t('h3_p2',{k:pr('kids'), s:pr('seniors'), b:pr('bp_sugar')}), c:['h3_c2', u ? 'app/tests?c=packages' : 'tests'] },
    { k:'phone', tone:'light', e:'h3_e3', t:'h3_t3', p:t('h3_p3'), c: u ? ['h3_c3', 'app/orders?r=1'] : ['h3_c3v', 'how'] },
    { k:'seniors', tone:'light', e:'h3_e4', t:'h3_t4', p:t('h3_p4'), c:['h3_c4', u ? 'app/tests?c=packages' : 'tests'] },
    { k:'soon', tone:'light', e:'h3_e5', t:'h3_t5', p:t('h3_p5'), c:['h3_c5', u ? 'app/tests#soon' : 'tests#soon'] }
  ];
}
function heroHtml(compact){
  const sl = heroSlides();
  return `<section class="h3 ${compact ? 'compact' : ''}" id="h3" data-i="0"><div class="h3-bg"></div><canvas class="h3-c" aria-hidden="true"></canvas><div class="h3-scrim"></div>
    <div class="h3-in ${compact ? '' : 'wrap-w'}">${sl.map((x, i) => `<div class="h3-s ${x.tone} ${i ? '' : 'on'}" data-s="${i}" ${i ? 'aria-hidden="true"' : ''}><span class="h3-e">${t(x.e)}</span><h2>${t(x.t)}</h2><p>${esc(x.p)}</p>
      <div class="h3-cta"><a class="btn" href="#/${x.c[1]}">${t(x.c[0])} <span class="flip">${ic('arrow',18)}</span></a>${x.c2 ? `<a class="btn ghost" href="#/${x.c2[1]}">${t(x.c2[0])}</a>` : ''}</div></div>`).join('')}</div>
    <div class="h3-nav ${compact ? '' : 'wrap-w'}"><div class="h3-dots">${sl.map((_, i) => `<button class="${i ? '' : 'on'}" data-d="${i}" aria-label="${i + 1}"><i></i></button>`).join('')}</div>
      <div class="h3-arr"><button data-pv aria-label="${t('prev')}"><span class="flip">${ic('back',18)}</span></button><button data-nx aria-label="${t('next_s')}"><span class="flip">${ic('arrow',18)}</span></button></div></div></section>`;
}
let H3MOD = null;
function loadH3(){ if (!H3MOD) H3MOD = import('./hero3d.js?v=' + APP_V).catch(e => { H3MOD = null; throw e; }); return H3MOD; }
function webglOk(){ try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch(e) { return false; } }
function bindHero(){
  const root = $('#h3'); if (!root) return; const n = $$('.h3-s', root).length; let i = 0, timer = null, paused = false;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; const DUR = 6500;
  let mod = null;
  const go3 = k => { i = (k + n) % n; root.dataset.i = i; $$('.h3-s', root).forEach((s, j) => { s.classList.toggle('on', j === i); s.setAttribute('aria-hidden', j === i ? 'false' : 'true'); });
    $$('.h3-dots button', root).forEach((d, j) => { d.classList.toggle('on', j === i); d.classList.remove('run'); if (j === i && !reduce && !paused) { void d.offsetWidth; d.classList.add('run'); } });
    const cv = $('.h3-c', root); if (mod) { cv.classList.add('swap'); setTimeout(() => { mod.show(i); cv.classList.remove('swap'); }, 220); } };
  const arm = () => { clearInterval(timer); if (reduce) return; timer = setInterval(() => { if (!paused && !document.hidden) go3(i + 1); }, DUR); S.timers.push(timer); };
  $$('.h3-dots button', root).forEach(d => d.onclick = () => { go3(+d.dataset.d); arm(); });
  $('[data-pv]', root).onclick = () => { go3(i - 1); arm(); }; $('[data-nx]', root).onclick = () => { go3(i + 1); arm(); };
  root.addEventListener('mouseenter', () => { paused = true; $$('.h3-dots button.run', root).forEach(d => d.classList.add('hold')); });
  root.addEventListener('mouseleave', () => { paused = false; $$('.h3-dots button', root).forEach(d => d.classList.remove('hold')); });
  let x0 = null, y0 = null; root.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive:true });
  root.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) { const fwd = S.lang === 'ar' ? dx > 0 : dx < 0; go3(i + (fwd ? 1 : -1)); arm(); } x0 = null; }, { passive:true });
  go3(0);
  SPLASH.then(() => { if (!root.isConnected) return; go3(0); arm();
  if (!webglOk()) { root.classList.add('flat'); return; }
  loadH3().then(m => m.init($('.h3-c', root)).then(() => { mod = m; m.show(i); root.classList.add('g3'); })).catch(e => { console.warn('3D off', e); root.classList.add('flat'); }); });
}
function quickTiles(){
  const u = !!S.user; const T = u ? 'app/tests' : 'tests';
  const tiles = [['flask','qt_book',T,'#1257d6','#eaf2ff'],['box','qt_pk',T + '?c=packages','#7a5af8','#efeaff'],['kid','qt_kids',T + '?c=kids','#f2a516','#fff4dc'],['heart','qt_seniors',T + '?c=packages','#e8466f','#fdeaf0'],
    ['gauge','qt_bp',T + '?c=vitals','#0fae9b','#e3f7f4'],['sun','qt_vit',T + '?c=vitamins','#d97706','#fff4dc'],['file','qt_results',u ? 'app/orders?r=1' : 'login','#0d7c6c','#dff5ef'],['chat','qt_help','support','#0b2350','#e6ebf5']];
  return `<div class="qtiles">${tiles.map(([i, k, h, c, b], n) => `<a class="qt" href="#/${h}" style="--d:${n * 40}ms"><span class="qi" style="color:${c};background:${b}">${ic(i, 26, 2)}</span><span>${t(k)}</span></a>`).join('')}</div>`;
}
async function viewLanding(){
  await loadCatalog().catch(() => null); const C = S.catalog;
  const steps = [['cal','hm_st1'],['syringe','hm_st2'],['file','hm_st3']];
  app.innerHTML = `${topbar()}${heroHtml(false)}
  <section class="hm-sec"><div class="wrap-w"><h2 class="hm-h">${t('hm_quick')}</h2>${quickTiles()}</div></section>
  ${C ? `<section class="hm-sec alt"><div class="wrap-w"><div class="row between"><h2 class="hm-h">${t('hm_pk')}</h2><a class="b small" href="#/tests">${t('view_all_tests')}</a></div><div class="hscroll" id="lp">${C.packages.map(p => pkgCard(p, S.cart.packages.includes(p.id))).join('')}</div></div></section>` : ''}
  <section class="hm-sec"><div class="wrap-w"><h2 class="hm-h">${t('hm_steps')}</h2><div class="steps3">${steps.map(([i, k], n) => `<div class="st3"><span class="n">${n + 1}</span><span class="qi" style="color:var(--blue);background:#eaf2ff">${ic(i, 26, 2)}</span><b>${t(k)}</b><span class="small muted">${t(k + 'd')}</span></div>`).join('')}</div>
    <div class="center" style="margin-top:18px"><a class="btn ghost" href="#/how">${ic('globe',18)} ${t('hm_how_more')}</a></div></div></section>
  <section class="hm-sec"><div class="wrap-w"><div class="band">
      <div><b>48 h</b><span>${t('band1')}</span></div><div><b>${omr(fee())}</b><span>${t('band2')} (${t('omr')})</span></div>
      <div><b>${C ? C.wilayats.length : 7}</b><span>${t('band3')}</span></div><div><b>${C ? C.tests.length + C.packages.length : 30}</b><span>${t('band4')}</span></div></div></div></section>
  <section class="hm-sec alt"><div class="wrap-w">${soonBlock()}</div></section>
  <section class="hm-sec"><div class="wrap-w"><div class="hm-app"><div class="grow"><h2>${t('hm_app_t')}</h2><p>${t('hm_app_p')}</p><div class="row wrap" style="gap:10px"><a class="btn" href="#/install">${ic('download',18)} ${t('ins_cta')}</a><a class="btn ghost" href="#/contact">${ic('phone',18)} ${t('m_contact')}</a></div></div><div class="hm-app-qr" id="hqr"></div></div></div></section>
  ${footer()}${cartBar()}`;
  bindHero();
  const lp = $('#lp'); if (lp) { const rer = () => { lp.innerHTML = C.packages.map(p => pkgCard(p, S.cart.packages.includes(p.id))).join(''); bind(); refreshCartBadges(); const cb = $('.cart-bar'); const nb = cartBar(); if (cb) cb.outerHTML = nb || '<span></span>'; else if (nb) app.insertAdjacentHTML('beforeend', nb); bindGo(); };
    const bind = () => $$('[data-add]', lp).forEach(b => b.onclick = () => { const [ty, id] = b.dataset.add.split(':'); const was = S.cart.packages.includes(id); toggleCart(ty, id); rer(); if (!was) toastCart(); }); bind(); }
  try { if (window.LAHQR && $('#hqr')) $('#hqr').innerHTML = window.LAHQR.svg({ size: 132 }); } catch(e) {}
  const hash = location.hash.split('#')[2]; if (hash) setTimeout(() => { const el = document.getElementById(hash); if (el) el.scrollIntoView({ behavior:'smooth' }); }, 80);
}
/* opening splash: the Lab@Home van drives in (once per session) */
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
  setTimeout(() => el.classList.add('brand'), 1500); if (!hold) setTimeout(end, 3400);
  if (!webglOk()) { el.classList.add('flat'); return; }
  const race = Promise.race([loadH3(), new Promise((_, rj) => setTimeout(() => rj(new Error('slow')), 1800))]);
  race.then(m => { if (!done) { el.classList.add('g3'); return m.splash($('canvas', el), hold ? 1e9 : 3200); } }).catch(() => el.classList.add('flat'));
}

async function boot(){
  setLang(S.lang);
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.installEvt = e; if (location.hash.startsWith('#/install')) render(); });
  window.addEventListener('appinstalled', () => { S.installEvt = null; if (location.hash.startsWith('#/install')) render(); });
  if (API.hasToken()) { try { const r = await API.me(); S.user = r.user; S.unread = r.unread; } catch(e) { API.setToken(null); } }
  window.addEventListener('hashchange', render);
  appFeel();
  splashIntro();
  render();
  setInterval(poll, 20000);
  if (S.user && 'Notification' in window && Notification.permission === 'granted' && localStorage.getItem('lah_push') === '1') setTimeout(() => pushEnable(true).catch(() => {}), 3000);
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
}
boot();
})();
