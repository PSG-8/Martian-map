-- v49 (owner's request, pilot): the two team doctor accounts with PRIVATE passwords take real users' consultations and
-- result reviews. Demo doctor accounts (public password) stay demo-only, so real users' data never opens with Demo@2026.
update public.app_users
   set is_demo = false,
       meta = (meta - 'license') || jsonb_build_object('consult', true, 'pilot', true, 'langs', jsonb_build_array('ar','en'))
 where email in ('doctor.team@labathome.om', 'tasnim@labathome.om') and role = 'doctor';

-- doctors offered to the caller: demo visitors see demo doctors, everyone else (real users, guests) sees the real ones
create or replace function public.doctors_list(p_kind text, p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v public.app_users; demo boolean := false; res jsonb;
begin
  if p_token is not null and p_token <> '' then
    begin v := public._uid(p_token); demo := coalesce(v.is_demo, false); exception when others then demo := false; end;
  end if;
  select coalesce(jsonb_agg(x order by x->>'gender', x->>'name'), '[]') into res
    from jsonb_array_elements(public.doctors_list(p_kind)) x
    join public.app_users d on d.id = (x->>'id')::uuid
   where d.is_demo = demo;
  return res;
end $$;
grant execute on function public.doctors_list(text, text) to anon, authenticated;

-- v49b (2026-11-26, owner's request): new consultant doctor account doctor.huda@labathome.om (Dr. Huda Al Mahrouqi,
-- consultant family medicine, real/non-demo, takes consultations and result reviews). Created directly in the database;
-- its password was given to the owner in chat only (never stored in the repo).
