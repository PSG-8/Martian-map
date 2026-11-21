/* iLab@Home – builds the results report as a real PDF file on the device (no print dialog, no libraries).
   Each A4 page is drawn on a canvas (so Arabic shaping and fonts are exact) and embedded as a JPEG in a small PDF. */
(function(){
'use strict';
const PW = 1240, PH = 1754, SC = 1.4;           // A4 at 150 dpi, drawn 1.6x for sharpness
const C = { navy:'#0d1628', navy2:'#14254a', blue:'#1257d6', blue2:'#3b82f6', ink:'#0f1b33', muted:'#5b6b88', line:'#e3e9f4', grp:'#f3f7ff',
  teal:'#0a7d70', tealBg:'#e3f7f4', amber:'#9a6400', amberBg:'#fff4dc', red:'#b3262e', redBg:'#fdecec', white:'#ffffff' };

function loadImg(svg){ return new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); }); }

async function build(d){
  const rtl = d.lang === 'ar';
  const F = rtl ? '"IBM Plex Sans Arabic", "Inter", sans-serif' : '"Inter", "IBM Plex Sans Arabic", sans-serif';
  try { await Promise.all(['400','600','700','800'].map(w => document.fonts.load(`${w} 20px ${F}`, rtl ? 'اب' : 'Ab'))); await document.fonts.ready; } catch(e) {}
  const logo = await loadImg(d.logo.replace(/#3b82f6/g, '#ffffff').replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"'));
  const pages = []; let cv, x, y;
  const M = 72, CW = PW - 2 * M;                  // margins / content width
  const X = v => rtl ? PW - v : v;                 // mirror for RTL
  const font = (w, s) => { x.font = `${w} ${s}px ${F}`; };
  const txt = (s, px, py, o = {}) => { font(o.w || 400, o.s || 20); x.fillStyle = o.c || C.ink; const al = o.a || 'start'; x.textAlign = rtl ? (al === 'start' ? 'right' : al === 'end' ? 'left' : al) : (al === 'start' ? 'left' : al === 'end' ? 'right' : al); x.direction = rtl ? 'rtl' : 'ltr'; x.textBaseline = 'alphabetic'; x.fillText(String(s), X(px), py); };
  const ltrTxt = (s, px, py, o = {}) => { font(o.w || 400, o.s || 20); x.fillStyle = o.c || C.ink; x.direction = 'ltr'; const al = o.a || 'start'; x.textAlign = rtl ? (al === 'start' ? 'right' : al === 'end' ? 'left' : al) : (al === 'start' ? 'left' : al === 'end' ? 'right' : al); x.fillText(String(s), X(px), py); };
  const width = (s, w, sz) => { font(w, sz); return x.measureText(String(s)).width; };
  const rr = (px, py, w, h, r, fill) => { const lx = rtl ? PW - px - w : px; x.beginPath(); x.roundRect ? x.roundRect(lx, py, w, h, r) : x.rect(lx, py, w, h); x.fillStyle = fill; x.fill(); };
  const wrap = (s, w, sz, wt) => { const words = String(s).split(/\s+/); const lines = []; let cur = ''; for (const wd of words) { const tr = cur ? cur + ' ' + wd : wd; if (width(tr, wt, sz) > w && cur) { lines.push(cur); cur = wd; } else cur = tr; } if (cur) lines.push(cur); return lines; };
  const fit = (s, w, wt, sz) => { s = String(s); if (width(s, wt, sz) <= w) return s; while (s.length > 1 && width(s + '…', wt, sz) > w) s = s.slice(0, -1); return s + '…'; };

  function newPage(first){
    cv = document.createElement('canvas'); cv.width = Math.round(PW * SC); cv.height = Math.round(PH * SC); x = cv.getContext('2d'); x.scale(SC, SC);
    x.fillStyle = '#fff'; x.fillRect(0, 0, PW, PH); pages.push(cv);
    if (first) {
      const g = x.createLinearGradient(0, 0, PW, 260); g.addColorStop(0, C.navy); g.addColorStop(.65, C.navy2); g.addColorStop(1, C.blue); x.fillStyle = g; x.fillRect(0, 0, PW, 230);
      if (logo) x.drawImage(logo, rtl ? PW - M - 92 : M, 58, 92, 92);
      const wx = M + 112; font(800, 50); x.direction = 'ltr'; x.textAlign = rtl ? 'right' : 'left';
      // wordmark "iLab@Home" with a blue @, always left-to-right
      const parts = [['i', '#60a5fa'], ['Lab', '#fff'], ['@', '#60a5fa'], ['Home', '#fff']]; let cx = rtl ? PW - wx : wx;
      x.textAlign = 'left'; const total = parts.reduce((a, p) => a + x.measureText(p[0]).width, 0); if (rtl) cx -= total;
      for (const [s, c] of parts) { x.fillStyle = c; x.fillText(s, cx, 112); cx += x.measureText(s).width; }
      txt(d.t.title, wx, 150, { s: 24, w: 600, c: '#c7d7f5' });
      txt(d.lab || '', PW - M, 102, { s: 24, w: 700, c: '#fff', a: 'end' });
      if (d.licence) txt(d.licence, PW - M, 136, { s: 19, c: '#c7d7f5', a: 'end' });
      txt(d.code, PW - M, 172, { s: 19, c: '#c7d7f5', a: 'end' });
      y = 280;
    } else {
      x.fillStyle = C.navy; x.fillRect(0, 0, PW, 70); txt(`iLab@Home · ${d.t.title} · ${d.code}`, M, 45, { s: 20, w: 600, c: '#fff' }); y = 120;
    }
  }
  function footer(i, n){
    x.fillStyle = C.line; x.fillRect(M, PH - 96, CW, 2);
    const lines = wrap(d.t.disclaimer, CW - 140, 15, 400).slice(0, 2); lines.forEach((l, k) => txt(l, M, PH - 64 + k * 22, { s: 15, c: C.muted }));
    txt(`${i} / ${n}`, PW - M, PH - 64, { s: 16, w: 600, c: C.muted, a: 'end' });
    if (d.contact) ltrTxt(d.contact, PW / 2, PH - 22, { s: 15, w: 600, c: C.blue, a: 'center' });
  }

  newPage(true);
  /* patient block */
  const cols = 3, cw = CW / cols;
  d.info.forEach((it, i) => { const cx = M + (i % cols) * cw, cy = y + Math.floor(i / cols) * 78; txt(it[0], cx, cy, { s: 17, c: C.muted, w: 500 }); txt(fit(it[1], cw - 20, 700, 23), cx, cy + 32, { s: 23, w: 700 }); });
  y += Math.ceil(d.info.length / cols) * 78 + 18;
  /* summary banner */
  rr(M, y, CW, 70, 18, d.flags ? C.amberBg : C.tealBg); txt(d.t.summary, M + 28, y + 45, { s: 24, w: 700, c: d.flags ? '#6d4800' : '#0a6457' }); y += 104;
  /* table */
  const colA = M + 14, colR = M + 470, colRef = M + 760, colF = PW - M - 14;
  const head = () => { txt(d.t.analyte, colA, y, { s: 16, w: 700, c: C.muted }); txt(d.t.result, colR, y, { s: 16, w: 700, c: C.muted }); txt(d.t.range, colRef, y, { s: 16, w: 700, c: C.muted }); txt(d.t.flag, colF, y, { s: 16, w: 700, c: C.muted, a: 'end' }); y += 16; x.fillStyle = C.line; x.fillRect(M, y, CW, 3); y += 14; };
  const LIM = PH - 140;
  head();
  for (const g of d.groups) {
    if (y + 56 + 62 > LIM) { newPage(false); head(); }
    rr(M, y, CW, 50, 10, C.grp); txt(fit(g.name, CW - 40, 700, 21), colA, y + 33, { s: 21, w: 700, c: C.navy }); y += 58;
    for (const r of g.rows) {
      if (y + 62 > LIM) { newPage(false); head(); }
      txt(fit(r.name, colR - colA - 24, 500, 21), colA, y + 36, { s: 21, w: 500 });
      const col = r.f === 'H' ? '#d0323b' : r.f === 'L' ? C.amber : C.ink;
      ltrTxt(r.v, colR, y + 36, { s: 23, w: 800, c: col }); const vw = width(r.v, 800, 23);
      if (r.u) ltrTxt(r.u, rtl ? colR + vw + 10 : colR + vw + 10, y + 36, { s: 16, c: C.muted });
      ltrTxt(r.range, colRef, y + 36, { s: 19, c: C.muted });
      if (r.f) { const lbl = r.fl; const w = width(lbl, 700, 17) + 30; const bg = r.f === 'N' ? C.tealBg : r.f === 'H' ? C.redBg : C.amberBg; const fc = r.f === 'N' ? C.teal : r.f === 'H' ? C.red : C.amber;
        rr(colF - w, y + 12, w, 34, 17, bg); txt(lbl, colF - w / 2, y + 35, { s: 17, w: 700, c: fc, a: 'center' }); }
      y += 58; x.fillStyle = '#eef2f8'; x.fillRect(M, y - 4, CW, 2);
    }
  }
  /* notes */
  if (d.notes.length) {
    y += 20; const lines = d.notes.map(n => wrap(n, CW - 56, 19, 400)); const h = 70 + lines.reduce((a, l) => a + l.length * 30 + 10, 0);
    if (y + h > LIM) newPage(false);
    x.strokeStyle = C.line; x.lineWidth = 2; x.beginPath(); x.roundRect ? x.roundRect(M, y, CW, h, 18) : x.rect(M, y, CW, h); x.stroke();
    txt(d.t.insight, M + 28, y + 44, { s: 22, w: 700 }); let ny = y + 84; lines.forEach(ls => { ls.forEach((l, k) => { if (!k) { x.fillStyle = C.blue; x.beginPath(); x.arc(X(M + 34), ny - 7, 4, 0, 7); x.fill(); } txt(l, M + 50, ny, { s: 19, c: '#2a3956' }); ny += 30; }); ny += 10; });
    y += h;
  }
  pages.forEach((p, i) => { x = p.getContext('2d'); x.setTransform(SC, 0, 0, SC, 0, 0); footer(i + 1, pages.length); });
  const jpgs = [];
  for (const p of pages) jpgs.push(await new Promise((res, rej) => { try { p.toBlob(b => { if (!b) { try { const u = p.toDataURL('image/jpeg', .9); const bin = atob(u.split(',')[1]); const a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return res(a); } catch(e) { return rej(e); } } b.arrayBuffer().then(a => res(new Uint8Array(a)), rej); }, 'image/jpeg', .9); } catch(e) { rej(e); } }));
  pages.forEach(p => { p.width = p.height = 1; });     // free memory on phones
  return pdfFromJpegs(jpgs, Math.round(PW * SC), Math.round(PH * SC), d.title || 'iLab@Home report');
}

function pdfFromJpegs(imgs, iw, ih, title){
  const enc = new TextEncoder(); const parts = []; const offs = []; let len = 0;
  const push = b => { const u = typeof b === 'string' ? enc.encode(b) : b; parts.push(u); len += u.length; };
  const obj = (n, body, stream) => { offs[n] = len; push(`${n} 0 obj\n${body}\n`); if (stream) { push('stream\n'); push(stream); push('\nendstream\n'); } push('endobj\n'); };
  const hexTitle = 'FEFF' + Array.from(title).map(c => c.charCodeAt(0).toString(16).padStart(4, '0')).join('');
  const N = imgs.length; const W = 595.28, H = 841.89;
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Count ${N} /Kids [${imgs.map((_, i) => `${4 + i * 3} 0 R`).join(' ')}] >>`);
  obj(3, `<< /Title <${hexTitle}> /Producer (iLab@Home) /Creator (iLab@Home) >>`);
  imgs.forEach((im, i) => { const p = 4 + i * 3; const cs = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
    obj(p, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${p + 2} 0 R >> >> /Contents ${p + 1} 0 R >>`);
    obj(p + 1, `<< /Length ${cs.length} >>`, enc.encode(cs));
    obj(p + 2, `<< /Type /XObject /Subtype /Image /Width ${iw} /Height ${ih} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.length} >>`, im); });
  const total = 4 + N * 3; const xref = len;
  let x = `xref\n0 ${total}\n0000000000 65535 f \n`; for (let i = 1; i < total; i++) x += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
  push(x + `trailer\n<< /Size ${total} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type: 'application/pdf' });
}

/* hand the file to the user: share sheet on iPhone/iPad (Save to Files, WhatsApp…), normal download elsewhere */
function isIOS(){ return /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
/* ready=false means the tap was spent waiting for the file: on iPhone the share sheet may then be refused, so we ask for one more tap */
async function save(blob, name, preferShare, ready){
  let file = null; try { file = new File([blob], name, { type: 'application/pdf' }); } catch(e) {}
  const canShareFile = file && navigator.share && navigator.canShare && navigator.canShare({ files: [file] });
  if ((preferShare || isIOS()) && canShareFile) {
    try { await navigator.share({ files: [file], title: name }); return 'shared'; } catch(e) { if (e && e.name === 'AbortError') return 'cancel'; return 'again'; }
  }
  if (isIOS()) return 'again';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 120000); return 'downloaded';
}
window.LAHPDF = { build, save, isIOS };
})();
