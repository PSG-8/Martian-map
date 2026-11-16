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
  const close = () => { bg.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
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
  return `<header class="topbar"><div class="wrap-w in">
    <a href="#/" class="brand">${A.logo}<span>Lab@Home<small>${esc(t('brand_sub'))}</small></span></a>
    <nav class="nav"><a href="#/#how">${t('nav_how')}</a><a href="#/#tests">${t('nav_tests')}</a><a href="#/#partners">${t('nav_partners')}</a><a href="#/#coverage">${t('nav_coverage')}</a><a href="#/#faq">${t('nav_faq')}</a></nav>
    <div class="grow"></div>
    <button class="lang" data-lang>${t('lang')}</button>
    ${S.user ? `<a class="btn sm" href="#/app">${ic('home',18)} ${esc(t('m_home'))}</a>` : `<a class="btn sm ghost" href="#/login">${t('login')}</a><a class="btn sm" href="#/register" style="display:${innerWidth<480?'none':''}">${t('signup')}</a>`}
  </div></header>`;
}
function testCard(x, inCart){
  return `<div class="tcard">${A.catIcon(x.cat)}
    <div class="grow"><h4>${esc(LN(x,'name'))}</h4><div class="muted small">${esc(LN(x,'desc'))}</div>
    <div class="meta"><span class="chip ${x.fasting_hours ? 'amber' : 'teal'}">${x.fasting_hours ? t('fasting',{h:x.fasting_hours}) : t('no_fasting')}</span><span class="chip gray">${t('results_in',{h:x.tat_hours})}</span></div></div>
    <div style="text-align:end"><div class="price">${omr(x.price)} <small>${t('omr')}</small></div>
    <button class="add ${inCart ? 'on' : ''}" data-add="test:${x.id}" aria-label="${t('add')}" style="margin-top:8px">${inCart ? ic('check',20,2.6) : ic('plus',20,2.6)}</button></div></div>`;
}
function pkgCard(p, inCart){
  const full = pkgFull(p);
  return `<div class="pkg ${inCart ? 'on' : ''}">
    ${p.badge ? `<span class="chip ${p.badge === 'best' ? 'purple' : 'amber'} tag">${t(p.badge === 'best' ? 'best' : 'popular')}</span>` : ''}
    ${A.catIcon('packages')}<h3>${esc(LN(p,'name'))}</h3><p class="muted small" style="margin:0">${esc(LN(p,'desc'))}</p>
    <ul>${p.test_ids.map(id => `<li>${esc(LN(S.catalog.T[id],'name'))}</li>`).join('')}</ul>
    <div class="foot"><div><div class="price" style="font-size:1.3rem">${omr(p.price)} <small>${t('omr')}</small><span class="strike">${omr(full)}</span></div><span class="chip teal" style="margin-top:4px">${t('save',{x:omr(full - p.price)})}</span></div>
    <button class="btn ${inCart ? 'teal' : ''} sm" data-add="package:${p.id}">${inCart ? ic('check',18,2.4) + ' ' + t('added') : ic('plus',18,2.4) + ' ' + t('add')}</button></div></div>`;
}
function catalogBlock(cat, limit){
  const C = S.catalog;
  const cats = ['all','packages','vitamins','blood','diabetes','heart','thyroid','organs'];
  const tabs = `<div class="cats">${cats.map(c => `<button class="${c === cat ? 'on' : ''}" data-cat="${c}">${t('cat_'+c)}</button>`).join('')}</div>`;
  const pk = (cat === 'all' || cat === 'packages') ? C.packages : [];
  let ts = cat === 'packages' ? [] : C.tests.filter(x => cat === 'all' || x.cat === cat);
  if (limit) ts = ts.slice(0, limit);
  return `${tabs}${pk.length ? `<div class="grid g3" style="margin:14px 0 22px">${pk.slice(0, limit ? 3 : 99).map(p => pkgCard(p, S.cart.packages.includes(p.id))).join('')}</div>` : ''}
    <div class="grid g2 collapse" style="margin-top:14px">${ts.map(x => testCard(x, S.cart.tests.includes(x.id))).join('')}</div>`;
}
function bindCatalog(root, rerender){
  $$('[data-cat]', root).forEach(b => b.onclick = () => rerender(b.dataset.cat));
  $$('[data-add]', root).forEach(b => b.onclick = () => { const [ty, id] = b.dataset.add.split(':'); toggleCart(ty, id); rerender(); });
}
function cartBar(){
  const n = cartCount(); if (!n || !S.catalog) return '';
  const c = cartCalc();
  return `<div class="cart-bar"><div class="in"><div class="grow"><b>${t('items_n',{n:c.items.length})}</b><div class="small" style="opacity:.8">${omr(c.sub)} ${t('omr')} + ${omr(fee())} ${t('home_fee')}</div></div><button class="btn sm" data-go="${S.user ? 'app/book' : 'register'}">${t('continue_book')} ${'<span class="flip">'+ic('arrow',18)+'</span>'}</button></div></div>`;
}

async function viewLanding(){
  await loadCatalog().catch(() => null);
  const C = S.catalog;
  let cat = 'all';
  const steps = ['s1','s2','s3','s4','s5','s6','s7','s8','s9','s10'];
  app.innerHTML = `${topbar()}
  <section class="hero"><div class="wrap-w in">
    <div><span class="chip" style="margin-bottom:16px">${ic('pin',14)} ${t('trust4')}</span>
      <h1>${t('hero_t1')}<br><em>${t('hero_t2')}</em></h1>
      <p class="lead">${t('hero_p')}</p>
      <div class="cta"><a class="btn" href="#/${S.user ? 'app/tests' : 'register'}">${t('book_now')} ${'<span class="flip">'+ic('arrow',18)+'</span>'}</a><a class="btn ghost" href="#/#tests">${t('explore_tests')}</a></div>
      <div class="trust"><span>${ic('shield',18)} ${t('trust1')}</span><span>${ic('flask',18)} ${t('trust2')}</span><span>${ic('clock',18)} ${t('trust3')}</span></div>
    </div>
    <div class="hero-art">${A.hero}</div>
  </div></section>

  <section class="section" id="how"><div class="wrap-w">
    <div class="section-h"><span class="eyebrow">${t('how_eyebrow')}</span><h2>${t('how_t')}</h2><p>${t('how_p')}</p></div>
    <div class="journey">${steps.map((s, i) => `<div class="jstep"><span class="n">${i+1}</span><div class="ic" style="color:var(--blue)">${ic(A.steps[i],30)}</div><h4>${t(s)}</h4><p>${t(s+'d')}</p></div>`).join('')}</div>
  </div></section>

  <section class="section alt" id="tests"><div class="wrap-w">
    <div class="section-h"><span class="eyebrow">${t('tests_eyebrow')}</span><h2>${t('tests_t')}</h2><p>${t('tests_p',{fee:omr(fee())})}</p></div>
    <div id="cat-block">${C ? catalogBlock(cat, 6) : '<div class="skel"></div>'}</div>
    <div class="center" style="margin-top:22px"><a class="btn ghost" href="#/tests">${t('view_all_tests')}</a></div>
  </div></section>

  <section class="section" id="partners"><div class="wrap-w">
    <div class="section-h"><span class="eyebrow">${t('roles_eyebrow')}</span><h2>${t('roles_t')}</h2><p>${t('roles_p')}</p></div>
    <div class="roles">${['patient','nurse','courier','lab','company'].map(r => `<a class="role" href="#/register/${r}">${A.roleIcon(r)}<h4>${t('r_'+r)}</h4><p>${t('r_'+r+'_d')}</p></a>`).join('')}</div>
    <div class="band" style="margin-top:34px">
      <div><b>48 h</b><span>${t('band1')}</span></div><div><b>${omr(fee())}</b><span>${t('band2')} (${t('omr')})</span></div>
      <div><b>${C ? C.wilayats.length : 7}</b><span>${t('band3')}</span></div><div><b>${C ? C.tests.length + C.packages.length : 17}</b><span>${t('band4')}</span></div>
    </div>
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
  const block = $('#cat-block');
  const rer = c => { if (c) cat = c; block.innerHTML = catalogBlock(cat, 6); bindCatalog(block, rer); const cb = $('.cart-bar'); const nb = cartBar(); if (cb) cb.outerHTML = nb || '<span></span>'; else if (nb) app.insertAdjacentHTML('beforeend', nb); bindGo(); };
  if (C) bindCatalog(block, rer);
  $('#wl').onsubmit = async e => { e.preventDefault(); const f = e.target; const b = $('button', f);
    await busy(b, () => API.waitlist(f.n.value, f.p.value, f.w.value)).then(() => { toast(t('joined')); f.reset(); }).catch(() => {}); };
  covMap();
  const hash = location.hash.split('#')[2]; if (hash) setTimeout(() => { const el = document.getElementById(hash); if (el) el.scrollIntoView({ behavior:'smooth' }); }, 50);
}
function footer(){
  return `<footer class="site"><div class="wrap-w"><div class="row wrap between" style="gap:20px;align-items:flex-start">
    <div style="max-width:520px"><div class="brand">${A.logo}<span>Lab@Home</span></div><p class="small" style="margin-top:12px">${t('foot_note')}</p><p class="xs" style="opacity:.75">${t('foot_team')}</p></div>
    <div class="stack small"><a href="#/tests">${t('nav_tests')}</a><a href="#/register/nurse">${t('r_nurse')}</a><a href="#/register/lab">${t('r_lab')}</a><a href="#/register/company">${t('r_company')}</a></div></div>
    <p class="xs" style="opacity:.6;margin-top:24px">© 2026 Lab@Home · Oman</p></div></footer>`;
}
function covMap(){
  const el = $('#cov-map'); if (!el) return;
  const draw = () => { if (!window.L || !S.catalog) return setTimeout(draw, 200);
    const m = L.map(el, { scrollWheelZoom:false, attributionControl:true }).setView([22.72, 58.55], 9);
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
  return `<div class="auth"><div class="side"><a href="#/" class="brand" style="color:#fff">${A.logo}<span>Lab@Home</span></a>
    <div><h2>${t('hero_t1')} ${t('hero_t2')}</h2><p style="opacity:.85">${t('hero_p')}</p></div>
    <div style="max-width:420px;opacity:.95">${A.welcomeArt}</div></div>
    <div class="main"><div class="box"><div class="row between" style="margin-bottom:22px"><a href="#/" class="brand">${A.logo}<span class="hide-d">Lab@Home</span></a><button class="lang" data-lang>${t('lang')}</button></div>${inner}</div></div></div>`;
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
  const back = sessionStorage.getItem('lah_after'); sessionStorage.removeItem('lah_after');
  go(back || (S.user.role === 'patient' && cartCount() ? 'app/book' : 'app'));
}
function viewLogin(){
  const demos = [['patient','patient@demo.labathome.om'],['nurse','nurse@demo.labathome.om'],['courier','courier@demo.labathome.om'],['lab','lab@demo.labathome.om'],['company','company@demo.labathome.om'],['admin','admin@demo.labathome.om']];
  app.innerHTML = authShell(`<h1>${t('welcome_back')}</h1><p class="muted">${t('login_sub')}</p>
    <form id="lf" class="stack" style="margin-top:18px"><label class="field"><span>${t('email_or_phone')}</span><input class="input" name="login" autocomplete="username" required placeholder="name@email.com · 9XXXXXXX"></label>
    ${pwField('password', t('password'))}<div class="err" id="le"></div><button class="btn block">${t('login')}</button></form>
    <p class="center muted" style="margin:16px 0">${t('no_account')} <a href="#/register" class="b">${t('signup')}</a></p>
    <div class="card flat" style="margin-top:8px"><div class="small b" style="margin-bottom:10px">${t('try_demo')}</div>
    <div class="demo-grid">${demos.map(([r, e]) => `<button type="button" data-demo="${e}">${A.roleIcon(r, 34)}${t('r_'+r)}</button>`).join('')}</div></div>`);
  bindPw(app);
  $('#lf').onsubmit = async e => { e.preventDefault(); const f = e.target; $('#le').textContent = '';
    try { const r = await busy($('button.btn', f), () => API.login(f.login.value, f.password.value)); afterLogin(r); } catch(err) { $('#le').textContent = errMsg(err); } };
  $$('[data-demo]').forEach(b => b.onclick = async () => { try { const r = await busy(b, () => API.login(b.dataset.demo, 'Demo@2026')); afterLogin(r); } catch(e) {} });
}
function viewRegister(role){
  const C = S.catalog; const W = C ? C.wilayats : Object.keys(WILAYAT_AR);
  const st = { role: role || null, step: role ? 1 : 0 };
  const draw = () => {
    const bar = `<div class="stepper"><i class="on"></i><i class="${st.step >= 1 ? 'on' : ''}"></i></div>`;
    if (st.step === 0) {
      app.innerHTML = authShell(`${bar}<h1>${t('reg_t')}</h1><p class="muted">${t('reg_role')}</p>
        <div class="grid g2 collapse" style="margin-top:16px">${['patient','nurse','courier','lab','company'].map(r => `<button class="role" style="text-align:start;display:flex;gap:12px;align-items:center;padding:14px" data-role="${r}">${A.roleIcon(r, 46)}<span><b>${t('r_'+r)}</b><span class="muted small" style="display:block">${t('r_'+r+'_d')}</span></span></button>`).join('')}</div>
        <p class="center muted" style="margin-top:18px">${t('have_account')} <a href="#/login" class="b">${t('login')}</a></p>`);
      $$('[data-role]').forEach(b => b.onclick = () => { st.role = b.dataset.role; st.step = 1; history.replaceState(null, '', '#/register/' + st.role); draw(); });
      return;
    }
    const r = st.role;
    const wsel = (name, multi) => multi
      ? `<div class="row wrap" style="gap:8px">${W.map(w => `<label class="chip gray" style="cursor:pointer;padding:8px 12px"><input type="checkbox" name="${name}" value="${esc(w)}" ${w === 'Ibra' ? 'checked' : ''} style="accent-color:var(--blue)"> ${esc(wN(w))}</label>`).join('')}</div>`
      : `<select class="input" name="${name}">${W.map(w => `<option value="${esc(w)}">${esc(wN(w))}</option>`).join('')}<option value="Other">${S.lang === 'ar' ? 'ولاية أخرى' : 'Other wilayat'}</option></select>`;
    const extra = {
      patient: `<div class="grid g2"><label class="field"><span>${t('gender')}</span><select class="input" name="gender"><option value="male">${t('male')}</option><option value="female">${t('female')}</option></select></label><label class="field"><span>${t('dob')}</span><input class="input" type="date" name="dob" max="${new Date().toISOString().slice(0,10)}"></label></div>
        <label class="field"><span>${t('wilayat')}</span>${wsel('wilayat')}</label><label class="field"><span>${t('address')}</span><input class="input" name="address" placeholder="${t('address_ph')}"></label>`,
      nurse: `<div class="grid g2"><label class="field"><span>${t('license')}</span><input class="input" name="license" required placeholder="OMSB-RN-…"></label><label class="field"><span>${t('years')}</span><input class="input" type="number" min="0" max="50" name="years"></label></div>
        <label class="field"><span>${t('gender')}</span><select class="input" name="gender"><option value="female">${t('female')}</option><option value="male">${t('male')}</option></select></label>
        <label class="field"><span>${t('wilayat')}</span>${wsel('wilayat')}</label><div class="field"><span>${t('coverage')}</span>${wsel('coverage', true)}</div>`,
      courier: `<label class="field"><span>${t('logistics_co')}</span><input class="input" name="company"></label><label class="field"><span>${t('vehicle')}</span><input class="input" name="vehicle" placeholder="Van · 2–8 °C box"></label><label class="field"><span>${t('wilayat')}</span>${wsel('wilayat')}</label>`,
      lab: `<label class="field"><span>${t('lab_name')}</span><input class="input" name="lab_name" required></label><div class="grid g2"><label class="field"><span>${t('lab_license')}</span><input class="input" name="license" required></label><label class="field"><span>${t('accreditation')}</span><input class="input" name="accreditation" placeholder="ISO 15189 / CAP"></label></div>
        <label class="field"><span>${t('wilayat')}</span>${wsel('wilayat')}</label><label class="field"><span>${t('address')}</span><input class="input" name="address"></label>`,
      company: `<label class="field"><span>${t('company_name')}</span><input class="input" name="company_name" required></label><div class="grid g2"><label class="field"><span>${t('cr')}</span><input class="input" name="cr"></label><label class="field"><span>${t('employees')}</span><input class="input" type="number" min="1" name="employees"></label></div><label class="field"><span>${t('wilayat')}</span>${wsel('wilayat')}</label>`
    }[r];
    app.innerHTML = authShell(`${bar}<button class="link" data-back>${ic('back',18)} ${t('back')}</button>
      <div class="row" style="margin:12px 0 4px">${A.roleIcon(r, 44)}<div><h1 style="margin:0">${t('reg_t')}</h1><div class="muted small">${t('r_'+r)} · ${t('r_'+r+'_d')}</div></div></div>
      <form id="rf" class="stack" style="margin-top:16px" novalidate>
        <label class="field"><span>${r === 'company' ? t('contact_person') : r === 'lab' ? t('contact_person') : t('full_name')}</span><input class="input" name="full_name" autocomplete="name" required></label>
        <div class="grid g2"><label class="field"><span>${t('phone')}</span><input class="input" name="phone" inputmode="tel" autocomplete="tel" placeholder="9XXX XXXX"></label>
        <label class="field"><span>${t('email_opt')}</span><input class="input" type="email" name="email" autocomplete="email"></label></div>
        ${pwField('newpass', t('password'), t('pass_rule'))}
        ${extra}
        <label class="check"><input type="checkbox" name="consent"> <span>${t('consent')}</span></label>
        ${r !== 'patient' ? `<div class="banner blue small">${ic('shield',20)}<span>${t('pending_p')}</span></div>` : ''}
        <div class="err" id="re"></div><button class="btn block">${t('finish')}</button></form>
      <p class="center muted" style="margin-top:16px">${t('have_account')} <a href="#/login" class="b">${t('login')}</a></p>`);
    bindPw(app);
    $('[data-back]').onclick = () => { st.step = 0; st.role = null; history.replaceState(null, '', '#/register'); draw(); };
    $('#rf').onsubmit = async e => { e.preventDefault(); const f = e.target; $('#re').textContent = '';
      const val = n => f[n] ? (f[n].value || '').trim() : '';
      const meta = {};
      ['gender','dob','license','years','lab_name','accreditation','company_name','cr','employees','vehicle','company'].forEach(k => { if (f[k] && f[k].value) meta[k] = f[k].value.trim(); });
      if (r === 'nurse') meta.coverage = $$('input[name=coverage]:checked', f).map(x => x.value);
      if (r === 'lab' && !meta.lab_name) { $('#re').textContent = t('e_NEED_NAME'); return; }
      const ll = WILAYAT_LL[val('wilayat')] || [];
      const p = { role:r, full_name: r === 'lab' ? (meta.lab_name || val('full_name')) : r === 'company' ? (meta.company_name || val('full_name')) : val('full_name'),
        phone: val('phone'), email: val('email'), password: f.newpass.value, consent: f.consent.checked,
        governorate: 'North Al Sharqiyah', wilayat: val('wilayat'), address: val('address'), lat: ll[0] || '', lng: ll[1] || '', meta };
      if (r === 'lab' || r === 'company') p.meta.contact = val('full_name');
      try { const res = await busy($('button.btn', f), () => API.register(p)); afterLogin(res); } catch(err) { $('#re').textContent = errMsg(err); }
    };
  };
  draw();
}

/* ---------- app shell ---------- */
function navFor(role){
  const m = {
    patient: [['app','home','m_home'],['app/tests','flask','m_tests'],['app/orders','list','m_orders'],['app/notifs','bell','m_notifs'],['app/profile','user','m_profile']],
    nurse: [['app','home','m_home'],['app/orders','syringe','m_jobs'],['app/notifs','bell','m_notifs'],['app/profile','user','m_profile']],
    courier: [['app','home','m_home'],['app/orders','van','m_pickups'],['app/notifs','bell','m_notifs'],['app/profile','user','m_profile']],
    lab: [['app','home','m_home'],['app/orders','flask','m_samples'],['app/notifs','bell','m_notifs'],['app/profile','user','m_profile']],
    company: [['app','home','m_programs'],['app/notifs','bell','m_notifs'],['app/profile','user','m_profile']],
    admin: [['app','chart','overview'],['app/orders','list','m_all_orders'],['app/admin/users','users','m_users'],['app/admin/catalog','flask','m_catalog'],['app/notifs','bell','m_notifs'],['app/profile','user','m_profile']]
  };
  return m[role] || m.patient;
}
function shell(title, body, opts){
  const u = S.user; const route = (location.hash.slice(2) || 'app').split('?')[0];
  const items = navFor(u.role);
  const isOn = h => route === h || (h !== 'app' && route.startsWith(h));
  return `${u.is_demo ? `<div class="demo-banner">${ic('play',14)} ${S.lang === 'ar' ? 'حساب تجريبي' : 'Demo account'} · ${t('r_'+u.role)}</div>` : ''}
  <div class="shell"><aside class="side-nav"><a href="#/" class="brand">${A.logo}<span>Lab@Home<small>${t('r_'+u.role)}</small></span></a>
    ${items.map(([h, i, k]) => `<a href="#/${h}" class="${isOn(h) ? 'on' : ''}">${ic(i)} <span class="grow">${t(k)}</span>${h === 'app/notifs' && S.unread ? `<span class="chip red">${S.unread}</span>` : ''}</a>`).join('')}
    <div class="me"><span class="avatar">${esc(initials(u.full_name))}</span><div class="grow"><div class="b small" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(u.full_name)}</div><button class="link small" data-logout>${t('logout')}</button></div></div></aside>
  <main class="main-area"><div class="app-top">${opts && opts.back ? `<button class="icon-btn" data-goback aria-label="${t('back')}"><span class="flip">${ic('back')}</span></button>` : ''}<h1 class="grow">${title}</h1>
    <button class="lang" data-lang>${t('lang')}</button><button class="icon-btn" data-go="app/notifs" aria-label="${t('m_notifs')}">${ic('bell')}${S.unread ? `<span class="dot">${S.unread}</span>` : ''}</button></div>
  <div class="content">${u.status === 'pending' ? `<div class="banner amber" style="margin-bottom:16px">${ic('clock',22)}<div><b>${t('pending_t')}</b><div class="small">${t('pending_p')}</div></div></div>` : ''}${body}</div></main></div>
  <nav class="tabbar">${items.slice(0, 5).map(([h, i, k]) => `<a href="#/${h}" class="${isOn(h) ? 'on' : ''}">${ic(i)}<span>${t(k)}</span></a>`).join('')}</nav>`;
}
function loading(title){ app.innerHTML = shell(title || '', `<div class="loading"><span class="spin"></span></div>`); }
function orderItem(o, extra){
  const names = (o.items || []).map(i => S.lang === 'ar' ? i.name_ar : i.name_en).join(' · ');
  return `<a class="oitem" href="#/app/order/${o.id}"><span class="oi" style="color:var(--blue)">${ic(o.status === 'completed' ? 'file' : 'flask', 26)}</span>
    <div class="grow"><div class="row between"><b>${esc(o.code)}</b>${stChip(o.status)}</div>
    <div class="small muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(names)}</div>
    <div class="xs muted">${ic('cal',13)} ${fmtDate(o.slot_date)} · ${esc(o.slot_time)} · ${ic('pin',13)} ${esc(wN(o.wilayat))}${o.person ? ' · ' + esc(o.person) : ''}</div>${extra || ''}</div></a>`;
}
function emptyBox(msg, cta){ return `<div class="card empty">${A.emptyArt}<p>${msg}</p>${cta || ''}</div>`; }

/* ---------- patient ---------- */
async function viewPatientHome(){
  loading(t('m_home'));
  const [list] = await Promise.all([API.orders(), loadCatalog()]);
  const active = list.filter(o => ACTIVE(o.status)); const done = list.filter(o => o.status === 'completed');
  const C = S.catalog;
  app.innerHTML = shell(t('m_home'), `<div class="stack-lg">
    <div class="welcome"><div class="art">${A.welcomeArt}</div><h2>${t('hello',{n:esc(S.user.full_name.split(' ')[0])})}</h2><p style="opacity:.85;max-width:420px">${t('hello_sub_patient')}</p><a class="btn" style="background:#fff;color:var(--blue);margin-top:6px" href="#/app/tests">${ic('plus',18)} ${t('q_book')}</a></div>
    <div class="qa"><a href="#/app/tests"><span style="color:var(--blue)">${ic('flask',34)}</span>${t('q_book')}</a><a href="#/app/tests?c=packages"><span style="color:var(--purple)">${ic('box',34)}</span>${t('q_packages')}</a><a href="#/app/orders"><span style="color:var(--teal)">${ic('pin',34)}</span>${t('q_track')}</a><a href="#/app/orders?r=1"><span style="color:var(--amber)">${ic('file',34)}</span>${t('q_reports')}</a></div>
    <div><div class="row between"><h3>${t('upcoming')}</h3>${list.length ? `<a href="#/app/orders" class="small b">${t('see_all')}</a>` : ''}</div>
      ${active.length ? `<div class="olist">${active.map(o => orderItem(o)).join('')}</div>` : emptyBox(t('none_orders'), `<a class="btn" href="#/app/tests">${t('book_now')}</a>`)}</div>
    ${done.length ? `<div><h3>${t('q_reports')}</h3><div class="olist">${done.slice(0, 3).map(o => orderItem(o)).join('')}</div></div>` : ''}
    <div><h3>${t('cat_packages')}</h3><div class="grid g3" id="hp">${C.packages.slice(0, 3).map(p => pkgCard(p, S.cart.packages.includes(p.id))).join('')}</div></div>
  </div>${cartBar()}`);
  $$('#hp [data-add]').forEach(b => b.onclick = () => { const [ty, id] = b.dataset.add.split(':'); toggleCart(ty, id); viewPatientHome(); });
}
async function viewAppTests(){
  await loadCatalog();
  let cat = new URLSearchParams(location.hash.split('?')[1] || '').get('c') || 'all';
  app.innerHTML = shell(t('m_tests'), `<p class="muted">${t('tests_p',{fee:omr(fee())})}</p><div id="cb"></div><div id="cbar"></div>`);
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
  if (r === 'admin') return viewAdminOrders();
  const list = await API.orders();
  const title = t(r === 'nurse' ? 'my_visits' : r === 'courier' ? 'm_pickups' : 'm_samples');
  app.innerHTML = shell(title, list.length ? `<div class="olist">${list.map(o => orderItem(o)).join('')}</div>` : emptyBox(t('none_yet')));
}

/* booking */
function bkInit(){
  if (!S.bk) { const now = muscatNow(); const u = S.user;
    S.bk = { step: 1, who: 'me', person: { name:'', relation:'parent', gender:'female', dob:'' }, date: addDays(now.date, 1), time: '', wilayat: u.wilayat && WILAYAT_LL[u.wilayat] ? u.wilayat : 'Ibra', address: u.address || '', lat: u.lat, lng: u.lng, notes:'', pay:'card', code:'', program:null }; }
  return S.bk;
}
async function viewBook(){
  await loadCatalog(); const b = bkInit(); const C = S.catalog;
  const c = cartCalc();
  if (!b.program && !c.items.length) { app.innerHTML = shell(t('q_book'), emptyBox(t('cart_empty'), `<a class="btn" href="#/app/tests">${t('explore_tests')}</a>`)); return; }
  const stepNames = ['b_step1','b_step2','b_step3','b_step4','b_step5'];
  const head = `<div class="stepper">${stepNames.map((s, i) => `<i class="${i < b.step ? 'on' : ''}"></i>`).join('')}</div><div class="small muted b" style="margin:-12px 0 14px">${b.step} / 5 · ${t(stepNames[b.step-1])}</div>`;
  const items = b.program ? [{ name: LN(C.P[b.program.package_id],'name'), price: Number(C.P[b.program.package_id].price) }] : c.items;
  const sub = b.program ? Number(C.P[b.program.package_id].price) : c.sub;
  const total = b.program ? 0 : sub + fee();
  const summary = `<div class="card summary"><h3>${t('summary')}</h3>${items.map(i => `<div class="line"><span>${esc(i.name)}</span><span class="num">${omr(i.price)}</span></div>`).join('')}
    <div class="line"><span>${t('home_fee')}</span><span class="num">${omr(fee())}</span></div>
    ${b.program ? `<div class="line" style="color:var(--teal)"><span>${t('discount')}</span><span class="num">−${omr(sub + fee())}</span></div>` : ''}
    <div class="line total"><span>${t('total')}</span><span class="num">${omr(total)} ${t('omr')}</span></div>
    ${b.step > 2 ? `<hr class="sep"><div class="small muted">${ic('cal',14)} ${fmtDate(b.date)} ${b.time ? '· ' + b.time : ''}<br>${ic('pin',14)} ${esc(wN(b.wilayat))}</div>` : ''}</div>`;
  let body = '';
  if (b.step === 1) {
    body = `<div class="card"><h3>${t('cart')}</h3>${b.program ? `<div class="banner teal">${ic('building',20)}<b>${t('sponsored_by',{c:esc(b.program.company)})}</b></div>` : ''}
      ${items.map((i, k) => `<div class="vline"><div><b>${esc(i.name)}</b></div><div class="row"><span class="price">${omr(i.price)}</span>${b.program ? '' : `<button class="icon-btn" data-rm="${k}" aria-label="remove">${ic('x',18)}</button>`}</div></div>`).join('')}
      ${c.fasting && !b.program ? `<div class="banner amber small" style="margin-top:12px">${ic('clock',20)}<span>${t('fasting',{h:c.fasting})} · ${t('fasting_tip')}</span></div>` : ''}
      <a href="#/app/tests" class="btn soft sm" style="margin-top:14px">${ic('plus',16)} ${t('add')}</a></div>`;
  } else if (b.step === 2) {
    body = `<div class="card stack"><h3>${t('who_t')}</h3><div class="seg"><button data-who="me" class="${b.who === 'me' ? 'on' : ''}">${t('me')}</button><button data-who="family" class="${b.who === 'family' ? 'on' : ''}">${t('family')}</button></div>
      ${b.who === 'family' ? `<label class="field"><span>${t('full_name')}</span><input class="input" id="pn" value="${esc(b.person.name)}"></label>
      <div class="grid g3"><label class="field"><span>${t('relation')}</span><select class="input" id="pr">${['parent','child','spouse','other'].map(x => `<option value="${x}" ${b.person.relation === x ? 'selected' : ''}>${t('rel_'+x)}</option>`).join('')}</select></label>
      <label class="field"><span>${t('gender')}</span><select class="input" id="pg"><option value="female">${t('female')}</option><option value="male" ${b.person.gender === 'male' ? 'selected' : ''}>${t('male')}</option></select></label>
      <label class="field"><span>${t('dob')}</span><input class="input" type="date" id="pd" value="${esc(b.person.dob)}"></label></div>` : `<div class="row"><span class="avatar">${esc(initials(S.user.full_name))}</span><div><b>${esc(S.user.full_name)}</b><div class="small muted">${esc(S.user.phone || S.user.email || '')}</div></div></div>`}</div>`;
  } else if (b.step === 3) {
    const now = muscatNow(); const days = Array.from({ length: 14 }, (_, i) => addDays(now.date, i));
    const slots = C.slots;
    const dis = s => b.date === now.date && (parseInt(s) * 60 <= now.mins + 60);
    body = `<div class="card stack"><h3>${t('date_t')}</h3><div class="cal">${days.map(d => { const x = new Date(d+'T12:00:00'); return `<button data-date="${d}" class="${b.date === d ? 'on' : ''}"><div class="xs" style="opacity:.75">${x.toLocaleDateString(loc(),{ weekday:'short' })}</div>${x.getDate()}</button>`; }).join('')}</div>
      <h3 style="margin-top:8px">${t('time_t')}</h3>${c.fasting ? `<div class="banner amber small">${ic('clock',20)}<span>${t('fasting_tip')}</span></div>` : ''}
      <div class="small b muted">${t('morning')}</div><div class="slots">${slots.filter(s => parseInt(s) < 13).map(s => `<button data-slot="${s}" class="${b.time === s ? 'on' : ''}" ${dis(s) ? 'disabled' : ''}>${s}</button>`).join('')}</div>
      <div class="small b muted">${t('evening')}</div><div class="slots">${slots.filter(s => parseInt(s) >= 13).map(s => `<button data-slot="${s}" class="${b.time === s ? 'on' : ''}" ${dis(s) ? 'disabled' : ''}>${s}</button>`).join('')}</div></div>`;
  } else if (b.step === 4) {
    body = `<div class="card stack"><h3>${t('loc_t')}</h3><label class="field"><span>${t('wilayat')}</span><select class="input" id="bw">${C.wilayats.map(w => `<option value="${esc(w)}" ${b.wilayat === w ? 'selected' : ''}>${esc(wN(w))}</option>`).join('')}</select></label>
      <div class="mapbox" id="bmap"></div><div class="row between"><span class="hint">${t('pin_tip')}</span><button class="btn soft sm" id="gps">${ic('pin',16)} ${t('use_gps')}</button></div>
      <label class="field"><span>${t('address')}</span><textarea class="input" id="ba" rows="2" placeholder="${t('address_ph')}">${esc(b.address)}</textarea></label>
      <label class="field"><span>${t('notes')}</span><input class="input" id="bn" value="${esc(b.notes)}" placeholder="${t('notes_ph')}"></label></div>`;
  } else {
    body = `<div class="card stack"><h3>${t('pay_t')}</h3>
      <div class="row"><input class="input grow" id="code" placeholder="${t('sponsor_code')}" value="${esc(b.code)}" style="text-transform:uppercase"><button class="btn soft" id="apply">${t('apply')}</button></div>
      ${b.program ? `<div class="banner teal">${ic('check',20)}<b>${t('sponsored_by',{c:esc(b.program.company)})} · ${esc(b.program.name)}</b></div>` : `
      <div class="paym">${[['card','card','pay_card'],['applepay','phone','pay_apple'],['cash','clock','pay_cash']].map(([v, i, k]) => `<label class="${b.pay === v ? 'on' : ''}"><input type="radio" name="pay" value="${v}" ${b.pay === v ? 'checked' : ''}> ${ic(i)} <span class="grow b">${t(k)}</span></label>`).join('')}</div>
      ${b.pay === 'card' ? `<div class="grid g3"><label class="field" style="grid-column:1/-1"><span>${t('card_no')}</span><input class="input ltr" id="cn" inputmode="numeric" placeholder="4242 4242 4242 4242" autocomplete="cc-number" style="width:100%"></label><label class="field"><span>${t('exp')}</span><input class="input" id="ce" placeholder="12/28" autocomplete="cc-exp"></label><label class="field"><span>${t('cvv')}</span><input class="input" id="cv" inputmode="numeric" placeholder="123" autocomplete="cc-csc"></label></div>` : ''}
      <div class="banner blue small">${ic('shield',20)}<span>${t('test_mode')}</span></div>`}</div>`;
  }
  const next = b.step < 5 ? `<button class="btn" id="nx">${t('next')} ${'<span class="flip">'+ic('arrow',18)+'</span>'}</button>` : `<button class="btn teal" id="pay">${b.program || b.pay === 'cash' ? t('confirm_book') : t('confirm_pay',{x:omr(total)})}</button>`;
  app.innerHTML = shell(t('q_book'), `${head}<div class="grid" style="grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:18px" id="bkg">
    <div class="stack">${body}<div class="err" id="be"></div><div class="row">${b.step > 1 ? `<button class="btn ghost" id="pv">${t('back')}</button>` : ''}<div class="grow"></div>${next}</div></div><div>${summary}</div></div>`, { back: true });
  if (innerWidth < 900) $('#bkg').style.gridTemplateColumns = '1fr';
  const err = m => $('#be').textContent = m;
  $$('[data-rm]').forEach(x => x.onclick = () => { const it = c.items[+x.dataset.rm]; toggleCart(it.type, it.id); viewBook(); });
  $$('[data-who]').forEach(x => x.onclick = () => { b.who = x.dataset.who; viewBook(); });
  $$('[data-date]').forEach(x => x.onclick = () => { b.date = x.dataset.date; b.time = ''; viewBook(); });
  $$('[data-slot]').forEach(x => x.onclick = () => { b.time = x.dataset.slot; viewBook(); });
  $$('input[name=pay]').forEach(x => x.onchange = () => { b.pay = x.value; viewBook(); });
  if (b.step === 4) bookMap(b);
  const keep = () => {
    if (b.step === 2 && b.who === 'family') { b.person = { name: $('#pn').value.trim(), relation: $('#pr').value, gender: $('#pg').value, dob: $('#pd').value }; }
    if (b.step === 4) { b.wilayat = $('#bw').value; b.address = $('#ba').value.trim(); b.notes = $('#bn').value.trim(); }
  };
  if ($('#pv')) $('#pv').onclick = () => { keep(); b.step--; viewBook(); };
  if ($('#nx')) $('#nx').onclick = () => { keep();
    if (b.step === 2 && b.who === 'family' && !b.person.name) return err(t('e_NEED_NAME'));
    if (b.step === 3 && !b.time) return err(t('e_BAD_SLOT'));
    if (b.step === 4 && !b.address) return err(t('e_NEED_ADDRESS'));
    b.step++; viewBook(); window.scrollTo(0, 0); };
  if ($('#apply')) $('#apply').onclick = async () => { const code = $('#code').value.trim(); if (!code) return; b.code = code;
    try { const pr = await busy($('#apply'), () => API.programLookup(code)); b.program = pr; viewBook(); } catch(e) { b.program = null; err(errMsg(e)); } };
  if ($('#pay')) $('#pay').onclick = async () => {
    if (!b.program && b.pay === 'card') { const n = ($('#cn').value || '').replace(/\D/g, ''); const ex = ($('#ce').value || '').trim(); const cv = ($('#cv').value || '').trim();
      if (!luhn(n) || !/^(0[1-9]|1[0-2])\/\d{2}$/.test(ex) || !/^\d{3,4}$/.test(cv)) return err(t('e_CARD')); }
    const p = { items: c.items.map(i => ({ type:i.type, id:i.id })), slot_date: b.date, slot_time: b.time, wilayat: b.wilayat, governorate: 'North Al Sharqiyah', address: b.address, lat: b.lat, lng: b.lng, notes: b.notes, payment_method: b.pay };
    if (b.program) p.program_code = b.code;
    if (b.who === 'family') p.person = b.person;
    try { const o = await busy($('#pay'), () => API.orderCreate(p)); S.cart = { packages:[], tests:[] }; saveCart(); S.bk = null; bookedScreen(o); } catch(e) { err(errMsg(e)); }
  };
}
function luhn(n){ if (n.length < 13 || n.length > 19) return false; let s = 0, alt = false; for (let i = n.length - 1; i >= 0; i--) { let d = +n[i]; if (alt) { d *= 2; if (d > 9) d -= 9; } s += d; alt = !alt; } return s % 10 === 0; }
function bookMap(b){
  const el = $('#bmap'); const draw = () => { if (!window.L) return setTimeout(draw, 200);
    const ll = b.lat && b.lng ? [b.lat, b.lng] : (WILAYAT_LL[b.wilayat] || WILAYAT_LL.Ibra);
    const m = L.map(el, { zoomControl:true }).setView(ll, 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19, attribution:'© OpenStreetMap' }).addTo(m);
    const mk = L.marker(ll, { draggable:true }).addTo(m);
    const set = p => { b.lat = +p.lat.toFixed(6); b.lng = +p.lng.toFixed(6); };
    set(mk.getLatLng());
    mk.on('dragend', () => set(mk.getLatLng())); m.on('click', e => { mk.setLatLng(e.latlng); set(e.latlng); });
    $('#bw').onchange = () => { const w = WILAYAT_LL[$('#bw').value]; if (w) { m.setView(w, 14); mk.setLatLng(w); set(mk.getLatLng()); } };
    $('#gps').onclick = () => navigator.geolocation && navigator.geolocation.getCurrentPosition(p => { const x = [p.coords.latitude, p.coords.longitude]; m.setView(x, 16); mk.setLatLng(x); set(mk.getLatLng()); }, () => toast(t('e_GENERIC'), true), { enableHighAccuracy:true, timeout:8000 });
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
  if (ACTIVE(o.status)) S.timers.push(setInterval(async () => { if (!location.hash.includes(id) || document.hidden) return; try { const n = await API.order(id); if (n.updated_at !== o.updated_at && !$('.modal-bg') && !$('#results-form')) { o = n; drawOrder(o); } } catch(e) {} }, 8000));
}
function drawOrder(o){
  const u = S.user, r = u.role;
  const idx = STATUS.indexOf(o.status);
  const ev = {}; (o.events || []).forEach(e => ev[e.status] = e.at);
  const pct = o.status === 'cancelled' ? 0 : Math.round(Math.max(0, idx) / (STATUS.length - 1) * 100);
  let eta = '';
  if (o.status === 'on_the_way') { const m = Math.max(3, 18 - Math.round((Date.now() - new Date(ev.on_the_way)) / 60000)); eta = `<div class="banner blue">${ic('truck',22)}<div><b>${t('st_on_the_way')}</b><div class="small">${t('eta',{m})}</div></div></div>`; }
  const tl = `<ul class="tl">${STATUS.map((s, i) => { const cls = o.status === 'cancelled' ? 'todo' : i < idx || o.status === 'completed' ? 'done' : i === idx ? 'now' : 'todo';
      return `<li class="${cls}"><span class="dotc">${cls === 'done' ? ic('check',16,2.6) : cls === 'now' ? ic('clock',16,2.2) : ''}</span><div><b>${t('st_'+s)}</b><div class="xs muted">${ev[s] ? fmtDT(ev[s]) : ''}</div></div></li>`; }).join('')}
    ${o.status === 'cancelled' ? `<li class="now"><span class="dotc" style="background:var(--red)">${ic('x',16,2.6)}</span><div><b>${t('st_cancelled')}</b><div class="xs muted">${fmtDT(ev.cancelled)}</div></div></li>` : ''}</ul>`;
  const nurse = o.nurse ? `<div class="card"><div class="small muted b">${S.user.role==='patient'?t('your_nurse'):t('r_nurse')}</div><div class="row" style="margin-top:10px">${A.roleIcon('nurse', 52)}<div class="grow"><b>${esc(o.nurse.name)}</b><div class="xs muted">${t('licence')}: ${esc(o.nurse.license || '—')} · ${o.nurse.rating ? '★ ' + o.nurse.rating + ' · ' : ''}${t('visits',{n:o.nurse.visits})}</div></div></div>
    ${r === 'patient' && o.nurse.phone && ['assigned','on_the_way','arrived'].includes(o.status) ? `<div class="row" style="margin-top:12px"><a class="btn soft sm grow" href="tel:${esc(o.nurse.phone)}">${ic('phone',16)} ${t('call')}</a><a class="btn soft sm grow" target="_blank" rel="noopener" href="https://wa.me/${esc(o.nurse.phone.replace(/\D/g, ''))}">${ic('wa',16)} ${t('whatsapp')}</a></div>` : ''}</div>` : '';
  const tests = `<div class="card"><h3>${t('tests')}</h3>${(o.tests || []).map(x => `<div class="vline"><div><b>${esc(LN(x,'name'))}</b><div class="xs muted">${t('tube')}: ${esc(x.tube)} · ${x.fasting_hours ? t('fasting',{h:x.fasting_hours}) : t('no_fasting')}</div></div></div>`).join('')}</div>`;
  const pat = o.patient || {};
  const details = `<div class="card"><h3>${t('details')}</h3>
    <div class="vline"><span class="muted">${t('patient')}</span><b>${esc(pat.name)}${pat.relation && pat.relation !== 'self' ? ` <span class="chip gray">${t('rel_'+pat.relation)}</span>` : ''}</b></div>
    <div class="vline"><span class="muted">${t('appointment')}</span><b>${fmtDate(o.slot_date)} · ${esc(o.slot_time)}</b></div>
    <div class="vline"><span class="muted">${t('location')}</span><b style="text-align:end">${esc(wN(o.wilayat))}${o.address ? `<div class="small muted" style="font-weight:500">${esc(o.address)}</div>` : r === 'nurse' ? `<div class="xs muted" style="font-weight:500">${t('addr_hidden')}</div>` : ''}</b></div>
    ${o.notes && o.address ? `<div class="vline"><span class="muted">${S.lang==='ar'?'ملاحظات':'Notes'}</span><span>${esc(o.notes)}</span></div>` : ''}
    ${pat.phone && r !== 'patient' ? `<div class="vline"><span class="muted">${t('phone')}</span><a class="b ltr" href="tel:${esc(pat.phone)}">${esc(pat.phone)}</a></div>` : ''}
    ${r !== 'nurse' && r !== 'courier' ? `<div class="vline"><span class="muted">${t('payment')}</span><b>${omr(o.total)} ${t('omr')} · <span class="chip ${o.paid_at ? 'teal' : 'amber'}">${o.payment_method === 'sponsored' ? t('sponsored') : o.paid_at ? t('paid') : t('pay_at_visit')}</span></b></div>` : ''}
    ${o.lab ? `<div class="vline"><span class="muted">${t('lab')}</span><b>${esc(o.lab.name)}</b></div>` : ''}
    ${o.sample_temp != null ? `<div class="vline"><span class="muted">${ic('thermo',16)} ${t('temp')}</span><b class="num">${esc(o.sample_temp)} °C</b></div>` : ''}
    ${o.reject_reason ? `<div class="banner red small" style="margin-top:10px">${ic('x',18)}<span>${esc(o.reject_reason)}</span></div>` : ''}</div>`;
  const acts = actionPanel(o);
  const head = `<div class="card"><div class="row between wrap"><div><div class="small muted">${t('request')}</div><h2 style="margin:0">${esc(o.code)}</h2></div>${stChip(o.status)}</div>
    <div class="progress" style="margin-top:14px"><i style="width:${pct}%"></i></div>
    ${o.status === 'completed' ? `<div class="row wrap" style="margin-top:14px"><a class="btn teal" href="#/app/report/${o.id}">${ic('file',18)} ${t('view_report')}</a></div>` : ''}</div>`;
  const map = o.lat && (r === 'nurse' || r === 'admin') ? `<div class="card" style="padding:0;overflow:hidden"><div class="mapbox" id="omap" style="border-radius:0;height:220px"></div>${o.address ? `<div style="padding:12px"><a class="btn soft sm" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${o.lat},${o.lng}">${ic('pin',16)} ${t('open_maps')}</a></div>` : ''}</div>` : '';
  app.innerHTML = shell(esc(o.code), `<div class="grid" id="og" style="grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:18px;align-items:start">
    <div class="stack">${head}${acts}${eta}${o.status === 'completed' && r === 'patient' ? rateBox(o) : ''}${map}${details}${tests}</div>
    <div class="stack">${nurse}<div class="card"><h3>${t('q_track')}</h3>${tl}</div></div></div>`, { back: true });
  if (innerWidth < 900) $('#og').style.gridTemplateColumns = '1fr';
  bindActions(o);
  if ($('#omap')) { const draw = () => { if (!window.L) return setTimeout(draw, 200); const m = L.map('omap', { scrollWheelZoom:false }).setView([o.lat, o.lng], o.address ? 15 : 12); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19, attribution:'© OpenStreetMap' }).addTo(m); if (o.address) L.marker([o.lat, o.lng]).addTo(m); else L.circle([o.lat, o.lng], { radius:1500, color:'#1257d6' }).addTo(m); }; draw(); }
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
  if (r === 'admin' && ['booked','recollect','assigned'].includes(s) && !u.is_demo) h = `<div class="row"><button class="btn sm" data-act="assign">${ic('syringe',16)} ${t('assign')}</button><button class="btn ghost sm" data-act="admincancel">${t('cancel_req')}</button></div>`;
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
    if (a === 'assign') { const ns = await API.adminNurses(o.wilayat); return modal(`<h3>${t('assign')}</h3><div class="stack" style="margin-top:12px">${ns.length ? ns.map(n => `<button class="btn ghost block" data-n="${n.id}">${esc(n.name)} · ${esc(wN(n.wilayat))}</button>`).join('') : `<p class="muted">${t('none_yet')}</p>`}</div>`, (el, close) => { $$('[data-n]', el).forEach(x => x.onclick = () => { close(); run(null, 'assign_nurse', { nurse_id: x.dataset.n }); }); }); }
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
  const ce = (o.events || []).find(e => e.status === 'collected');
  app.innerHTML = shell(t('report_t'), `<div class="row no-print" style="margin-bottom:14px;flex-wrap:wrap"><button class="btn" id="pr">${ic('download',18)} ${t('download_pdf')}</button>${navigator.share ? `<button class="btn ghost" id="sh">${ic('share',18)} ${t('share')}</button>` : ''}</div>
  <div class="report"><div class="rh"><div class="row">${A.logo.replace('<svg','<svg width="46" height="46"')}<div><div class="b" style="font-size:1.2rem">Lab@Home</div><div class="small" style="opacity:.8">${t('report_t')}</div></div></div>
    <div class="small" style="text-align:end"><b>${esc(o.lab ? o.lab.name : '')}</b><br>${o.lab && o.lab.license ? t('licence') + ': ' + esc(o.lab.license) : ''}</div></div>
  <div class="rb"><div class="grid g4" style="gap:12px;margin-bottom:18px">
    <div><div class="xs muted">${t('patient')}</div><b>${esc(p.name)}</b></div><div><div class="xs muted">${t('age')} / ${t('sex')}</div><b>${p.dob ? age(p.dob) : '—'} / ${p.gender ? t(p.gender) : '—'}</b></div>
    <div><div class="xs muted">${t('request')}</div><b>${esc(o.code)}</b></div><div><div class="xs muted">${t('collected_at')}</div><b>${ce ? fmtDT(ce.at) : '—'}</b></div>
    <div><div class="xs muted">${t('reported_at')}</div><b>${fmtDT(o.published_at)}</b></div><div><div class="xs muted">${t('verified_by')}</div><b>${esc(o.verified_by || '')}</b></div></div>
  <div class="banner ${flags ? 'amber' : 'teal'}" style="margin-bottom:16px">${ic(flags ? 'clock' : 'check',22)}<b>${flags ? t('some_flags',{n:flags}) : t('all_normal')}</b></div>
  <div class="scroll-x"><table class="rtable"><thead><tr><th>${t('analyte')}</th><th>${t('result')}</th><th>${t('ref_range')}</th><th class="rb-col"></th><th>${t('flag')}</th></tr></thead><tbody>${rows}</tbody></table></div>
  ${notes.length ? `<div class="card flat" style="margin-top:18px"><h4>${t('insight_t')}</h4><ul class="small" style="margin:0;padding-inline-start:18px">${notes.join('')}</ul></div>` : ''}
  <p class="xs muted" style="margin-top:18px">${t('report_disclaimer')}</p></div></div>`, { back: true });
  $('#pr').onclick = () => window.print();
  if ($('#sh')) $('#sh').onclick = () => navigator.share({ title: 'Lab@Home ' + o.code, text: t('report_t') + ' ' + o.code, url: location.href }).catch(() => {});
}

/* ---------- nurse / courier / lab homes ---------- */
async function viewNurseHome(){
  loading(t('m_home'));
  const [st, av, mine] = await Promise.all([API.stats(), API.orders('available'), API.orders('mine')]);
  const u = S.user; const act = mine.filter(o => ['assigned','on_the_way','arrived'].includes(o.status));
  app.innerHTML = shell(t('hello',{n:esc(u.full_name.split(' ')[0])}), `<div class="stack-lg">
    <div class="card row between"><div><b>${t('avail_t')}</b><div class="small muted">${u.available ? t('avail_on') : t('avail_off')}</div></div><label class="check" style="font-size:1rem"><input type="checkbox" id="av" ${u.available ? 'checked' : ''} style="width:26px;height:26px"></label></div>
    <div class="grid g4"><div class="kpi blue"><span>${t('earnings')}</span><b>${omr(st.earnings)} <small style="font-size:.8rem">${t('omr')}</small></b></div><div class="kpi"><span>${t('collected_n')}</span><b>${st.collected}</b></div><div class="kpi"><span>${t('this_month')}</span><b>${st.month}</b></div><div class="kpi"><span>${t('rating')}</span><b>${st.rating ? '★ ' + st.rating : '—'}</b></div></div>
    <div><h3>${t('my_visits')}</h3>${act.length ? `<div class="olist">${act.map(o => orderItem(o)).join('')}</div>` : emptyBox(t('none_yet'))}</div>
    <div><h3>${t('available_req')} <span class="chip">${av.length}</span></h3>${av.length ? `<div class="olist">${av.map(o => orderItem(o, `<div style="margin-top:8px"><span class="chip teal">+${omr(st.fee)} ${t('omr')}</span>${o.fasting ? ` <span class="chip amber">${t('fasting',{h:o.fasting})}</span>` : ''}</div>`)).join('')}</div>` : emptyBox(t('none_yet'))}</div></div>`);
  $('#av').onchange = async e => { try { S.user = await API.profile({ available: e.target.checked }); viewNurseHome(); } catch(err) { toast(errMsg(err), true); } };
}
async function viewCourierHome(){
  loading(t('m_home'));
  const [st, av, mine] = await Promise.all([API.stats(), API.orders('available'), API.orders('mine')]);
  const tr = mine.filter(o => o.status === 'in_transit');
  app.innerHTML = shell(t('hello',{n:esc(S.user.full_name.split(' ')[0])}), `<div class="stack-lg">
    <div class="grid g4"><div class="kpi blue"><span>${t('pickups_ready')}</span><b>${st.waiting}</b></div><div class="kpi"><span>${t('in_transit_list')}</span><b>${st.in_transit}</b></div><div class="kpi"><span>${t('delivered_n')}</span><b>${st.delivered}</b></div><div class="kpi"><span>${t('avg_temp')}</span><b>${st.avg_temp != null ? st.avg_temp + ' °C' : '—'}</b></div></div>
    <div><h3>${t('in_transit_list')}</h3>${tr.length ? `<div class="olist">${tr.map(o => orderItem(o)).join('')}</div>` : emptyBox(t('none_yet'))}</div>
    <div><h3>${t('pickups_ready')}</h3>${av.length ? `<div class="olist">${av.map(o => orderItem(o)).join('')}</div>` : emptyBox(t('none_yet'))}</div></div>`);
}
async function viewLabHome(){
  loading(t('m_home'));
  const [st, list] = await Promise.all([API.stats(), API.orders()]);
  const inc = list.filter(o => ['in_transit','at_lab'].includes(o.status)), pr = list.filter(o => o.status === 'processing'), pub = list.filter(o => o.status === 'completed');
  app.innerHTML = shell(esc(S.user.meta && S.user.meta.lab_name || S.user.full_name), `<div class="stack-lg">
    <div class="grid g4"><div class="kpi blue"><span>${t('incoming')}</span><b>${st.incoming}</b></div><div class="kpi"><span>${t('processing_list')}</span><b>${st.processing}</b></div><div class="kpi"><span>${t('published_list')}</span><b>${st.published}</b></div><div class="kpi"><span>${t('avg_tat')}</span><b>${st.avg_tat_h != null ? st.avg_tat_h + ' h' : '—'}</b></div></div>
    <div><h3>${t('incoming')}</h3>${inc.length ? `<div class="olist">${inc.map(o => orderItem(o)).join('')}</div>` : emptyBox(t('none_yet'))}</div>
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
    <div class="grid g4"><div class="kpi blue"><span>${t('orders_today')}</span><b>${ov.today}</b></div><div class="kpi"><span>${t('active_orders')}</span><b>${ov.active}</b></div><div class="kpi"><span>${t('completed_orders')}</span><b>${ov.completed}</b></div><div class="kpi"><span>${t('revenue')}</span><b>${omr(ov.revenue)}</b></div>
    <div class="kpi"><span>${t('avg_tat')}</span><b>${ov.avg_tat_h != null ? ov.avg_tat_h + ' h' : '—'}</b></div><div class="kpi"><span>${t('rating')}</span><b>${ov.rating ? '★ ' + ov.rating : '—'}</b></div><div class="kpi"><span>${t('pending_verif')}</span><b>${ov.pending}</b></div><div class="kpi"><span>${t('waitlist_n')}</span><b>${ov.waitlist}</b></div></div>
    <div class="grid g2 collapse"><div class="card"><h3>${t('last14')}</h3><div class="bars" style="margin:18px 0 22px">${days.map(([d, n]) => `<div style="height:${n / mx * 100}%" title="${d}: ${n}"><span>${d.slice(8)}</span></div>`).join('')}</div></div>
      <div class="card"><h3>${t('by_status')}</h3>${Object.entries(bs).map(([s, n]) => `<div class="hbar"><span style="width:130px" class="small">${t('st_'+s)}</span><i style="width:${n / bsMax * 60}%"></i><b>${n}</b></div>`).join('') || `<p class="muted">${t('none_yet')}</p>`}</div></div>
    <div class="grid g2 collapse"><div class="card"><h3>${t('top_tests')}</h3>${(ov.top_tests || []).map(x => `<div class="vline"><span>${esc(LN(S.catalog.T[x.id],'name'))}</span><b>${x.n}</b></div>`).join('') || `<p class="muted">${t('none_yet')}</p>`}</div>
      <div class="card"><h3>${t('by_wilayat')}</h3>${Object.entries(ov.by_wilayat || {}).map(([w, n]) => `<div class="vline"><span>${esc(wN(w))}</span><b>${n}</b></div>`).join('') || `<p class="muted">${t('none_yet')}</p>`}</div></div>
    <div class="card"><h3>${t('pending_verif')} <span class="chip amber">${pend.length}</span></h3>${pend.length ? userTable(pend) : `<p class="muted">${t('none_yet')}</p>`}</div></div>`);
  bindUserActions();
}
function userTable(list){
  return `<div class="scroll-x"><table class="table"><thead><tr><th>${t('full_name')}</th><th>${t('role')}</th><th>${t('wilayat')}</th><th>${t('details')}</th><th>${t('status')}</th><th></th></tr></thead><tbody>
    ${list.map(u => `<tr><td><b>${esc(u.full_name)}</b><div class="xs muted ltr">${esc(u.email || '')} ${esc(u.phone || '')}</div></td><td>${t('r_'+u.role)}</td><td>${esc(wN(u.wilayat || ''))}</td>
      <td class="xs muted">${esc([u.meta.license, u.meta.lab_name, u.meta.company_name, u.meta.cr, u.meta.vehicle].filter(Boolean).join(' · '))}</td><td>${u.status === 'active' ? `<span class="chip teal">${t('active')}</span>` : `<span class="chip ${u.status === 'pending' ? 'amber' : 'red'}">${esc(u.status)}</span>`}</td>
      <td style="white-space:nowrap">${u.role === 'admin' ? '' : u.status !== 'active' ? `<button class="btn sm teal" data-us="${u.id}:active">${t('approve')}</button> ` : ''}${u.role !== 'admin' && u.status === 'pending' ? `<button class="btn sm ghost" data-us="${u.id}:rejected">${t('reject')}</button>` : u.role !== 'admin' && u.status === 'active' && u.role !== 'patient' ? `<button class="btn sm ghost" data-us="${u.id}:suspended">${t('suspend')}</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`;
}
function bindUserActions(){ $$('[data-us]').forEach(b => b.onclick = async () => { const [id, s] = b.dataset.us.split(':'); try { await busy(b, () => API.adminSetStatus(id, s)); toast(t('saved')); render(); } catch(e) {} }); }
async function viewAdminUsers(){
  loading(t('m_users'));
  const role = new URLSearchParams(location.hash.split('?')[1] || '').get('role') || '';
  const list = await API.adminUsers(role || null, null);
  app.innerHTML = shell(t('m_users'), `<div class="cats" style="margin-bottom:12px">${['','patient','nurse','courier','lab','company','admin'].map(r => `<button class="${r === role ? 'on' : ''}" data-r="${r}">${r ? t('r_'+r) : t('cat_all')}</button>`).join('')}</div><div class="card">${userTable(list)}</div>`);
  $$('[data-r]').forEach(b => b.onclick = () => go('app/admin/users' + (b.dataset.r ? '?role=' + b.dataset.r : '')));
  bindUserActions();
}
async function viewAdminOrders(){
  const list = await API.orders();
  app.innerHTML = shell(t('m_all_orders'), `<div class="card"><div class="scroll-x"><table class="table"><thead><tr><th>${t('request')}</th><th>${t('patient')}</th><th>${t('appointment')}</th><th>${t('wilayat')}</th><th>${t('total')}</th><th>${t('status')}</th></tr></thead><tbody>
    ${list.map(o => `<tr style="cursor:pointer" data-o="${o.id}"><td><b>${esc(o.code)}</b></td><td>${esc(o.person || '')}</td><td class="small">${fmtDate(o.slot_date)} · ${esc(o.slot_time)}</td><td>${esc(wN(o.wilayat))}</td><td class="num">${omr(o.total)}</td><td>${stChip(o.status)}</td></tr>`).join('')}</tbody></table></div></div>`);
  $$('[data-o]').forEach(r => r.onclick = () => go('app/order/' + r.dataset.o));
}
async function viewAdminCatalog(){
  S.catalog = null; await loadCatalog();
  app.innerHTML = shell(t('m_catalog'), `<div class="card"><div class="scroll-x"><table class="table"><thead><tr><th>${t('analyte')}</th><th>${t('tube')}</th><th>${t('price')} (${t('omr')})</th><th></th></tr></thead><tbody>
    ${S.catalog.tests.map(x => `<tr><td><b>${esc(LN(x,'name'))}</b><div class="xs muted">${x.analytes.length} · ${x.fasting_hours ? t('fasting',{h:x.fasting_hours}) : t('no_fasting')}</div></td><td class="small">${esc(x.tube)}</td><td><input class="input num" style="width:110px;min-height:38px;padding:6px 10px" value="${omr(x.price)}" data-price="${x.id}"></td><td><button class="btn sm soft" data-sv="${x.id}">${t('save_changes')}</button></td></tr>`).join('')}</tbody></table></div></div>`);
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
      <label class="field"><span>${t('wilayat')}</span><select class="input" name="wilayat">${W.map(w => `<option value="${esc(w)}" ${u.wilayat === w ? 'selected' : ''}>${esc(wN(w))}</option>`).join('')}</select></label>
      ${u.role === 'patient' ? `<label class="field"><span>${t('address')}</span><input class="input" name="address" value="${esc(u.address || '')}"></label>
      <h4 style="margin-top:8px">${t('medical')}</h4><div class="grid g3"><label class="field"><span>${t('blood')}</span><select class="input" name="blood">${['','A+','A-','B+','B-','AB+','AB-','O+','O-'].map(b => `<option ${m.blood === b ? 'selected' : ''}>${b}</option>`).join('')}</select></label>
      <label class="field"><span>${t('gender')}</span><select class="input" name="gender"><option value="male">${t('male')}</option><option value="female" ${m.gender === 'female' ? 'selected' : ''}>${t('female')}</option></select></label><label class="field"><span>${t('dob')}</span><input class="input" type="date" name="dob" value="${esc(m.dob || '')}"></label></div>
      <label class="field"><span>${t('allergies')}</span><input class="input" name="allergies" value="${esc(m.allergies || '')}"></label><label class="field"><span>${t('chronic')}</span><input class="input" name="chronic" value="${esc(m.chronic || '')}"></label>` : ''}
      <button class="btn">${t('save_changes')}</button></form></div>
    <div class="stack"><form class="card stack" id="pw"><h3>${t('change_pw')}</h3>${pwField('old', t('old_pw'))}${pwField('new1', t('new_pw'), t('pass_rule'))}<button class="btn ghost">${t('change_pw')}</button></form>
      <div class="card"><h3>${t('install_t')}</h3><p class="muted small">${t('install_p')}</p>${S.installEvt ? `<button class="btn" id="inst">${ic('download',18)} ${t('install_btn')}</button>` : `<p class="small">${t('install_ios')}</p>`}</div>
      <div class="card row between"><span class="b">${S.lang === 'ar' ? 'اللغة' : 'Language'}</span><button class="lang" data-lang>${t('lang')}</button></div>
      <button class="btn ghost block" data-logout>${ic('logout',18)} ${t('logout')}</button></div></div>`);
  bindPw(app);
  $('#pf').onsubmit = async e => { e.preventDefault(); const f = e.target; const meta = {}; ['blood','gender','dob','allergies','chronic'].forEach(k => { if (f[k]) meta[k] = f[k].value; });
    const ll = WILAYAT_LL[f.wilayat.value] || [];
    try { S.user = await busy($('button', f), () => API.profile({ full_name: f.full_name.value, phone: f.phone.value, wilayat: f.wilayat.value, address: f.address ? f.address.value : undefined, lat: u.lat || ll[0], lng: u.lng || ll[1], meta })); toast(t('saved')); } catch(err) {} };
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

/* ---------- router ---------- */
function bindGo(){ $$('[data-go]').forEach(b => b.onclick = () => { const g = b.dataset.go; if (g === 'register' && !S.user) sessionStorage.setItem('lah_after', 'app/book'); go(g); }); }
function bindGlobal(){
  $$('[data-lang]').forEach(b => b.onclick = () => { setLang(S.lang === 'ar' ? 'en' : 'ar'); render(); });
  $$('[data-logout]').forEach(b => b.onclick = async () => { await API.logout(); API.setToken(null); S.user = null; S.bk = null; go(''); });
  $$('[data-goback]').forEach(b => b.onclick = () => history.length > 1 ? history.back() : go('app'));
  bindGo();
}
async function render(){
  clearTimers();
  const h = (location.hash.slice(2) || '').split('#')[0];
  const [path] = h.split('?'); const seg = path.split('/');
  try {
    if (seg[0] !== 'app') {
      if (seg[0] === 'login') { if (S.user) return go('app'); viewLogin(); }
      else if (seg[0] === 'register') { if (S.user) return go('app'); await loadCatalog().catch(() => {}); viewRegister(seg[1]); }
      else if (seg[0] === 'tests') await viewTestsPublic();
      else await viewLanding();
    } else {
      if (!S.user) { sessionStorage.setItem('lah_after', path); return go('login'); }
      const r = S.user.role; const sub = seg[1] || '';
      if (sub === '') await ({ patient: viewPatientHome, nurse: viewNurseHome, courier: viewCourierHome, lab: viewLabHome, company: viewCompanyHome, admin: viewAdminHome }[r])();
      else if (sub === 'tests') await viewAppTests();
      else if (sub === 'book') await viewBook();
      else if (sub === 'orders') await viewOrders();
      else if (sub === 'order') await viewOrder(seg[2]);
      else if (sub === 'report') await viewReport(seg[2]);
      else if (sub === 'profile') await viewProfile();
      else if (sub === 'notifs') await viewNotifs();
      else if (sub === 'programs') await viewCompanyHome();
      else if (sub === 'admin' && r === 'admin') await ({ users: viewAdminUsers, catalog: viewAdminCatalog }[seg[2]] || viewAdminHome)();
      else go('app');
    }
  } catch(e) {
    console.error(e);
    if (e && e.code === 'AUTH_REQUIRED') { S.user = null; return go('login'); }
    app.innerHTML = (S.user ? shell('', '') : topbar()) ;
    const c = $('.content') || app; c.insertAdjacentHTML('beforeend', `<div class="card empty" style="margin:20px">${A.emptyArt}<p>${errMsg(e)}</p><button class="btn" onclick="location.reload()">${t('retry')}</button></div>`);
  }
  bindGlobal();
  if (!location.hash.includes('#', 1)) window.scrollTo(0, 0);
}
async function poll(){ if (!S.user || document.hidden) return; try { const r = await API.me(); const before = S.unread; S.user = r.user; S.unread = r.unread; if (r.unread !== before) { $$('.icon-btn .dot').forEach(d => d.textContent = r.unread); if (r.unread > before) { const b = $('[data-go="app/notifs"]'); if (b && !$('.dot', b)) b.insertAdjacentHTML('beforeend', `<span class="dot">${r.unread}</span>`); } } } catch(e) { if (e.code === 'AUTH_REQUIRED') { S.user = null; go('login'); } } }

async function boot(){
  setLang(S.lang);
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.installEvt = e; });
  if (API.hasToken()) { try { const r = await API.me(); S.user = r.user; S.unread = r.unread; } catch(e) { API.setToken(null); } }
  window.addEventListener('hashchange', render);
  render();
  setInterval(poll, 20000);
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
}
boot();
})();
