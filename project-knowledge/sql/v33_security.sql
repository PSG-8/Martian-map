-- v33 security hardening (before public launch).
-- Safe to run more than once. Test with a rolled-back dry run first (see RUNBOOK).
--
-- What it fixes:
--  1. Demo isolation. Demo accounts share a public password (Demo@2026), so a demo account must
--     only ever see demo people's data. Before this, demo admin / doctor / nurse / courier / lab
--     accounts could read real users' orders, results, consultations, tickets and SOS alerts.
--  2. Partner accounts (nurse, courier, lab, doctor) see no requests until the owner approves them,
--     and new partner sign-ups are no longer approved automatically after 2 minutes.
--  3. Users can no longer give themselves special powers through profile or sign-up "meta"
--     (fleet manager, loyalty stamps, referral, manual mode...). Nurses and doctors cannot change
--     their gender after sign-up (the same-gender rule depends on it).
--  4. Spam limits on guest support tickets, the waitlist and sign-ups. Support topics are fixed values.
--  5. Internal helper functions are no longer callable from the public API; fixed search_path.

-- ---------- 1. helper: may this viewer see data that belongs to this user? ----------
create or replace function public._demo_ok(v public.app_users, p_user uuid)
returns boolean language sql stable set search_path = public as $$
  select not coalesce(v.is_demo, false)
      or coalesce((select u.is_demo from public.app_users u where u.id = p_user), false)
$$;
revoke all on function public._demo_ok(public.app_users, uuid) from public, anon, authenticated;

-- _can_see: add demo isolation + "partners must be approved" to the end of the existing rule.
do $$
declare d text;
begin
  d := pg_get_functiondef('public._can_see(public.orders, public.app_users)'::regprocedure);
  if position('_demo_ok' in d) = 0 then
    if position('else false end, false)' in d) = 0 then raise exception 'v33: _can_see tail not found'; end if;
    d := replace(d, 'else false end, false)', 'else false end, false)
    and public._demo_ok(v, o.patient_id)
    and (v.role not in (''nurse'',''courier'',''lab'',''doctor'') or v.status = ''active'')');
    execute d;
  end if;
end $$;

-- consult_create: a demo doctor's notification must not carry a real user's name.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.consult_create(text, jsonb)'::regprocedure);
  if position('_demo_ok' in d) = 0 then
    if position('|| '' · '' || v.full_name' in d) = 0 then raise exception 'v33: consult_create name pattern not found'; end if;
    d := replace(d, '|| '' · '' || v.full_name', '|| '' · '' || case when public._demo_ok(d, v.id) then v.full_name else ''•••'' end');
    execute d;
  end if;
end $$;

create or replace function public.orders_list(p_token text, p_scope text default 'mine')
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v public.app_users := public._uid(p_token);
  fleet boolean := v.role='courier' and coalesce((v.meta->>'fleet_admin')::boolean,false);
begin
  if v.role in ('nurse','courier','lab','doctor') and v.status <> 'active' then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(public._order_brief(o) || jsonb_build_object('preferred', o.preferred_nurse_id = v.id, 'gender', o.patient_gender,
        'courier_name', (select full_name from public.app_users where id=o.courier_id), 'severity', o.severity, 'reviewed', o.doctor_note is not null, 'mode', o.mode) order by
      case when p_scope='available' then o.slot_date end asc nulls last,
      case when v.role='doctor' then (o.doctor_note is not null)::int end, case when v.role='doctor' then (o.severity='urgent')::int end desc, o.updated_at desc)
    from (select * from public.orders o where public._demo_ok(v, o.patient_id) and
      case
        when v.role='patient' then o.patient_id=v.id
        when v.role='doctor' then public._can_see(o, v)
        when v.role='nurse' and p_scope='available' then o.nurse_id is null and public._can_see(o, v)
        when v.role='nurse' then o.nurse_id=v.id
        when fleet and p_scope='available' then o.status='collected' and o.courier_id is null
        when fleet then exists(select 1 from public.app_users c where c.id=o.courier_id and c.meta->>'company' = v.meta->>'company')
        when v.role='courier' and p_scope='available' then (o.status='collected' or (o.mode='self' and o.status in ('booked','recollect'))) and o.courier_id is null and public._can_see(o, v)
        when v.role='courier' then o.courier_id=v.id
        when v.role='lab' then o.lab_id=v.id and o.status in ('booked','assigned','on_the_way','arrived','collected','in_transit','at_lab','processing','completed','recollect')
        when v.role in ('admin','staff') then true
        else false end
      order by o.updated_at desc limit 300) o), '[]'::jsonb);
end $$;

-- ---------- admin screens: a demo admin sees demo people only ----------
create or replace function public.admin_users(p_token text, p_role text default null, p_status text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v public.app_users := public._uid(p_token);
begin
  if v.role not in ('admin','staff') then raise exception 'FORBIDDEN'; end if;
  return coalesce((select jsonb_agg(public._pub(u, v.is_demo and not u.is_demo) || jsonb_build_object('orders',(select count(*) from public.orders o where o.patient_id=u.id or o.nurse_id=u.id)) order by u.created_at desc) from public.app_users u
    where u.status<>'deleted' and (not v.is_demo or u.is_demo) and (p_role is null or u.role=p_role) and (p_status is null or u.status=p_status)), '[]'::jsonb);
end $$;

create or replace function public.admin_overview(p_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v public.app_users := public._uid(p_token); dm boolean;
begin
  if v.role not in ('admin','staff') then raise exception 'FORBIDDEN'; end if;
  dm := coalesce(v.is_demo, false);
  return (with oo as (select o.* from public.orders o where not dm or exists(select 1 from public.app_users p where p.id=o.patient_id and p.is_demo)),
               uu as (select u.* from public.app_users u where not dm or u.is_demo)
  select jsonb_build_object(
    'orders', (select count(*) from oo),
    'today', (select count(*) from oo where created_at >= date_trunc('day', now() at time zone 'Asia/Muscat') at time zone 'Asia/Muscat'),
    'active', (select count(*) from oo where status not in ('completed','cancelled')),
    'completed', (select count(*) from oo where status='completed'),
    'revenue', (select coalesce(sum(subtotal+home_fee),0) from oo where status<>'cancelled'),
    'avg_tat_h', (select round(avg(extract(epoch from published_at-created_at)/3600)::numeric,1) from oo where published_at is not null),
    'rating', (select round(avg(rating),2) from oo where rating is not null),
    'by_status', (select coalesce(jsonb_object_agg(status,c),'{}') from (select status, count(*) c from oo group by 1) z),
    'by_wilayat', (select coalesce(jsonb_object_agg(wilayat,c),'{}') from (select wilayat, count(*) c from oo group by 1) z),
    'users', (select coalesce(jsonb_object_agg(role,c),'{}') from (select role, count(*) c from uu group by 1) z),
    'pending', (select count(*) from uu where status='pending'),
    'top_tests', (select coalesce(jsonb_agg(jsonb_build_object('id',x,'n',c) order by c desc),'[]') from (select x, count(*) c from oo, unnest(oo.test_ids) x where status<>'cancelled' group by 1 order by 2 desc limit 6) z),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('d',d,'n',c) order by d),'[]') from (select (created_at at time zone 'Asia/Muscat')::date d, count(*) c from oo where created_at > now()-interval '14 days' group by 1) z),
    'waitlist', case when dm then 0 else (select count(*) from public.waitlist) end));
end $$;

create or replace function public.admin_payments(p_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
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
    from public.orders where public._demo_ok(v, patient_id) and status in ('collected','in_transit','at_lab','processing','completed') and refunded_at is null;
  select coalesce(sum(fee),0), coalesce(sum(doctor_pay),0) into cons_fee, cons_doc from public.consults c
    where c.status='done' and public._demo_ok(v, c.patient_id);
  return jsonb_build_object(
    'gross', (select coalesce(sum(total),0) from public.orders where public._demo_ok(v, patient_id) and paid_at is not null and refunded_at is null),
    'refunded', (select coalesce(sum(total),0) from public.orders where public._demo_ok(v, patient_id) and refunded_at is not null),
    'sponsored', (select coalesce(sum(subtotal+home_fee),0) from public.orders where public._demo_ok(v, patient_id) and payment_method='sponsored' and status<>'cancelled'),
    'nurse_payout', round(done_n * s_nurse, 3),
    'lab_payout', round(done_sub * s_lab, 3),
    'courier_payout', round(done_n * s_cour, 3),
    'kit_cost', round(done_n * s_kit, 3),
    'card_fees', round(done_total * s_pay, 3),
    'consult_revenue', cons_fee, 'doctor_payout', cons_doc,
    'platform_margin', round(done_total - done_sub*s_lab - done_n*(s_nurse+s_cour+s_kit) - done_total*s_pay + cons_fee - cons_doc, 3),
    'by_method', (select coalesce(jsonb_object_agg(payment_method, c),'{}') from (select payment_method, sum(total) c from public.orders where public._demo_ok(v, patient_id) and paid_at is not null and refunded_at is null group by 1) z),
    'list', (select coalesce(jsonb_agg(x order by x->>'at' desc),'[]') from (select jsonb_build_object('id',o.id,'code',o.code,'patient',coalesce(o.person->>'name',u.full_name),'total',o.total,'method',o.payment_method,
        'at',coalesce(o.paid_at,o.created_at),'paid',o.paid_at is not null,'refunded',o.refunded_at,'status',o.status,'ref',o.pay_ref) x
       from public.orders o join public.app_users u on u.id=o.patient_id where not v.is_demo or u.is_demo order by o.created_at desc limit 200) z));
end $$;

create or replace function public.admin_safety(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.app_users := public._uid(p_token);
begin
  if v.role not in ('admin','staff') then raise exception 'FORBIDDEN'; end if;
  return jsonb_build_object(
    'sos', coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'who',u.full_name,'role',u.role,'phone',u.phone,'lat',s.lat,'lng',s.lng,'note',s.note,'at',s.created_at,'resolved_at',s.resolved_at,'order',o.code) order by s.resolved_at nulls first, s.created_at desc)
             from (select * from public.sos_alerts order by created_at desc limit 50) s join public.app_users u on u.id=s.user_id left join public.orders o on o.id=s.order_id
             where not v.is_demo or u.is_demo), '[]'::jsonb),
    'incidents', coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'who',u.full_name,'role',u.role,'kind',i.kind,'note',i.note,'status',i.status,'at',i.created_at,'order',o.code) order by (i.status='open') desc, i.created_at desc)
             from (select * from public.incidents order by created_at desc limit 80) i join public.app_users u on u.id=i.user_id left join public.orders o on o.id=i.order_id
             where not v.is_demo or u.is_demo), '[]'::jsonb));
end $$;

create or replace function public.admin_tickets(p_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v public.app_users := public._uid(p_token);
begin
  if v.role not in ('admin','staff') then raise exception 'FORBIDDEN'; end if;
  return coalesce((select jsonb_agg(to_jsonb(t) order by t.status='open' desc, t.id desc)
    from (select k.* from public.support_tickets k
          where not v.is_demo or exists(select 1 from public.app_users u where u.id=k.user_id and u.is_demo)
          order by k.id desc limit 200) t),'[]'::jsonb);
end $$;

create or replace function public.admin_ticket_reply(p_token text, p_id bigint, p_reply text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare v public.app_users := public._uid(p_token); r public.support_tickets;
begin
  if v.role not in ('admin','staff') then raise exception 'FORBIDDEN'; end if;
  if length(coalesce(btrim(p_reply),'')) < 2 then raise exception 'NEED_MESSAGE'; end if;
  select * into r from public.support_tickets where id=p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v.is_demo and not exists(select 1 from public.app_users u where u.id=r.user_id and u.is_demo) then raise exception 'DEMO_READONLY'; end if;
  update public.support_tickets set reply=left(btrim(p_reply),2000), status='answered', replied_at=now() where id=p_id returning * into r;
  if r.user_id is not null then perform public._notify(r.user_id, null, 'ticket_reply', 'Customer service replied', 'رد خدمة العملاء', left(r.reply,120), left(r.reply,120)); end if;
end $$;

create or replace function public.admin_camps(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.app_users := public._uid(p_token);
begin
  if v.role not in ('admin','staff') then raise exception 'FORBIDDEN'; end if;
  return coalesce((select jsonb_agg(to_jsonb(c) || jsonb_build_object('company', u.full_name, 'workers_n', jsonb_array_length(c.workers)) order by c.created_at desc)
    from public.camp_requests c join public.app_users u on u.id=c.company_id where not v.is_demo or u.is_demo), '[]'::jsonb);
end $$;

create or replace function public.admin_nurses(p_token text, p_wilayat text, p_gender text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v public.app_users := public._uid(p_token);
begin
  if v.role not in ('admin','staff') then raise exception 'FORBIDDEN'; end if;
  return coalesce((select jsonb_agg(public._nurse_card(n)) from public.app_users n
    where n.role='nurse' and n.status='active' and (not v.is_demo or n.is_demo) and (p_gender is null or n.meta->>'gender'=p_gender)
      and (n.wilayat=p_wilayat or coalesce(n.meta->'coverage','[]'::jsonb) ? p_wilayat)),'[]'::jsonb);
end $$;

create or replace function public.admin_privacy(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.app_users := public._uid(p_token);
begin
  if v.role not in ('admin','staff') then raise exception 'FORBIDDEN'; end if;
  return coalesce((select jsonb_agg(to_jsonb(r) || jsonb_build_object('user', u.full_name) order by (r.status='open') desc, r.created_at desc)
    from public.privacy_requests r join public.app_users u on u.id=r.user_id where not v.is_demo or u.is_demo), '[]'::jsonb);
end $$;

-- ---------- consultations: demo accounts see demo patients only ----------
create or replace function public.consult_list(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v public.app_users := public._uid(p_token);
begin
  return coalesce((select jsonb_agg(public._consult_json(c, v) order by (c.status in ('done','cancelled')), c.slot_date, c.slot_time)
    from public.consults c where ((v.role='patient' and c.patient_id=v.id) or (v.role='doctor' and c.doctor_id=v.id) or v.role in ('admin','staff'))
      and public._demo_ok(v, c.patient_id)), '[]');
end $$;

create or replace function public.consult_get(p_token text, p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v public.app_users := public._uid(p_token); c public.consults;
begin
  select * into c from public.consults where id=p_id and (patient_id=v.id or doctor_id=v.id or v.role in ('admin','staff')) and public._demo_ok(v, patient_id);
  if not found then raise exception 'NOT_FOUND'; end if;
  return public._consult_json(c, v);
end $$;

create or replace function public.consult_msgs(p_token text, p_id uuid, p_after bigint default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v public.app_users := public._uid(p_token); c public.consults;
begin
  select * into c from public.consults where id=p_id and (patient_id=v.id or doctor_id=v.id or v.role in ('admin','staff')) and public._demo_ok(v, patient_id);
  if not found then raise exception 'NOT_FOUND'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'mine',m.sender_id=v.id,'who',case when m.sender_id=c.doctor_id then 'doctor' else 'patient' end,'body',m.body,'at',m.created_at) order by m.id)
    from public.consult_messages m where m.consult_id=c.id and m.id > coalesce(p_after,0)), '[]');
end $$;

create or replace function public.consult_send(p_token text, p_id uuid, p_body text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.app_users := public._uid(p_token); c public.consults; other uuid; last_at timestamptz; m public.consult_messages;
begin
  select * into c from public.consults where id=p_id and (patient_id=v.id or doctor_id=v.id) and public._demo_ok(v, patient_id);
  if not found then raise exception 'NOT_FOUND'; end if;
  if c.status = 'cancelled' then raise exception 'BAD_ACTION'; end if;
  if coalesce(btrim(p_body),'') = '' then raise exception 'BAD_INPUT'; end if;
  if (select count(*) from public.consult_messages where consult_id=c.id and sender_id=v.id and created_at > now() - interval '1 minute') >= 20 then raise exception 'TOO_MANY'; end if;
  select max(created_at) into last_at from public.consult_messages where consult_id=c.id and sender_id=v.id;
  insert into public.consult_messages(consult_id, sender_id, body) values (c.id, v.id, left(btrim(p_body), 2000)) returning * into m;
  other := case when v.id=c.patient_id then c.doctor_id else c.patient_id end;
  if last_at is null or last_at < now() - interval '3 minutes' then
    perform public._notify(other, null, 'consult_msg', '💬 New message · ' || c.code, '💬 رسالة جديدة · ' || c.code, left(btrim(p_body), 80), left(btrim(p_body), 80));
  end if;
  return jsonb_build_object('id', m.id, 'mine', true, 'who', case when v.id=c.doctor_id then 'doctor' else 'patient' end, 'body', m.body, 'at', m.created_at);
end $$;

do $$
declare d text;
begin
  d := pg_get_functiondef('public.consult_action(text, uuid, text, jsonb)'::regprocedure);
  if position('_demo_ok' in d) = 0 then
    if position('or public._is_owner(v)) then raise exception ''NOT_FOUND''' in d) = 0 then raise exception 'v33: consult_action pattern not found'; end if;
    d := replace(d, 'or public._is_owner(v)) then raise exception ''NOT_FOUND''',
                    'or public._is_owner(v)) or not public._demo_ok(v, c.patient_id) then raise exception ''NOT_FOUND''');
    execute d;
  end if;
end $$;

-- ---------- 2. partners wait for the owner's approval ----------
-- _uid() approves pending accounts after settings.auto_approve_minutes; JSON null turns that off.
update public.settings set value = 'null'::jsonb where key = 'auto_approve_minutes';

-- ---------- 3. no self-granted powers ----------
create or replace function public.profile_update(p_token text, p jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare u public.app_users := public._uid(p_token); v_phone text; v_civil text; m jsonb;
begin
  if p ? 'phone' then
    v_phone := public._norm_phone(p->>'phone');
    if v_phone is not null and exists(select 1 from public.app_users where phone=v_phone and id<>u.id) then raise exception 'PHONE_TAKEN'; end if;
  end if;
  if u.is_demo and (p ? 'phone' or p ? 'full_name' or p ? 'civil_id' or (p->'meta') ? 'gender') then raise exception 'DEMO_READONLY'; end if;
  -- only these profile details can be changed by the user; everything else in meta is set by the system or the owner
  m := coalesce((select jsonb_object_agg(k, x) from jsonb_each(case when jsonb_typeof(p->'meta')='object' then p->'meta' else '{}'::jsonb end) e(k, x)
                 where k in ('blood','gender','dob','allergies','chronic','needs_profile','langs','languages','bio','bio_ar','hours')
                   and length(x::text) <= 400), '{}'::jsonb);
  if m ? 'gender' and m->>'gender' not in ('male','female') then raise exception 'NEED_GENDER'; end if;
  -- nurses and doctors keep the gender they registered with (the same-gender rule depends on it); the owner can change it
  if u.role <> 'patient' and coalesce(u.meta->>'gender','') <> '' then m := m - 'gender'; end if;
  if p ? 'civil_id' then v_civil := public._check_civil(p->>'civil_id', u.id); end if;
  update public.app_users set
    full_name = coalesce(nullif(left(btrim(p->>'full_name'),80),''), full_name),
    phone = case when p ? 'phone' then v_phone else phone end,
    civil_id = case when p ? 'civil_id' and v_civil is not null then v_civil else civil_id end,
    governorate = coalesce(left(p->>'governorate',60), governorate), wilayat = coalesce(left(p->>'wilayat',60), wilayat),
    address = coalesce(left(p->>'address',300), address),
    lat = coalesce(nullif(p->>'lat','')::float8, lat), lng = coalesce(nullif(p->>'lng','')::float8, lng),
    available = coalesce((p->>'available')::boolean, available),
    available_on = case when (p->>'available')::boolean is true then public._today() when (p->>'available')::boolean is false then null else available_on end,
    meta = meta || m
  where id = u.id returning * into u;
  return public._pub(u);
end $$;

-- auth_register: drop system-only meta keys and cap sizes; light global limit against bot sign-ups.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.auth_register(jsonb)'::regprocedure);
  if position('v33_meta' in d) = 0 then
    if position('coalesce(p->''meta'',''{}''::jsonb) || jsonb_build_object(''consent_at'', now())' in d) = 0 then raise exception 'v33: auth_register meta pattern not found'; end if;
    d := replace(d, 'coalesce(p->''meta'',''{}''::jsonb) || jsonb_build_object(''consent_at'', now())',
      '/* v33_meta */ (case when jsonb_typeof(p->''meta'')=''object'' then p->''meta'' else ''{}''::jsonb end - array[''fleet_admin'',''manual'',''rating_seed'',''reviews_seed'',''visits_seed'',''done_seed'',''bonus_stamps'',''ref_code'',''referred_by'',''google'',''consent_at'',''consult'',''deleted_at'',''deleted_by'',''needs_profile'']) || jsonb_build_object(''consent_at'', now())');
    if position('if coalesce(btrim(p->>''full_name''),'''') = '''' then raise exception ''NEED_NAME''; end if;' in d) = 0 then raise exception 'v33: auth_register name pattern not found'; end if;
    d := replace(d, 'if coalesce(btrim(p->>''full_name''),'''') = '''' then raise exception ''NEED_NAME''; end if;',
      'if coalesce(btrim(p->>''full_name''),'''') = '''' then raise exception ''NEED_NAME''; end if;
  if length(btrim(p->>''full_name'')) > 80 or length(coalesce(p->>''address'','''')) > 300 or length(coalesce(p->''meta'',''{}'')::text) > 4000 then raise exception ''BAD_INPUT''; end if;
  if (select count(*) from public.app_users where created_at > now() - interval ''10 minutes'') >= 60 then raise exception ''TOO_MANY_ATTEMPTS''; end if;');
    execute d;
  end if;
end $$;

-- staff alerts (incident, privacy, SOS, temperature, camp, sign-up): demo admins only hear about demo people
do $$
declare f text; d text;
begin
  foreach f in array array['public.camp_create(text, jsonb)','public.incident_report(text, uuid, text, text)','public.privacy_request(text, text, text)',
                           'public.sos_raise(text, uuid, double precision, double precision, text)','public.sample_log(text, uuid, text, numeric, text)'] loop
    d := pg_get_functiondef(f::regprocedure);
    if position('(not a.is_demo or v.is_demo)' in d) = 0 then
      if position('a.role in (''admin'',''staff'') and a.status=''active''' in d) = 0 then raise exception 'v33: admin alert pattern not found in %', f; end if;
      d := replace(d, 'a.role in (''admin'',''staff'') and a.status=''active''', 'a.role in (''admin'',''staff'') and a.status=''active'' and (not a.is_demo or v.is_demo)');
      execute d;
    end if;
  end loop;
  d := pg_get_functiondef('public.auth_register(jsonb)'::regprocedure);
  if position('where role=''admin'' and not is_demo loop' in d) = 0 then
    if position('where role=''admin'' loop' in d) = 0 then raise exception 'v33: auth_register admin loop not found'; end if;
    execute replace(d, 'where role=''admin'' loop', 'where role=''admin'' and not is_demo loop');
  end if;
  -- an incident report may only point at a request the reporter can see
  d := pg_get_functiondef('public.incident_report(text, uuid, text, text)'::regprocedure);
  if position('v33_order' in d) = 0 then
    if position('values (v.id, p_order, p_kind' in d) = 0 then raise exception 'v33: incident_report insert not found'; end if;
    execute replace(d, 'values (v.id, p_order, p_kind', 'values (v.id, /* v33_order */ (select o.id from public.orders o where o.id = p_order and public._can_see(o, v)), p_kind');
  end if;
end $$;

-- ---------- 4. spam limits ----------
create or replace function public.support_create(p_token text, p jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare u public.app_users; r public.support_tickets; a record; v_contact text; v_topic text;
begin
  begin if p_token is not null and p_token <> '' then u := public._uid(p_token); end if; exception when others then u := null; end;
  if length(coalesce(btrim(p->>'message'),'')) < 5 then raise exception 'NEED_MESSAGE'; end if;
  if u.id is null and coalesce(btrim(p->>'contact'),'') = '' then raise exception 'NEED_PHONE'; end if;
  v_contact := left(coalesce(nullif(btrim(p->>'contact'),''), u.phone, u.email),80);
  v_topic := case when p->>'topic' in ('booking','nurse','other','partner','payment','results') then p->>'topic' else 'other' end;
  if u.id is not null then
    if (select count(*) from public.support_tickets where user_id=u.id and created_at > now() - interval '1 hour') >= 6 then raise exception 'TOO_MANY'; end if;
  else
    if (select count(*) from public.support_tickets where user_id is null and contact=v_contact and created_at > now() - interval '1 hour') >= 3 then raise exception 'TOO_MANY'; end if;
    if (select count(*) from public.support_tickets where user_id is null and created_at > now() - interval '10 minutes') >= 20 then raise exception 'TOO_MANY'; end if;
  end if;
  insert into public.support_tickets(user_id,name,contact,topic,order_code,message)
  values (u.id, left(coalesce(nullif(btrim(p->>'name'),''), u.full_name),80), v_contact,
          v_topic, left(nullif(btrim(coalesce(p->>'order_code','')),''),20), left(btrim(p->>'message'),2000))
  returning * into r;
  for a in select id from public.app_users where role in ('admin','staff') and status='active' and (not is_demo or coalesce(u.is_demo, false)) loop
    perform public._notify(a.id, null, 'ticket', 'New support request #'||r.id, 'طلب دعم جديد #'||r.id, left(r.message,90), left(r.message,90));
  end loop;
  return to_jsonb(r);
end $$;

create or replace function public.waitlist_join(p_name text, p_phone text, p_wilayat text)
returns void language plpgsql security definer set search_path = public as $$
declare ph text := left(public._norm_phone(p_phone),20);
begin
  if coalesce(btrim(p_phone),'')='' or coalesce(btrim(p_wilayat),'')='' then raise exception 'NEED_PHONE'; end if;
  if exists(select 1 from public.waitlist where phone=ph and created_at > now() - interval '1 day') then return; end if;
  if (select count(*) from public.waitlist where created_at > now() - interval '1 hour') >= 120 then raise exception 'TOO_MANY'; end if;
  insert into public.waitlist(name,phone,wilayat) values (left(p_name,80), ph, left(p_wilayat,60));
end $$;

-- ---------- 5. internal helpers off the public API ----------
revoke execute on function public._kit_use() from public, anon, authenticated;
revoke execute on function public._orders_published() from public, anon, authenticated;
revoke execute on function public._orders_severity() from public, anon, authenticated;
alter function public._is_owner(public.app_users) set search_path = public;
alter function public._is_manual(public.app_users) set search_path = public;
alter function public._nurse_level(integer, numeric) set search_path = public;

-- every function that is part of the API keeps its grant; new helpers stay private
revoke all on function public._demo_ok(public.app_users, uuid) from public, anon, authenticated;
