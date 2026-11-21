import { build, update, project, SHOTS, W, seg, eo, eio, clamp } from './cast.js';
const VO = 1.2; // voice-over offset
const S = (a, b, ar) => ({ a: a + VO, b: b + VO, ar });
const SUBS = [
  S(0.30, 4.57, 'برنامج واحد، إحدى عشر شخص، ورحلة وحدة. هذا آي لاب@هوم.'),
  S(5.12, 10.03, 'سالم مشغول بدوامه؟ يحجز فحصه من جواله، والممرضة توصل لبيته.'),
  S(10.67, 14.17, 'مريم تختار باقة الأطفال، مع ممرضة تزورهم في البيت.'),
  S(14.58, 16.59, 'ويوسف؟ ولا خايف أبداً!'),
  S(17.23, 21.54, 'الجد حمد ما يحتاج يسافر من القرية؛ ضغطه وسكره يتقاسون في بيته.'),
  S(22.30, 28.41, 'نور وخالد يقبلون الطلب، يتأكدون من الهوية، ويسحبون العينة بأمان.'),
  S(28.91, 35.01, 'المندوب سعيد يوصّل العينات للمختبر في صندوق مبرّد على ٤٫٢ درجة.'),
  S(35.65, 40.69, 'الدكتورة عائشة تراجع النتيجة العاجلة وترسل النصيحة فوراً.'),
  S(41.32, 48.23, 'إيما وديفيد وبريا: التطبيق بالإنجليزي، الدفع بالبطاقة، والنتائج على جوالاتهم.'),
  S(48.96, 52.12, 'كل خطوة مباشرة وتقدر تتابعها، من الحجز لين النتيجة.'),
  S(52.71, 53.87, 'آي لاب@هوم.'),
  S(54.55, 56.34, 'صحتك، عند باب بيتك.')
];
const NAMES = {
  salim: ['Salim', 'سالم', 'Busy professional', '#2563EB'], maryam: ['Maryam', 'مريم', 'Mother', '#DB2777'], yousef: ['Yousef', 'يوسف', 'Age 7', '#F59E0B'],
  hamad: ['Grandpa Hamad', 'الجد حمد', 'Mountain village', '#B45309'], nour: ['Nurse Nour', 'الممرضة نور', 'Female nurse', '#14B8A6'], khalid: ['Nurse Khalid', 'الممرض خالد', 'Male nurse', '#0EA5E9'],
  saeed: ['Courier Saeed', 'المندوب سعيد', 'Cold-chain courier', '#F97316'], aisha: ['Dr. Aisha', 'الدكتورة عائشة', 'Reviewing doctor', '#0F766E'],
  emma: ['Emma', 'إيما', 'Expat', '#6366F1'], david: ['David', 'ديفيد', 'Expat', '#16A34A'], priya: ['Priya', 'بريا', 'Expat', '#E11D48']
};
const CHIP = { office: ['01', 'Book in seconds', 'احجز بثواني'], home: ['02', 'Kids & family', 'الأطفال والعائلة'], village: ['03', 'Seniors at home', 'كبار السن في البيت'], nurses: ['04', 'Verified home visit', 'زيارة موثّقة'], courier: ['05', 'Cold chain 2–8 °C', 'سلسلة تبريد'], clinic: ['06', 'Doctor review', 'مراجعة الطبيب'], flat: ['07', 'English & card pay', 'إنجليزي ودفع بالبطاقة'] };
const ui = document.getElementById('ui'); const el = (h) => { const d = document.createElement('div'); d.innerHTML = h.trim(); const n = d.firstChild; ui.appendChild(n); return n; };
const WM = '<span class="wm">i<b>Lab</b><i>@</i><b>home</b></span>';
const bug = el(`<div id="bug">${WM}</div>`);
const title = el(`<div id="title"><div class="big">${WM}</div><div class="tag">Home lab tests across Oman</div><div class="tagar">فحوصات مخبرية في بيتك، في كل عُمان</div></div>`);
const sub = el(`<div id="sub"><span></span></div>`); const subSpan = sub.firstChild;
const chip = el(`<div id="chip"><b></b><span class="en"></span><span class="ar"></span></div>`);
const tags = {}; for (const k in NAMES) { const [en, ar, role, c] = NAMES[k]; tags[k] = el(`<div class="tagc" style="--c:${c}"><div class="n">${en}<span>${ar}</span></div><div class="r">${role}</div></div>`); }
const live = el(`<div id="live"><i></i>Live tracking · LAH-10250<div class="steps"><span>Booked</span><span>Nurse on the way</span><span>Sample</span><span>Lab</span><span>Result</span></div></div>`);
const end = el(`<div id="end"><div class="big">${WM}</div><div class="tl">Your health, at your doorstep.</div><div class="tlar">صحتك، عند باب بيتك</div><div class="row"><span class="pill">labathome-oman.vercel.app</span><span class="pill ig"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.3" cy="6.7" r="1.3" fill="currentColor"/></svg>@ilabathome</span></div></div>`);
const scrim = el(`<div id="scrim"></div>`); end.before(scrim); const fade = el(`<div id="fade"></div>`);
const show = (n, o, tr) => { n.style.opacity = o; if (tr != null) n.style.transform = tr; };
let curSub = -1;
window.setT = (t) => {
  update(t); const sh = W.shot;
  // subtitles
  const i = sh.end ? -1 : SUBS.findIndex(s => t >= s.a - .05 && t < s.b + .35); if (i !== curSub) { curSub = i; if (i >= 0) subSpan.textContent = SUBS[i].ar; }
  if (i >= 0) { const s = SUBS[i]; const k = Math.min(seg(t, s.a - .05, s.a + .2), 1 - seg(t, s.b + .15, s.b + .35)); show(sub, k, `translate(-50%, ${(1 - eo(k)) * 14}px)`); } else show(sub, 0);
  // title
  const tk = Math.min(eo(seg(t, 1.6, 2.4)), 1 - seg(t, 5.3, 5.9)); show(title, tk, `translate(-50%,-50%) scale(${.92 + .08 * eo(seg(t, 1.6, 2.6))})`);
  show(bug, sh.end || t < 5.6 ? 0 : 1);
  // character name tags
  const seen = new Set(); const u = t - sh.a;
  const fl = W.focus || []; fl.forEach(([k, ch], j) => { const p = project(ch, 0); const n = fl.length; const side = n === 1 ? (p.x < 1000 ? 1 : -1) : (j === 0 ? -1 : j === n - 1 ? 1 : 0); const a = .5 + j * .25; const kk = Math.min(eo(seg(u, a, a + .45)), 1 - seg(u, sh.b - sh.a - .45, sh.b - sh.a - .1)); seen.add(k);
    let x = p.x + side * 330, y = p.y; if (side === 0) { const q = project(ch, -1.05); y = q.y; } x = clamp(x, 230, 1690); y = clamp(y, 200, 760); tags[k].classList.toggle('mid', side === 0); tags[k].style.left = x + 'px'; tags[k].style.top = y + 'px'; show(tags[k], kk, `translate(-50%,-50%) translateX(${(1 - kk) * side * -24}px) scale(${.9 + .1 * kk})`); });
  if (sh.set === 'all' && !sh.end) ['saeed', 'khalid', 'nour', 'salim', 'maryam', 'yousef', 'hamad', 'aisha', 'emma', 'david', 'priya'].forEach((k, j) => { const p = project(W.CAST[k], .62 + (j % 2) * .55); const a = .3 + j * .08; const kk = Math.min(eo(seg(u, a, a + .4)), 1 - seg(u, 3.4, 3.8)); seen.add(k); tags[k].classList.add('mini'); tags[k].style.left = p.x + 'px'; tags[k].style.top = p.y + 'px'; show(tags[k], kk, `translate(-50%,-100%) scale(${.6 + .4 * kk})`); });
  for (const k in tags) { if (!seen.has(k)) show(tags[k], 0); if (sh.set !== 'all') tags[k].classList.remove('mini'); }
  // step chip
  const c = CHIP[sh.set]; if (c) { chip.children[0].textContent = c[0]; chip.children[1].textContent = c[1]; chip.children[2].textContent = c[2]; const kk = Math.min(eo(seg(u, .25, .7)), 1 - seg(u, sh.b - sh.a - .4, sh.b - sh.a - .1)); show(chip, kk, `translateX(${(1 - kk) * -30}px)`); } else show(chip, 0);
  // live strip in lineup
  if (sh.set === 'all' && !sh.end) { const kk = Math.min(eo(seg(u, .4, .9)), 1 - seg(u, 3.4, 3.8)); show(live, kk, `translate(-50%, ${(1 - kk) * 20}px)`); const st = Math.floor(clamp((u - .6) / .55, 0, 4.99)); [...live.querySelectorAll('.steps span')].forEach((s, j) => s.classList.toggle('on', j <= st)); } else show(live, 0);
  // end card
  const ek = sh.end ? eo(seg(u, .5, 1.4)) : 0; show(scrim, ek); show(end, ek, `translate(-50%,-50%) scale(${.94 + .06 * ek})`); ui.classList.toggle('dark', sh.set === 'all');
  // dip between shots
  let f = 0; for (const s of SHOTS) { if (s.a > 0 && !s.end) f = Math.max(f, 1 - Math.abs(t - s.a) / .18); } f = clamp(f); fade.style.opacity = f * .85;
  const fin = seg(t, 60.2, 61); if (fin > 0) { fade.style.background = '#0a1222'; fade.style.opacity = fin; } else fade.style.background = '#fff';
};
await build(document.getElementById('gl')); window.setT(0); window.ready = true;
