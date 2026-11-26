// v28 additions to the local mock: consultations, money settings, premarital tests.
const base = require('./mock.cjs');
const now = Date.now(); const today = new Date(now + 4 * 3600e3).toISOString().slice(0, 10);
const add = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const docs = {
  pre: [{ id: 'd1', name: 'Dr. Aisha Al Balushi', gender: 'female', specialty: 'Family Medicine', specialty_ar: 'طب الأسرة', license: 'OMSB-MD-31207', years: 12, rating: 4.9, bio: 'Family doctor. Women and children.', bio_ar: 'طبيبة أسرة.', taken: [add(today, 1) + ' 17:00'] },
        { id: 'd2', name: 'Dr. Hilal Al Harthy', gender: 'male', specialty: 'Family Medicine', specialty_ar: 'طب الأسرة', license: 'OMSB-MD-28844', years: 14, rating: 4.9, bio: 'Diabetes and blood pressure.', bio_ar: 'السكري والضغط.', taken: [] }],
  dental: [{ id: 'd3', name: 'Dr. Rahma Al Shukaili', gender: 'female', specialty: 'Dentistry', specialty_ar: 'طب الأسنان', license: 'OMSB-DN-17320', years: 9, rating: 4.9, bio: 'Family dentist.', bio_ar: 'طبيبة أسنان.', taken: [] },
           { id: 'd4', name: 'Dr. Talal Al Riyami', gender: 'male', specialty: 'Dentistry', specialty_ar: 'طب الأسنان', license: 'OMSB-DN-15102', years: 11, rating: 4.8, bio: 'Adults and seniors.', bio_ar: 'للكبار.', taken: [] }] };
const all = [...docs.pre, ...docs.dental];
const consults = [];
const cj = c => ({ ...c, doctor: all.find(d => d.id === c.doctor_id), patient: { name: 'Salim Al Rashdi', gender: 'male', dob: '1988-04-12', phone: '+96890000001' }, join: ['video', 'voice'].includes(c.mode) && ['booked', 'live'].includes(c.status) ? 'https://meet.jit.si/iLabAtHome-test' : null, room: c.mode !== 'home' && ['booked','live'].includes(c.status) ? 'iLabAtHome-test' : null });
const msgs = [];
const extra = {
  consult_msgs: b => msgs.filter(x => x.id > (b.p_after || 0)),
  consult_send: b => { const x = { id: msgs.length + 1, mine: true, who: 'patient', body: b.p_body, at: new Date().toISOString() }; msgs.push(x); return x; },
  business_public: () => ({ home_fee: '5.000', nurse_fee: '3.000', courier_fee: '1.000', kit_cost: '0.500', lab_share: '0.65', pay_fee_pct: '0.025', nurse_bonus: [0, 0.25, 0.5, 0.75], consult_fee: '4.000', consult_post_fee: '3.000', consult_doctor_share: '0.75', dental_home_fee: '12.000', dental_home_share: '0.65', consult_slots: ['16:00', '16:20', '16:40', '17:00', '17:20', '20:40'] }),
  doctors_list: b => /dental/.test(b.p_kind) ? docs.dental : docs.pre,
  consult_create: b => { const p = b.p; const c = { id: 'c' + (consults.length + 1), code: 'CON-50' + (10 + consults.length), kind: p.kind, mode: p.kind === 'dental_home' ? 'home' : p.mode, slot_date: p.slot_date, slot_time: p.slot_time, reason: p.reason, doctor_id: p.doctor_id, fee: p.kind === 'dental_home' ? '12.000' : '4.000', status: 'booked', created_at: new Date().toISOString() }; consults.push(c); return cj(c); },
  consult_list: () => consults.map(cj),
  consult_get: b => { const c = consults.find(x => x.id === b.p_id); if (!c) throw new Error('NOT_FOUND'); return cj(c); },
  consult_action: b => { const c = consults.find(x => x.id === b.p_id); if (b.p_action === 'finish') { c.status = 'done'; c.note = { note: b.p.note, tests: b.p.tests, packages: b.p.packages, by: 'Dr. Hilal Al Harthy', at: new Date().toISOString() }; } else if (b.p_action === 'cancel') c.status = 'cancelled'; else if (b.p_action === 'start') c.status = 'live'; else if (b.p_action === 'rate') c.rating = b.p.rating; return cj(c); }
};
module.exports = { handle: (fn, body) => extra[fn] ? extra[fn](body || {}) : base.handle(fn, body), consults };
