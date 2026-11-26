const H = require('./h.js'); const { devices } = require('playwright');
(async () => {
  for (const cart of [null, JSON.stringify([{ k: 'test', id: 'cbc', q: 1 }]), '{bad json', '"str"', '{"a":1}', '{"packages":["x"],"tests":[1,null,"cbc"]}']) {
    const { b, p, errors } = await H.open({ ctxOpts: devices['Galaxy S24'], role: 'patient', lang: 'ar' });
    if (cart !== null) await p.addInitScript(c => localStorage.setItem('lah_cart', c), cart);
    await p.goto((process.env.QA_BASE || 'http://localhost:5055/') + '#/app/book'); await p.waitForTimeout(1800);
    const t = await p.evaluate(() => (document.querySelector('#app') || {}).innerText.slice(0, 60).replace(/\n/g, ' | '));
    console.log('cart', String(cart).slice(0, 30).padEnd(32), '->', t ? 'OK  ' + JSON.stringify(t.slice(0, 40)) : 'BLANK', errors.slice(0, 1));
    await b.close();
  }
  // storage blocked (in-app browser with storage off): the getters throw
  for (const route of ['', 'login', 'tests']) {
    const { b, ctx } = await H.open({ ctxOpts: devices['Galaxy S24'], lang: 'ar' });
    const p = await ctx.newPage(); const errors = []; p.on('pageerror', e => errors.push(e.message));
    await p.addInitScript(() => { for (const n of ['localStorage', 'sessionStorage']) Object.defineProperty(window, n, { get() { throw new DOMException('The operation is insecure.', 'SecurityError'); }, configurable: true }); });
    await p.goto((process.env.QA_BASE || 'http://localhost:5055/') + '#/' + route); await p.waitForTimeout(2500);
    const t = await p.evaluate(() => (document.querySelector('#app') || {}).innerText.slice(0, 60).replace(/\n/g, ' | '));
    console.log('blocked storage #/' + route.padEnd(8), '->', t ? 'OK  ' + JSON.stringify(t.slice(0, 40)) : 'BLANK', errors.slice(0, 1));
    await b.close();
  }
})();
