const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 2000 }, deviceScaleFactor: 2 }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + __dirname + '/design.html'); await p.waitForTimeout(2500); await p.evaluate(() => document.fonts.ready);
  for (const id of await p.$$eval('.f', a => a.map(e => e.id))) { const el = await p.$('#' + id); const ov = id.startsWith('tz') && id !== 'tzend';
    await el.screenshot({ path: __dirname + '/out_' + id + '.png', omitBackground: ov }); }
  console.log('done', errs); await b.close(); })();
