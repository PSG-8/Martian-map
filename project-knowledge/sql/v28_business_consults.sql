-- v28: corrected money split (planning figures) + online doctor / dentist consultations.

-- 1) money settings. Per home visit (5.000 OMR paid by the patient): nurse 3.000, courier 1.000,
--    kit & consumables 0.500, platform 0.500. Lab partners are paid 65% of the test price (platform keeps 35%).
--    Card fees 2.5% are a platform cost. Nurse level bonus per visit: Silver +0.250, Gold +0.500, Platinum +0.750.
insert into public.settings(key, value) values
 ('nurse_fee', '3.000'), ('courier_fee', '1.000'), ('kit_cost', '0.500'), ('lab_share', '0.65'), ('pay_fee_pct', '0.025'),
 ('nurse_bonus', '[0, 0.25, 0.5, 0.75]'),
 ('consult_fee', '4.000'), ('consult_post_fee', '3.000'), ('consult_doctor_share', '0.75'),
 ('dental_home_fee', '12.000'), ('dental_home_share', '0.65'),
 ('consult_slots', '["16:00","16:20","16:40","17:00","17:20","17:40","18:00","18:20","18:40","19:00","19:20","19:40","20:00","20:20","20:40"]')
on conflict (key) do update set value = excluded.value;

-- nurse level (same rule as the app): visits and rating
create or replace function public._nurse_level(p_visits int, p_rating numeric) returns int
language sql immutable as $$
  select case when p_visits >= 300 and p_rating >= 4.8 then 4 when p_visits >= 150 and p_rating >= 4.7 then 3 when p_visits >= 50 and p_rating >= 4.5 then 2 else 1 end
$$;

-- 2) consult doctors (demo accounts, password Demo@2026)
insert into public.app_users(role, full_name, email, pass_hash, status, governorate, wilayat, meta, is_demo, available)
select 'doctor', x.n, x.e, extensions.crypt('Demo@2026', extensions.gen_salt('bf')), 'active', 'North Al Sharqiyah', 'Ibra', x.m::jsonb, true, true
from (values
 ('Dr. Hilal Al Harthy', 'doctor.hilal@demo.labathome.om', '{"gender":"male","specialty":"Family Medicine","specialty_ar":"طب الأسرة","license":"OMSB-MD-28844","years":14,"consult":true,"langs":["Arabic","English"],"rating_seed":4.9,"bio":"Family doctor. Diabetes, blood pressure and men''s health. Explains results in plain words.","bio_ar":"طبيب أسرة. السكري والضغط وصحة الرجل. يشرح النتائج بكلام بسيط."}'),
 ('Dr. Rahma Al Shukaili', 'dentist.rahma@demo.labathome.om', '{"gender":"female","specialty":"Dentistry","specialty_ar":"طب الأسنان","license":"OMSB-DN-17320","years":9,"consult":true,"dental":true,"langs":["Arabic","English"],"rating_seed":4.9,"bio":"Family dentist, gentle with children. Check-ups, fluoride and gum care.","bio_ar":"طبيبة أسنان للعائلة، لطيفة مع الأطفال. فحص وفلورايد وعناية باللثة."}'),
 ('Dr. Talal Al Riyami', 'dentist.talal@demo.labathome.om', '{"gender":"male","specialty":"Dentistry","specialty_ar":"طب الأسنان","license":"OMSB-DN-15102","years":11,"consult":true,"dental":true,"langs":["Arabic","English"],"rating_seed":4.8,"bio":"Dentist for adults and seniors. Tooth pain advice, dentures and gum disease.","bio_ar":"طبيب أسنان للكبار وكبار السن. استشارات ألم الأسنان وأطقم الأسنان وأمراض اللثة."}')
) as x(n, e, m)
where not exists (select 1 from public.app_users a where a.email = x.e);
update public.app_users set meta = meta || '{"consult":true,"langs":["Arabic","English"],"rating_seed":4.9,"bio":"Family doctor. Women''s and children''s health, vitamins and thyroid. Reviews iLab@home results.","bio_ar":"طبيبة أسرة. صحة المرأة والطفل والفيتامينات والغدة. تراجع نتائج آي لاب@هوم."}'::jsonb
 where email = 'doctor@demo.labathome.om';

-- 3) consultations
create table if not exists public.consults (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  patient_id uuid not null references public.app_users(id) on delete cascade,
  doctor_id uuid not null references public.app_users(id),
  kind text not null check (kind in ('pre','post','dental','dental_home')),
  mode text not null check (mode in ('video','voice','chat','home')),
  slot_date date not null, slot_time text not null,
  reason text, order_id uuid references public.orders(id) on delete set null,
  fee numeric(10,3) not null default 0, doctor_pay numeric(10,3) not null default 0,
  payment_method text, paid_at timestamptz,
  status text not null default 'booked' check (status in ('booked','live','done','cancelled')),
  room text, note jsonb, rating int,
  address text, wilayat text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists consults_doctor_slot on public.consults(doctor_id, slot_date, slot_time) where status <> 'cancelled';
create index if not exists consults_patient on public.consults(patient_id, created_at desc);
alter table public.consults enable row level security;
create sequence if not exists public.consult_seq start 5001;

create or replace function public._consult_json(c public.consults, v public.app_users) returns jsonb
language sql stable security definer set search_path to 'public' as $$
  select to_jsonb(c) || jsonb_build_object(
    'doctor', (select jsonb_build_object('id',d.id,'name',d.full_name,'gender',d.meta->>'gender','specialty',d.meta->>'specialty','specialty_ar',d.meta->>'specialty_ar','license',d.meta->>'license','years',d.meta->'years') from public.app_users d where d.id=c.doctor_id),
    'patient', (select jsonb_build_object('name',p.full_name,'gender',p.meta->>'gender','dob',p.meta->>'dob','phone',case when v.role in ('doctor','admin','staff') or v.id=p.id then p.phone end) from public.app_users p where p.id=c.patient_id),
    'order', (select jsonb_build_object('id',o.id,'code',o.code,'severity',o.severity,'status',o.status) from public.orders o where o.id=c.order_id),
    'join', case when c.mode in ('video','voice') and c.status in ('booked','live') then 'https://meet.jit.si/' || c.room end)
$$;

-- public list of consult doctors with their free slots for the next 7 days
create or replace function public.doctors_list(p_kind text default 'pre') returns jsonb
language sql stable security definer set search_path to 'public' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'name',d.full_name,'gender',d.meta->>'gender','specialty',d.meta->>'specialty','specialty_ar',d.meta->>'specialty_ar',
      'license',d.meta->>'license','years',d.meta->'years','langs',d.meta->'langs','bio',d.meta->>'bio','bio_ar',d.meta->>'bio_ar',
      'rating',coalesce((select round(avg(rating),1) from public.consults c where c.doctor_id=d.id and rating is not null),(d.meta->>'rating_seed')::numeric),
      'done',(select count(*) from public.consults c where c.doctor_id=d.id and status='done'),
      'taken',(select coalesce(jsonb_agg(c.slot_date::text||' '||c.slot_time),'[]') from public.consults c where c.doctor_id=d.id and c.status<>'cancelled' and c.slot_date >= public._today())
    ) order by (d.meta->>'gender'), d.full_name), '[]')
  from public.app_users d
  where d.role='doctor' and d.status='active' and coalesce((d.meta->>'consult')::boolean,false)
    and (case when p_kind in ('dental','dental_home') then coalesce((d.meta->>'dental')::boolean,false) else not coalesce((d.meta->>'dental')::boolean,false) end)
$$;

create or replace function public.consult_create(p_token text, p jsonb) returns jsonb
language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare v public.app_users := public._uid(p_token); d public.app_users; o public.orders; c public.consults;
  v_kind text := p->>'kind'; v_mode text := p->>'mode'; v_date date := nullif(p->>'slot_date','')::date; v_time text := p->>'slot_time';
  v_fee numeric; v_share numeric; v_pay text := p->>'payment_method';
begin
  if v.role <> 'patient' then raise exception 'ONLY_PATIENTS'; end if;
  select * into d from public.app_users where id = nullif(p->>'doctor_id','')::uuid and role='doctor' and status='active' and coalesce((meta->>'consult')::boolean,false);
  if not found then raise exception 'BAD_DOCTOR'; end if;
  if v_kind not in ('pre','post','dental','dental_home') then raise exception 'BAD_INPUT'; end if;
  if (v_kind in ('dental','dental_home')) <> coalesce((d.meta->>'dental')::boolean,false) then raise exception 'BAD_DOCTOR'; end if;
  if v_kind = 'dental_home' then v_mode := 'home'; elsif v_mode not in ('video','voice','chat') then raise exception 'BAD_INPUT'; end if;
  if v_date is null or v_date < public._today() or v_date > public._today() + 14 then raise exception 'BAD_DATE'; end if;
  if not exists(select 1 from public.settings s, jsonb_array_elements_text(s.value) x where s.key='consult_slots' and x=v_time) then raise exception 'BAD_SLOT'; end if;
  if v_date = public._today() and v_time::time <= (now() at time zone 'Asia/Muscat')::time + interval '30 minutes' then raise exception 'SLOT_PASSED'; end if;
  if v_kind = 'post' then
    select * into o from public.orders where id = nullif(p->>'order_id','')::uuid and patient_id = v.id and status='completed';
    if not found then raise exception 'NOT_FOUND'; end if;
  end if;
  if v_kind = 'dental_home' and coalesce(btrim(coalesce(p->>'address', v.address)),'') = '' then raise exception 'NEED_ADDRESS'; end if;
  v_fee := case
    when v_kind = 'post' and o.severity in ('review','urgent') then 0                     -- free when results need attention
    when v_kind = 'post' then (select (value#>>'{}')::numeric from public.settings where key='consult_post_fee')
    when v_kind = 'dental_home' then (select (value#>>'{}')::numeric from public.settings where key='dental_home_fee')
    else (select (value#>>'{}')::numeric from public.settings where key='consult_fee') end;
  v_share := case when v_kind='dental_home' then (select (value#>>'{}')::numeric from public.settings where key='dental_home_share')
                  else (select (value#>>'{}')::numeric from public.settings where key='consult_doctor_share') end;
  if v_fee > 0 and (v_pay is null or v_pay not in ('card','applepay')) then raise exception 'BAD_PAYMENT'; end if;
  insert into public.consults(code, patient_id, doctor_id, kind, mode, slot_date, slot_time, reason, order_id, fee, doctor_pay, payment_method, paid_at, room, address, wilayat)
  values ('CON-' || nextval('public.consult_seq'), v.id, d.id, v_kind, v_mode, v_date, v_time, nullif(btrim(coalesce(p->>'reason','')),''), o.id,
          v_fee, case when v_fee = 0 then 2.000 else round(v_fee * v_share, 3) end, case when v_fee > 0 then v_pay else 'included' end, now(),
          'iLabAtHome-' || encode(gen_random_bytes(6), 'hex'),
          case when v_kind='dental_home' then btrim(coalesce(nullif(p->>'address',''), v.address)) end,
          case when v_kind='dental_home' then coalesce(nullif(p->>'wilayat',''), v.wilayat) end)
  returning * into c;
  perform public._notify(d.id, null, 'consult_new', 'New consultation · ' || c.code, 'استشارة جديدة · ' || c.code,
    to_char(c.slot_date,'DD Mon') || ' · ' || c.slot_time || ' · ' || v.full_name, to_char(c.slot_date,'DD/MM') || ' · ' || c.slot_time || ' · ' || v.full_name);
  perform public._notify(v.id, null, 'consult_booked', 'Consultation booked · ' || c.code, 'تم حجز الاستشارة · ' || c.code,
    d.full_name || ' · ' || to_char(c.slot_date,'DD Mon') || ' ' || c.slot_time, d.full_name || ' · ' || to_char(c.slot_date,'DD/MM') || ' ' || c.slot_time);
  return public._consult_json(c, v);
exception when unique_violation then raise exception 'SLOT_TAKEN';
end $$;

create or replace function public.consult_list(p_token text) returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare v public.app_users := public._uid(p_token);
begin
  return coalesce((select jsonb_agg(public._consult_json(c, v) order by (c.status in ('done','cancelled')), c.slot_date, c.slot_time)
    from public.consults c where (v.role='patient' and c.patient_id=v.id) or (v.role='doctor' and c.doctor_id=v.id) or v.role in ('admin','staff')), '[]');
end $$;

create or replace function public.consult_get(p_token text, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare v public.app_users := public._uid(p_token); c public.consults;
begin
  select * into c from public.consults where id=p_id and (patient_id=v.id or doctor_id=v.id or v.role in ('admin','staff'));
  if not found then raise exception 'NOT_FOUND'; end if;
  return public._consult_json(c, v);
end $$;

-- doctor: start / finish (advice + suggested tests); patient: cancel / rate
create or replace function public.consult_action(p_token text, p_id uuid, p_action text, p jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v public.app_users := public._uid(p_token); c public.consults;
begin
  select * into c from public.consults where id=p_id for update;
  if not found or not (c.patient_id=v.id or c.doctor_id=v.id or public._is_owner(v)) then raise exception 'NOT_FOUND'; end if;
  if v.id=c.doctor_id and p_action='start' and c.status='booked' then
    update public.consults set status='live', updated_at=now() where id=c.id;
    perform public._notify(c.patient_id, null, 'consult_live', 'Your doctor is ready · ' || c.code, 'طبيبك جاهز الآن · ' || c.code, v.full_name, v.full_name);
  elsif v.id=c.doctor_id and p_action='finish' and c.status in ('booked','live') then
    if coalesce(btrim(p->>'note'),'')='' then raise exception 'NEED_NOTE'; end if;
    update public.consults set status='done', updated_at=now(),
      note=jsonb_build_object('note',btrim(p->>'note'),'tests',coalesce(p->'tests','[]'::jsonb),'packages',coalesce(p->'packages','[]'::jsonb),'at',now(),'by',v.full_name) where id=c.id;
    perform public._notify(c.patient_id, null, 'consult_done', '🩺 Advice from ' || v.full_name, '🩺 توصية من ' || v.full_name, c.code, c.code);
  elsif v.id=c.patient_id and p_action='cancel' and c.status='booked' then
    update public.consults set status='cancelled', updated_at=now() where id=c.id;
    perform public._notify(c.doctor_id, null, 'consult_cancel', 'Consultation cancelled · ' || c.code, 'تم إلغاء الاستشارة · ' || c.code, '', '');
  elsif v.id=c.patient_id and p_action='rate' and c.status='done' then
    if (p->>'rating')::int not between 1 and 5 then raise exception 'BAD_RATING'; end if;
    update public.consults set rating=(p->>'rating')::int where id=c.id;
  else raise exception 'BAD_ACTION'; end if;
  select * into c from public.consults where id=p_id;
  return public._consult_json(c, v);
end $$;

-- 4) nurse earnings now = visits × (3.000 + level bonus); admin money view shows every party's share
create or replace function public.my_stats(p_token text) returns jsonb
language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare v public.app_users := public._uid(p_token); fee numeric := (select (value#>>'{}')::numeric from public.settings where key='nurse_fee');
  n int; seed int; v_rating numeric; lv int; bonus numeric;
begin
  if v.role='nurse' then
    n := (select count(*) from public.orders where nurse_id=v.id and status in ('collected','in_transit','at_lab','processing','completed'));
    seed := coalesce((v.meta->>'visits_seed')::int,0);
    v_rating := coalesce((select round(avg(rating),1) from public.orders where nurse_id=v.id and rating is not null),(v.meta->>'rating_seed')::numeric, 0);
    lv := public._nurse_level(n + seed, v_rating);
    bonus := coalesce(((select value from public.settings where key='nurse_bonus')->>(lv-1))::numeric, 0);
    return jsonb_build_object(
      'active',(select count(*) from public.orders where nurse_id=v.id and status in ('assigned','on_the_way','arrived')),
      'collected', n + seed,
      'month',(select count(*) from public.orders where nurse_id=v.id and status in ('collected','in_transit','at_lab','processing','completed') and updated_at >= date_trunc('month',now())),
      'earnings',(fee + bonus) * n, 'fee', fee + bonus, 'base', fee, 'bonus', bonus, 'level', lv, 'rating', v_rating,
      'today', v.available and (v.available_on = public._today() or v.is_demo),
      'available',(select count(*) from public.orders o where o.nurse_id is null and public._can_see(o, v)));
  elsif v.role='courier' then
    return jsonb_build_object('waiting',(select count(*) from public.orders where status='collected' and courier_id is null),
      'in_transit',(select count(*) from public.orders where courier_id=v.id and status='in_transit'),
      'delivered',(select count(*) from public.orders where courier_id=v.id and status in ('at_lab','processing','completed')),
      'earnings',(select (value#>>'{}')::numeric from public.settings where key='courier_fee') * (select count(*) from public.orders where courier_id=v.id and status in ('at_lab','processing','completed')),
      'avg_temp',(select round(avg(sample_temp),1) from public.orders where courier_id=v.id));
  elsif v.role='lab' then
    return jsonb_build_object('incoming',(select count(*) from public.orders where lab_id=v.id and status in ('in_transit','at_lab')),
      'processing',(select count(*) from public.orders where lab_id=v.id and status='processing'),
      'published',(select count(*) from public.orders where lab_id=v.id and status='completed'),
      'revenue',(select round(coalesce(sum(subtotal),0) * (select (value#>>'{}')::numeric from public.settings where key='lab_share'),3) from public.orders where lab_id=v.id and status='completed' and payment_method <> 'sponsored'),
      'avg_tat_h',(select round(avg(extract(epoch from published_at-created_at)/3600)::numeric,1) from public.orders where lab_id=v.id and published_at is not null),
      'abnormal',(select count(*) from public.orders o, jsonb_each(coalesce(o.results,'{}'::jsonb)) r where o.lab_id=v.id and o.status='completed' and r.value->>'f' in ('L','H') and not coalesce((r.value->>'m')::boolean,false)));
  elsif v.role='doctor' then
    return jsonb_build_object('consults_today',(select count(*) from public.consults where doctor_id=v.id and slot_date=public._today() and status<>'cancelled'),
      'consults_done',(select count(*) from public.consults where doctor_id=v.id and status='done'),
      'earnings',(select coalesce(sum(doctor_pay),0) from public.consults where doctor_id=v.id and status='done'));
  elsif v.role='patient' then
    return jsonb_build_object('total',(select count(*) from public.orders where patient_id=v.id),
      'active',(select count(*) from public.orders where patient_id=v.id and status not in ('completed','cancelled')),
      'reports',(select count(*) from public.orders where patient_id=v.id and status='completed'),
      'consults',(select count(*) from public.consults where patient_id=v.id and status in ('booked','live')));
  end if;
  return '{}'::jsonb;
end $$;

create or replace function public.admin_payments(p_token text) returns jsonb
language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare v public.app_users := public._uid(p_token);
  s_lab numeric := (select (value#>>'{}')::numeric from public.settings where key='lab_share');
  s_nurse numeric := (select (value#>>'{}')::numeric from public.settings where key='nurse_fee');
  s_cour numeric := (select (value#>>'{}')::numeric from public.settings where key='courier_fee');
  s_kit numeric := (select (value#>>'{}')::numeric from public.settings where key='kit_cost');
  s_pay numeric := (select (value#>>'{}')::numeric from public.settings where key='pay_fee_pct');
  done_n int; done_sub numeric; done_total numeric; cons_fee numeric; cons_doc numeric;
begin
  if not public._is_owner(v) and not (v.role='admin' and v.is_demo) then raise exception 'FORBIDDEN'; end if;
  select count(*), coalesce(sum(subtotal),0), coalesce(sum(subtotal+home_fee),0) into done_n, done_sub, done_total
    from public.orders where status in ('collected','in_transit','at_lab','processing','completed') and refunded_at is null;
  select coalesce(sum(fee),0), coalesce(sum(doctor_pay),0) into cons_fee, cons_doc from public.consults where status='done';
  return jsonb_build_object(
    'gross', (select coalesce(sum(total),0) from public.orders where paid_at is not null and refunded_at is null),
    'refunded', (select coalesce(sum(total),0) from public.orders where refunded_at is not null),
    'sponsored', (select coalesce(sum(subtotal+home_fee),0) from public.orders where payment_method='sponsored' and status<>'cancelled'),
    'nurse_payout', round(done_n * s_nurse, 3),
    'lab_payout', round(done_sub * s_lab, 3),
    'courier_payout', round(done_n * s_cour, 3),
    'kit_cost', round(done_n * s_kit, 3),
    'card_fees', round(done_total * s_pay, 3),
    'consult_revenue', cons_fee, 'doctor_payout', cons_doc,
    'platform_margin', round(done_total - done_sub*s_lab - done_n*(s_nurse+s_cour+s_kit) - done_total*s_pay + cons_fee - cons_doc, 3),
    'by_method', (select coalesce(jsonb_object_agg(payment_method, c),'{}') from (select payment_method, sum(total) c from public.orders where paid_at is not null and refunded_at is null group by 1) z),
    'list', (select coalesce(jsonb_agg(x order by x->>'at' desc),'[]') from (select jsonb_build_object('id',o.id,'code',o.code,'patient',coalesce(o.person->>'name',u.full_name),'total',o.total,'method',o.payment_method,
        'at',coalesce(o.paid_at,o.created_at),'paid',o.paid_at is not null,'refunded',o.refunded_at,'status',o.status,'ref',o.pay_ref) x
       from public.orders o join public.app_users u on u.id=o.patient_id order by o.created_at desc limit 200) z));
end $$;

-- public money settings for the business page and the cart (no secrets)
create or replace function public.business_public() returns jsonb
language sql stable security definer set search_path to 'public' as $$
  select jsonb_object_agg(key, value) from public.settings
  where key in ('home_fee','nurse_fee','courier_fee','kit_cost','lab_share','pay_fee_pct','nurse_bonus','consult_fee','consult_post_fee','consult_doctor_share','dental_home_fee','dental_home_share','consult_slots')
$$;

grant execute on function public.doctors_list(text), public.consult_create(text, jsonb), public.consult_list(text), public.consult_get(text, uuid),
  public.consult_action(text, uuid, text, jsonb), public.business_public() to anon, authenticated;

-- lock internal helpers (applied as v28_lock_internal_helpers)
revoke execute on function public._consult_json(public.consults, public.app_users) from public, anon, authenticated;
