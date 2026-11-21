// Google sign-in: checks the Google ID token, then signs the person in (or creates a patient account).
// Needs GOOGLE_CLIENT_ID (OAuth 2.0 Web client ID from Google Cloud Console) and PUSH_SECRET.
const SB = 'https://ufykiqxsegyuyablrjsq.supabase.co/rest/v1/rpc/';
const SB_KEY = 'sb_publishable_rVQ1jmPovakb-FMIgB1pUQ_BAoJlXMv';
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const cid = process.env.GOOGLE_CLIENT_ID || '';
  if (req.method === 'GET') return res.status(200).json({ client_id: cid || null });
  if (req.method !== 'POST') return res.status(405).end();
  if (!cid) return res.status(503).json({ error: 'GENERIC' });
  let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } } b = b || {};
  const cred = String(b.credential || '');
  if (!cred || cred.length > 4096) return res.status(400).json({ error: 'BAD_INPUT' });
  try {
    const g = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(cred));
    const p = await g.json().catch(() => ({}));
    const okIss = p.iss === 'accounts.google.com' || p.iss === 'https://accounts.google.com';
    if (!g.ok || p.aud !== cid || !okIss || String(p.email_verified) !== 'true' || !p.email || +p.exp * 1000 < Date.now()) return res.status(401).json({ error: 'BAD_LOGIN' });
    const r = await fetch(SB + 'auth_google', { method: 'POST', headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_secret: process.env.PUSH_SECRET, p_email: p.email, p_name: p.name || '' }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { const m = (d && d.message) || ''; return res.status(400).json({ error: /^[A-Z_]+$/.test(m) ? m : 'GENERIC' }); }
    return res.status(200).json(d);
  } catch (e) { console.error('google', e.message); return res.status(500).json({ error: 'GENERIC' }); }
};
