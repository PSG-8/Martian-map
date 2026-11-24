import { chromium } from 'playwright'; import { serve } from './serve.mjs';
const srv = await serve(8895); const b = await chromium.launch({ args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } }); p.on('pageerror', e => console.log('ERR', e.message)); p.on('console', m => { if (m.type() === 'error') console.log('CON', m.text()); });
await p.goto('http://127.0.0.1:8895/index.html'); await p.waitForFunction(() => window.ready, null, { timeout: 60000 });
for (const t of process.argv[2].split(',').map(Number)) { await p.evaluate(t => setT(t), t); await p.screenshot({ path: `st/${t}.jpg`, type: 'jpeg', quality: 70 }); }
await b.close(); srv.close();
