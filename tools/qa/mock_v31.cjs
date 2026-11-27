// v31 additions to the local mock: self-collection kits, loyalty, coupons, privacy, sample chain, safety, share links, trends, camps.
const base = require('./mock_v28.cjs');
const now = Date.now(); const iso = m => new Date(now - m * 60000).toISOString(); const day = d => new Date(now + d * 864e5 + 4 * 3600e3).toISOString().slice(0, 10);
const role = b => ((b && b.p_token) || '').replace('tok-', '') || 'patient';
const T = (id, cat, en, ar, price, tube, an, col) => ({ id, cat, name_en: en, name_ar: ar, desc_en: en + ' – short description for preview.', desc_ar: 'وصف مختصر ' + ar, price: price.toFixed(3), fasting_hours: 0, tube, tat_hours: 24, analytes: an, active: true, collection: col || 'self' });
const newTests = [
  T('urine', 'selfkit', 'Urine Analysis (routine)', 'تحليل البول الروتيني', 2, 'Urine cup', [{ c: 'UPH', n: 'pH', na: 'الحموضة', u: '', lo: 4.5, hi: 8 }, { c: 'UWBC', n: 'Pus cells', na: 'خلايا الصديد', u: '/HPF', hi: 5 }]),
  T('fit', 'selfkit', 'Stool Occult Blood (FIT)', 'الدم الخفي في البراز (FIT)', 6, 'Stool kit', [{ c: 'FIT', n: 'Faecal haemoglobin', na: 'هيموجلوبين البراز', u: 'ng/mL', hi: 99 }]),
  T('stoolop', 'selfkit', 'Stool Analysis (parasites)', 'تحليل البراز (الطفيليات)', 3, 'Stool kit', [{ c: 'OVA', n: 'Ova & parasites', na: 'بيوض وطفيليات', u: '/slide', hi: 0 }]),
  T('hpvself', 'selfkit', 'HPV Self-Swab (women 30–65)', 'مسحة HPV الذاتية', 18, 'Self-swab kit', [{ c: 'HPV', n: 'HPV DNA', na: 'فيروس HPV', u: 'S/CO', hi: 0.99 }]),
  T('igra', 'expat', 'TB Blood Test (IGRA)', 'فحص السل الكامن (IGRA)', 22, 'QuantiFERON tubes', [{ c: 'IGRA', n: 'Interferon-gamma', na: 'إنترفيرون غاما', u: 'IU/mL', hi: 0.34 }], 'nurse')
];
const newPk = [
  { id: 'selfkit', name_en: 'Home Self-Kit (no nurse)', name_ar: 'عدة الفحص الذاتي (بدون ممرض)', desc_en: 'Urine + bowel screening + parasites.', desc_ar: 'بول + قولون + طفيليات.', test_ids: ['urine', 'fit', 'stoolop'], price: '9.500', badge: 'new', active: true },
  { id: 'expat_pre', name_en: 'Expat Pre-Check (not the official certificate)', name_ar: 'فحص مبدئي للعمالة (مو الشهادة الرسمية)', desc_en: 'Know early.', desc_ar: 'اعرف مبكراً.', test_ids: ['cbc', 'urine', 'stoolop', 'igra'], price: '38.000', badge: 'new', active: true },
  { id: 'housemaid', name_en: 'Domestic Worker Home Check', name_ar: 'فحص العاملة المنزلية في البيت', desc_en: 'Yearly check at home.', desc_ar: 'فحص سنوي في البيت.', test_ids: ['cbc', 'urine', 'stoolop'], price: '19.000', badge: 'new', active: true }
];
const scansFor = (o) => { const ix = ['collected', 'in_transit', 'at_lab', 'processing', 'completed'].indexOf(o.status); if (ix < 0) return []; const s = [{ step: 'collected', at: iso(240), role: 'nurse' }];
  if (ix >= 1) s.push({ step: 'pickup', at: iso(200), temp: 4.6, role: 'courier' }); if (ix >= 1) s.push({ step: 'check', at: iso(170), temp: 5.1, role: 'courier' });
  if (ix >= 2) s.push({ step: 'handover', at: iso(140), role: 'courier' }); if (ix >= 3) s.push({ step: 'lab_received', at: iso(130), role: 'lab' }); return s; };
let kitStatus = 'arrived';
const kitOrder = () => { const o = base.handle('order_get', { p_id: 'o2' }); const k = JSON.parse(JSON.stringify(o));
  return Object.assign(k, { id: 'k1', code: 'LAH-10261', mode: 'self', status: kitStatus, home_fee: '2.000', nurse: null, nurse_id: null, courier_id: 'u3',
    courier: { id: 'u3', name: 'Salim Al Hinai', vehicle: 'Van' }, tests: newTests.slice(0, 3), test_ids: ['urine', 'fit', 'stoolop'],
    events: ['booked', 'assigned', 'on_the_way', 'arrived'].map((s, i) => ({ status: s, at: iso(300 - i * 40), note: i ? 'Kit' : null })), scans: [] }); };
const decorate = (o, b) => o && Object.assign({}, o, { mode: o.mode || 'nurse', nurse_id: o.nurse_id || (o.nurse && o.nurse.id) || null, courier_id: o.courier_id || (o.courier && o.courier.id) || null, scans: o.scans || scansFor(o) });
let coupons = [{ code: 'WELCOME10', kind: 'pct', value: 10, max_uses: 5000, used: 41, min_sub: 0, first_order: true, expires_on: null, active: true }, { code: 'ILAB2', kind: 'fixed', value: 2, max_uses: 2000, used: 12, min_sub: 10, first_order: false, expires_on: '2027-06-30', active: true }];
const X = {
  catalog: () => { const c = base.handle('catalog'); return Object.assign({}, c, { tests: c.tests.map(x => Object.assign({ collection: 'nurse' }, x)).concat(newTests), packages: c.packages.concat(newPk), self_fee: '2.000', stamps_per_free: 5, ramadan: { from: day(-1), to: day(20), slots: ['20:30', '21:30', '22:30'] } }); },
  orders_list: b => { const l = (base.handle('orders_list', b) || []).map(o => Object.assign({ mode: 'nurse' }, o)); if (['patient', 'courier'].includes(role(b))) l.unshift({ id: 'k1', code: 'LAH-10261', status: kitStatus, mode: 'self', slot_date: day(0), slot_time: '17:00', wilayat: 'Ibra', total: '13.000', items: [], tests_count: 3, person: 'Salim Al Rashdi', created_at: iso(300), updated_at: iso(30) }); return l; },
  order_get: b => b.p_id === 'k1' ? kitOrder() : decorate(base.handle('order_get', b), b),
  order_action: b => { if (b.p_id === 'k1') { if (b.p_action === 'self_collected') kitStatus = 'collected'; return kitOrder(); } return decorate(base.handle('order_action', b), b); },
  demo_advance: b => decorate(base.handle('demo_advance', b), b),
  order_create: b => Object.assign(decorate(base.handle('order_create', b), b), { disc: b.p && b.p.coupon ? { coupon: { code: b.p.coupon, amount: 2 } } : {} }),
  my_loyalty: () => ({ per: 5, stamps: 3, orders: 3, bonus: 0, free_next: false, free_used: 0, ref_code: 'ILDEMO7', referred: 2, referred_by: false, can_apply_ref: false, reward: '1.000',
    history: [{ code: 'LAH-10255', at: iso(2000), status: 'completed', free: false }, { code: 'LAH-10254', at: iso(9000), status: 'completed', free: false }, { code: 'LAH-10241', at: iso(30000), status: 'completed', free: false }] }),
  coupon_check: b => { const c = coupons.find(x => x.code === String(b.p_code || '').toUpperCase()); if (!c) throw new Error('BAD_COUPON'); return { code: c.code, kind: c.kind, value: c.value, amount: c.kind === 'pct' ? +(b.p_sub * c.value / 100).toFixed(3) : c.value }; },
  referral_apply: () => ({ ok: true, reward: '1.000' }),
  my_privacy: b => ({ consent_at: iso(90000), views: role(b) === 'patient' ? [{ code: 'LAH-10241', role: 'lab', who: 'Al Sharqiyah Diagnostics Lab', at: iso(1500) }, { code: 'LAH-10254', role: 'doctor', who: 'Dr. Aisha Al Balushi', at: iso(800) }, { code: 'LAH-10241', role: 'share', who: null, at: iso(200) }] : [],
    shares: role(b) === 'patient' ? [{ token: 'tok123', code: 'LAH-10241', expires_at: new Date(now + 2 * 864e5).toISOString(), views: 1, revoked: false }] : [], requests: [{ id: 1, kind: 'export', status: 'done', reply: 'Sent to your email.', created_at: iso(5000) }] }),
  privacy_request: b => ({ id: 2, kind: b.p_kind, status: 'open' }), my_data_export: () => ({ profile: { name: 'Salim Al Rashdi' }, orders: [] }),
  share_create: () => ({ token: 'tok123', expires_at: new Date(now + 3 * 864e5).toISOString() }), share_revoke: () => ({ ok: true }),
  share_get: () => { const o = base.handle('order_get', { p_id: 'o1' }); return { code: o.code, name: 'Salim', age: 38, sex: 'male', published_at: iso(1500), verified_by: 'Dr. Lab Director', lab: 'Al Sharqiyah Diagnostics Lab', licence: 'MOH-LAB-0192', results: o.results, expires_at: new Date(now + 2 * 864e5).toISOString(), tests: o.tests, doctor_note: null }; },
  my_trends: () => ({ VITD: [{ at: iso(400000), v: 16.2, f: 'L' }, { at: iso(200000), v: 21.4, f: 'L' }, { at: iso(1500), v: 24.6, f: 'L' }], B12: [{ at: iso(200000), v: 420, f: 'N' }, { at: iso(1500), v: 667, f: 'N' }] }),
  sample_log: () => [{ step: 'collected', at: iso(60) }, { step: 'check', at: iso(1), temp: 4.4 }],
  sos_raise: () => ({ id: 9, at: new Date().toISOString() }), incident_report: () => ({ id: 4 }),
  admin_safety: () => ({ sos: [{ id: 9, who: 'Fatima Al Harthy', role: 'nurse', phone: null, lat: 22.69, lng: 58.53, note: null, at: iso(12), resolved_at: null, order: 'LAH-10242' }], incidents: [{ id: 4, who: 'Fatima Al Harthy', role: 'nurse', kind: 'needle', note: 'Small needle-stick, washed and reported.', status: 'open', at: iso(300), order: 'LAH-10242' }] }),
  admin_safety_close: () => X.admin_safety(),
  /* v56 security */
  admin_security: () => ({ failed_24h: 2, sessions_active: 14, my_sessions: 2, failed: [{ login: 'adm***', n: 3, last: iso(40) }, { login: '968***', n: 1, last: iso(400) }],
    audit: [{ at: iso(5), action: 'user_changed', actor: 'Bilarab Al Musallami', target: 'Dr. Huda Al Mahrouqi', detail: { role: ['doctor', 'staff'], password: 'changed' } }, { at: iso(60), action: 'user_created', actor: 'Bilarab Al Musallami', target: 'Salim Al Hinai', detail: { role: 'nurse', demo: false } },
      { at: iso(90), action: 'setting_update', actor: 'Bilarab Al Musallami', target: '', detail: { key: 'home_fee' } }, { at: iso(200), action: 'logout_all_devices', actor: 'Bilarab Al Musallami', target: 'Bilarab Al Musallami', detail: {} }] }),
  auth_logout_all: () => null,
  email_set: b => { const u = base.handle('auth_me', { p_token: b.p_token }).user; if (u.role !== 'patient' && !b.p_password) throw Object.assign(new Error('REAUTH_REQUIRED'), { code: 'REAUTH_REQUIRED' }); return Object.assign({}, u, { email: b.p_email, email_verified: false }); },
  admin_privacy: () => [{ id: 2, kind: 'delete', note: 'Please remove my account', status: 'open', created_at: iso(100), user: 'Demo patient' }, { id: 1, kind: 'export', status: 'done', reply: 'Sent', created_at: iso(5000), user: 'Demo patient' }],
  admin_privacy_done: () => X.admin_privacy(),
  admin_coupons: () => coupons, admin_coupon_save: b => { coupons.unshift(Object.assign({ used: 0 }, b.p)); return coupons; },
  camps_mine: () => [{ id: 'c1', code: 'CMP-1001', package_id: 'expat_pre', site: 'Camp 4, Ibra industrial area', wilayat: 'Ibra', visit_date: day(5), status: 'scheduled', workers: [{ n: 'Ram Kumar', id: '4567', r: 'fit' }, { n: 'Ali Khan', id: '4321', r: null }, { n: 'Joseph D.', id: '8810', r: 'retest' }], created_at: iso(2000) }],
  camp_create: () => ({ id: 'c2', code: 'CMP-1002' }),
  admin_camps: () => [{ id: 'c1', code: 'CMP-1001', company: 'Sharqiyah Energy Co.', package_id: 'expat_pre', site: 'Camp 4, Ibra industrial area', wilayat: 'Ibra', visit_date: day(5), status: 'scheduled', workers_n: 3, workers: [{ n: 'Ram Kumar', id: 'P1234567', nat: 'IN' }, { n: 'Ali Khan', id: 'P7654321', nat: 'PK' }, { n: 'Joseph D.', id: 'P9918810', nat: 'PH' }], results: { 0: 'fit', 2: 'retest' } }],
  camp_update: () => X.admin_camps()
};
module.exports = { handle: (fn, body) => X[fn] ? X[fn](body || {}) : base.handle(fn, body) };
