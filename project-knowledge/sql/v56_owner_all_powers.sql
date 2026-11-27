-- v56 (owner's request 2026-11-27): the owner (leader) account can do everything every other role can,
-- so real orders can be run end to end from the owner account while there are no real lab/courier accounts.
-- Each change only ADDS "or the owner" to an existing check; nobody else gains anything. Stops if a function's shape changed.
do $$
declare r record; d text; n int;
begin
  for r in select * from (values
    ('public.order_action(text,uuid,text,jsonb)', 'elsif v.role=''lab'' and p_action=''receive''', 'elsif (v.role=''lab'' or public._is_owner(v)) and p_action=''receive'''),
    ('public.order_action(text,uuid,text,jsonb)', 'elsif v.role=''lab'' and p_action=''reject''', 'elsif (v.role=''lab'' or public._is_owner(v)) and p_action=''reject'''),
    ('public.order_action(text,uuid,text,jsonb)', 'elsif v.role=''lab'' and p_action in (''save_results'',''publish'')', 'elsif (v.role=''lab'' or public._is_owner(v)) and p_action in (''save_results'',''publish'')'),
    -- owner moves a visit one step on (nurse on the way, arrived, collected, sample to lab, at the lab)
    ('public.order_action(text,uuid,text,jsonb)', 'elsif public._is_owner(v) and p_action=''cancel''',
     'elsif public._is_owner(v) and p_action=''owner_next'' and o.status in (''assigned'',''on_the_way'',''arrived'',''collected'',''in_transit'') then /* v56_owner */
    perform public._advance(o.id, (case o.status when ''assigned'' then ''on_the_way'' when ''on_the_way'' then ''arrived'' when ''arrived'' then ''collected'' when ''collected'' then ''in_transit'' else ''at_lab'' end), v, ''Owner'');
  elsif public._is_owner(v) and p_action=''cancel'''),
    ('public.kit_mine(text)', 'if v.role <> ''nurse'' then', 'if v.role <> ''nurse'' and not public._is_owner(v) then'),
    ('public.kit_request(text,jsonb,text)', 'if v.role <> ''nurse'' then', 'if v.role <> ''nurse'' and not public._is_owner(v) then'),
    ('public.incident_report(text,uuid,text,text)', 'if v.role not in (''nurse'',''courier'',''lab'') then', 'if v.role not in (''nurse'',''courier'',''lab'') and not public._is_owner(v) then'),
    ('public.sos_raise(text,uuid,double precision,double precision,text)', 'if v.role not in (''nurse'',''courier'') then', 'if v.role not in (''nurse'',''courier'') and not public._is_owner(v) then'),
    ('public.camp_create(text,jsonb)', 'if v.role <> ''company'' then', 'if v.role <> ''company'' and not public._is_owner(v) then'),
    ('public.camps_mine(text)', 'if v.role <> ''company'' then', 'if v.role <> ''company'' and not public._is_owner(v) then'),
    ('public.program_create(text,jsonb)', 'if v.role <> ''company'' then', 'if v.role <> ''company'' and not public._is_owner(v) then'),
    ('public.fleet_overview(text)', 'if v.role <> ''courier'' or not coalesce((v.meta->>''fleet_admin'')::boolean,false) then', 'if (v.role <> ''courier'' or not coalesce((v.meta->>''fleet_admin'')::boolean,false)) and not public._is_owner(v) then')
  ) t(sig, a, b) loop
    d := pg_get_functiondef(r.sig::regprocedure);
    if position(r.b in d) > 0 then continue; end if;            -- already applied
    n := (length(d) - length(replace(d, r.a, ''))) / length(r.a);
    if n <> 1 then raise exception 'v56: % shape changed (% matches)', r.sig, n; end if;
    execute replace(d, r.a, r.b);
  end loop;
end $$;
