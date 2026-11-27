-- v55 security hardening (owner-approved, 2026-11-27). One transaction: if any step fails, nothing changes.
-- 1) close the 15 tables that still had table rights for anon/authenticated (access is only through checked functions)
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- 2) fixed search path on the two new message helpers
alter function public._auto_test_lines(text[], boolean) set search_path = public;
alter function public._consult_auto_text(text, text, boolean, boolean) set search_path = public;

-- 3) owner identity by internal account id (not by email, not by "any real admin")
--    Applied on 2026-11-27 with the owner's account id written in directly. This public copy finds the same account
--    (the one and only real admin at that time) so the id itself is not published; it stops if there is not exactly one.
insert into public.private_config(key, value)
select 'owner_id', (select id::text from public.app_users where role = 'admin' and not is_demo)
where not exists (select 1 from public.private_config where key = 'owner_id')
  and (select count(*) from public.app_users where role = 'admin' and not is_demo) = 1;
do $$ begin
  if not exists (select 1 from public.private_config where key = 'owner_id') then raise exception 'v55: owner account not found, stopping'; end if;
end $$;
create or replace function public._is_owner(v public.app_users) returns boolean
language sql stable set search_path = public as $$
  select v.role = 'admin' and not v.is_demo and v.id::text = (select value from public.private_config where key = 'owner_id')
$$;

-- 4) the owner row cannot be deleted, demoted, suspended or turned into a demo account, by any path;
--    and no second real admin can appear (staff is the limited admin role)
create or replace function public._protect_owner() returns trigger
language plpgsql security definer set search_path = public as $$
declare oid text := (select value from public.private_config where key = 'owner_id');
begin
  if TG_OP = 'DELETE' then
    if old.id::text = oid then raise exception 'OWNER_PROTECTED'; end if;
    return old;
  end if;
  if TG_OP = 'UPDATE' and old.id::text = oid and (new.id is distinct from old.id or new.role is distinct from old.role or new.is_demo is distinct from old.is_demo or new.status is distinct from old.status) then
    raise exception 'OWNER_PROTECTED';
  end if;
  if new.role = 'admin' and not new.is_demo and new.id::text is distinct from oid and (TG_OP = 'INSERT' or old.role is distinct from 'admin' or old.is_demo) then
    raise exception 'ADMIN_LOCKED';
  end if;
  return new;
end $$;
revoke all on function public._protect_owner() from public, anon, authenticated;
drop trigger if exists app_users_protect_owner on public.app_users;
create trigger app_users_protect_owner before insert or update or delete on public.app_users for each row execute function public._protect_owner();

-- 5) Google sign-in only for user (patient) accounts; never for team / staff / owner / demo accounts or the team domain
do $$ declare d text; begin
  d := pg_get_functiondef('public.auth_google(text, text, text)'::regprocedure);
  if position('v55' in d) = 0 then
    d := regexp_replace(d, '(raise exception ''BAD_INPUT''; end if;)', '\1 /* v55 */ if em ~ ''@(demo\.)?labathome\.om$'' then raise exception ''USE_PASSWORD''; end if;');
    d := regexp_replace(d, '(raise exception ''ACCOUNT_BLOCKED''; end if;)', '\1 if u.role <> ''patient'' or u.is_demo then raise exception ''USE_PASSWORD''; end if;');
    if (length(d) - length(replace(d, 'USE_PASSWORD', ''))) / length('USE_PASSWORD') <> 2 then raise exception 'v55: auth_google patch failed'; end if;
    execute d;
  end if;
end $$;

-- 6) email change for team/staff/owner accounts needs the current password (stops a stolen session from taking over by email)
do $$ declare d text; begin
  d := pg_get_functiondef('public.email_set(text, text)'::regprocedure);
  if position('v55' in d) = 0 then
    d := regexp_replace(d, '(if v\.is_demo then raise exception ''DEMO_READONLY''; end if;)', '\1 /* v55 */ if v.role <> ''patient'' and current_setting(''lah.reauth'', true) is distinct from ''1'' then raise exception ''REAUTH_REQUIRED''; end if;');
    if position('REAUTH_REQUIRED' in d) = 0 then raise exception 'v55: email_set patch failed'; end if;
    execute d;
  end if;
end $$;
create or replace function public.email_set(p_token text, p_email text, p_password text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v public.app_users := public._uid(p_token);
begin
  if v.is_demo then raise exception 'DEMO_READONLY'; end if;
  if coalesce(p_password, '') = '' or extensions.crypt(p_password, v.pass_hash) <> v.pass_hash then raise exception 'BAD_LOGIN'; end if;
  perform set_config('lah.reauth', '1', true);
  return public.email_set(p_token, p_email);
end $$;

-- 7) log out from every device
create or replace function public.auth_logout_all(p_token text) returns void
language plpgsql security definer set search_path = public as $$
declare v public.app_users := public._uid(p_token);
begin
  delete from public.sessions where user_id = v.id;
  insert into public.security_audit(actor, action, target, detail) values (v.id, 'logout_all_devices', v.id, '{}'::jsonb);
end $$;

-- 8) security audit log (who did what), protected: no direct access, rows cannot be changed or deleted from the app
create table if not exists public.security_audit (id bigserial primary key, at timestamptz not null default now(), actor uuid, action text not null, target uuid, detail jsonb not null default '{}'::jsonb);
alter table public.security_audit enable row level security;
revoke all on public.security_audit from anon, authenticated;
create index if not exists security_audit_at on public.security_audit(at desc);
create or replace function public._audit_no_change() returns trigger language plpgsql set search_path = public as $$ begin raise exception 'AUDIT_READONLY'; end $$;
drop trigger if exists security_audit_ro on public.security_audit;
create trigger security_audit_ro before update or delete on public.security_audit for each row execute function public._audit_no_change();
-- every signed-in call records who is acting (transaction-local), so the audit knows the actor
do $$ declare d text; begin
  d := pg_get_functiondef('public._uid(text)'::regprocedure);
  if position('lah.actor' in d) = 0 then
    d := regexp_replace(d, '(if not found then raise exception ''AUTH_REQUIRED''; end if;)', '\1 perform set_config(''lah.actor'', u.id::text, true);');
    if position('lah.actor' in d) = 0 then raise exception 'v55: _uid patch failed'; end if;
    execute d;
  end if;
end $$;
create or replace function public._audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare a uuid := nullif(current_setting('lah.actor', true), '')::uuid; ch jsonb := '{}'::jsonb;
begin
  if TG_TABLE_NAME = 'app_users' then
    if TG_OP = 'INSERT' then insert into public.security_audit(actor, action, target, detail) values (a, 'user_created', new.id, jsonb_build_object('role', new.role, 'demo', new.is_demo));
    elsif TG_OP = 'DELETE' then insert into public.security_audit(actor, action, target, detail) values (a, 'user_deleted', old.id, jsonb_build_object('role', old.role, 'name', old.full_name));
    else
      if new.role is distinct from old.role then ch := ch || jsonb_build_object('role', jsonb_build_array(old.role, new.role)); end if;
      if new.status is distinct from old.status then ch := ch || jsonb_build_object('status', jsonb_build_array(old.status, new.status)); end if;
      if new.is_demo is distinct from old.is_demo then ch := ch || jsonb_build_object('demo', jsonb_build_array(old.is_demo, new.is_demo)); end if;
      if new.email is distinct from old.email then ch := ch || jsonb_build_object('email', 'changed'); end if;
      if new.phone is distinct from old.phone then ch := ch || jsonb_build_object('phone', 'changed'); end if;
      if new.pass_hash is distinct from old.pass_hash then ch := ch || jsonb_build_object('password', 'changed'); end if;
      if ch <> '{}'::jsonb then insert into public.security_audit(actor, action, target, detail) values (a, 'user_changed', new.id, ch); end if;
    end if;
  elsif TG_TABLE_NAME = 'settings' then
    insert into public.security_audit(actor, action, detail) values (a, 'setting_' || lower(TG_OP), jsonb_build_object('key', coalesce(new.key, old.key)));
  elsif TG_TABLE_NAME = 'coupons' then
    insert into public.security_audit(actor, action, detail) values (a, 'coupon_' || lower(TG_OP), jsonb_build_object('code', coalesce(new.code, old.code)));
  elsif TG_TABLE_NAME = 'private_config' then
    insert into public.security_audit(actor, action, detail) values (a, 'secret_config_' || lower(TG_OP), jsonb_build_object('key', coalesce(new.key, old.key)));
  end if;
  return coalesce(new, old);
end $$;
revoke all on function public._audit_row() from public, anon, authenticated;
drop trigger if exists audit_app_users on public.app_users;
create trigger audit_app_users after insert or update or delete on public.app_users for each row execute function public._audit_row();
drop trigger if exists audit_settings on public.settings;
create trigger audit_settings after insert or update or delete on public.settings for each row execute function public._audit_row();
drop trigger if exists audit_coupons on public.coupons;
create trigger audit_coupons after insert or update or delete on public.coupons for each row execute function public._audit_row();
drop trigger if exists audit_private_config on public.private_config;
create trigger audit_private_config after insert or update or delete on public.private_config for each row execute function public._audit_row();

-- 9) the owner's security page: audit log, failed sign-ins, sessions
create or replace function public.admin_security(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v public.app_users := public._uid(p_token);
begin
  if not public._is_owner(v) then raise exception 'FORBIDDEN'; end if;
  return jsonb_build_object(
    'audit', coalesce((select jsonb_agg(x order by x->>'at' desc) from (select jsonb_build_object('at', s.at, 'action', s.action, 'actor', coalesce(a.full_name, '—'), 'target', coalesce(t.full_name, ''), 'detail', s.detail) x
                       from public.security_audit s left join public.app_users a on a.id = s.actor left join public.app_users t on t.id = s.target order by s.at desc limit 150) z), '[]'::jsonb),
    'failed', coalesce((select jsonb_agg(f order by f->>'last' desc) from (select jsonb_build_object('login', left(l.login, 3) || '***', 'n', count(*), 'last', max(l.created_at)) f
                       from public.login_attempts l where not l.ok and l.created_at > now() - interval '7 days' group by l.login order by max(l.created_at) desc limit 50) z), '[]'::jsonb),
    'failed_24h', (select count(*) from public.login_attempts where not ok and created_at > now() - interval '24 hours'),
    'sessions_active', (select count(*) from public.sessions where expires_at > now()),
    'my_sessions', (select count(*) from public.sessions where user_id = v.id and expires_at > now()));
end $$;

-- 10) (applied as v55b) "log out of all devices" also removes that account's push subscriptions,
--     so phones that were signed out stop receiving notification text
create or replace function public.auth_logout_all(p_token text) returns void
language plpgsql security definer set search_path = public as $$
declare v public.app_users := public._uid(p_token); s int; p int;
begin
  delete from public.sessions where user_id = v.id; get diagnostics s = row_count;
  delete from public.push_subs where user_id = v.id; get diagnostics p = row_count;
  insert into public.security_audit(actor, action, target, detail) values (v.id, 'logout_all_devices', v.id, jsonb_build_object('sessions', s, 'push', p));
end $$;
