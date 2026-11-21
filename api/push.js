// Sends Web Push notifications to a user's devices. Called by the database when a notification is created.
const webpush = require('web-push');
const SB = 'https://ufykiqxsegyuyablrjsq.supabase.co/rest/v1/rpc/';
const SB_KEY = 'sb_publishable_rVQ1jmPovakb-FMIgB1pUQ_BAoJlXMv';
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  if (!b || !process.env.PUSH_SECRET || b.secret !== process.env.PUSH_SECRET) return res.status(403).json({ error: 'FORBIDDEN' });
  webpush.setVapidDetails('mailto:support@labathome.om', process.env.VAPID_PUBLIC, process.env.VAPID_PRIVATE);
  const n = b.n || {}; let sent = 0, gone = 0;
  await Promise.all((b.subs || []).map(async s => {
    const ar = s.lang === 'ar';
    const payload = JSON.stringify({ title: (ar ? n.title_ar : n.title_en) || n.title_en || 'iLab@Home', body: (ar ? n.body_ar : n.body_en) || '',
      url: n.order_id ? './#/app/order/' + n.order_id : './#/app/notifs', tag: n.order_id || n.kind || undefined, dir: ar ? 'rtl' : 'ltr', lang: ar ? 'ar' : 'en' });
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload, { TTL: 86400, urgency: 'high' }); sent++; }
    catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) { gone++; await fetch(SB + 'push_gone', { method: 'POST', headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_secret: b.secret, p_endpoint: s.endpoint }) }).catch(() => {}); }
      else console.error('push error', e.statusCode, (e.body || e.message || '').toString().slice(0, 200));
    }
  }));
  return res.status(200).json({ sent, gone });
};
