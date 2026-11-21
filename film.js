// Lab@Home explainer – time-driven film. setT(t) draws frame t (seconds).
import * as H from './js/hero3d.js';
const A = window.ART, ic = (n, s = 30, w = 2) => A.icon(n, s, w);
const CUES = await (await fetch('cues.json')).json();
const WK = (await (await fetch('warp.json')).json()).knots;
const warp = tn => { for (let i = 1; i < WK.length; i++) { const [n0, o0] = WK[i - 1], [n1, o1] = WK[i]; if (tn <= n1 || i === WK.length - 1) return n1 === n0 ? o1 : o0 + (Math.min(tn, n1) - n0) / (n1 - n0) * (o1 - o0); } return tn; };
const ui = document.getElementById('ui'); const bgui = document.getElementById('bgui'); const gl = document.getElementById('gl');
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v)); const seg = (t, a, b) => clamp((t - a) / (b - a));
const eo = x => 1 - Math.pow(1 - x, 3); const eio = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; const back = x => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const op = (t, a, b, fi = .35, fo = .35) => seg(t, a, a + fi) * (1 - seg(t, b - fo, b));
const el = (html, cls, id) => { const d = document.createElement('div'); if (cls) d.className = cls; if (id) d.id = id; d.innerHTML = html; ui.appendChild(d); return d; };
const st = (e, o) => { for (const k in o) e.style[k] = o[k]; };
const WM = '<span class="wm">Lab<i>@</i>Home</span>';
const logo = A.logo;

/* 3D shots: [from, to, scene, ox, oy, tOffset] */
const SHOTS = [[0, 5.05, 0, .2, 0], [9.1, 12.0, 1, .2, 0, 0], [25.0, 27.55, 0, .2, 0, 30], [30.6, 33.75, 1, .2, 0, 12], [38.8, 41.6, 2, .2, 0, 0], [53.2, 61.5, 0, 0, -.08, 60]];
/* text blocks */
const C = (icon, label, col, bg, at) => ({ icon, label, col, bg, at });
const TX = [
  { a: 0.3, b: 5.05, dark: true, eb: 'Lab@Home · Oman', h: 'Lab tests at<br>your doorstep', p: 'Home sample collection across North Al Sharqiyah.', chips: [] },
  { a: 5.05, b: 9.1, eb: 'Step 1 · Sign up', h: 'Join in a minute', chips: [C('phone', 'Phone number', '#1257d6', '#eaf2ff', 6.1), C('mail', 'Email', '#7a5af8', '#efeaff', 7.0), C('user', 'Google account', '#0fae9b', '#e3f7f4', 8.2)] },
  { a: 9.1, b: 15.45, eb: 'Step 2 · Choose', h: 'Single tests &<br>family packages', chips: [C('kid', 'Kids', '#f2a516', '#fff4dc', 10.7), C('users', 'Adults', '#1257d6', '#eaf2ff', 12.3), C('heart', 'Seniors 60+', '#e8466f', '#fdeaf0', 13.9)] },
  { a: 15.45, b: 22.3, eb: 'Step 3 · Book', h: 'Book in three taps', chips: [C('clock', 'Pick a time', '#1257d6', '#eaf2ff', 15.8), C('pin', 'Drop a pin', '#e2474f', '#fdecec', 17.4), C('card', 'Pay securely', '#0fae9b', '#e3f7f4', 19.3)] },
  { a: 22.3, b: 27.55, eb: 'Step 4 · Nurse', h: 'A licensed nurse<br>is on the way', chips: [C('bell', 'Notified instantly', '#f2a516', '#fff4dc', 22.7), C('check', 'Request accepted', '#0fae9b', '#e3f7f4', 25.0), C('truck', 'Heading to you', '#1257d6', '#eaf2ff', 26.3)], darkFrom: 25.0 },
  { a: 27.55, b: 33.75, eb: 'Step 5 · Collect', h: 'Safe sample<br>collection', chips: [C('idcard', 'ID checked', '#1257d6', '#eaf2ff', 27.9), C('syringe', 'Sample collected', '#0fae9b', '#e3f7f4', 28.9), C('thermo', '2–8 °C cold box', '#2563eb', '#e0ecff', 30.8)] },
  { a: 33.75, b: 38.8, eb: 'Step 6 · Track', h: 'Follow every step,<br>live', chips: [C('van', 'Courier', '#f2a516', '#fff4dc', 34.2), C('flask', 'Partner laboratory', '#7a5af8', '#efeaff', 35.6), C('route', 'Live timeline', '#0fae9b', '#e3f7f4', 37.2)] },
  { a: 38.8, b: 48.05, eb: 'Step 7 · Results', h: 'Clear results,<br>with next steps', chips: [C('drop', 'Diet tips', '#13804a', '#eef9f1', 44.6), C('steth', 'Doctor’s advice', '#0d7c6c', '#dff5ef', 45.7), C('hosp', 'Nearest hospital', '#e2474f', '#fdecec', 47.0)], levels: true },
  { a: 48.05, b: 53.2, eb: 'Step 8 · Share', h: 'Your report,<br>your way', chips: [C('download', 'Download PDF', '#1257d6', '#eaf2ff', 48.9), C('share', 'Share with your doctor', '#7a5af8', '#efeaff', 49.7), C('plus', 'Book again in one tap', '#0fae9b', '#e3f7f4', 51.2)] },
];
TX.forEach(x => { x.el = el(`<span class="eb">${x.eb}</span><h1>${x.h}</h1>${x.p ? `<p>${x.p}</p>` : ''}${x.levels ? `<div class="lv"><span style="background:#e3f7f4;color:#0b8a7a">✓ Normal</span><span style="background:#fff4dc;color:#a86a00">! Needs review</span><span style="background:#fdecec;color:#c42b33">● Urgent</span></div>` : ''}<div class="chips">${x.chips.map(c => `<div class="chip"><span class="ci" style="color:${c.col};background:${c.bg}">${ic(c.icon, 30, 2.2)}</span>${c.label}</div>`).join('')}</div>`, 'tx' + (x.dark ? ' dark' : '')); });
const LVT = [41.76, 42.62, 43.73];
/* phone and screens: [src, a, b, scroll keyframes [t, y]] */
const SCR = [
  ['01_register', 5.05, 9.1, [[5.6, 0], [8.6, 120]]], ['02_packages', 12.0, 15.45, [[12.3, 0], [15.2, 260]]],
  ['04_book4b', 15.45, 18.9, [[15.6, 0]]], ['05_pay', 18.9, 22.3, [[19.0, 0], [21.6, 90]]],
  ['07_nurse_home', 22.3, 25.0, [[22.3, 0]]], ['09_checklist', 27.55, 30.6, [[27.6, 0]]],
  ['10_tracking', 33.75, 38.8, [[34.3, 0], [35.6, 1470]]], ['11_urgent', 41.6, 48.05, [[41.7, 300], [43.9, 300], [44.6, 860], [46.6, 860], [47.3, 1690]]],
  ['13_report', 48.05, 53.2, [[48.2, 0], [50.4, 0], [52.6, 560]]],
];
const phone = el(`<div class="scr">${SCR.map(s => `<img src="shots/${s[0]}.png" data-s="${s[0]}">`).join('')}</div><div class="notch"></div>`, '', 'phone');
const imgs = [...phone.querySelectorAll('img')];
const notif = el(`<span class="ni">${logo}</span><div><b>New request near you</b><span>LAH-10250 · Ibra · 07:00</span></div>`, '', 'notif');
const mapc = el(`<div class="road" style="top:70px;transform:rotate(-8deg)"></div><div class="road" style="top:150px;transform:rotate(14deg)"></div><div class="road" style="left:150px;width:22px;top:-20px;bottom:-20px;right:auto;height:auto"></div><svg class="pin" viewBox="0 0 44 58"><path d="M22 2C11 2 3 10.5 3 21c0 14 19 34 19 34s19-20 19-34C41 10.5 33 2 22 2z" fill="#e2474f"/><circle cx="22" cy="21" r="7" fill="#fff"/></svg>`, '', 'map');
const cold = el(`<span class="ci" style="background:#e0ecff;color:#2563eb">${ic('thermo', 30, 2.2)}</span>4.2 °C · cold box`, 'badge', 'cold');
const pdfb = el(`<span class="ci" style="background:#fdecec;color:#e2474f">${ic('file', 30, 2.2)}</span>LabAtHome-LAH-10255.pdf`, 'badge', 'pdfb');
const scrim = el('', '', 'scrim'); ui.prepend(scrim); const bug = el(`${logo}${WM}`, '', 'bug');
const endbg = el('', '', 'endbg');
const end = el(`<div class="el">${logo}</div><div class="ew wm">Lab<i>@</i>Home</div><div class="words"><span>Book.</span><span>Test.</span><span>Get results.</span></div><div class="url">labathome-oman.vercel.app</div>`, '', 'end');
const vig = el('', '', 'vig');
const subs = el('<div class="ar"></div>', '', 'subs'); const subAr = subs.querySelector('.ar');

await H.filmSetup(gl, 1920, 1080);
for (const i of [0, 1, 2]) H.filmRender(i, 0.01);

window.setT = tn => { const t = warp(tn);
  /* 3D */
  const sh = SHOTS.find(s => t >= s[0] - .4 && t < s[1] + .4);
  if (sh) { H.filmRender(sh[2], t - sh[0] + (sh[5] || 0), sh[3], sh[4]); gl.style.opacity = op(t, sh[0] - .4, sh[1] + .4, .4, .4) * (t < .4 ? 1 : 1); if (sh[0] === 0) gl.style.opacity = 1 - seg(t, sh[1] - .0, sh[1] + .4); }
  else gl.style.opacity = 0;
  gl.style.filter = t > 53.2 ? `blur(${(seg(t, 53.2, 54.2) * 6).toFixed(1)}px)` : 'none';
  /* text */
  TX.forEach(x => { const o = op(t, x.a, x.b, .45, .35); st(x.el, { opacity: o, transform: `translateY(${(1 - eo(seg(t, x.a, x.a + .7))) * 40}px)` });
    const dark = x.dark || (x.darkFrom && t >= x.darkFrom && t < x.b); x.el.classList.toggle('dark', !!dark);
    if (x.dark && sh && sh[2] === 2) x.el.classList.remove('dark');
    x.el.querySelectorAll('.chip').forEach((c, i) => { const k = seg(t, x.chips[i].at, x.chips[i].at + .5); st(c, { opacity: k, transform: `translateX(${(1 - back(k)) * -60}px) scale(${.9 + .1 * k})` }); });
    if (x.levels) x.el.querySelectorAll('.lv span').forEach((s, i) => { const k = seg(t, LVT[i], LVT[i] + .4); st(s, { opacity: k, transform: `scale(${.6 + .4 * back(k)})` }); }); });
  /* phone */
  const PR = [[5.05, 9.1], [12.0, 25.0], [27.55, 30.6], [33.75, 38.8], [41.6, 53.2]];
  let pk2 = 0; PR.forEach(([a, b]) => { pk2 = Math.max(pk2, eo(seg(t, a, a + .6)) * (1 - eio(seg(t, b - .45, b)))); });
  st(phone, { opacity: pk2 > 0.001 ? 1 : 0, transform: `translateX(${(1 - pk2) * 760}px) rotate(${(1 - pk2) * 6}deg)` });
  imgs.forEach((im, i) => { const s = SCR[i]; const o = op(t, s[1], s[2], .3, .3); let y = 0; const k = s[3]; for (let j = 0; j < k.length; j++) { if (t >= k[j][0]) y = k[j][1]; if (j + 1 < k.length && t >= k[j][0] && t < k[j + 1][0]) { y = k[j][1] + (k[j + 1][1] - k[j][1]) * eio(seg(t, k[j][0], k[j + 1][0])); break; } }
    st(im, { opacity: o, transform: `translateY(${-y}px)` }); });
  /* extras */
  const nk = op(t, 22.6, 25.0, .4, .3); st(notif, { opacity: nk, transform: `translateY(${(1 - back(seg(t, 22.6, 23.1))) * -80}px)` });
  const mk = op(t, 17.3, 19.0, .4, .3); st(mapc, { opacity: mk, transform: `scale(${.8 + .2 * back(seg(t, 17.3, 17.8))})` }); mapc.querySelector('.pin').style.transform = `translateY(${(1 - back(seg(t, 17.5, 18.0))) * -120}px)`;
  const ck = op(t, 30.8, 33.75, .4, .35); st(cold, { left: '1180px', top: '760px', opacity: ck, transform: `scale(${.7 + .3 * back(seg(t, 30.8, 31.3))})` });
  const pk = op(t, 48.9, 53.2, .4, .35); st(pdfb, { left: '1050px', top: '700px', opacity: pk, transform: `translateY(${(1 - back(seg(t, 48.9, 49.4))) * 60}px)` });
  const dark3d = sh && (sh[2] === 0) && t < 53.2; bug.classList.toggle('dark', !!dark3d); st(bug, { opacity: t < 53.2 ? seg(t, 1.0, 1.6) : 1 - seg(t, 53.2, 53.6) });
  st(scrim, { opacity: Math.max(1 - seg(t, 4.9, 5.3), op(t, 25.0, 27.55, .4, .4)) });
  st(endbg, { opacity: seg(t, 53.2, 54.0) });
  st(end, { opacity: seg(t, 53.3, 53.9), transform: `scale(${.92 + .08 * eo(seg(t, 53.3, 54.3))})` });
  [54.41, 55.09, 56.16].forEach((a, i) => { const k = seg(t, a, a + .35); st(end.querySelectorAll('.words span')[i], { opacity: k, transform: `translateY(${(1 - back(k)) * 30}px)` }); });
  st(end.querySelector('.url'), { opacity: seg(t, 57.0, 57.6) });
  bgui.style.opacity = 1;
  /* subtitles */
  const c = CUES.find(c => t >= c[0] - .05 && t < c[1] + .15);
  if (c) { if (subAr.textContent !== c[3]) subAr.textContent = c[3]; st(subs, { opacity: Math.min(seg(t, c[0] - .05, c[0] + .15), 1 - seg(t, c[1] + .05, c[1] + .15)) }); } else st(subs, { opacity: 0 });
  return true;
};
window.ready = true;
