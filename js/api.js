/* Lab@Home – API client. Every call goes to a secured Postgres function. */
(function(){
const URL = 'https://ufykiqxsegyuyablrjsq.supabase.co/rest/v1/rpc/';
const KEY = 'sb_publishable_rVQ1jmPovakb-FMIgB1pUQ_BAoJlXMv';
class ApiError extends Error { constructor(code){ super(code); this.code = code; } }
async function rpc(fn, args){
  let res;
  try {
    res = await fetch(URL + fn, { method:'POST', headers:{ 'apikey':KEY, 'Authorization':'Bearer '+KEY, 'Content-Type':'application/json', 'Accept':'application/json' }, body: JSON.stringify(args||{}) });
  } catch(e){ throw new ApiError('NETWORK'); }
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
  demoAdvance: (id) => rpc('demo_advance', { p_token: tok(), p_id:id }),
  setToken: (t) => t ? localStorage.setItem('lah_token', t) : localStorage.removeItem('lah_token'),
  hasToken: () => !!tok()
};
})();
