// Local phone harness: serves the site, the mock API and real fonts (the live site loads them from Google).
import { chromium, devices } from 'playwright'; import fs from 'fs'; import path from 'path'; import { createRequire } from 'module';
const require = createRequire(import.meta.url); export const mock = require('./mock.cjs');
const GF = '/tmp/lv/gf/ofl/';
const fontCss = `@font-face{font-family:'Inter';font-weight:100 900;src:url(http://site.local/__f/inter/Inter[opsz,wght].ttf)}` + [['400','Regular'],['500','Medium'],['600','SemiBold'],['700','Bold']].map(([w,n]) => `@font-face{font-family:'IBM Plex Sans Arabic';font-weight:${w};src:url(http://site.local/__f/ibmplexsansarabic/IBMPlexSansArabic-${n}.ttf)}`).join('');
export async function launch(){ return chromium.launch({ executablePath:'/usr/bin/google-chrome', args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] }); }
export async function phone(b, { token, lang = 'en', w = 390, h = 844, errors = [], dpr = 2 } = {}){
  const ctx = await b.newContext({ viewport:{width:w,height:h}, deviceScaleFactor:dpr, isMobile:true, hasTouch:true, acceptDownloads:true, userAgent: devices['Pixel 7'].userAgent});
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type()==='error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text().slice(0,200)); });
  await p.route('**/*', async r => { const u = new URL(r.request().url());
    if (u.hostname==='site.local'){ if (u.pathname.startsWith('/__f/')) return r.fulfill({status:200,contentType:'font/ttf',body:fs.readFileSync(GF + decodeURIComponent(u.pathname.slice(5)))});
      let f=path.join((process.env.SITE_DIR || '/tmp/lab/site'),u.pathname); if(f.endsWith('/'))f+='index.html'; if (!fs.existsSync(f)) return r.fulfill({status:404,body:''}); const ext=path.extname(f); return r.fulfill({status:200,contentType:{'.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/json'}[ext]||'text/html',body:fs.readFileSync(f)});}
    if (u.hostname==='fonts.googleapis.com') return r.fulfill({status:200,contentType:'text/css',body:fontCss});
    if (u.hostname.endsWith('supabase.co')) { let body; try { body = mock.handle(u.pathname.split('/').pop(), JSON.parse(r.request().postData()||'{}')); } catch(e){ return r.fulfill({status:400,contentType:'application/json',body:JSON.stringify({message:'MOCK_'+e.message})}); } return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body ?? null)}); }
    if (u.hostname.includes('unpkg.com')) { const lp = '/tmp/lab/test/node_modules/leaflet/dist/' + u.pathname.split('/').pop(); if (fs.existsSync(lp)) return r.fulfill({status:200,contentType:lp.endsWith('.css')?'text/css':'application/javascript',body:fs.readFileSync(lp)}); }
    return r.abort(); });
  await p.addInitScript(([tk, l]) => { if (tk) localStorage.setItem('lah_token', tk); localStorage.setItem('lah_lang', l); localStorage.setItem('lah_seen','1'); }, [token, lang]);
  return p;
}
