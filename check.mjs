import { chromium, webkit, devices } from 'playwright';
for (const bt of [chromium, webkit]) { let b; try { b = await bt.launch(); } catch (e) { console.log('no', bt.name()); continue; } console.log('== ' + bt.name());
for (const [name, ctxo] of [['desktop', { viewport: { width: 1366, height: 768 } }], ['iphone', devices['iPhone 13']]]) {
  const c = await b.newContext(ctxo); const p = await c.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('CON ' + m.text()); });
  p.on('requestfailed', r => errs.push('FAIL ' + r.url() + ' ' + (r.failure() || {}).errorText));
  const res = await p.goto('https://labathome-oman.vercel.app/present/', { waitUntil: 'load' }); await p.waitForTimeout(4000);
  const info = await p.evaluate(() => { const s = document.querySelector('.slide.on'); const st = document.getElementById('stage'); const r = st ? st.getBoundingClientRect() : null; return { title: document.title, on: s ? s.id : null, op: s ? getComputedStyle(s).opacity : null, stage: r ? [r.x, r.y, r.width, r.height] : null, text: (s ? s.innerText : document.body.innerText).slice(0, 200) }; });
  console.log(name, res.status(), res.headers()['content-type'], JSON.stringify(info)); console.log(errs.join('\n'));
  await c.close(); }
await b.close(); }
