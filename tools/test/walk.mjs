// Phone walk-through: every screen of every role, English and Arabic. Reports overflow, small fields, errors, tiny tap targets.
import { launch, phone } from './harness.mjs'; import fs from 'fs';
const R = {
  public: ['install', 'contact', '', 'start', 'login', 'register', 'register/patient', 'register/nurse', 'tests', 'about', 'support'],
  patient: ['install', 'contact', 'app', 'app/tests', 'app/cart', 'app/book', 'app/orders', 'app/order/o1', 'app/order/o2', 'app/order/o3', 'app/report/o1', 'app/profile', 'app/notifs', 'support'],
  nurse: ['app', 'app/orders', 'app/order/o2', 'app/notifs', 'app/profile'],
  courier: ['app', 'app/orders', 'app/order/o2', 'app/profile'],
  lab: ['app', 'app/orders', 'app/order/o2', 'app/profile'],
  company: ['app', 'app/profile'],
  leader: ['app', 'app/orders', 'app/order/o1', 'app/admin/users', 'app/admin/tickets', 'app/admin/payments', 'app/admin/contracts', 'app/admin/catalog', 'app/admin/settings', 'app/profile', 'app/notifs'],
  staff: ['app', 'app/admin/tickets', 'app/orders', 'app/admin/users', 'app/admin/contracts', 'app/admin/settings', 'app/profile'],
};
const only = process.argv[2]; const langs = (process.argv[3] || 'en,ar').split(',');
const b = await launch(); const issues = []; fs.mkdirSync('walk', { recursive: true });
for (const [role, routes] of Object.entries(R)) { if (only && only !== role) continue;
  for (const lang of langs) { const errors = []; const p = await phone(b, { token: role === 'public' ? null : 'tok-' + role, lang, errors, w: +(process.env.W || 390), h: process.env.W ? 860 : 844 });
    for (const r of routes) { errors.length = 0;
      await p.goto('http://site.local/index.html#/' + r); await p.waitForTimeout(r.includes('book') || r === '' ? 1600 : 900);
      const m = await p.evaluate(() => { const W = innerWidth; const out = [];
        const sw = document.scrollingElement.scrollWidth; if (sw > W + 1) out.push('page scrolls sideways: ' + sw + 'px');
        for (const el of document.querySelectorAll('body *')) { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || el.closest('.scroll-x,.leaflet-container,.track,#bot,.hscroll,.chips,.filters') || (el.parentElement && ['auto','scroll'].includes(getComputedStyle(el.parentElement).overflowX))) continue; const r = el.getBoundingClientRect(); if (r.width && (r.right > W + 1 || r.left < -1) && cs.position !== 'fixed' && !el.closest('[style*="overflow"]')) { out.push('wide: ' + el.tagName.toLowerCase() + '.' + [...el.classList].join('.') + ' ' + Math.round(r.left) + '→' + Math.round(r.right)); if (out.length > 6) break; } }
        for (const f of document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=hidden]),select,textarea')) { const fs = parseFloat(getComputedStyle(f).fontSize); if (fs < 16 && f.offsetParent) out.push('small field ' + (f.name || f.id || f.placeholder) + ' ' + fs + 'px'); }
        const tiny = [...document.querySelectorAll('button,a[href],[data-go]')].filter(e => { const r = e.getBoundingClientRect(); return e.offsetParent && r.width && r.height && (r.height < 30 || r.width < 30) && !e.closest('.leaflet-container,p,li,.small,small,footer,.xs'); }).map(e => (e.textContent.trim() || e.getAttribute('aria-label') || e.className).slice(0, 30));
        if (tiny.length) out.push('small tap targets: ' + [...new Set(tiny)].slice(0, 6).join(' | '));
        /* every visible button/link must receive a tap at its centre */
        const blocked = []; for (const e of document.querySelectorAll('button,a[href],[data-go],input[type=checkbox],label.check')) { if (!e.offsetParent || getComputedStyle(e).visibility === 'hidden' || e.closest('.leaflet-container,#bot,.modal-root')) continue; const r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4 || r.left < 0 || r.right > innerWidth || (e.parentElement && ['auto','scroll'].includes(getComputedStyle(e.parentElement).overflowX) && (r.right > e.parentElement.getBoundingClientRect().right + 1 || r.left < e.parentElement.getBoundingClientRect().left - 1)) || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue; const cx = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1), cy = Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 1); const top = document.elementFromPoint(cx, cy); if (top && top !== e && !e.contains(top) && !top.closest('.tabbar,.app-top,.topbar,#bot,.cart-bar,#toast') && !(e.closest('.tabbar,.app-top,.topbar'))) blocked.push((e.textContent.trim() || e.getAttribute('aria-label') || e.className).slice(0, 25) + ' ← ' + top.tagName.toLowerCase() + '.' + [...top.classList].join('.')); }
        if (blocked.length) out.push('NOT TAPPABLE: ' + blocked.slice(0, 6).join(' | '));
        const txt = document.body.innerText; if (/undefined|NaN|\[object|null\b/.test(txt)) out.push('suspicious text: ' + (txt.match(/.{0,30}(undefined|NaN|\[object|null\b).{0,20}/) || [''])[0]);
        const miss = txt.match(/\b[a-z]+_[a-z_0-9]+\b/g); if (miss) out.push('raw i18n keys?: ' + [...new Set(miss)].slice(0, 6).join(', '));
        return out; });
      const name = `${role}_${lang}_${(r || 'home').replace(/\//g, '-')}`;
      await p.screenshot({ path: `walk/${name}.jpg`, type: 'jpeg', quality: 70 });
      const all = [...m, ...errors]; if (all.length) issues.push(`## ${name}\n  ` + all.join('\n  '));
    }
    await p.context().close(); } }
await b.close(); fs.writeFileSync('walk/issues.txt', issues.join('\n')); console.log(issues.join('\n') || 'NO ISSUES');
