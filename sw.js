const V = 'lah-v41';
const CORE = ['./', 'index.html', 'css/app.css?v=41', 'js/i18n.js?v=41', 'js/art.js?v=41', 'js/api.js?v=41', 'js/qr.js?v=41', 'js/pdf.js?v=41', 'js/guide.js?v=41', 'js/motion.js?v=41', 'js/app.js?v=41', 'icons/icon.svg', 'manifest.webmanifest', "img/hero/h0d.webp?v=41", "img/hero/h0m.webp?v=41"];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; const u = new URL(r.url);
  if (r.method !== 'GET' || r.headers.has('range') || u.pathname.includes('/media/') || u.pathname.endsWith('.mp4') || u.pathname.includes('/api/') || u.hostname.endsWith('supabase.co') || u.hostname.includes('tile.openstreetmap')) return;
  /* pages and anything without a version number: always try the network first, so every change shows up at once */
  if (r.mode === 'navigate') { e.respondWith(fetch(r.url, { cache: 'no-store', credentials: 'same-origin' }).catch(() => caches.match('index.html'))); return; }
  const versioned = u.search.includes('v=') || u.hostname.includes('unpkg') || u.hostname.includes('gstatic');
  if (!versioned && u.origin === location.origin) { e.respondWith(fetch(r, { cache: 'no-cache' }).then(res => { if (res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); } return res; }).catch(() => caches.match(r))); return; }
  e.respondWith(caches.match(r).then(hit => hit || fetch(r).then(res => { if (res.ok && (u.origin === location.origin || u.hostname.includes('unpkg') || u.hostname.includes('gstatic') || u.hostname.includes('googleapis'))) { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); } return res; })));
});
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: 'iLab@home', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'iLab@home', { body: d.body || '', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: d.tag || undefined, renotify: !!d.tag, dir: d.dir || 'auto', lang: d.lang || 'ar', data: { url: d.url || './#/app' }, vibrate: [120, 60, 120] }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close(); const url = new URL((e.notification.data && e.notification.data.url) || './#/app', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => { for (const w of ws) { if (w.url.startsWith(self.registration.scope) && 'focus' in w) { w.navigate(url).catch(() => {}); return w.focus(); } } return self.clients.openWindow(url); }));
});
