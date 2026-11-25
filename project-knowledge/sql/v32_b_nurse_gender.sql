-- v32: nurse gender rule — a male nurse visits men, a female nurse visits women AND children (under 12, any gender).
-- Run after the v32 front end is deployed (the booking screen asks for female nurses for children).
-- Rewrites the existing functions in place with exact text replacements and fails loudly if a function changed shape.

create or replace function public._nurse_gender_for(p_person jsonb, p_gender text)
returns text language sql stable set search_path to 'public' as $$
  select case when public._order_age(p_person) is not null and public._order_age(p_person) < 12 then 'female' else p_gender end
$$;

do $mig$
declare
  src text; dst text;
  fixes text[][] := array[
    -- trigger: the assigned nurse must match the rule, not just the patient's gender
    array['public._check_nurse_gender()', 'is distinct from new.patient_gender', 'is distinct from public._nurse_gender_for(new.person, new.patient_gender)'],
    -- nurses only see open requests they are allowed to take
    array['public._can_see(public.orders, public.app_users)', 'coalesce(o.patient_gender = (v.meta->>''gender''), false)', 'coalesce(public._nurse_gender_for(o.person, o.patient_gender) = (v.meta->>''gender''), false)'],
    -- automatic and demo assignment
    array['public._auto_step(uuid)', 'u.meta->>''gender'' = o.patient_gender', 'u.meta->>''gender'' = public._nurse_gender_for(o.person, o.patient_gender)'],
    array['public.demo_advance(text, uuid)', 'meta->>''gender'' = o.patient_gender', 'meta->>''gender'' = public._nurse_gender_for(o.person, o.patient_gender)']
  ];
  i int;
begin
  for i in 1 .. array_length(fixes, 1) loop
    begin
      src := pg_get_functiondef(fixes[i][1]::regprocedure);
    exception when others then raise exception 'v32 nurse gender: function % not found (%)', fixes[i][1], sqlerrm;
    end;
    dst := replace(src, fixes[i][2], fixes[i][3]);
    if dst = src then raise exception 'v32 nurse gender: pattern not found in %', fixes[i][1]; end if;
    execute dst;
  end loop;

  -- order_create: choose / notify nurses by the rule
  src := pg_get_functiondef('public.order_create(text, jsonb)'::regprocedure);
  dst := replace(src, '  v_nurse uuid := nullif(p->>''nurse_id'','''')::uuid;',
                      '  v_nurse uuid := nullif(p->>''nurse_id'','''')::uuid;' || chr(10) || '  v_ngender text;');
  dst := replace(dst, '  if v_nurse is not null then' || chr(10) || '    select * into nu from public.app_users where id=v_nurse',
                      '  v_ngender := public._nurse_gender_for(coalesce(v_person, jsonb_build_object(''dob'', v.meta->>''dob'')), v_gender);' || chr(10) || '  if v_nurse is not null then' || chr(10) || '    select * into nu from public.app_users where id=v_nurse');
  dst := replace(dst, 'and meta->>''gender'' = v_gender and (wilayat = p->>''wilayat''', 'and meta->>''gender'' = v_ngender and (wilayat = p->>''wilayat''');
  dst := replace(dst, 'and (v_nurse is null or a.id = v_nurse) and a.meta->>''gender'' = v_gender', 'and (v_nurse is null or a.id = v_nurse) and a.meta->>''gender'' = v_ngender');
  if (length(dst) - length(replace(dst, 'v_ngender', ''))) / length('v_ngender') < 4 then raise exception 'v32 nurse gender: order_create changed shape'; end if;
  execute dst;
end $mig$;
