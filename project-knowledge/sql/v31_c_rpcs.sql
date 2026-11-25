-- v31 (part C): RPCs for loyalty, referral, coupons, privacy, sample checks, safety, share links, trends, company camps.

create or replace function public.my_loyalty(p_token text) returns jsonb
language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare v public.app_users := public._uid(p_token); code text; tries int := 0;
begin
  if v.role <> 'patient' then raise exception 'ONLY_PATIENTS'; end if;
  code := v.meta->>'ref_code';
  while code is null and tries < 8 loop
    code := 'IL' || upper(substr(translate(encode(gen_random_bytes(6),'base64'),'+/=0O1Il',''), 1, 5));
    if length(code) < 7 or exists(select 1 from public.app_users where meta->>'ref_code' = code) then code := null; end if;
    tries := tries + 1;
  end loop;
  if (v.meta->>'ref_code') is null and code is not null then
    update public.app_users set meta = coalesce(meta,'{}'::jsonb) || jsonb_build_object('ref_code', code) where id = v.id;
  end if;
  return public._loyalty(v.id) || jsonb_build_object(
    'ref_code', code,
    'referred', (select count(*) from public.app_users where meta->>'referred_by' = v.id::text),
    'referred_by', v.meta->>'referred_by' is not null,
    'can_apply_ref', (v.meta->>'referred_by') is null and not exists(select 1 from public.orders where patient_id=v.id and status<>'cancelled'),
    'reward', coalesce((select value#>>'{}' from public.settings where key='ref_reward'),'1.000'),
    'history', coalesce((select jsonb_agg(jsonb_build_object('code',o.code,'at',o.created_at,'status',o.status,'free',o.disc ? 'stamp','disc',o.disc) order by o.created_at desc)
                 from (select * from public.orders where patient_id=v.id and status<>'cancelled' and program_id is null order by created_at desc limit 12) o), '[]'::jsonb));
end $$;

create or replace function public.referral_apply(p_token text, p_code text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v public.app_users := public._uid(p_token); r public.app_users;
begin
  if v.role <> 'patient' then raise exception 'ONLY_PATIENTS'; end if;
  if (v.meta->>'referred_by') is not null then raise exception 'REF_DONE'; end if;
  if exists(select 1 from public.orders where patient_id=v.id and status<>'cancelled') then raise exception 'REF_LATE'; end if;
  select * into r from public.app_users where meta->>'ref_code' = upper(btrim(coalesce(p_code,''))) and role='patient';
  if not found or r.id = v.id then raise exception 'BAD_REF'; end if;
  update public.app_users set meta = coalesce(meta,'{}'::jsonb) || jsonb_build_object('referred_by', r.id::text) where id = v.id;
  return jsonb_build_object('ok', true, 'reward', coalesce((select value#>>'{}' from public.settings where key='ref_reward'),'1.000'));
end $$;

create or replace function public.coupon_check(p_token text, p_code text, p_sub numeric) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v public.app_users := public._uid(p_token); c public.coupons; amt numeric;
begin
  if v.role <> 'patient' then raise exception 'ONLY_PATIENTS'; end if;
  amt := public._coupon_amount(v, p_code, p_sub);
  select * into c from public.coupons where code = upper(btrim(p_code));
  return jsonb_build_object('code', c.code, 'kind', c.kind, 'value', c.value, 'amount', amt, 'note', c.note);
end $$;

create or replace function public.admin_coupons(p_token text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v public.app_users := public._uid(p_token);
begin
  if v.role not in ('admin','staff') then raise exception 'FORBIDDEN'; end if;
  return coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at desc) from public.coupons c), '[]'::jsonb);
end $$;

create or replace function public.admin_coupon_save(p_token text, p jsonb) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v public.app_users := public._uid(p_token); c text := upper(btrim(coalesce(p->>'code','')));
begin
  if v.role <> 'admin' then raise exception 'FORBIDDEN'; end if;
  if v.is_demo then raise exception 'DEMO_READONLY'; end if;
  if c !~ '^[A-Z0-9]{3,20}$' then raise exception 'BAD_INPUT'; end if;
  if coalesce(p->>'kind','') not in ('pct','fixed') or coalesce((p->>'value')::numeric,0) <= 0 then raise exception 'BAD_INPUT'; end if;
  if p->>'kind'='pct' and (p->>'value')::numeric > 90 then raise exception 'BAD_INPUT'; end if;
  insert into public.coupons(code,kind,value,max_uses,min_sub,first_order,expires_on,active,note)
  values (c, p->>'kind', (p->>'value')::numeric, nullif(p->>'max_uses','')::int, coalesce(nullif(p->>'min_sub','')::numeric,0),
          coalesce((p->>'first_order')::boolean,false), nullif(p->>'expires_on','')::date, coalesce((p->>'active')::boolean,true), nullif(btrim(coalesce(p->>'note','')),''))
  on conflict (code) do update set kind=excluded.kind, value=excluded.value, max_uses=excluded.max_uses, min_sub=excluded.min_sub,
     first_order=excluded.first_order, expires_on=excluded.expires_on, active=excluded.active, note=excluded.note;
  return public.admin_coupons(p_token);
end $$;

-- privacy: who opened my reports, my requests, my data
create or replace function public.my_privacy(p_token text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v public.app_users := public._uid(p_token);
begin
  return jsonb_build_object(
    'consent_at', v.meta->>'consent_at',
    'views', case when v.role='patient' then coalesce((select jsonb_agg(jsonb_build_object('code',o.code,'role',rv.viewer_role,'at',rv.at,
              'who', case when rv.viewer_role in ('admin','staff') then null when rv.viewer_role='lab' then coalesce(a.meta->>'lab_name', a.full_name) else a.full_name end) order by rv.at desc)
            from (select * from public.report_views where order_id in (select id from public.orders where patient_id=v.id) and (viewer_id is distinct from v.id) order by at desc limit 60) rv
            join public.orders o on o.id=rv.order_id left join public.app_users a on a.id=rv.viewer_id), '[]'::jsonb) else '[]'::jsonb end,
    'shares', case when v.role='patient' then coalesce((select jsonb_agg(jsonb_build_object('token',s.token,'code',o.code,'expires_at',s.expires_at,'views',s.views,'revoked',s.revoked) order by s.created_at desc)
            from public.share_links s join public.orders o on o.id=s.order_id where s.created_by=v.id), '[]'::jsonb) else '[]'::jsonb end,
    'requests', coalesce((select jsonb_agg(to_jsonb(r) - 'user_id' order by r.created_at desc) from public.privacy_requests r where r.user_id=v.id), '[]'::jsonb));
end $$;

create or replace function public.privacy_request(p_token text, p_kind text, p_note text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v public.app_users := public._uid(p_token); r public.privacy_requests;
begin
  if p_kind not in ('export','delete','correct') then raise exception 'BAD_INPUT'; end if;
  if exists(select 1 from public.privacy_requests where user_id=v.id and kind=p_kind and status='open') then raise exception 'ALREADY_OPEN'; end if;
  insert into public.privacy_requests(user_id, kind, note) values (v.id, p_kind, left(nullif(btrim(coalesce(p_note,'')),''), 1000)) returning * into r;
  perform public._notify(a.id, null, 'privacy', 'Privacy request · '||p_kind, 'طلب خصوصية · '||p_kind, v.full_name, v.full_name)
    from public.app_users a where a.role in ('admin','staff') and a.status='active';
  return to_jsonb(r) - 'user_id';
end $$;

create or replace function public.my_data_export(p_token text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v public.app_users := public._uid(p_token);
begin
  return jsonb_build_object(
    'exported_at', now(), 'service', 'iLab@home',
    'profile', jsonb_build_object('name', v.full_name, 'email', v.email, 'phone', v.phone, 'role', v.role, 'governorate', v.governorate, 'wilayat', v.wilayat,
        'address', v.address, 'created_at', v.created_at, 'details', coalesce(v.meta,'{}'::jsonb) - 'ref_code' - 'referred_by' - 'bonus_stamps'),
    'orders', coalesce((select jsonb_agg(public._order_json(o, v) order by o.created_at desc) from (select * from public.orders where patient_id=v.id order by created_at desc limit 200) o), '[]'::jsonb),
    'consultations', coalesce((select jsonb_agg(jsonb_build_object('code',c.code,'kind',c.kind,'mode',c.mode,'date',c.slot_date,'time',c.slot_time,'status',c.status,'reason',c.reason,'note',c.note) order by c.created_at desc)
                       from public.consults c where c.patient_id=v.id), '[]'::jsonb),
    'privacy_requests', coalesce((select jsonb_agg(to_jsonb(r) - 'user_id') from public.privacy_requests r where r.user_id=v.id), '[]'::jsonb));
end $$;

create or replace function public.admin_privacy(p_token text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v public.app_users := public._uid(p_token);
begin
  if v.role not in ('admin','staff') then raise exception 'FORBIDDEN'; end if;
  return coalesce((select jsonb_agg(to_jsonb(r) || jsonb_build_object('user', case when v.is_demo and not u.is_demo then '—' else u.full_name end) order by (r.status='open') desc, r.created_at desc)
    from public.privacy_requests r join public.app_users u on u.id=r.user_id), '[]'::jsonb);
end $$;

create or replace function public.admin_privacy_done(p_token text, p_id bigint, p_status text, p_reply text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v public.app_users := public._uid(p_token); r public.privacy_requests;
begin
  if v.role not in ('admin','staff') then raise exception 'FORBIDDEN'; end if;
  if v.is_demo then raise exception 'DEMO_READONLY'; end if;
  if p_status not in ('done','rejected') then raise exception 'BAD_INPUT'; end if;
  update public.privacy_requests set status=p_status, reply=nullif(btrim(coalesce(p_reply,'')),''), done_at=now() where id=p_id returning * into r;
  if not found then raise exception 'NOT_FOUND'; end if;
  perform public._notify(r.user_id, null, 'privacy', 'Your privacy request was answered', 'تم الرد على طلب الخصوصية', coalesce(r.reply,''), coalesce(r.reply,''));
  return public.admin_privacy(p_token);
end $$;

-- extra cold-chain check (scan the order code and write the box temperature)
create or replace function public.sample_log(p_token text, p_id uuid, p_code text, p_temp numeric, p_note text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v public.app_users := public._uid(p_token); o public.orders;
begin
  select * into o from public.orders where id=p_id;
  if not found or not public._can_see(o, v) or v.role not in ('nurse','courier','lab','admin','staff') then raise exception 'NOT_FOUND'; end if;
  if upper(btrim(coalesce(p_code,''))) <> upper(o.code) then raise exception 'CODE_MISMATCH'; end if;
  if p_temp is null or p_temp < -30 or p_temp > 45 then raise exception 'NEED_TEMP'; end if;
  if o.status not in ('collected','in_transit','at_lab','processing') then raise exception 'BAD_ACTION'; end if;
  insert into public.sample_scans(order_id, actor_id, actor_role, step, temp, note) values (o.id, v.id, v.role, 'check', p_temp, left(nullif(btrim(coalesce(p_note,'')),''), 300));
  if p_temp < 2 or p_temp > 8 then
    perform public._notify(a.id, o.id, 'temp_alert', '🌡 Sample temperature out of range · '||o.code, '🌡 حرارة العينة خارج المدى · '||o.code, p_temp||' °C', p_temp||' °C')
      from public.app_users a where (a.role in ('admin','staff') and a.status='active') or a.id = o.lab_id;
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('step',s.step,'temp',s.temp,'at',s.at,'role',s.actor_role) order by s.at) from public.sample_scans s where s.order_id=o.id), '[]'::jsonb);
end $$;

-- safety for nurses and couriers
create or replace function public.sos_raise(p_token text, p_order uuid, p_lat float8, p_lng float8, p_note text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v public.app_users := public._uid(p_token); s public.sos_alerts; oc text;
begin
  if v.role not in ('nurse','courier') then raise exception 'FORBIDDEN'; end if;
  if p_order is not null then select code into oc from public.orders where id=p_order and (nurse_id=v.id or courier_id=v.id); end if;
  insert into public.sos_alerts(user_id, order_id, lat, lng, note) values (v.id, case when oc is not null then p_order end, p_lat, p_lng, left(nullif(btrim(coalesce(p_note,'')),''), 500)) returning * into s;
  perform public._notify(a.id, s.order_id, 'sos', '🚨 SOS · '||v.full_name, '🚨 طلب نجدة · '||v.full_name,
      coalesce(oc,'')||case when p_lat is not null then ' · https://maps.google.com/?q='||round(p_lat::numeric,5)||','||round(p_lng::numeric,5) else '' end,
      coalesce(oc,'')||case when p_lat is not null then ' · https://maps.google.com/?q='||round(p_lat::numeric,5)||','||round(p_lng::numeric,5) else '' end)
    from public.app_users a where a.role in ('admin','staff') and a.status='active';
  return jsonb_build_object('id', s.id, 'at', s.created_at);
end $$;

create or replace function public.incident_report(p_token text, p_order uuid, p_kind text, p_note text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v public.app_users := public._uid(p_token); i public.incidents;
begin
  if v.role not in ('nurse','courier','lab') then raise exception 'FORBIDDEN'; end if;
  if p_kind not in ('needle','faint','sample','safety','vehicle','other') or coalesce(btrim(p_note),'') = '' then raise exception 'BAD_INPUT'; end if;
  insert into public.incidents(user_id, order_id, kind, note) values (v.id, p_order, p_kind, left(btrim(p_note), 1500)) returning * into i;
  perform public._notify(a.id, p_order, 'incident', 'Incident report · '||p_kind, 'بلاغ حادث · '||p_kind, v.full_name, v.full_name)
    from public.app_users a where a.role in ('admin','staff') and a.status='active';
  return jsonb_build_object('id', i.id);
end $$;

create or replace function public.admin_safety(p_token text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v public.app_users := public._uid(p_token);
begin
  if v.role not in ('admin','staff') then raise exception 'FORBIDDEN'; end if;
  return jsonb_build_object(
    'sos', coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'who',u.full_name,'role',u.role,'phone',case when v.is_demo and not u.is_demo then null else u.phone end,'lat',s.lat,'lng',s.lng,'note',s.note,'at',s.created_at,'resolved_at',s.resolved_at,'order',o.code) order by s.resolved_at nulls first, s.created_at desc)
             from (select * from public.sos_alerts order by created_at desc limit 50) s join public.app_users u on u.id=s.user_id left join public.orders o on o.id=s.order_id), '[]'::jsonb),
    'incidents', coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'who',u.full_name,'role',u.role,'kind',i.kind,'note',i.note,'status',i.status,'at',i.created_at,'order',o.code) order by (i.status='open') desc, i.created_at desc)
             from (select * from public.incidents order by created_at desc limit 80) i join public.app_users u on u.id=i.user_id left join public.orders o on o.id=i.order_id), '[]'::jsonb));
end $$;

create or replace function public.admin_safety_close(p_token text, p_kind text, p_id bigint) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v public.app_users := public._uid(p_token);
begin
  if v.role not in ('admin','staff') then raise exception 'FORBIDDEN'; end if;
  if v.is_demo then raise exception 'DEMO_READONLY'; end if;
  if p_kind='sos' then update public.sos_alerts set resolved_at=now(), resolved_by=v.id where id=p_id and resolved_at is null;
  elsif p_kind='incident' then update public.incidents set status='closed' where id=p_id;
  else raise exception 'BAD_INPUT'; end if;
  return public.admin_safety(p_token);
end $$;

-- share a finished report with a doctor through a private link that expires
create or replace function public.share_create(p_token text, p_id uuid, p_hours int default 72) returns jsonb
language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare v public.app_users := public._uid(p_token); o public.orders; tk text; s public.share_links;
begin
  select * into o from public.orders where id=p_id and patient_id=v.id and status='completed';
  if not found then raise exception 'NOT_FOUND'; end if;
  if (select count(*) from public.share_links where created_by=v.id and created_at > now() - interval '1 day') >= 20 then raise exception 'TOO_MANY'; end if;
  tk := translate(encode(gen_random_bytes(18),'base64'),'+/=','-_');
  insert into public.share_links(token, order_id, created_by, expires_at) values (tk, o.id, v.id, now() + make_interval(hours => greatest(1, least(coalesce(p_hours,72), 168)))) returning * into s;
  return jsonb_build_object('token', s.token, 'expires_at', s.expires_at);
end $$;

create or replace function public.share_revoke(p_token text, p_share text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v public.app_users := public._uid(p_token);
begin
  update public.share_links set revoked=true where token=p_share and created_by=v.id;
  if not found then raise exception 'NOT_FOUND'; end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.share_get(p_share text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare s public.share_links; o public.orders; pat public.app_users; lab public.app_users; dob date;
begin
  select * into s from public.share_links where token=p_share;
  if not found or s.revoked or s.expires_at < now() then raise exception 'LINK_EXPIRED'; end if;
  select * into o from public.orders where id=s.order_id and status='completed';
  if not found then raise exception 'LINK_EXPIRED'; end if;
  select * into pat from public.app_users where id=o.patient_id;
  select * into lab from public.app_users where id=o.lab_id;
  update public.share_links set views = views + 1 where token=p_share;
  insert into public.report_views(order_id, viewer_id, viewer_role) values (o.id, null, 'share');
  dob := nullif(coalesce(o.person->>'dob', pat.meta->>'dob'),'')::date;
  return jsonb_build_object('code', o.code, 'name', split_part(coalesce(o.person->>'name', pat.full_name),' ',1),
    'age', case when dob is not null then date_part('year', age(dob))::int end, 'sex', o.patient_gender,
    'published_at', o.published_at, 'verified_by', o.verified_by, 'lab', coalesce(lab.meta->>'lab_name', lab.full_name), 'licence', lab.meta->>'license',
    'results', o.results, 'severity', o.severity, 'expires_at', s.expires_at,
    'doctor_note', case when o.doctor_note is not null then jsonb_build_object('name', o.doctor_note->>'name', 'note', o.doctor_note->>'note') end,
    'tests', (select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name_en',t.name_en,'name_ar',t.name_ar,'analytes',t.analytes) order by t.sort),'[]') from public.tests t where t.id = any(o.test_ids)));
end $$;

-- my numbers over time (for the trend charts)
create or replace function public.my_trends(p_token text, p_codes text[]) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v public.app_users := public._uid(p_token);
begin
  if v.role <> 'patient' then raise exception 'ONLY_PATIENTS'; end if;
  return coalesce((select jsonb_object_agg(k, pts) from (
      select kv.key k, jsonb_agg(jsonb_build_object('at', o.published_at, 'v', (kv.value->>'v')::numeric, 'f', kv.value->>'f', 'code', o.code) order by o.published_at) pts
      from public.orders o, jsonb_each(coalesce(o.results,'{}'::jsonb)) kv
      where o.patient_id=v.id and o.status='completed' and coalesce(o.person->>'relation','self')='self' and kv.key = any(p_codes) and (kv.value->>'v') is not null
      group by kv.key) x), '{}'::jsonb);
end $$;

-- company camp visits (workers / expat pre-checks)
create or replace function public.camp_create(p_token text, p jsonb) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v public.app_users := public._uid(p_token); c public.camp_requests; w jsonb; n int; d date := nullif(p->>'visit_date','')::date;
begin
  if v.role <> 'company' then raise exception 'FORBIDDEN'; end if;
  if v.status <> 'active' then raise exception 'NOT_VERIFIED'; end if;
  if not coalesce((p->>'consent')::boolean,false) then raise exception 'NEED_CONSENT'; end if;
  if not exists(select 1 from public.packages where id = p->>'package_id' and active) then raise exception 'BAD_ITEM'; end if;
  if coalesce(btrim(p->>'site'),'') = '' then raise exception 'NEED_ADDRESS'; end if;
  if d is null or d < public._today() + 2 or d > public._today() + 90 then raise exception 'BAD_DATE'; end if;
  w := coalesce(p->'workers','[]'::jsonb); n := jsonb_array_length(w);
  if n < 1 or n > 500 then raise exception 'BAD_INPUT'; end if;
  if exists(select 1 from jsonb_array_elements(w) x where coalesce(btrim(x->>'n'),'') = '') then raise exception 'BAD_INPUT'; end if;
  insert into public.camp_requests(code, company_id, package_id, site, wilayat, visit_date, workers, consent, note)
  values ('CMP-'||nextval('public.camp_seq'), v.id, p->>'package_id', btrim(p->>'site'), nullif(p->>'wilayat',''), d,
          (select jsonb_agg(jsonb_build_object('n', left(btrim(x->>'n'),80), 'id', left(regexp_replace(coalesce(x->>'id',''),'[^A-Za-z0-9]','','g'),20), 'g', case when x->>'g' in ('male','female') then x->>'g' end, 'nat', left(coalesce(x->>'nat',''),40))) from jsonb_array_elements(w) x),
          true, left(nullif(btrim(coalesce(p->>'note','')),''),500))
  returning * into c;
  perform public._notify(a.id, null, 'camp', 'Camp visit request · '||c.code, 'طلب زيارة سكن عمال · '||c.code, v.full_name||' · '||n||' workers', v.full_name||' · '||n||' عامل')
    from public.app_users a where a.role in ('admin','staff') and a.status='active';
  return to_jsonb(c);
end $$;

create or replace function public.camps_mine(p_token text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v public.app_users := public._uid(p_token);
begin
  if v.role <> 'company' then raise exception 'FORBIDDEN'; end if;
  -- the company sees only fit / unfit / retest per worker, never the medical values
  return coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'code',c.code,'package_id',c.package_id,'site',c.site,'wilayat',c.wilayat,'visit_date',c.visit_date,'status',c.status,
      'workers', (select jsonb_agg(jsonb_build_object('n', w.value->>'n', 'id', right(coalesce(w.value->>'id',''),4), 'r', c.results->>(w.ordinality-1)::text) order by w.ordinality) from jsonb_array_elements(c.workers) with ordinality w),
      'created_at',c.created_at) order by c.created_at desc) from public.camp_requests c where c.company_id=v.id), '[]'::jsonb);
end $$;

create or replace function public.admin_camps(p_token text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v public.app_users := public._uid(p_token);
begin
  if v.role not in ('admin','staff') then raise exception 'FORBIDDEN'; end if;
  return coalesce((select jsonb_agg(to_jsonb(c) || jsonb_build_object('company', u.full_name, 'workers_n', jsonb_array_length(c.workers)) order by c.created_at desc)
    from public.camp_requests c join public.app_users u on u.id=c.company_id), '[]'::jsonb);
end $$;

create or replace function public.camp_update(p_token text, p_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v public.app_users := public._uid(p_token); c public.camp_requests;
begin
  if v.role not in ('admin','staff') then raise exception 'FORBIDDEN'; end if;
  if v.is_demo then raise exception 'DEMO_READONLY'; end if;
  if p ? 'status' and p->>'status' not in ('requested','scheduled','visited','completed','cancelled') then raise exception 'BAD_INPUT'; end if;
  update public.camp_requests set status = coalesce(p->>'status', status), visit_date = coalesce(nullif(p->>'visit_date','')::date, visit_date),
    results = case when p ? 'results' then p->'results' else results end, note = coalesce(p->>'note', note), updated_at=now() where id=p_id returning * into c;
  if not found then raise exception 'NOT_FOUND'; end if;
  perform public._notify(c.company_id, null, 'camp', 'Camp visit '||c.code||': '||c.status, 'زيارة '||c.code||': '||c.status, to_char(c.visit_date,'DD Mon'), to_char(c.visit_date,'DD/MM'));
  return public.admin_camps(p_token);
end $$;

-- access: public RPCs callable through the API; internal helpers are not
revoke all on function public._loyalty(uuid), public._coupon_amount(app_users, text, numeric), public._order_event_after() from public, anon, authenticated;
grant execute on function
  public.my_loyalty(text), public.referral_apply(text,text), public.coupon_check(text,text,numeric), public.admin_coupons(text), public.admin_coupon_save(text,jsonb),
  public.my_privacy(text), public.privacy_request(text,text,text), public.my_data_export(text), public.admin_privacy(text), public.admin_privacy_done(text,bigint,text,text),
  public.sample_log(text,uuid,text,numeric,text), public.sos_raise(text,uuid,float8,float8,text), public.incident_report(text,uuid,text,text),
  public.admin_safety(text), public.admin_safety_close(text,text,bigint), public.share_create(text,uuid,int), public.share_revoke(text,text), public.share_get(text),
  public.my_trends(text,text[]), public.camp_create(text,jsonb), public.camps_mine(text), public.admin_camps(text), public.camp_update(text,uuid,jsonb)
to anon, authenticated;
