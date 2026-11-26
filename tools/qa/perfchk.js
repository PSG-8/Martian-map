// Smoothness on a mid/low-end Android phone: CPU slowed 4x (like a Galaxy A-series / Redmi), Samsung Internet user agent.
// Measures: first paint, blocking time in the first 6 s, and dropped frames while scrolling.
// Usage: node perfchk.js [base-url]   (default: local harness)
const H = require('./h.js'); const { devices } = require('playwright');
const base = process.argv[2] || (process.env.QA_BASE || 'http://localhost:5055/');
const live = !base.includes('localhost');
const UA = 'Mozilla/5.0 (Linux; Android 14; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36';
(async () => {
  const cases = [[null, ''], [null, 'tests'], ['patient', 'app'], ['patient', 'app/tests'], ['leader', 'app'], ['leader', 'app/admin/users'], [null, 'login']].filter(c => !live || !c[0]);
  for (const [role, r] of cases) {
    const { b, p, ctx } = await H.open({ ctxOpts: { ...devices['Galaxy A55'], userAgent: UA }, role, lang: 'ar', live });
    const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await p.addInitScript(() => { window.__lt = []; try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push(e.duration))).observe({ type: 'longtask', buffered: true }); } catch (e) {} });
    const t0 = Date.now(); await p.goto(base + '#/' + r, { waitUntil: 'load' }); await p.waitForTimeout(6000);
    const m = await p.evaluate(() => { const fcp = performance.getEntriesByName('first-contentful-paint')[0]; const tbt = window.__lt.reduce((s, d) => s + Math.max(0, d - 50), 0); return { fcp: fcp ? Math.round(fcp.startTime) : null, tbt: Math.round(tbt), longest: Math.round(Math.max(0, ...window.__lt)) }; });
    const sc = await p.evaluate(async () => { const fr = []; let last = performance.now(), run = true; const tick = t => { fr.push(t - last); last = t; if (run) requestAnimationFrame(tick); }; requestAnimationFrame(tick);
      const H = document.documentElement.scrollHeight - innerHeight; for (let i = 0; i < 30; i++) { scrollBy(0, Math.max(60, H / 30)); await new Promise(r => setTimeout(r, 70)); } for (let i = 0; i < 15; i++) { scrollBy(0, -Math.max(60, H / 15)); await new Promise(r => setTimeout(r, 70)); }
      run = false; fr.shift(); const bad = fr.filter(x => x > 50).length; const avg = fr.reduce((a, b) => a + b, 0) / fr.length; return { frames: fr.length, janky: bad, worst: Math.round(Math.max(...fr)), fps: Math.round(1000 / avg) }; });
    console.log((role || 'public').padEnd(8), ('#/' + r).padEnd(18), 'first paint', m.fcp + 'ms', '| blocking', m.tbt + 'ms (longest task ' + m.longest + 'ms)', '| scroll', sc.fps + 'fps, janky frames', sc.janky + '/' + sc.frames, 'worst', sc.worst + 'ms');
    await b.close();
  }
})();
