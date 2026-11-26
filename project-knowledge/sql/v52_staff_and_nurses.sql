-- v52 (owner's request, pilot): more real doctors (men and women, incl. dentists) and real male + female nurses;
-- nurse booking fixed for real users. Passwords were given to the owner in chat only (not stored here).
-- 1) real users only see real nurses (demo visitors see demo nurses); pilot nurses always count as available today
do $$
declare d text; a text := '(n.available_on = public._today() or n.is_demo)';
begin
  d := pg_get_functiondef('public.nurses_today(text, text, text)'::regprocedure);
  if position('v52' in d) = 0 then
    if position(a in d) = 0 then raise exception 'v52: nurses_today shape changed'; end if;
    execute replace(d, a, '(n.available_on = public._today() or n.is_demo or coalesce((n.meta->>''pilot'')::boolean, false)) and n.is_demo = coalesce(v.is_demo, false) /* v52 */');
  end if;
end $$;
-- 2) a new booking never goes to (or notifies) a nurse of the other world (demo vs real)
do $$
declare d text; a1 text := 'raise exception ''ONLY_PATIENTS''; end if;';
  a2 text := 'a.role=''nurse'' and a.status=''active'' and a.available and (v_nurse is null or a.id = v_nurse)';
begin
  d := pg_get_functiondef('public.order_create(text, jsonb)'::regprocedure);
  if position('v52' in d) = 0 then
    if position(a1 in d) = 0 or position(a2 in d) = 0 then raise exception 'v52: order_create shape changed'; end if;
    d := replace(d, a1, a1 || ' /* v52 */ if v_nurse is not null and (select u.is_demo from public.app_users u where u.id = v_nurse) is distinct from v.is_demo then v_nurse := null; end if;');
    d := replace(d, a2, a2 || ' and a.is_demo = v.is_demo');
    execute d;
  end if;
end $$;
-- 3) the founding-team nurses count as always available in the pilot
update public.app_users set meta = meta || '{"pilot": true}'::jsonb where email in ('rahaf@labathome.om', 'alzahraa@labathome.om');
-- 4) new staff accounts: see the migration applied on 2026-11-26 (inserted with bcrypt hashes of private passwords)
-- 5) privacy: old "result to review" notifications in demo doctor accounts that named real orders are removed
delete from public.notifications n
 where n.kind = 'doctor_review' and exists (select 1 from public.app_users d where d.id = n.user_id and d.is_demo)
   and exists (select 1 from public.orders o join public.app_users p on p.id = o.patient_id where o.id = n.order_id and not p.is_demo);
-- 6) the two demo nurse accounts that carried team members' names get fictional names
update public.app_users set full_name = 'Nawal Al Rashdi' where email = 'ansam@demo.labathome.om';
update public.app_users set full_name = 'Khadija Al Abri' where email = 'jokha@demo.labathome.om';
