// iLab@home – Pixar-style character film compositor. setT(t) draws frame t.
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const eo = x => 1 - Math.pow(1 - x, 3), eio = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const back = x => { const c1 = 1.7, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const lerp = (a, b, k) => a + (b - a) * k;
const VO = 1.0;
const S = (a, b, ar) => ({ a: a + VO, b: b + VO, ar });
const SUBS = [
  S(0.30, 4.48, 'تطبيق واحد، إحدى عشر شخص، ورحلة وحدة. هذا آي لاب@هوم.'),
  S(5.08, 9.73, 'سالم مشغول بدوامه. يحجز فحصه من جواله، والممرضة توصل لبيته.'),
  S(10.37, 13.31, 'مريم تختار باقة الأطفال، مع ممرضة في البيت.'),
  S(13.82, 15.43, 'ويوسف؟ ولا خايف أبداً!'),
  S(15.99, 20.72, 'الجد حمد ما يحتاج يسافر من قريته. ضغطه وسكره يتقاسون في البيت.'),
  S(21.36, 26.57, 'الممرضين نور وخالد يقبلون الطلب، يتأكدون من الهوية، ويسحبون العينة بأمان.'),
  S(27.09, 31.87, 'المندوب سعيد يوصّل العينات للمختبر في صندوق مبرّد، على ٤٫٢ درجة.'),
  S(32.81, 36.52, 'الدكتورة عائشة تراجع النتيجة العاجلة، وترسل النصيحة فوراً.'),
  S(37.01, 42.69, 'إيما وديفيد وبريا يستخدمون التطبيق بالإنجليزي، يدفعون بالبطاقة، ونتائجهم على جوالاتهم.'),
  S(43.84, 46.23, 'كل خطوة مباشرة، من الحجز لين النتيجة.'),
  S(46.61, 47.47, 'آي لاب@هوم.')
];
// characters: [en, ar, role, colour]
const C = {
  salim: ['Salim', 'سالم', 'Busy professional', '#2563EB'], maryam: ['Maryam', 'مريم', 'Mother', '#B4236B'], yousef: ['Yousef', 'يوسف', 'Age 7 · brave', '#E08A00'],
  hamad: ['Grandpa Hamad', 'الجد حمد', 'Mountain village', '#A0522D'], nour: ['Nurse Nour', 'الممرضة نور', 'Female nurse', '#0F9F8F'], khalid: ['Nurse Khalid', 'الممرض خالد', 'Male nurse', '#0284C7'],
  saeed: ['Courier Saeed', 'المندوب سعيد', 'Cold-chain courier', '#EA580C'], aisha: ['Dr. Aisha', 'الدكتورة عائشة', 'Reviewing doctor', '#0F766E'],
  emma: ['Emma', 'إيما', 'Expat', '#4F46E5'], david: ['David', 'ديفيد', 'Expat', '#15803D'], priya: ['Priya', 'بريا', 'Expat', '#E11D48']
};
// shots. kind clip = frame sequence; still = 2.5D parallax (bg + cut-out subject layer)
const SH = [
  { a: 0, b: 6.0, clip: 'intro', n: 200, card: 'brand' },
  { a: 6.0, b: 11.0, clip: 'office', n: 170, who: ['salim'], chip: ['01', 'Book in seconds', 'احجز بثواني'], em: [[8.6, 'check', .62, .3], [10.0, 'thumb', .27, .28]] },
  { a: 11.0, b: 17.0, still: 'home', who: ['maryam', 'yousef'], chip: ['02', 'Kids & family', 'الأطفال والعائلة'], cam: { z: [1.0, 1.085], x: [-.012, .012], y: [0, -.01], ax: .45, ay: .9 }, em: [[12.4, 'heart', .2, .24], [15.0, 'star', .44, .06], [15.4, 'spark', .52, .12], [16.0, 'check', .75, .14]] },
  { a: 17.0, b: 22.2, clip: 'village', n: 159, who: ['hamad'], chip: ['03', 'Seniors at home', 'كبار السن في البيت'], em: [[19.9, 'heart', .58, .12], [21.0, 'check', .8, .55]] },
  { a: 22.2, b: 27.9, still: 'nurses', who: ['nour', 'khalid'], chip: ['04', 'Verified home visit', 'زيارة موثّقة'], cam: { z: [1.09, 1.0], x: [.01, -.01], y: [-.01, 0], ax: .5, ay: .95 }, em: [[22.9, 'spark', .49, .07], [25.0, 'id', .74, .3], [26.6, 'check', .3, .25]] },
  { a: 27.9, b: 33.6, still: 'courier', who: ['saeed'], chip: ['05', 'Cold chain 2–8 °C', 'سلسلة تبريد'], cam: { z: [1.0, 1.09], x: [.015, -.005], y: [0, -.012], ax: .62, ay: .95 }, em: [[30.0, 'snow', .92, .5], [31.1, 'temp', .74, .58], [32.6, 'star', .6, .08]] },
  { a: 33.6, b: 37.9, still: 'clinic', who: ['aisha'], chip: ['06', 'Doctor review', 'مراجعة الطبيب'], cam: { z: [1.0, 1.08], x: [-.012, .008], y: [0, -.01], ax: .3, ay: .8 }, em: [[34.9, 'urgent', .86, .3], [36.6, 'send', .5, .62]] },
  { a: 37.9, b: 44.6, still: 'flat', who: ['emma', 'david', 'priya'], chip: ['07', 'English & card pay', 'إنجليزي ودفع بالبطاقة'], cam: { z: [1.08, 1.0], x: [-.01, .01], y: [-.01, 0], ax: .5, ay: .9 }, em: [[39.5, 'en', .22, .12], [41.2, 'card', .4, .2], [42.6, 'check', .82, .14], [43.2, 'thumb', .5, .12]] },
  { a: 44.6, b: 48.9, still: 'all', card: 'all', live: true, cam: { z: [1.05, 1.0], x: [0, 0], y: [-.01, 0], ax: .5, ay: .85 } },
  { a: 48.9, b: 55.5, still: 'all', end: true, cam: { z: [1.0, 1.06], x: [0, 0], y: [0, 0], ax: .5, ay: .6 } }
];
const TOTAL = 55.5;
/* ---------- assets ---------- */
const load = src => new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = src; });
const IMG = {}, FR = {};
async function frame(clip, i) { const k = clip + i; if (FR[k]) return FR[k]; const im = await load(`f/${clip}/${String(i).padStart(4, '0')}.jpg`); FR[k] = im; const ks = Object.keys(FR); if (ks.length > 12) delete FR[ks[0]]; return im; }
/* ---------- overlay DOM ---------- */
const cv = document.getElementById('cv'), g = cv.getContext('2d'); g.imageSmoothingQuality = 'high';
const ui = document.getElementById('ui'); const el = h => { const d = document.createElement('div'); d.innerHTML = h.trim(); const n = d.firstChild; ui.appendChild(n); return n; };
const WM = '<span class="wm">i<b>Lab</b><i>@</i><b>home</b></span>';
const vign = el('<div id="vign"></div>');
const bug = el(`<div id="bug">${WM}</div>`);
const chip = el('<div id="chip"><b></b><span class="en"></span><span class="ar"></span></div>');
const title = el(`<div id="title"><div class="big">${WM}</div><div class="tag">Home lab tests across Oman</div><div class="tagar">فحوصات مخبرية في بيتك، في كل عُمان</div></div>`);
const sub = el('<div id="sub"><span></span></div>'), subSpan = sub.firstChild;
const card = el('<div id="card"></div>');
const live = el('<div id="live"><i></i>Live tracking · LAH-10250<div class="steps"><span>Booked</span><span>On the way</span><span>Sample</span><span>Lab</span><span>Result</span></div></div>');
const scrim = el('<div id="scrim"></div>');
const end = el(`<div id="end"><div class="big">${WM}</div><div class="tl">Your health, at your doorstep.</div><div class="tlar">صحتك، عند باب بيتك</div><div class="row"><span class="pill">labathome-oman.vercel.app</span><span class="pill"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.3" cy="6.7" r="1.3" fill="currentColor"/></svg>@ilabathome</span></div></div>`);
const fade = el('<div id="fade"></div>');
const ICON = {
  heart: '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.8 4.5c2.1 0 3.5 1.2 5.2 3 1.7-1.8 3.1-3 5.2-3 3.8 0 5.9 3.9 4.4 7.3C19.5 16.4 12 21 12 21z" fill="#F43F6E"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" fill="#F5B300"/></svg>',
  spark: '<svg viewBox="0 0 24 24"><path d="M12 2c.6 4.6 2.4 7 7 8-4.6 1-6.4 3.4-7 8-.6-4.6-2.4-7-7-8 4.6-1 6.4-3.4 7-8z" fill="#8B5CF6"/><path d="M19 15c.3 2 1 3 3 3.4-2 .4-2.7 1.4-3 3.4-.3-2-1-3-3-3.4 2-.4 2.7-1.4 3-3.4z" fill="#F5B300"/></svg>',
  check: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#14B8A6"/><path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  thumb: '<svg viewBox="0 0 24 24"><path d="M7 10v11H3V10zm2 11h8.5c1 0 1.8-.7 2-1.6l1.4-6.6c.3-1.3-.7-2.6-2-2.6H14l.8-4c.2-1.2-.6-2.2-1.8-2.2L9 9.6z" fill="#2563EB"/></svg>',
  snow: '<svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2" stroke-linecap="round"><path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M9 4l3 2 3-2M9 20l3-2 3 2"/></svg>',
  id: '<svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="3" fill="#0284C7"/><circle cx="8" cy="12" r="2.6" fill="#fff"/><path d="M13 10h6M13 14h4" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>',
  send: '<svg viewBox="0 0 24 24"><path d="M3 11.5L21 3l-6.5 18-3-7.5z" fill="#0F766E"/></svg>',
  card: '<svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="3" fill="#4F46E5"/><path d="M2 9.5h20" stroke="#fff" stroke-width="2.4"/><path d="M5.5 15h5" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>'
};
const TXT = { temp: ['4.2 °C', '#2563EB'], urgent: ['Urgent', '#DC2626'], en: ['EN', '#4F46E5'] };
const ems = [].concat(SH.flatMap(s => []).map(e => { const [t, k, x, y] = e; const html = ICON[k] ? `<div class="em">${ICON[k]}</div>` : `<div class="em tx" style="--c:${TXT[k][1]}">${TXT[k][0]}</div>`; return { t, x, y, n: el(html), s }; }));
const show = (n, o, tr) => { n.style.opacity = o; if (tr != null) n.style.transform = tr; };
let curSub = -1, curCard = '';
function cardHTML(s) {
  if (s.card === 'brand') return `<div class="brand">${WM}<div class="r">Home lab tests · Oman</div></div>`;
  if (s.card === 'all') return `<div class="brand"><div class="big2">11 people</div><div class="r">1 app · 1 journey</div></div>`;
  return s.who.map(k => { const [en, ar, role, c] = C[k]; return `<div class="who" style="--c:${c}"><div class="n">${en}<span>${ar}</span></div><div class="r">${role}</div></div>`; }).join('');
}
/* ---------- draw ---------- */
function drawCover(im, z, cx, cy, ax, ay) { // cover 1920x1080 with zoom z around anchor
  const s = 1920 / im.width * z, w = im.width * s, h = im.height * s; const px = ax * 1920, py = ay * 1080;
  const x = px - ax * w + cx * 1920, y = py - ay * h + cy * 1080; g.drawImage(im, x, y, w, h);
}
window.setT = async (t) => {
  const s = SH.find(x => t >= x.a && t < x.b) || SH[SH.length - 1]; const u = t - s.a, L = s.b - s.a, k = eio(seg(u, 0, L));
  if (s.clip) { const i = Math.min(s.n, 1 + Math.floor(u * 30)); const im = await frame(s.clip, i); g.drawImage(im, 0, 0, 1920, 1080); }
  else { const c = s.cam, bg = IMG[s.still], fg = IMG['cut_' + s.still]; const z = lerp(c.z[0], c.z[1], k), x = lerp(c.x[0], c.x[1], k), y = lerp(c.y[0], c.y[1], k);
    const breathe = 1 + .006 * (.5 + .5 * Math.sin(t * 2.4));
    g.filter = s.end ? 'blur(6px) saturate(1.1)' : 'none'; drawCover(bg, z, x, y, c.ax, c.ay); g.filter = 'none';
  }
  // reactions
  for (const e of ems) { const on = e.s === s; const kk = on ? Math.min(back(seg(t, e.t, e.t + .4)), 1 - seg(t, e.t + 1.5, e.t + 1.8)) : 0; e.n.style.left = e.x * 1920 + 'px'; e.n.style.top = e.y * 1080 + 'px'; show(e.n, kk > .01 ? 1 : 0, `translate(-50%,-50%) translateY(${-eo(seg(t, e.t, e.t + 1.8)) * 50}px) scale(${Math.max(0, kk)}) rotate(${Math.sin(t * 5 + e.x * 9) * 6}deg)`); }
  // subtitles
  const si = s.end ? -1 : SUBS.findIndex(q => t >= q.a - .05 && t < q.b + .35); if (si !== curSub) { curSub = si; if (si >= 0) subSpan.textContent = SUBS[si].ar; }
  if (si >= 0) { const q = SUBS[si]; const kk = Math.min(seg(t, q.a - .05, q.a + .2), 1 - seg(t, q.b + .15, q.b + .35)); show(sub, kk, `translate(-50%, ${(1 - eo(kk)) * 14}px)`); } else show(sub, 0);
  // title (intro)
  const tk = Math.min(eo(seg(t, 1.3, 2.1)), 1 - seg(t, 5.0, 5.6)); show(title, tk, `translate(-50%,-50%) scale(${.92 + .08 * eo(seg(t, 1.3, 2.3))})`);
  show(bug, s.end || t < 5.4 ? 0 : 1);
  // chip
  if (s.chip) { chip.children[0].textContent = s.chip[0]; chip.children[1].textContent = s.chip[1]; chip.children[2].textContent = s.chip[2]; const kk = Math.min(eo(seg(u, .2, .6)), 1 - seg(u, L - .35, L - .05)); show(chip, kk, `translateX(${(1 - kk) * 30}px)`); } else show(chip, 0);
  // bottom-right card (always solid while a clip plays)
  if (!s.end) { const id = SH.indexOf(s); if (curCard !== id) { curCard = id; card.innerHTML = cardHTML(s); }
    const kk = s.clip ? 1 : Math.min(eo(seg(u, .15, .55)), 1 - seg(u, L - .3, L - .02)); show(card, kk, `translateY(${(1 - kk) * 30}px)`); } else show(card, 0);
  // live strip
  if (s.live) { const kk = eo(seg(u, .3, .8)); show(live, kk, `translate(-50%, ${(1 - kk) * 20}px)`); const st = Math.floor(clamp((u - .5) / .5, 0, 4.99)); [...live.querySelectorAll('.steps span')].forEach((q, j) => q.classList.toggle('on', j <= st)); } else show(live, 0);
  // end card
  const ek = s.end ? eo(seg(u, .2, 1.1)) : 0; show(scrim, ek); show(end, ek, `translate(-50%,-50%) scale(${.94 + .06 * ek})`);
  // dips between shots + final fade
  let f = 0; for (const q of SH) if (q.a > 0) f = Math.max(f, 1 - Math.abs(t - q.a) / .16); fade.style.background = '#fff'; fade.style.opacity = clamp(f) * .7;
  const fin = seg(t, TOTAL - .8, TOTAL); if (fin > 0) { fade.style.background = '#0a1222'; fade.style.opacity = fin; }
};
(async () => { await document.fonts.ready; for (const n of ['home', 'nurses', 'courier', 'clinic', 'flat', 'all']) { IMG[n] = await load(`img/${n}.png`); IMG['cut_' + n] = await load(`img/cut_${n}.png`); } await setT(0); window.ready = true; })();
