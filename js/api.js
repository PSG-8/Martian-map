/* iLab@Home – API client. Every call goes to a secured Postgres function. */
(function(){
const URL = 'https://ufykiqxsegyuyablrjsq.supabase.co/rest/v1/rpc/';
const KEY = 'sb_publishable_rVQ1jmPovakb-FMIgB1pUQ_BAoJlXMv';
class ApiError extends Error { constructor(code){ super(code); this.code = code; } }
/* reads are safe to repeat: they get one quick retry. Every call has a time limit, so a weak phone signal
   can never leave a screen waiting for ever (that used to block every tap after it). */
const READS = /^(catalog|auth_me|order_get|orders_list|my_stats|programs_mine|program_lookup|notif_list|partners_public|nurse_profile|fleet_overview|admin_[a-z_]*s|admin_overview|admin_settings|kit_mine|nurses_today|support_mine|consult_list|consult_get|doctors_list|business_public)$/;
async function send(fn, args, ms){
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), ms) : null;
  try { return await fetch(URL + fn, { method:'POST', headers:{ 'apikey':KEY, 'Authorization':'Bearer '+KEY, 'Content-Type':'application/json', 'Accept':'application/json' }, body: JSON.stringify(args||{}), signal: ctl ? ctl.signal : undefined }); }
  finally { if (timer) clearTimeout(timer); }
}
async function rpc(fn, args){
  let res; const read = READS.test(fn);
  try { res = await send(fn, args, read ? 9000 : 20000); }
  catch(e){
    if (!read) throw new ApiError(e && e.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK');
    try { await new Promise(r => setTimeout(r, 600)); res = await send(fn, args, 12000); } catch(e2){ throw new ApiError(e2 && e2.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK'); }
  }
  const txt = await res.text();
  let data = null; try { data = txt ? JSON.parse(txt) : null; } catch(e){ data = txt; }
  if (!res.ok) {
    const msg = (data && (data.message || data.hint)) || '';
    const code = /^[A-Z_]+$/.test(msg) ? msg : 'GENERIC';
    if (code === 'AUTH_REQUIRED') { localStorage.removeItem('lah_token'); }
    throw new ApiError(code);
  }
  return data;
}
const tok = () => localStorage.getItem('lah_token');
window.API = {
  ApiError,
  catalog: () => rpc('catalog'),
  register: (p) => rpc('auth_register', { p }),
  login: (l, pw) => rpc('auth_login', { p_login:l, p_password:pw }),
  me: () => rpc('auth_me', { p_token: tok() }),
  logout: () => rpc('auth_logout', { p_token: tok() }).catch(()=>{}),
  profile: (p) => rpc('profile_update', { p_token: tok(), p }),
  password: (o, n) => rpc('password_change', { p_token: tok(), p_old:o, p_new:n }),
  orderCreate: (p) => rpc('order_create', { p_token: tok(), p }),
  order: (id) => rpc('order_get', { p_token: tok(), p_id:id }),
  action: (id, a, p) => rpc('order_action', { p_token: tok(), p_id:id, p_action:a, p: p||{} }),
  orders: (scope) => rpc('orders_list', { p_token: tok(), p_scope: scope||'mine' }),
  stats: () => rpc('my_stats', { p_token: tok() }),
  programCreate: (p) => rpc('program_create', { p_token: tok(), p }),
  programs: () => rpc('programs_mine', { p_token: tok() }),
  programLookup: (c) => rpc('program_lookup', { p_token: tok(), p_code:c }),
  notifs: () => rpc('notif_list', { p_token: tok() }),
  notifsRead: () => rpc('notif_read', { p_token: tok() }),
  waitlist: (n, ph, w) => rpc('waitlist_join', { p_name:n, p_phone:ph, p_wilayat:w }),
  adminOverview: () => rpc('admin_overview', { p_token: tok() }),
  adminUsers: (role, status) => rpc('admin_users', { p_token: tok(), p_role: role||null, p_status: status||null }),
  adminSetStatus: (id, s) => rpc('admin_set_status', { p_token: tok(), p_user:id, p_status:s }),
  adminTest: (id, price, active) => rpc('admin_test_update', { p_token: tok(), p_id:id, p_price:price, p_active:active }),
  adminNurses: (w, g) => rpc('admin_nurses', { p_token: tok(), p_wilayat:w, p_gender: g||null }),
  nursesToday: (w, g) => rpc('nurses_today', { p_token: tok(), p_wilayat:w, p_gender:g }),
  supportCreate: (p) => rpc('support_create', { p_token: tok() || '', p }),
  supportMine: () => rpc('support_mine', { p_token: tok() }),
  adminTickets: () => rpc('admin_tickets', { p_token: tok() }),
  adminReply: (id, r) => rpc('admin_ticket_reply', { p_token: tok(), p_id:id, p_reply:r }),
  partnersPublic: () => rpc('partners_public'),
  nurseProfile: (id) => rpc('nurse_profile', { p_token: tok(), p_id:id }),
  fleet: () => rpc('fleet_overview', { p_token: tok() }),
  adminUserCreate: (p) => rpc('admin_user_create', { p_token: tok(), p }),
  adminUserUpdate: (id, p) => rpc('admin_user_update', { p_token: tok(), p_user:id, p }),
  adminUserDelete: (id) => rpc('admin_user_delete', { p_token: tok(), p_user:id }),
  adminPayments: () => rpc('admin_payments', { p_token: tok() }),
  adminRefund: (id) => rpc('admin_refund', { p_token: tok(), p_id:id }),
  adminContractSave: (p) => rpc('admin_contract_save', { p_token: tok(), p }),
  adminSettings: () => rpc('admin_settings', { p_token: tok() }),
  adminSetting: (k, v) => rpc('admin_setting_set', { p_token: tok(), p_key:k, p_value:v }),
  pushSubscribe: (sub, lang) => rpc('push_subscribe', { p_token: tok(), p_sub: sub, p_lang: lang, p_ua: navigator.userAgent }),
  pushUnsubscribe: (ep) => rpc('push_unsubscribe', { p_token: tok(), p_endpoint: ep }),
  pushTest: () => rpc('push_test', { p_token: tok() }),
  emailSet: (e) => rpc('email_set', { p_token: tok(), p_email: e }),
  emailConfirm: (c) => rpc('email_verify_confirm', { p_code: c }),
  emailSendVerify: async () => { let r; try { r = await fetch('api/mail', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ action:'verify', token: tok() }) }); } catch(e) { throw new ApiError('NETWORK'); } const j = await r.json().catch(() => ({})); if (!r.ok) throw new ApiError(j.error || 'GENERIC'); return j; },
  doctorNote: (id, note, plan) => rpc('doctor_note_save', { p_token: tok(), p_id:id, p_note:note, p_plan:plan||[] }),
  kitMine: () => rpc('kit_mine', { p_token: tok() }),
  kitRequest: (items, note) => rpc('kit_request', { p_token: tok(), p_items:items, p_note:note||null }),
  adminKit: () => rpc('admin_kit', { p_token: tok() }),
  adminKitFill: (req, nurse) => rpc('admin_kit_fill', { p_token: tok(), p_request:req, p_nurse:nurse }),
  resetConfirm: (c, pw) => rpc('password_reset_confirm', { p_code:c, p_new:pw }),
  resetRequest: async (login) => { let r; try { r = await fetch('api/mail', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ action:'reset', login }) }); } catch(e) { throw new ApiError('NETWORK'); } const j = await r.json().catch(() => ({})); if (!r.ok) throw new ApiError(j.error || 'GENERIC'); return j; },
  demoAdvance: (id) => rpc('demo_advance', { p_token: tok(), p_id:id }),
  business: () => rpc('business_public'),
  doctors: (k) => rpc('doctors_list', { p_kind: k || 'pre' }),
  consultCreate: (p) => rpc('consult_create', { p_token: tok(), p }),
  consults: () => rpc('consult_list', { p_token: tok() }),
  consult: (id) => rpc('consult_get', { p_token: tok(), p_id: id }),
  consultAction: (id, a, p) => rpc('consult_action', { p_token: tok(), p_id: id, p_action: a, p: p || {} }),
  setToken: (t) => t ? localStorage.setItem('lah_token', t) : localStorage.removeItem('lah_token'),
  hasToken: () => !!tok()
};
})();
