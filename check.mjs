import { chromium, webkit, devices } from 'playwright';
const U = 'https://labathome-oman.vercel.app';
for (const bt of [chromium, webkit]) { let b; try { b = await bt.launch(); } catch (e) { console.log('no', bt.name()); continue; } console.log('== ' + bt.name());
for (const [name, ctxo] of [['desktop', { viewport: { width: 1440, height: 900 } }], ['iphone', devices['iPhone 13']]]) {
  const c = await b.newContext(ctxo); await c.addInitScript(() => localStorage.setItem('lah_seen', '1')); const p = await c.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('CON ' + m.text().slice(0, 160)); });
  const t0 = Date.now(); const res = await p.goto(U + '/?splash=0', { waitUntil: 'load' }); const tl = Date.now() - t0; await p.waitForTimeout(5000);
  const info = await p.evaluate(() => ({ v: typeof APP_V !== 'undefined' ? APP_V : null, h3: document.querySelector('#h3') && document.querySelector('#h3').className, img: (document.querySelector('.h3-im.on img') || {}).currentSrc, imgOk: (document.querySelector('.h3-im.on img') || {}).naturalWidth, wn: !!document.querySelector('#whatsnew video'), ct: !!document.querySelector('#contact .ig-qr svg'), ver: [...document.scripts].map(s => s.src).filter(s => s.includes('app.js'))[0] }));
  const vid = await p.evaluate(async () => { const n = document.querySelectorAll('#whatsnew video').length; const r = await fetch('/media/iLabAtHome_HowItWorks.mp4', { headers: { Range: 'bytes=0-99' } }); return n + ' videos, how ' + r.status + ' ' + r.headers.get('content-type'); });
  console.log(name, res.status(), 'load', tl + 'ms', JSON.stringify(info), 'video', vid);
  for (const path of ['/questions/', '/present/']) { const q = await p.goto(U + path); await p.waitForTimeout(2500); console.log(name, path, q.status(), await p.evaluate(() => (document.querySelector('.slide.on') || document.body).innerText.slice(0, 90).replace(/\n/g, ' | '))); }
  await p.goto(U + '/#/about'); await p.waitForTimeout(2500); console.log(name, 'team', await p.evaluate(() => [...document.querySelectorAll('.team h4')].map(h => h.textContent).join(' / ') + ' :: ' + (document.querySelector('.dev-chip') || {}).textContent));
  console.log(errs.join('\n')); await c.close(); }
await b.close(); }
