-- v48: "result to review" notifications went to EVERY doctor, including demo doctors, for real patients' orders.
-- Demo doctors cannot open real patients' orders (v33 isolation), so the notification opened "Not found".
-- Now: a doctor is notified only for orders they can open (_demo_ok); the owner is notified for real patients' results
-- (there is no real licensed doctor account yet), never for demo patients.
do $$
declare d text; a text := 'from public.app_users d where d.role=''doctor'' and d.status=''active'';';
begin
  d := pg_get_functiondef('public._orders_published()'::regprocedure);
  if position('v48_review' in d) = 0 then
    if (length(d) - length(replace(d, a, ''))) / length(a) <> 1 then raise exception 'v48: doctor filter not found exactly once'; end if;
    execute replace(d, a, 'from public.app_users d where /* v48_review */ ((d.role=''doctor'' and d.status=''active'' and public._demo_ok(d, new.patient_id)) or (public._is_owner(d) and d.id <> new.patient_id and not coalesce((select u.is_demo from public.app_users u where u.id = new.patient_id), true)));');
  end if;
end $$;
-- the old "not found" notifications in demo doctors' lists (for orders they cannot open) are marked read
update public.notifications n set read = true
 where n.kind = 'doctor_review' and exists (select 1 from public.app_users d where d.id = n.user_id and d.is_demo)
   and exists (select 1 from public.orders o join public.app_users p on p.id = o.patient_id where o.id = n.order_id and not p.is_demo);
