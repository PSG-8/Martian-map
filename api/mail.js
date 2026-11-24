// Sends iLab@home emails: address verification and request updates.
// Mail is sent through SMTP (Gmail by default) using environment variables:
//   MAIL_USER, MAIL_PASS (Gmail address + 16-letter App Password); optional MAIL_HOST, MAIL_PORT, MAIL_FROM.
const nodemailer = require('nodemailer');
const SB = 'https://ufykiqxsegyuyablrjsq.supabase.co/rest/v1/rpc/';
const SB_KEY = 'sb_publishable_rVQ1jmPovakb-FMIgB1pUQ_BAoJlXMv';
const SITE = 'https://labathome-oman.vercel.app/';
const hits = new Map();
async function rpc(fn, args) {
  const r = await fetch(SB + fn, { method: 'POST', headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(args || {}) });
  const t = await r.text(); let d; try { d = JSON.parse(t); } catch (e) { d = t; }
  if (!r.ok) { const e = new Error((d && d.message) || 'RPC'); e.code = /^[A-Z_]+$/.test(e.message) ? e.message : 'GENERIC'; throw e; }
  return d;
}
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function shell(inner) {
  return `<!doctype html><html><body style="margin:0;background:#f1f5fb;font-family:Segoe UI,Tahoma,Arial,sans-serif;color:#0d1628">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:28px 12px"><tr><td align="center">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 6px 24px rgba(13,22,40,.08)">
  <tr><td style="background:#0d1628;padding:22px 26px"><span style="font-size:26px;font-weight:800;color:#fff;letter-spacing:-.5px"><span style="color:#60a5fa">i</span>Lab<span style="color:#60a5fa">@</span>Home</span>
  <div style="color:#9fb3d9;font-size:13px;margin-top:4px">الفحص يوصلك · The test comes to you</div></td></tr>
  <tr><td style="padding:26px">${inner}</td></tr>
  <tr><td style="padding:16px 26px;background:#f6f9fe;color:#6b7a94;font-size:12px;line-height:1.6">iLab@home · North Al Sharqiyah, Oman<br>هذه رسالة تلقائية، لا ترد عليها. · This is an automatic message.</td></tr>
  </table></td></tr></table></body></html>`;
}
const btn = (href, label) => `<a href="${href}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;padding:13px 26px;border-radius:12px;font-size:15px">${label}</a>`;
function verifyMail(name, code) {
  const link = SITE + '#/verify/' + code;
  return { subject: 'تأكيد بريدك الإلكتروني · Verify your email – iLab@home', html: shell(`
    <div dir="rtl" style="text-align:right"><h2 style="margin:0 0 10px;font-size:20px">أهلاً ${esc(name)} 👋</h2>
    <p style="font-size:15px;line-height:1.8;margin:0 0 18px">شكراً لتسجيلك في آي لاب@هوم. اضغط الزر لتأكيد بريدك الإلكتروني، وبعدها توصلك تحديثات طلباتك ونتائجك على الإيميل.</p>
    <p style="margin:0 0 22px">${btn(link, 'تأكيد البريد الإلكتروني')}</p></div>
    <hr style="border:0;border-top:1px solid #e6ecf5;margin:8px 0 18px">
    <div dir="ltr"><p style="font-size:14px;line-height:1.7;margin:0 0 16px">Hi ${esc(name)}, please confirm your email address to receive request updates and results by email.</p>
    <p style="margin:0 0 16px">${btn(link, 'Verify email')}</p>
    <p style="font-size:12px;color:#6b7a94;margin:0">The link works for 48 hours. If you didn’t create an account, ignore this email.<br>الرابط صالح لمدة 48 ساعة. إذا لم تنشئ حساباً تجاهل هذه الرسالة.</p></div>`),
    text: `iLab@home – تأكيد البريد / Verify your email: ${link}` };
}
function notifyMail(name, n) {
  const link = SITE + (n.order_id ? '#/app/order/' + n.order_id : '#/app/notifs');
  return { subject: `${n.title_ar || ''} · ${n.title_en || ''}`.trim(), html: shell(`
    <div dir="rtl" style="text-align:right"><h2 style="margin:0 0 8px;font-size:19px">${esc(n.title_ar)}</h2><p style="font-size:15px;line-height:1.8;margin:0 0 18px">${esc(n.body_ar)}</p></div>
    <div dir="ltr" style="border-top:1px solid #e6ecf5;padding-top:14px"><h3 style="margin:0 0 6px;font-size:16px">${esc(n.title_en)}</h3><p style="font-size:14px;line-height:1.7;margin:0 0 18px">${esc(n.body_en)}</p></div>
    <p style="margin:6px 0 0;text-align:center">${btn(link, 'فتح الطلب · Open request')}</p>`),
    text: `${n.title_ar}\n${n.body_ar}\n\n${n.title_en}\n${n.body_en}\n\n${link}` };
}
function resetMail(name, code) {
  const link = SITE + '#/reset/' + code;
  return { subject: 'إعادة تعيين كلمة المرور · Reset your password – iLab@home', html: shell(`
    <div dir="rtl" style="text-align:right"><h2 style="margin:0 0 10px;font-size:20px">أهلاً ${esc(name)}</h2>
    <p style="font-size:15px;line-height:1.8;margin:0 0 18px">وصلنا طلب لتغيير كلمة المرور. اضغط الزر لتعيين كلمة مرور جديدة. الرابط صالح لمدة ساعة واحدة.</p>
    <p style="margin:0 0 22px">${btn(link, 'تعيين كلمة مرور جديدة')}</p></div>
    <hr style="border:0;border-top:1px solid #e6ecf5;margin:8px 0 18px">
    <div dir="ltr"><p style="font-size:14px;line-height:1.7;margin:0 0 16px">Hi ${esc(name)}, we received a request to reset your password. The link works for one hour.</p>
    <p style="margin:0 0 16px">${btn(link, 'Set a new password')}</p>
    <p style="font-size:12px;color:#6b7a93;margin:0">If you did not ask for this, you can ignore this email. Your password stays the same.</p></div>`),
    text: `Reset your iLab@home password (valid 1 hour): ${link}` };
}
let tx = null;
function transport() {
  if (!process.env.MAIL_USER || !process.env.MAIL_PASS) return null;
  if (!tx) tx = nodemailer.createTransport({ host: process.env.MAIL_HOST || 'smtp.gmail.com', port: +(process.env.MAIL_PORT || 465), secure: (process.env.MAIL_PORT || '465') === '465',
    auth: { user: process.env.MAIL_USER, pass: String(process.env.MAIL_PASS).replace(/\s+/g, '') } });
  return tx;
}
async function send(to, m) {
  const t = transport(); if (!t) { const e = new Error('NO_MAIL'); e.code = 'NO_MAIL'; throw e; }
  await t.sendMail({ from: process.env.MAIL_FROM || `"iLab@home" <${process.env.MAIL_USER}>`, to, subject: m.subject, html: m.html, text: m.text });
}
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') return res.status(200).json({ ok: true, configured: !!transport() });
  if (req.method !== 'POST') return res.status(405).end();
  let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } } b = b || {};
  try {
    if (b.action === 'verify') {
      const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0] || 'x'; const now = Date.now();
      const h = (hits.get(ip) || []).filter(x => now - x < 600000); h.push(now); hits.set(ip, h); if (h.length > 8) return res.status(429).json({ error: 'TOO_MANY_ATTEMPTS' });
      if (!transport()) return res.status(503).json({ error: 'NO_MAIL' });
      const k = await rpc('email_token_create', { p_secret: process.env.PUSH_SECRET, p_session: String(b.token || '') });
      await send(k.email, verifyMail(k.name, k.code));
      return res.status(200).json({ ok: true, email: k.email });
    }
    if (b.action === 'reset') {
      const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0] || 'x'; const now = Date.now();
      const h = (hits.get('r' + ip) || []).filter(x => now - x < 600000); h.push(now); hits.set('r' + ip, h); if (h.length > 6) return res.status(429).json({ error: 'TOO_MANY_ATTEMPTS' });
      if (!transport()) return res.status(503).json({ error: 'NO_MAIL' });
      let k = null; try { k = await rpc('password_reset_create', { p_secret: process.env.PUSH_SECRET, p_login: String(b.login || '').slice(0, 120) }); } catch (e) { if (e.code !== 'TOO_SOON' && e.code !== 'TOO_MANY_ATTEMPTS') throw e; }
      if (k && k.email) await send(k.email, resetMail(k.name, k.code));
      return res.status(200).json({ ok: true });
    }
    if (b.action === 'notify') {
      if (!process.env.PUSH_SECRET || b.secret !== process.env.PUSH_SECRET) return res.status(403).json({ error: 'FORBIDDEN' });
      if (!transport()) return res.status(200).json({ skipped: 'NO_MAIL' });
      await send(b.to, notifyMail(b.name, b.n || {}));
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: 'BAD_INPUT' });
  } catch (e) {
    console.error('mail', e.code || '', e.message);
    return res.status(e.code && e.code !== 'GENERIC' ? 400 : 500).json({ error: e.code || 'GENERIC' });
  }
};
