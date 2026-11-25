-- v31 (part B): order flow for self-collection kits, server-side discounts (stamps, coupons, referral),
-- Ramadan night slots, report-view log, automatic sample chain of custody, referral reward on completion.

-- loyalty card: every 5th order (not sponsored, not cancelled) has a free home visit
create or replace function public._loyalty(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare n int; b int; per int; used int;
begin
  select count(*) into n from public.orders where patient_id=p_user and status<>'cancelled' and refunded_at is null and program_id is null;
  select coalesce((meta->>'bonus_stamps')::int,0) into b from public.app_users where id=p_user;
  per := coalesce((select (value#>>'{}')::int from public.settings where key='stamps_per_free'), 5);
  select count(*) into used from public.orders where patient_id=p_user and disc ? 'stamp' and status<>'cancelled';
  return jsonb_build_object('orders', n, 'bonus', coalesce(b,0), 'per', per, 'stamps', (n + coalesce(b,0)) % per,
    'free_next', ((n + coalesce(b,0)) % per) = per - 1, 'free_used', used);
end $$;

create or replace function public._coupon_amount(v public.app_users, p_code text, p_sub numeric) returns numeric
language plpgsql stable security definer set search_path to 'public' as $$
declare c public.coupons; amt numeric;
begin
  select * into c from public.coupons where code = upper(btrim(coalesce(p_code,'')));
  if not found or not c.active then raise exception 'BAD_COUPON'; end if;
  if c.expires_on is not null and c.expires_on < public._today() then raise exception 'COUPON_EXPIRED'; end if;
  if c.max_uses is not null and c.used >= c.max_uses then raise exception 'COUPON_FULL'; end if;
  if exists(select 1 from public.coupon_uses u join public.orders o on o.id=u.order_id where u.user_id=v.id and u.code=c.code and o.status<>'cancelled') then raise exception 'COUPON_USED'; end if;
  if c.first_order and exists(select 1 from public.orders where patient_id=v.id and status<>'cancelled') then raise exception 'COUPON_FIRST'; end if;
  if coalesce(p_sub,0) < c.min_sub then raise exception 'COUPON_MIN'; end if;
  amt := case when c.kind='pct' then round(p_sub * c.value / 100, 3) else c.value end;
  return least(amt, p_sub);
end $$;

create or replace function public.order_create(p_token text, p jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public', 'extensions' as $function$
declare
  v public.app_users := public._uid(p_token);
  it jsonb; pk public.packages; t public.tests; prog public.programs; o public.orders; n record; nu public.app_users;
  v_tests text[] := '{}'; v_items jsonb := '[]'; v_sub numeric := 0; v_disc numeric := 0;
  v_mode text := 'nurse'; v_fee numeric;
  v_date date := nullif(p->>'slot_date','')::date; v_slot text := p->>'slot_time';
  v_today date := public._today(); v_lab uuid; v_pay text := p->>'payment_method'; v_code text;
  v_gender text := coalesce(nullif(p->'person'->>'gender',''), v.meta->>'gender');
  v_nurse uuid := nullif(p->>'nurse_id','')::uuid;
  v_last text := coalesce((select value#>>'{}' from public.settings where key='fasting_last_slot'),'10:00');
  v_person jsonb := p->'person';
  v_ram jsonb := (select value from public.settings where key='ramadan');
  v_coupon text := upper(nullif(btrim(coalesce(p->>'coupon','')),''));
  d_stamp numeric := 0; d_coupon numeric := 0; d_ref numeric := 0; v_dj jsonb := '{}'::jsonb; lj jsonb;
begin
  if v.role <> 'patient' then raise exception 'ONLY_PATIENTS'; end if;
  if v_gender is null or v_gender not in ('male','female') then raise exception 'NEED_GENDER'; end if;
  if nullif(btrim(coalesce(p->>'program_code','')),'') is not null then
    select * into prog from public.programs where upper(code)=upper(btrim(p->>'program_code')) and active for update;
    if not found then raise exception 'BAD_CODE'; end if;
    if prog.used >= prog.seats then raise exception 'CODE_FULL'; end if;
    p := jsonb_set(p, '{items}', case when prog.package_id is not null then jsonb_build_array(jsonb_build_object('type','package','id',prog.package_id))
         else (select jsonb_agg(jsonb_build_object('type','test','id',x)) from unnest(prog.test_ids) x) end);
  end if;
  if jsonb_array_length(coalesce(p->'items','[]'::jsonb)) = 0 then raise exception 'EMPTY_CART'; end if;
  for it in select value from jsonb_array_elements(p->'items') where value->>'type'='package' loop
    select * into pk from public.packages where id = it->>'id' and active;
    if not found then raise exception 'BAD_ITEM'; end if;
    v_sub := v_sub + pk.price; v_tests := v_tests || pk.test_ids;
    v_items := v_items || jsonb_build_object('type','package','id',pk.id,'name_en',pk.name_en,'name_ar',pk.name_ar,'price',pk.price);
  end loop;
  for it in select value from jsonb_array_elements(p->'items') where value->>'type'='test' loop
    select * into t from public.tests where id = it->>'id' and active;
    if not found then raise exception 'BAD_ITEM'; end if;
    if t.id = any(v_tests) then continue; end if;
    v_sub := v_sub + t.price; v_tests := v_tests || t.id;
    v_items := v_items || jsonb_build_object('type','test','id',t.id,'name_en',t.name_en,'name_ar',t.name_ar,'price',t.price);
  end loop;
  select array_agg(distinct x) into v_tests from unnest(v_tests) x;
  -- only self-collection items: a courier brings the kit, no nurse visit, lower fee
  select case when bool_and(collection='self') then 'self' else 'nurse' end into v_mode from public.tests where id = any(v_tests);
  v_fee := case when v_mode='self' then coalesce((select (value#>>'{}')::numeric from public.settings where key='self_fee'), 2)
                else (select (value#>>'{}')::numeric from public.settings where key='home_fee') end;
  if v_mode='self' then v_nurse := null; end if;
  if v_date is null or v_date < v_today or v_date > v_today + 30 then raise exception 'BAD_DATE'; end if;
  if not exists(select 1 from public.settings s, jsonb_array_elements_text(s.value) x where s.key='slots' and x=v_slot)
     and not (v_ram is not null and v_date between (v_ram->>'from')::date and (v_ram->>'to')::date and coalesce(v_ram->'slots','[]'::jsonb) ? v_slot)
  then raise exception 'BAD_SLOT'; end if;
  if v_date = v_today and v_slot::time <= (now() at time zone 'Asia/Muscat')::time + interval '1 hour' then raise exception 'SLOT_PASSED'; end if;
  if exists(select 1 from public.tests x where x.id = any(v_tests) and x.fasting_hours > 0) and v_slot::time > v_last::time then raise exception 'FASTING_SLOT'; end if;
  if not exists(select 1 from public.settings s, jsonb_array_elements_text(s.value) x where s.key='wilayats' and x = p->>'wilayat') then raise exception 'OUT_OF_AREA'; end if;
  if coalesce(btrim(p->>'address'),'') = '' then raise exception 'NEED_ADDRESS'; end if;
  if v_person is not null and coalesce(v_person->>'relation','self') <> 'self' and coalesce(v_person->>'civil_id','') <> '' then
    if regexp_replace(v_person->>'civil_id','\D','','g') !~ '^\d{6,10}$' then raise exception 'BAD_CIVIL'; end if;
    v_person := jsonb_set(v_person, '{civil_id}', to_jsonb(regexp_replace(v_person->>'civil_id','\D','','g')));
  end if;
  if v_nurse is not null then
    select * into nu from public.app_users where id=v_nurse and role='nurse' and status='active' and available
      and meta->>'gender' = v_gender and (wilayat = p->>'wilayat' or coalesce(meta->'coverage','[]'::jsonb) ? (p->>'wilayat'));
    if not found then raise exception 'BAD_NURSE'; end if;
  end if;
  if prog.id is not null then v_disc := v_sub + v_fee; v_pay := 'sponsored'; v_dj := jsonb_build_object('program', v_disc);
  else
    if v_pay is null or v_pay not in ('card','applepay') then raise exception 'BAD_PAYMENT'; end if;
    -- discounts are always computed here, never trusted from the phone
    lj := public._loyalty(v.id);
    if (lj->>'free_next')::boolean then d_stamp := v_fee; v_dj := v_dj || jsonb_build_object('stamp', d_stamp); end if;
    if v_coupon is not null then d_coupon := public._coupon_amount(v, v_coupon, v_sub); v_dj := v_dj || jsonb_build_object('coupon', jsonb_build_object('code', v_coupon, 'amount', d_coupon)); end if;
    if (v.meta->>'referred_by') is not null and not exists(select 1 from public.orders where patient_id=v.id and status<>'cancelled') then
      d_ref := least(coalesce((select (value#>>'{}')::numeric from public.settings where key='ref_reward'), 1), greatest(v_sub - d_coupon, 0));
      if d_ref > 0 then v_dj := v_dj || jsonb_build_object('referral', d_ref, 'ref_by', v.meta->>'referred_by'); end if;
    end if;
    v_disc := d_stamp + d_coupon + d_ref;
  end if;
  select id into v_lab from public.app_users a where role='lab' and status='active'
    order by (a.wilayat = p->>'wilayat') desc, (select count(*) from public.orders x where x.lab_id=a.id and x.status not in ('completed','cancelled')), random() limit 1;
  v_code := 'LAH-' || nextval('public.order_seq');
  insert into public.orders(code,patient_id,person,items,test_ids,subtotal,home_fee,discount,total,program_id,payment_method,paid_at,
     slot_date,slot_time,governorate,wilayat,address,lat,lng,notes,lab_id,patient_gender,preferred_nurse_id,mode,disc)
  values (v_code, v.id,
     coalesce(v_person, jsonb_build_object('name', v.full_name,'gender', v_gender,'dob', v.meta->>'dob','relation','self')),
     v_items, v_tests, v_sub, v_fee, v_disc, greatest(v_sub + v_fee - v_disc, 0), prog.id, v_pay,
     case when v_pay in ('card','applepay','sponsored') then now() end,
     v_date, v_slot, coalesce(p->>'governorate','North Al Sharqiyah'), p->>'wilayat', btrim(p->>'address'),
     nullif(p->>'lat','')::float8, nullif(p->>'lng','')::float8, nullif(btrim(coalesce(p->>'notes','')),''), v_lab, v_gender, v_nurse, v_mode, v_dj)
  returning * into o;
  if d_coupon > 0 then
    insert into public.coupon_uses(code, user_id, order_id, amount) values (v_coupon, v.id, o.id, d_coupon);
    update public.coupons set used = used + 1 where code = v_coupon;
  end if;
  if prog.id is not null then update public.programs set used = used + 1 where id = prog.id;
    perform public._notify(prog.company_id, null, 'program_used', 'Program booking', 'حجز ضمن البرنامج',
      'An employee booked a check-up under "'||prog.name||'".', 'قام موظف بحجز فحص ضمن برنامج "'||prog.name||'".');
  end if;
  perform public._advance(o.id, 'booked', v, case when prog.id is not null then 'Sponsored' when v_mode='self' then 'Self-collection kit' end);
  if v_mode='self' then
    for n in select c.id from public.app_users c where c.role='courier' and c.status='active' and c.available and not coalesce((c.meta->>'fleet_admin')::boolean,false)
               and (c.wilayat = o.wilayat or coalesce(c.meta->'coverage','[]'::jsonb) ? o.wilayat or jsonb_array_length(coalesce(c.meta->'coverage','[]'::jsonb)) = 0) loop
      perform public._notify(n.id, o.id, 'kit_request', 'Kit delivery · '||o.code, 'توصيل عدة فحص · '||o.code,
        to_char(o.slot_date,'DD Mon')||' · '||o.slot_time||' · '||o.wilayat, to_char(o.slot_date,'DD/MM')||' · '||o.slot_time||' · '||o.wilayat);
    end loop;
  else
    for n in select a.id from public.app_users a where a.role='nurse' and a.status='active' and a.available
               and (v_nurse is null or a.id = v_nurse) and a.meta->>'gender' = v_gender
               and (a.wilayat = o.wilayat or coalesce(a.meta->'coverage','[]'::jsonb) ? o.wilayat) loop
      perform public._notify(n.id, o.id, 'new_request',
        case when v_nurse is not null then 'A user chose you · '||o.code else 'New request in '||o.wilayat end,
        case when v_nurse is not null then 'مستخدم اختارك · '||o.code else 'طلب جديد في '||o.wilayat end,
        to_char(o.slot_date,'DD Mon')||' · '||o.slot_time||' · '||array_length(o.test_ids,1)||' tests',
        to_char(o.slot_date,'DD/MM')||' · '||o.slot_time||' · '||array_length(o.test_ids,1)||' فحوصات');
    end loop;
  end if;
  if v_lab is not null then
    perform public._notify(v_lab, o.id, 'expected', 'Sample expected · '||o.code, 'عينة متوقعة · '||o.code,
      to_char(o.slot_date,'DD Mon')||' · '||o.wilayat, to_char(o.slot_date,'DD/MM')||' · '||o.wilayat);
  end if;
  select * into o from public.orders where id=o.id;
  return public._order_json(o, v);
end $function$;

-- who can see an order: nurses never see kit orders in their open pool; couriers see open kit deliveries
create or replace function public._can_see(o orders, v app_users) returns boolean
language sql stable set search_path to 'public' as $function$
  select coalesce(case v.role
    when 'admin' then true when 'staff' then true
    when 'doctor' then o.status='completed' and (o.severity in ('review','urgent') or (o.doctor_note->>'by')::uuid = v.id)
    when 'patient' then o.patient_id = v.id
    when 'nurse' then coalesce(o.nurse_id = v.id, false) or (o.mode <> 'self' and o.status in ('booked','recollect') and o.nurse_id is null
         and (o.preferred_nurse_id is null or o.preferred_nurse_id = v.id)
         and coalesce(o.patient_gender = (v.meta->>'gender'), false)
         and (o.wilayat = v.wilayat or coalesce(v.meta->'coverage','[]'::jsonb) ? o.wilayat))
    when 'courier' then coalesce(o.courier_id = v.id, false)
         or (((o.status = 'collected') or (o.mode='self' and o.status in ('booked','recollect'))) and o.courier_id is null and coalesce((v.meta->>'fleet_admin')::boolean,false) = false
             and (o.wilayat = v.wilayat or coalesce(v.meta->'coverage','[]'::jsonb) ? o.wilayat or jsonb_array_length(coalesce(v.meta->'coverage','[]'::jsonb)) = 0))
         or (coalesce((v.meta->>'fleet_admin')::boolean,false) and exists(select 1 from public.app_users c where c.id=o.courier_id and c.meta->>'company' = v.meta->>'company'))
    when 'lab' then o.lab_id = v.id
    else false end, false)
$function$;

create or replace function public.orders_list(p_token text, p_scope text default 'mine')
 returns jsonb language plpgsql security definer set search_path to 'public', 'extensions' as $function$
declare v public.app_users := public._uid(p_token);
  fleet boolean := v.role='courier' and coalesce((v.meta->>'fleet_admin')::boolean,false);
begin
  return coalesce((select jsonb_agg(public._order_brief(o) || jsonb_build_object('preferred', o.preferred_nurse_id = v.id, 'gender', o.patient_gender,
        'courier_name', (select full_name from public.app_users where id=o.courier_id), 'severity', o.severity, 'reviewed', o.doctor_note is not null, 'mode', o.mode) order by
      case when p_scope='available' then o.slot_date end asc nulls last,
      case when v.role='doctor' then (o.doctor_note is not null)::int end, case when v.role='doctor' then (o.severity='urgent')::int end desc, o.updated_at desc)
    from (select * from public.orders o where
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
end $function$;

-- opening a finished report is logged (privacy: the patient can see who opened it)
create or replace function public.order_get(p_token text, p_id uuid)
 returns jsonb language plpgsql security definer set search_path to 'public', 'extensions' as $function$
declare v public.app_users := public._uid(p_token); o public.orders;
begin
  select * into o from public.orders where id=p_id;
  if not found or not public._can_see(o, v) then raise exception 'NOT_FOUND'; end if;
  if o.status='completed' and not exists(select 1 from public.report_views where order_id=o.id and viewer_id=v.id and at > now() - interval '10 minutes') then
    insert into public.report_views(order_id, viewer_id, viewer_role) values (o.id, v.id, v.role);
  end if;
  return public._order_json(o, v);
end $function$;

create or replace function public.catalog()
 returns jsonb language sql stable security definer set search_path to 'public' as $function$
  select jsonb_build_object(
    'tests', (select coalesce(jsonb_agg(to_jsonb(t) order by t.sort),'[]') from public.tests t where t.active),
    'packages', (select coalesce(jsonb_agg(to_jsonb(k) order by k.sort),'[]') from public.packages k where k.active),
    'home_fee', (select value from public.settings where key='home_fee'),
    'self_fee', coalesce((select value from public.settings where key='self_fee'),'"2.000"'::jsonb),
    'stamps_per_free', coalesce((select value from public.settings where key='stamps_per_free'),'5'::jsonb),
    'ramadan', (select value from public.settings where key='ramadan'),
    'wilayats', (select value from public.settings where key='wilayats'),
    'slots', (select value from public.settings where key='slots'),
    'fasting_last_slot', coalesce((select value from public.settings where key='fasting_last_slot'),'"10:00"'::jsonb),
    'stats', jsonb_build_object(
      'nurses', (select count(*) from public.app_users where role='nurse' and status='active'),
      'nurses_f', (select count(*) from public.app_users where role='nurse' and status='active' and meta->>'gender'='female'),
      'nurses_m', (select count(*) from public.app_users where role='nurse' and status='active' and meta->>'gender'='male'),
      'labs', (select count(*) from public.app_users where role='lab' and status='active'),
      'couriers', (select count(*) from public.app_users where role='courier' and status='active' and not coalesce((meta->>'fleet_admin')::boolean,false)),
      'completed', (select count(*) from public.orders where status='completed')))
$function$;

-- automatic steps for demo / auto mode, now aware of kit orders
create or replace function public._auto_step(p_id uuid)
 returns text language plpgsql security definer set search_path to 'public', 'extensions' as $function$
declare o public.orders; nur public.app_users; cou public.app_users; lab public.app_users; pat public.app_users;
begin
  select * into o from public.orders where id=p_id for update skip locked;
  if not found then return null; end if;
  select * into pat from public.app_users where id=o.patient_id;
  select * into nur from public.app_users where id=o.nurse_id;
  if nur.id is null and o.mode <> 'self' then
    select * into nur from public.app_users where id=o.preferred_nurse_id and status='active' and not public._is_manual(app_users);
    if nur.id is null then
      select * into nur from public.app_users u where u.role='nurse' and u.status='active' and not public._is_manual(u) and u.meta->>'gender' = o.patient_gender
        and (u.wilayat = o.wilayat or coalesce(u.meta->'coverage','[]'::jsonb) ? o.wilayat)
        order by (select count(*) from public.orders x where x.nurse_id=u.id and x.status in ('assigned','on_the_way','arrived')), random() limit 1;
    end if;
  end if;
  select * into cou from public.app_users where id=o.courier_id;
  if cou.id is null then
    select * into cou from public.app_users c where c.role='courier' and c.status='active' and not coalesce((c.meta->>'fleet_admin')::boolean,false) and not public._is_manual(c)
      order by (c.wilayat = o.wilayat or coalesce(c.meta->'coverage','[]'::jsonb) ? o.wilayat) desc, random() limit 1;
  end if;
  select * into lab from public.app_users where id=o.lab_id;
  if lab.id is null then select * into lab from public.app_users l where l.role='lab' and l.status='active' order by (l.wilayat=o.wilayat) desc, l.created_at limit 1; end if;
  if o.mode='self' and o.status in ('booked','recollect','assigned','on_the_way','arrived') then
    if cou.id is null then return null; end if;
    if o.status in ('booked','recollect') then update public.orders set courier_id=cou.id, lab_id=coalesce(lab_id,lab.id) where id=o.id; perform public._advance(o.id,'assigned',cou,'Kit courier');
    elsif o.status='assigned' then perform public._advance(o.id,'on_the_way',cou,'Kit on the way');
    elsif o.status='on_the_way' then perform public._advance(o.id,'arrived',cou,'Kit delivered');
    else update public.orders set checklist=jsonb_build_object('labelled',true,'self',true,'at',now()) where id=o.id; perform public._advance(o.id,'collected',pat,'Self-collected');
    end if;
  elsif o.status in ('booked','recollect') then
    if nur.id is null then return null; end if;
    update public.orders set nurse_id=nur.id, lab_id=coalesce(lab_id,lab.id) where id=o.id; perform public._advance(o.id,'assigned',nur,nur.full_name);
  elsif o.status='assigned' then perform public._advance(o.id,'on_the_way',nur);
  elsif o.status='on_the_way' then perform public._advance(o.id,'arrived',nur);
  elsif o.status='arrived' then
    update public.orders set checklist=jsonb_build_object('id_verified',true,'labelled',true,'consent',true,'tubes',greatest(1,(select count(distinct tube) from public.tests where id=any(o.test_ids) and tube not like 'Device%')),'at',now()) where id=o.id;
    perform public._advance(o.id,'collected',nur,'Collected');
  elsif o.status='collected' then
    if cou.id is null then return null; end if;
    update public.orders set courier_id=cou.id, sample_temp=round((3.6+random()*1.6)::numeric,1) where id=o.id;
    perform public._advance(o.id,'in_transit',cou,'Cold box');
  elsif o.status='in_transit' then perform public._advance(o.id,'at_lab',cou);
  elsif o.status='at_lab' then perform public._advance(o.id,'processing',lab);
  elsif o.status='processing' then
    update public.orders set results=public._demo_results(o), published_at=now(), verified_by=coalesce(lab.meta->>'director','Lab Director') where id=o.id;
    perform public._advance(o.id,'completed',lab);
  else return null; end if;
  return (select status from public.orders where id=p_id);
end $function$;

create or replace function public.demo_advance(p_token text, p_id uuid)
 returns jsonb language plpgsql security definer set search_path to 'public', 'extensions' as $function$
declare v public.app_users := public._uid(p_token); o public.orders; nur public.app_users; cou public.app_users; lab public.app_users;
begin
  select * into o from public.orders where id=p_id for update;
  if not found or o.patient_id<>v.id or not v.is_demo then raise exception 'FORBIDDEN'; end if;
  select * into nur from public.app_users where id = coalesce(o.nurse_id, o.preferred_nurse_id);
  if nur.id is null or not nur.is_demo then
    select * into nur from public.app_users where role='nurse' and is_demo and status='active' and meta->>'gender' = o.patient_gender
      order by (wilayat = o.wilayat or coalesce(meta->'coverage','[]'::jsonb) ? o.wilayat) desc, created_at limit 1;
  end if;
  select * into cou from public.app_users where id=o.courier_id;
  if cou.id is null then
    select * into cou from public.app_users where role='courier' and is_demo and status='active' and not coalesce((meta->>'fleet_admin')::boolean,false)
      order by (wilayat = o.wilayat or coalesce(meta->'coverage','[]'::jsonb) ? o.wilayat) desc, created_at limit 1;
  end if;
  select * into lab from public.app_users where id=o.lab_id;
  if lab.id is null then select * into lab from public.app_users where email='lab@demo.labathome.om'; end if;
  if o.mode='self' and o.status in ('booked','recollect') then update public.orders set courier_id=cou.id, lab_id=coalesce(lab_id,lab.id) where id=o.id; perform public._advance(o.id,'assigned',cou,'Kit courier');
  elsif o.mode='self' and o.status='assigned' then perform public._advance(o.id,'on_the_way',cou,'Kit on the way');
  elsif o.mode='self' and o.status='on_the_way' then perform public._advance(o.id,'arrived',cou,'Kit delivered');
  elsif o.mode='self' and o.status='arrived' then update public.orders set checklist=jsonb_build_object('labelled',true,'self',true,'at',now()) where id=o.id; perform public._advance(o.id,'collected',v,'Self-collected');
  elsif o.status in ('booked','recollect') then
    update public.orders set nurse_id=nur.id, lab_id=coalesce(lab_id,lab.id) where id=o.id; perform public._advance(o.id,'assigned',nur,nur.full_name);
  elsif o.status='assigned' then perform public._advance(o.id,'on_the_way',nur);
  elsif o.status='on_the_way' then perform public._advance(o.id,'arrived',nur);
  elsif o.status='arrived' then
    update public.orders set checklist='{"id_verified":true,"labelled":true,"consent":true,"tubes":3}'::jsonb || jsonb_build_object('at',now()) where id=o.id;
    perform public._advance(o.id,'collected',nur,'3 tubes');
  elsif o.status='collected' then update public.orders set courier_id=cou.id, sample_temp=4.2 where id=o.id; perform public._advance(o.id,'in_transit',cou,'4.2 °C');
  elsif o.status='in_transit' then perform public._advance(o.id,'at_lab',cou);
  elsif o.status='at_lab' then perform public._advance(o.id,'processing',lab);
  elsif o.status='processing' then
    update public.orders set results=public._demo_results(o), published_at=now(), verified_by=coalesce(lab.meta->>'director','Lab Director')||' (demo)' where id=o.id;
    perform public._advance(o.id,'completed',lab);
  else raise exception 'BAD_ACTION'; end if;
  select * into o from public.orders where id=p_id;
  return public._order_json(o, v);
end $function$;

-- every step of the sample is written to the chain-of-custody log; a completed referral order earns the friend a stamp
create or replace function public._order_event_after() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare o public.orders; ref uuid;
begin
  select * into o from public.orders where id = new.order_id;
  if new.status in ('collected','in_transit','at_lab','processing') then
    insert into public.sample_scans(order_id, actor_id, actor_role, step, temp, note)
    values (new.order_id, new.actor_id, new.actor_role,
            case new.status when 'collected' then 'collected' when 'in_transit' then 'pickup' when 'at_lab' then 'handover' else 'lab_received' end,
            case when new.status='in_transit' then o.sample_temp end, new.note);
  end if;
  if new.status='completed' and o.disc ? 'referral' and not (o.disc ? 'ref_paid') then
    ref := nullif(o.disc->>'ref_by','')::uuid;
    if ref is not null then
      update public.app_users set meta = jsonb_set(coalesce(meta,'{}'::jsonb), '{bonus_stamps}', to_jsonb(coalesce((meta->>'bonus_stamps')::int,0) + 1)) where id = ref;
      perform public._notify(ref, null, 'referral', '🎁 Your friend used your code: +1 stamp', '🎁 صديقك استخدم كودك: ختم إضافي لك',
        'Thank you for sharing iLab@home.', 'شكراً لأنك شاركت آي لاب@هوم.');
    end if;
    update public.orders set disc = disc || '{"ref_paid":true}'::jsonb where id = o.id;
  end if;
  return new;
end $$;
drop trigger if exists order_events_after on public.order_events;
create trigger order_events_after after insert on public.order_events for each row execute function public._order_event_after();

-- order_action: kit steps for couriers and patients; nurses cannot take kit orders
do $$ declare d text; begin
  select pg_get_functiondef('public.order_action(text,uuid,text,jsonb)'::regprocedure) into d;
  d := replace(d, $q$  if v.role='nurse' and p_action='accept' then
    if o.status not in ('booked','recollect')$q$, $q$  if v.role='nurse' and p_action='accept' then
    if o.mode='self' then raise exception 'BAD_ACTION'; end if;
    if o.status not in ('booked','recollect')$q$);
  d := replace(d, $q$  elsif v.role='patient' and p_action='cancel' and o.status in ('booked','assigned','recollect') then$q$,
  $q$  elsif v.role='courier' and o.mode='self' and p_action='kit_accept' and o.status in ('booked','recollect') and o.courier_id is null and not coalesce((v.meta->>'fleet_admin')::boolean,false) then
    update public.orders set courier_id=v.id where id=o.id;
    perform public._advance(o.id,'assigned',v,'Kit courier');
  elsif v.role='courier' and o.mode='self' and o.courier_id=v.id and p_action='kit_start' and o.status='assigned' then
    perform public._advance(o.id,'on_the_way',v,'Kit on the way');
  elsif v.role='courier' and o.mode='self' and o.courier_id=v.id and p_action='kit_deliver' and o.status='on_the_way' then
    perform public._advance(o.id,'arrived',v,'Kit delivered');
  elsif v.role='patient' and o.mode='self' and p_action='self_collected' and o.status='arrived' then
    if not coalesce((p->>'labelled')::boolean,false) then raise exception 'CHECKLIST'; end if;
    update public.orders set checklist = jsonb_build_object('labelled',true,'self',true,'at',now()) where id=o.id;
    perform public._advance(o.id,'collected',v,'Self-collected');
    if o.courier_id is not null then perform public._notify(o.courier_id, o.id, 'pickup', 'Sample ready for pickup', 'عينة جاهزة للاستلام', o.wilayat||' · '||o.code, o.wilayat||' · '||o.code); end if;
  elsif v.role='patient' and p_action='cancel' and o.status in ('booked','assigned','recollect') then$q$);
  if position('kit_accept' in d) = 0 or position($q$o.mode='self' then raise exception 'BAD_ACTION'$q$ in d) = 0 then raise exception 'order_action patch failed'; end if;
  execute d;
end $$;

-- the order JSON carries the sample chain
do $$ declare d text; begin
  select pg_get_functiondef('public._order_json(orders,app_users)'::regprocedure) into d;
  if position('''scans''' in d) = 0 then
    d := replace(d, $q$    'program', (select jsonb_build_object('name',p.name$q$,
      $q$    'scans', (select coalesce(jsonb_agg(jsonb_build_object('step',s.step,'temp',s.temp,'at',s.at,'role',s.actor_role) order by s.at),'[]') from public.sample_scans s where s.order_id=o.id),
    'program', (select jsonb_build_object('name',p.name$q$);
    if position('''scans''' in d) = 0 then raise exception '_order_json patch failed'; end if;
    execute d;
  end if;
end $$;
