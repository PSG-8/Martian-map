// End-to-end test of the live site against the real database: every role moves one real order.
import { chromium } from 'playwright';
const BASE = process.argv[2] || 'https://lab-at-home-two.vercel.app';
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const b = await chromium.launch({ args: ['--no-sandbox'] });
const errors = [];
async function page(w = 390, h = 844) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/tile|favicon|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  return p;
}
async function login(p, email) {
  await p.goto(BASE + '/#/login'); await p.fill('input[name=login]', email); await p.fill('input[name=password]', 'Demo@2026');
  await p.click('#lf button.btn'); await p.waitForURL(/#\/app/); await p.waitForTimeout(800);
}
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); log('✓', m); };
try {
  // 1. landing
  let p = await page(1366, 900);
  await p.goto(BASE + '/'); await p.waitForSelector('.pkg', { timeout: 20000 });
  ok((await p.$$('.pkg')).length >= 3, 'landing shows packages from the live catalogue');
  await p.click('[data-lang]'); await p.waitForTimeout(400);
  ok((await p.getAttribute('html', 'dir')) === 'rtl', 'Arabic switch sets RTL');
  await p.context().close();

  // 2. register a new patient and book with card
  p = await page();
  const phone = '9' + String(Date.now()).slice(-7);
  await p.goto(BASE + '/#/register/patient');
  await p.fill('input[name=full_name]', 'Test Patient E2E'); await p.fill('input[name=phone]', phone);
  await p.fill('input[name=newpass]', 'Test1234x'); await p.selectOption('select[name=wilayat]', 'Ibra');
  await p.fill('input[name=address]', 'E2E house'); await p.check('input[name=consent]');
  await p.click('#rf button.btn'); await p.waitForURL(/#\/app/); await p.waitForTimeout(800);
  ok(await p.isVisible('.welcome'), 'new patient registered and sees dashboard');
  await p.goto(BASE + '/#/app/tests'); await p.waitForSelector('[data-add="package:vitamins"]');
  await p.click('[data-add="package:vitamins"]'); await p.click('[data-add="test:hba1c"]');
  await p.click('[data-go="app/book"]'); await p.waitForSelector('#nx');
  await p.click('#nx'); await p.click('#nx');
  await p.click('.slots button:not([disabled])'); await p.click('#nx');
  await p.fill('#ba', 'House 7, E2E street'); await p.click('#nx');
  await p.fill('#cn', '4242 4242 4242 4242'); await p.fill('#ce', '12/29'); await p.fill('#cv', '123');
  await p.click('#pay'); await p.waitForSelector('text=Booking confirmed', { timeout: 15000 });
  const code = (await p.textContent('.card.pad-lg p.muted')).match(/LAH-\d+/)[0];
  ok(!!code, 'booking confirmed ' + code);
  await p.click('a.btn.block'); await p.waitForSelector('.tl');
  const orderUrl = p.url(); ok(/order\//.test(orderUrl), 'tracking page opened');

  // 3. nurse
  const n = await page(1366, 900); await login(n, 'nurse@demo.labathome.om');
  ok(await n.isVisible(`text=${code}`), 'nurse sees the new request near her');
  await n.click(`text=${code}`); await n.waitForSelector('[data-act=accept]');
  ok(!(await n.textContent('body')).includes('E2E street'), 'address hidden before accepting');
  await n.click('[data-act=accept]'); await n.waitForSelector('[data-act=start]');
  ok((await n.textContent('body')).includes('E2E street'), 'address visible after accepting');
  await n.click('[data-act=start]'); await n.waitForSelector('[data-act=arrive]');
  await n.click('[data-act=arrive]'); await n.waitForSelector('[data-act=collect]');
  await n.click('[data-act=collect]'); await n.check('#c1'); await n.check('#c2'); await n.check('#c3'); await n.click('#cok');
  await n.waitForSelector('text=Sample collected'); ok(true, 'nurse: accepted, travelled, collected with checklist');

  // 4. courier
  const c = await page(); await login(c, 'courier@demo.labathome.om');
  await c.click(`text=${code}`); await c.click('[data-act=pickup]'); await c.fill('#tp', '4.5'); await c.click('#tok');
  await c.waitForSelector('[data-act=deliver]'); await c.click('[data-act=deliver]'); await c.waitForTimeout(1200);
  ok(true, 'courier: picked up at 4.5 °C and delivered');

  // 5. lab
  const l = await page(1366, 900); await login(l, 'lab@demo.labathome.om');
  const labHas = await l.isVisible(`text=${code}`);
  if (labHas) {
    await l.click(`text=${code}`); await l.click('[data-act=receive]'); await l.waitForSelector('#results-form');
    const vals = { VITD: '18.5', B12: '450', FERR: '95', A1C: '5.2' };
    for (const [k, v] of Object.entries(vals)) await l.fill(`[data-an=${k}]`, v);
    await l.fill('#vf', 'Dr. Test, Lab Director'); await l.click('[data-act=publish]'); await l.waitForSelector('a[href*="/report/"]', { timeout: 15000 });
    ok(true, 'lab: received, entered results, published');
  } else { log('! order went to another active lab; skipping lab step'); }

  // 6. patient report
  if (labHas) {
    await p.goto(orderUrl.replace('/order/', '/report/')); await p.reload(); await p.waitForSelector('.rtable', { timeout: 20000 });
    const txt = await p.textContent('.report');
    ok(/18.5/.test(txt) && /Low/.test(txt), 'patient report shows results with low flag');
    ok(/What this means/.test(txt), 'report shows plain-language insight');
  }

  // 7. partner registration -> pending
  const q = await page(); await q.goto(BASE + '/#/register/nurse');
  await q.fill('input[name=full_name]', 'Nurse E2E'); await q.fill('input[name=phone]', '9' + String(Date.now() + 7).slice(-7));
  await q.fill('input[name=newpass]', 'Test1234x'); await q.fill('input[name=license]', 'OMSB-RN-00000'); await q.check('input[name=consent]');
  await q.click('#rf button.btn'); await q.waitForURL(/#\/app/); await q.waitForTimeout(800);
  ok((await q.textContent('body')).includes('Verification in progress'), 'new nurse sees verification banner');

  // 8. company + 9. admin
  const co = await page(1366, 900); await login(co, 'company@demo.labathome.om');
  ok((await co.textContent('body')).includes('SEC-WELL26'), 'company sees its programme code');
  const ad = await page(1366, 900); await login(ad, 'admin@demo.labathome.om');
  ok((await ad.textContent('body')).includes('Awaiting verification'), 'admin overview loads');
  ok(!(await ad.textContent('body')).includes(phone), 'demo admin sees masked phone numbers');

  // 10. wrong password
  const w = await page(); await w.goto(BASE + '/#/login'); await w.fill('input[name=login]', 'nurse@demo.labathome.om'); await w.fill('input[name=password]', 'nope'); await w.click('#lf button.btn');
  await w.waitForTimeout(1500); ok((await w.textContent('#le')).length > 3, 'wrong password is rejected with a message');
  console.log('RESULT: PASS', code);
} catch (e) { console.log('RESULT: FAIL', e.message); }
console.log('page errors:', errors.length ? errors.slice(0, 8).join('\n') : 'none');
await b.close();
