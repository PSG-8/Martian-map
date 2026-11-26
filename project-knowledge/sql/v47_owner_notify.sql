-- v47: the owner (non-demo admin) gets a notification for every REAL new booking, consultation and user sign-up.
-- Demo accounts (public password) never trigger it, so visitors trying the demo do not flood the owner.
create or replace function public._owner_notify_new() returns trigger
language plpgsql security definer set search_path = public as $$
declare p public.app_users; o record;
begin
  if TG_TABLE_NAME = 'app_users' then
    if NEW.is_demo or NEW.role <> 'patient' then return NEW; end if;   -- partners already notify admins in auth_register
    for o in select a.id from public.app_users a where public._is_owner(a) loop
      perform public._notify(o.id, null, 'owner_user', 'New user · ' || NEW.full_name, 'مستخدم جديد · ' || NEW.full_name,
        coalesce(NEW.wilayat, ''), coalesce(NEW.wilayat, ''));
    end loop;
    return NEW;
  end if;
  select * into p from public.app_users where id = NEW.patient_id;
  if not found or p.is_demo then return NEW; end if;
  for o in select a.id from public.app_users a where public._is_owner(a) and a.id <> NEW.patient_id loop
    if TG_TABLE_NAME = 'orders' then
      perform public._notify(o.id, NEW.id, 'owner_order', 'New booking · ' || NEW.code, 'حجز جديد · ' || NEW.code,
        p.full_name || ' · ' || coalesce(NEW.wilayat, '') || ' · ' || to_char(NEW.slot_date, 'DD Mon') || ' ' || coalesce(NEW.slot_time, ''),
        p.full_name || ' · ' || coalesce(NEW.wilayat, '') || ' · ' || to_char(NEW.slot_date, 'DD/MM') || ' ' || coalesce(NEW.slot_time, ''));
    else
      perform public._notify(o.id, null, 'owner_consult', 'New consultation · ' || NEW.code, 'استشارة جديدة · ' || NEW.code,
        p.full_name || ' · ' || to_char(NEW.slot_date, 'DD Mon') || ' ' || coalesce(NEW.slot_time, ''),
        p.full_name || ' · ' || to_char(NEW.slot_date, 'DD/MM') || ' ' || coalesce(NEW.slot_time, ''));
    end if;
  end loop;
  return NEW;
end $$;
revoke all on function public._owner_notify_new() from public, anon, authenticated;
drop trigger if exists owner_notify_order on public.orders;
create trigger owner_notify_order after insert on public.orders for each row execute function public._owner_notify_new();
drop trigger if exists owner_notify_consult on public.consults;
create trigger owner_notify_consult after insert on public.consults for each row execute function public._owner_notify_new();
drop trigger if exists owner_notify_user on public.app_users;
create trigger owner_notify_user after insert on public.app_users for each row execute function public._owner_notify_new();
