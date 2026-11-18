const V = 'lah-v6';
const CORE = ['./', 'index.html', 'css/app.css?v=6', 'js/i18n.js?v=6', 'js/art.js?v=6', 'js/api.js?v=6', 'js/app.js?v=6', 'icons/icon.svg', 'manifest.webmanifest'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; const u = new URL(r.url);
  if (r.method !== 'GET' || u.hostname.endsWith('supabase.co') || u.hostname.includes('tile.openstreetmap')) return;
  if (r.mode === 'navigate') { e.respondWith(fetch(r).catch(() => caches.match('index.html'))); return; }
  e.respondWith(caches.match(r).then(hit => hit || fetch(r).then(res => { if (res.ok && (u.origin === location.origin || u.hostname.includes('unpkg') || u.hostname.includes('gstatic') || u.hostname.includes('googleapis'))) { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); } return res; })));
});
