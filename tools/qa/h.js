// Test harness: real site files from localhost, Supabase RPCs answered by the mock, Leaflet from node_modules.
const { chromium, devices } = require('playwright'); const fs = require('fs'); const path = require('path');
const mock = require('./mock_v31.cjs');
const LP = path.join(__dirname, 'node_modules/leaflet/dist/');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
exports.mock = mock;
exports.open = async (opts = {}) => {
  const b = opts.browser || await chromium.launch();
  const ctx = await b.newContext(opts.ctxOpts || (opts.desktop ? { viewport: { width: 1440, height: 900 } } : { ...devices[opts.device || 'iPhone 13'] }));
  const p = await ctx.newPage(); const errors = [];
  p.on('pageerror', e => errors.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED/.test(m.text())) errors.push('console: ' + m.text().slice(0, 200)); });
  await p.route('**/*', async r => {
    const u = new URL(r.request().url());
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return r.continue();
    if (u.hostname.endsWith('supabase.co') && opts.live) return r.continue();
    if (u.hostname.endsWith('supabase.co')) {
      if (u.pathname.includes('/storage/')) return r.abort();
      let body; try { body = mock.handle(u.pathname.split('/').pop(), JSON.parse(r.request().postData() || '{}')); }
      catch (e) { return r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'MOCK_' + e.message }) }); }
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body ?? null) });
    }
    if (u.hostname.includes('unpkg.com') && u.pathname.includes('leaflet')) { const f = LP + u.pathname.split('/dist/')[1]; if (!fs.existsSync(f)) return r.continue(); return r.fulfill({ status: 200, contentType: f.endsWith('.css') ? 'text/css' : f.endsWith('.png') ? 'image/png' : 'application/javascript', body: fs.readFileSync(f) }); }
    if (u.hostname.includes('tile.openstreetmap') || u.hostname.includes('basemaps') || u.hostname.includes('arcgis')) return r.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    return r.abort();
  });
  await p.addInitScript(([l, tk]) => { localStorage.setItem('lah_seen', '1'); localStorage.setItem('lah_lang', l); sessionStorage.setItem('lah_splash', '1'); if (tk) localStorage.setItem('lah_token', tk); }, [opts.lang || 'en', opts.role && !opts.live ? 'tok-' + opts.role : null]);
  return { b, ctx, p, errors };
};
exports.text = p => p.evaluate(() => document.querySelector('#app').innerText.replace(/\n+/g, ' | ').slice(0, 500));
