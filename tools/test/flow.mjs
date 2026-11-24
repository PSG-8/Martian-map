// Tap-through flows on a phone: booking, menus, modals, language, keyboard, report PDF, rapid navigation.
import { launch, phone } from './harness.mjs';
const b = await launch(); const errors = []; const log = (...a) => console.log(...a);
const ok = (c, m) => { log((c ? '✓ ' : '✗ FAIL ') + m); if (!c) process.exitCode = 1; };
for (const lang of ['en', 'ar']) {
  log('--- ' + lang);
  const p = await phone(b, { token: 'tok-patient', lang, errors });
  await p.goto('http://site.local/index.html#/app/tests'); await p.waitForSelector('[data-add]');
  const adds = await p.$$('[data-add]'); await adds[0].tap(); await p.waitForTimeout(300); await (await p.$$('[data-add]'))[4].tap(); await p.waitForTimeout(400);
  await p.tap('.tabbar a[href="#/app/cart"]'); await p.waitForTimeout(800); ok(p.url().includes('app/cart'), 'tab bar opens cart');
  await p.goto('http://site.local/index.html#/app/book'); await p.waitForSelector('#nx', { timeout: 8000 });
  for (let s = 1; s <= 4; s++) { await p.waitForTimeout(700);
    if (s === 4) { const sl = await p.$('[data-slot]:not([disabled]):not(.locked)'); if (sl) await sl.tap(); await p.waitForTimeout(300); }
    await p.tap('#nx'); await p.waitForTimeout(700); const e = await p.textContent('#be').catch(() => ''); if (e) log('   step', s, 'message:', e); }
  ok(!!(await p.$('#pay')), 'booking wizard reaches payment step');
  ok(!(await p.$('[data-pm=cash], [value=cash]')), 'no cash option');
  if (await p.$('#cn')) { await p.fill('#cn', '4242424242424242'); await p.fill('#ce', '1230'); await p.fill('#cv', '123'); log('   card fields:', await p.inputValue('#cn'), await p.inputValue('#ce')); } await p.tap('#pay'); await p.waitForTimeout(1500); log('   after pay:', (await p.textContent('.content')).replace(/\s+/g,' ').slice(0,200)); ok(/LAH-/.test(await p.textContent('.content')), 'payment confirms booking');
  // drawer
  await p.goto('http://site.local/index.html#/app'); await p.waitForTimeout(800);
  await p.tap('.tabbar [data-menu]'); await p.waitForTimeout(400); ok(await p.isVisible('.drawer'), 'menu drawer opens'); ok(await p.evaluate(() => document.body.classList.contains('lock')), 'page behind menu is locked');
  await p.tap('.drawer [data-x]'); await p.waitForTimeout(400); ok(!(await p.evaluate(() => document.body.classList.contains('lock'))), 'lock released after closing menu');
  // keyboard behaviour
  await p.goto('http://site.local/index.html#/app/profile'); await p.waitForTimeout(900);
  await p.focus('input.input'); await p.waitForTimeout(200); ok(await p.evaluate(() => document.body.classList.contains('kb') && getComputedStyle(document.querySelector('.tabbar')).display === 'none'), 'tab bar hides while typing');
  ok(await p.evaluate(() => parseFloat(getComputedStyle(document.activeElement).fontSize) >= 16), 'fields are 16px (no iPhone auto-zoom)');
  await p.evaluate(() => document.activeElement.blur()); await p.waitForTimeout(200); ok(await p.evaluate(() => !document.body.classList.contains('kb')), 'tab bar returns after typing');
  // pinch blocked
  ok(await p.evaluate(() => { const e = new Event('gesturestart', { cancelable: true, bubbles: true }); document.body.dispatchEvent(e); return e.defaultPrevented; }), 'page pinch-zoom blocked');
  // rapid navigation ends on the last screen
  await p.evaluate(() => { location.hash = '#/app/orders'; location.hash = '#/app/profile'; location.hash = '#/app/tests'; location.hash = '#/app/notifs'; });
  await p.waitForTimeout(2500); ok((await p.textContent('.app-top h1')).length > 0 && p.url().endsWith('app/notifs') && /notif|إشعار|تنبيه/i.test(await p.textContent('.app-top h1')), 'fast taps land on the right screen: ' + await p.textContent('.app-top h1'));
  // report PDF
  await p.goto('http://site.local/index.html#/app/report/o1'); await p.waitForSelector('#pr'); await p.waitForTimeout(1200);
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 15000 }), p.tap('#pr')]); ok(/\.pdf$/.test(dl.suggestedFilename()), 'PDF downloads: ' + dl.suggestedFilename());
  // language switch from drawer
  await p.tap('.tabbar [data-menu]'); await p.waitForTimeout(400); const lb = await p.$('.drawer [data-lang]'); if (lb) { await lb.tap(); await p.waitForTimeout(800); ok((await p.getAttribute('html', 'dir')) === (lang === 'en' ? 'rtl' : 'ltr'), 'language switch works'); }
  await p.context().close();
}
log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors'); await b.close();
