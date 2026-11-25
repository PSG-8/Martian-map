-- v39: the owner (non-demo admin, the team leader) can use every feature himself:
-- book tests, book doctor consultations, coupons, loyalty card, trends, referral codes, and write a doctor's advice.
-- The demo admin is NOT included (_is_owner excludes demo accounts).
do $$
declare f text; d text; n int;
begin
  foreach f in array array['public.consult_create(text, jsonb)','public.coupon_check(text, text, numeric)','public.my_loyalty(text)',
                           'public.my_trends(text, text[])','public.order_create(text, jsonb)','public.referral_apply(text, text)'] loop
    d := pg_get_functiondef(f::regprocedure);
    if position('v39_owner' in d) = 0 then
      n := (length(d) - length(replace(d, 'if v.role <> ''patient'' then raise exception ''ONLY_PATIENTS''', ''))) / length('if v.role <> ''patient'' then raise exception ''ONLY_PATIENTS''');
      if n <> 1 then raise exception 'v39: patient check not found exactly once in % (%)', f, n; end if;
      execute replace(d, 'if v.role <> ''patient'' then raise exception ''ONLY_PATIENTS''',
                         'if v.role <> ''patient'' and not public._is_owner(v) /* v39_owner */ then raise exception ''ONLY_PATIENTS''');
    end if;
  end loop;
  d := pg_get_functiondef('public.doctor_note_save(text, uuid, text, jsonb)'::regprocedure);
  if position('v39_owner' in d) = 0 then
    if position('if v.role <> ''doctor'' or v.status <> ''active'' then raise exception ''FORBIDDEN''' in d) = 0 then raise exception 'v39: doctor check not found'; end if;
    execute replace(d, 'if v.role <> ''doctor'' or v.status <> ''active'' then raise exception ''FORBIDDEN''',
                       'if (v.role <> ''doctor'' or v.status <> ''active'') and not public._is_owner(v) /* v39_owner */ then raise exception ''FORBIDDEN''');
  end if;
end $$;
