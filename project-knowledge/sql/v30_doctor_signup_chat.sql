-- v30: doctors can join as partners; patient <-> doctor messages inside a consultation.
-- (Team accounts for Rahaf, Alzahraa and two team doctors were created separately; passwords are not stored in the repo.)

-- 1) sign-up: role 'doctor' allowed (pending until approved, like other partners); doctors list for consultations
do $$ declare d text; begin
  select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='auth_register';
  d := replace(d, $q$v_role not in ('patient','nurse','courier','lab','company')$q$, $q$v_role not in ('patient','nurse','courier','lab','company','doctor')$q$);
  d := replace(d, $q$if v_role in ('patient','nurse') and coalesce(p->'meta'->>'gender','')$q$, $q$if v_role in ('patient','nurse','doctor') and coalesce(p->'meta'->>'gender','')$q$);
  d := replace(d, $q$coalesce(p->'meta','{}'::jsonb) || jsonb_build_object('consent_at', now()),$q$,
                  $q$coalesce(p->'meta','{}'::jsonb) || jsonb_build_object('consent_at', now()) || case when v_role='doctor' then '{"consult":true}'::jsonb else '{}'::jsonb end,$q$);
  execute d;
end $$;

-- 2) messages
create table if not exists public.consult_messages (
  id bigserial primary key,
  consult_id uuid not null references public.consults(id) on delete cascade,
  sender_id uuid not null references public.app_users(id) on delete cascade,
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists consult_messages_c on public.consult_messages(consult_id, id);
alter table public.consult_messages enable row level security;

create or replace function public.consult_msgs(p_token text, p_id uuid, p_after bigint default 0) returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare v public.app_users := public._uid(p_token); c public.consults;
begin
  select * into c from public.consults where id=p_id and (patient_id=v.id or doctor_id=v.id or v.role in ('admin','staff'));
  if not found then raise exception 'NOT_FOUND'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'mine',m.sender_id=v.id,'who',case when m.sender_id=c.doctor_id then 'doctor' else 'patient' end,'body',m.body,'at',m.created_at) order by m.id)
    from public.consult_messages m where m.consult_id=c.id and m.id > coalesce(p_after,0)), '[]');
end $$;

create or replace function public.consult_send(p_token text, p_id uuid, p_body text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v public.app_users := public._uid(p_token); c public.consults; other uuid; last_at timestamptz; m public.consult_messages;
begin
  select * into c from public.consults where id=p_id and (patient_id=v.id or doctor_id=v.id);
  if not found then raise exception 'NOT_FOUND'; end if;
  if c.status = 'cancelled' then raise exception 'BAD_ACTION'; end if;
  if coalesce(btrim(p_body),'') = '' then raise exception 'BAD_INPUT'; end if;
  select max(created_at) into last_at from public.consult_messages where consult_id=c.id and sender_id=v.id;
  insert into public.consult_messages(consult_id, sender_id, body) values (c.id, v.id, left(btrim(p_body), 2000)) returning * into m;
  other := case when v.id=c.patient_id then c.doctor_id else c.patient_id end;
  if last_at is null or last_at < now() - interval '3 minutes' then
    perform public._notify(other, null, 'consult_msg', '💬 New message · ' || c.code, '💬 رسالة جديدة · ' || c.code, left(btrim(p_body), 80), left(btrim(p_body), 80));
  end if;
  return jsonb_build_object('id', m.id, 'mine', true, 'who', case when v.id=c.doctor_id then 'doctor' else 'patient' end, 'body', m.body, 'at', m.created_at);
end $$;

grant execute on function public.consult_msgs(text, uuid, bigint), public.consult_send(text, uuid, text) to anon, authenticated;

-- 3) v30_consult_room: the consultation's call room is shown to both sides for every online consult (chat too), so either can start a voice/video call
do $$ declare d text; begin
  select pg_get_functiondef(p.oid) into d from pg_proc p where p.proname='_consult_json' and p.pronamespace='public'::regnamespace;
  d := replace(d, $q$'join', case when c.mode in ('video','voice') and c.status in ('booked','live') then 'https://meet.jit.si/' || c.room end)$q$,
    $q$'join', case when c.mode in ('video','voice') and c.status in ('booked','live') then 'https://meet.jit.si/' || c.room end, 'room', case when c.mode <> 'home' and c.status in ('booked','live') then c.room end)$q$);
  execute d;
end $$;
