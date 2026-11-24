-- v28: result reading that matches common Oman MOH / international lab practice.
-- Each analyte: lo/hi = normal range (adult male / general), rlo/rhi = "slightly outside" band
-- (shown as normal-with-advice, no doctor needed), clo/chi = critical limits (urgent, same day).
-- f = adult female overrides, k = children under 16 overrides. Comparisons are strict (< lo, > hi).
-- nod = never picked for random abnormal demo results (infection screens).

create or replace function public._rng(a jsonb, p_sex text, p_age int) returns jsonb
language sql immutable set search_path to 'public' as $$
  select case
    when p_age is not null and p_age < 16 and a ? 'k' then a || (a->'k')
    when p_sex = 'female' and a ? 'f' then a || (a->'f')
    else a end
$$;

-- flag + mild marker + the range actually used for this person
create or replace function public._flag2(a jsonb, val numeric, p_sex text, p_age int) returns jsonb
language plpgsql immutable set search_path to 'public' as $$
declare r jsonb := public._rng(a, p_sex, p_age); lo numeric := (r->>'lo')::numeric; hi numeric := (r->>'hi')::numeric;
  rlo numeric := (r->>'rlo')::numeric; rhi numeric := (r->>'rhi')::numeric; f text := 'N'; m boolean := false;
begin
  if val is null then return null; end if;
  if lo is not null and val < lo then f := 'L'; m := rlo is not null and val >= rlo;
  elsif hi is not null and val > hi then f := 'H'; m := rhi is not null and val <= rhi; end if;
  return jsonb_strip_nulls(jsonb_build_object('v', val, 'f', f, 'm', case when m then true end, 'r', jsonb_build_array(lo, hi)));
end $$;

-- keep the old helper working for any caller (general range)
create or replace function public._flag(a jsonb, val numeric) returns text
language sql immutable set search_path to 'public' as $$ select (public._flag2(a, val, null, null))->>'f' $$;

create or replace function public._order_age(p jsonb) returns int
language sql stable set search_path to 'public' as $$
  select case when nullif(p->>'dob','') is null then null else date_part('year', age(current_date, (p->>'dob')::date))::int end
$$;

-- severity: urgent = a critical value; review = clearly abnormal; normal = in range or only slightly outside
create or replace function public._orders_severity() returns trigger
language plpgsql set search_path to 'public' as $$
declare a jsonb; v numeric; rg jsonb; crit boolean; urgent boolean := false; review boolean := false; mild int := 0;
  res jsonb := new.results; sx text := new.patient_gender; ag int := public._order_age(new.person); fl jsonb;
begin
  if new.results is null or new.results = '{}'::jsonb then new.severity := null; return new; end if;
  for a in select jsonb_array_elements(t.analytes) from public.tests t where t.id = any(new.test_ids) loop
    if res ? (a->>'c') and (res->(a->>'c')->>'v') is not null then
      v := (res->(a->>'c')->>'v')::numeric; rg := public._rng(a, sx, ag);
      fl := public._flag2(a, v, sx, ag);
      crit := ((rg->>'clo') is not null and v < (rg->>'clo')::numeric) or ((rg->>'chi') is not null and v > (rg->>'chi')::numeric);
      if crit then urgent := true; fl := fl || '{"c":true}'::jsonb; end if;
      if fl->>'f' <> 'N' then if coalesce((fl->>'m')::boolean, false) and not crit then mild := mild + 1; else review := true; end if; end if;
      res := jsonb_set(res, array[a->>'c'], fl);
    end if;
  end loop;
  new.results := res;
  new.severity := case when urgent then 'urgent' when review then 'review' else 'normal' end;
  return new;
end $$;

-- demo results: realistic values for this person's sex/age; review values are clearly out of range,
-- "normal" orders sometimes carry one slightly-out value, infection screens are never made positive
drop function if exists public._gen_results(text[], text);
create or replace function public._gen_results(p_tests text[], p_mode text default 'mixed', p_sex text default null, p_age int default null)
returns jsonb language plpgsql set search_path to 'public' as $$
declare a jsonb; rg jsonb; res jsonb := '{}'; val numeric; lo numeric; hi numeric; rlo numeric; rhi numeric; clo numeric; chi numeric;
  mode text := coalesce(p_mode,'mixed'); codes text[] := '{}'; crit_codes text[] := '{}'; pick text[] := '{}'; soft text; urg text; r float := random(); i int;
begin
  if mode='mixed' then mode := case when r < 0.5 then 'normal' when r < 0.88 then 'review' else 'urgent' end; end if;
  for a in select jsonb_array_elements(t.analytes) from public.tests t where t.id = any(p_tests) loop
    if not coalesce((a->>'nod')::boolean,false) then
      codes := codes || (a->>'c');
      if (a ? 'chi' or a ? 'clo') and (a->>'c') not in ('A1C') then crit_codes := crit_codes || (a->>'c'); end if;
    end if;
  end loop;
  if mode='urgent' and coalesce(array_length(crit_codes,1),0)=0 then mode := 'review'; end if;
  if mode='urgent' then urg := crit_codes[1 + floor(random()*array_length(crit_codes,1))::int]; end if;
  if mode in ('review','urgent') and coalesce(array_length(codes,1),0)>0 then
    for i in 1..(case when mode='review' then 1 + floor(random()*2)::int else floor(random()*2)::int end) loop
      pick := pick || codes[1 + floor(random()*array_length(codes,1))::int];
    end loop;
  end if;
  if mode='normal' and coalesce(array_length(codes,1),0)>0 and random() < 0.4 then soft := codes[1 + floor(random()*array_length(codes,1))::int]; end if;
  for a in select jsonb_array_elements(t.analytes) from public.tests t where t.id = any(p_tests) loop
    rg := public._rng(a, p_sex, p_age);
    lo := (rg->>'lo')::numeric; hi := (rg->>'hi')::numeric; rlo := (rg->>'rlo')::numeric; rhi := (rg->>'rhi')::numeric; clo := (rg->>'clo')::numeric; chi := (rg->>'chi')::numeric;
    if a->>'c' = urg then
      if chi is not null and (clo is null or random() < 0.7) then val := chi*(1.03+random()*0.12); else val := clo*(0.82+random()*0.12); end if;
    elsif (a->>'c') = any(pick) then
      if hi is not null and (lo is null or random() < 0.65) then
        if hi = 0 then val := 32 + random()*8; else val := coalesce(rhi, hi)*(1.06+random()*0.25); end if;
        if chi is not null then val := least(val, chi*0.95); end if;
      else val := coalesce(rlo, lo)*(0.75+random()*0.2); if clo is not null then val := greatest(val, clo*1.05); end if; end if;
    elsif (a->>'c') = soft and (rhi is not null or rlo is not null) then
      if rhi is not null and hi is not null then val := hi + (rhi-hi)*(0.25+random()*0.6); else val := rlo + (lo-rlo)*(0.25+random()*0.6); end if;
    elsif a->>'c' = 'SPO2' then val := 96 + random()*3;
    elsif hi = 0 then val := 0;
    elsif lo is not null and hi is not null then val := lo + (hi-lo)*(0.15+random()*0.7);
    elsif hi is not null then val := hi*(0.45+random()*0.4);
    else val := lo*(1.2+random()*0.5); end if;
    val := case when val >= 100 then round(val) when val >= 10 then round(val,1) else round(val,2) end;
    res := res || jsonb_build_object(a->>'c', public._flag2(a, val, p_sex, p_age));
  end loop;
  return res;
end $$;

-- ranges per test
update public.tests set analytes = '[
 {"c":"HGB","n":"Haemoglobin","na":"الهيموجلوبين","u":"g/dL","lo":13,"hi":17,"rlo":12,"rhi":18.5,"clo":7,"chi":20,"f":{"lo":12,"hi":15.5,"rlo":11,"rhi":16.5},"k":{"lo":11,"hi":14.5,"rlo":10,"rhi":16}},
 {"c":"WBC","n":"White blood cells","na":"كريات الدم البيضاء","u":"×10⁹/L","lo":4,"hi":11,"rlo":3,"rhi":13,"clo":2,"chi":30,"k":{"lo":5,"hi":14.5,"rlo":4,"rhi":17}},
 {"c":"PLT","n":"Platelets","na":"الصفائح الدموية","u":"×10⁹/L","lo":150,"hi":400,"rlo":100,"rhi":500,"clo":50,"chi":1000},
 {"c":"RBC","n":"Red blood cells","na":"كريات الدم الحمراء","u":"×10¹²/L","lo":4.5,"hi":5.9,"rlo":4,"rhi":6.5,"f":{"lo":3.8,"hi":5.2,"rlo":3.5,"rhi":5.8},"k":{"lo":4,"hi":5.3,"rlo":3.6,"rhi":5.8}},
 {"c":"HCT","n":"Haematocrit","na":"الهيماتوكريت","u":"%","lo":40,"hi":52,"rlo":36,"rhi":55,"f":{"lo":36,"hi":46,"rlo":32,"rhi":50},"k":{"lo":33,"hi":43,"rlo":30,"rhi":47}},
 {"c":"MCV","n":"Mean cell volume","na":"متوسط حجم الكرية","u":"fL","lo":80,"hi":100,"rlo":75,"rhi":105,"k":{"lo":75,"hi":90,"rlo":70,"rhi":95}}
]'::jsonb where id='cbc';
update public.tests set analytes = '[{"c":"CRP","n":"C-reactive protein","na":"بروتين سي التفاعلي","u":"mg/L","hi":5,"rhi":10}]'::jsonb where id='crp';
update public.tests set analytes = '[{"c":"GLU","n":"Fasting glucose","na":"سكر الدم الصائم","u":"mmol/L","lo":3.9,"hi":5.6,"rlo":3.3,"rhi":6.9,"clo":2.8,"chi":22.2}]'::jsonb where id='fbs';
update public.tests set analytes = '[{"c":"A1C","n":"HbA1c","na":"السكر التراكمي","u":"%","lo":4,"hi":5.6,"rlo":3.5,"rhi":6.4}]'::jsonb where id='hba1c';
update public.tests set analytes = '[{"c":"GLUR","n":"Random glucose","na":"سكر الدم العشوائي","u":"mmol/L","lo":3.9,"hi":7.8,"rlo":3.3,"rhi":11,"clo":2.8,"chi":22.2}]'::jsonb where id='rbs';
update public.tests set analytes = '[
 {"c":"CHOL","n":"Total cholesterol","na":"الكوليسترول الكلي","u":"mmol/L","hi":5.2,"rhi":6.2},
 {"c":"LDL","n":"LDL cholesterol","na":"الكوليسترول الضار LDL","u":"mmol/L","hi":3.4,"rhi":4.1},
 {"c":"HDL","n":"HDL cholesterol","na":"الكوليسترول النافع HDL","u":"mmol/L","lo":1,"rlo":0.8,"f":{"lo":1.2,"rlo":1}},
 {"c":"TG","n":"Triglycerides","na":"الدهون الثلاثية","u":"mmol/L","hi":1.7,"rhi":2.3,"chi":11.3}
]'::jsonb where id='lipid';
update public.tests set analytes = '[{"c":"IGE","n":"Total IgE","na":"الغلوبولين المناعي E","u":"kU/L","hi":100,"rhi":200}]'::jsonb where id='ige';
update public.tests set analytes = '[{"c":"TTG","n":"tTG-IgA","na":"الأجسام المضادة tTG-IgA","u":"U/mL","hi":10}]'::jsonb where id='ttg';
update public.tests set analytes = '[{"c":"PSA","n":"Total PSA","na":"مستضد البروستاتا PSA","u":"ng/mL","hi":4}]'::jsonb where id='psa';
update public.tests set analytes = '[{"c":"CA","n":"Calcium (total)","na":"الكالسيوم الكلي","u":"mmol/L","lo":2.15,"hi":2.55,"rlo":2,"rhi":2.75,"clo":1.75,"chi":3.2,"k":{"lo":2.2,"hi":2.7,"rlo":2.05,"rhi":2.85}}]'::jsonb where id='calcium';
update public.tests set analytes = '[
 {"c":"UREA","n":"Urea","na":"اليوريا","u":"mmol/L","lo":2.5,"hi":7.8,"rlo":1.5,"rhi":10,"k":{"lo":1.8,"hi":6.4,"rlo":1.2,"rhi":8}},
 {"c":"CREA","n":"Creatinine","na":"الكرياتينين","u":"µmol/L","lo":62,"hi":106,"rlo":40,"rhi":130,"chi":530,"f":{"lo":44,"hi":80,"rlo":30,"rhi":100},"k":{"lo":20,"hi":70,"rlo":15,"rhi":90}},
 {"c":"EGFR","n":"eGFR","na":"معدل الترشيح الكبيبي","u":"mL/min/1.73m²","lo":60,"clo":15}
]'::jsonb where id='kft';
update public.tests set analytes = '[
 {"c":"ALT","n":"ALT","na":"إنزيم ALT","u":"U/L","hi":41,"rhi":82,"chi":1000,"f":{"hi":33,"rhi":66}},
 {"c":"AST","n":"AST","na":"إنزيم AST","u":"U/L","hi":40,"rhi":80,"chi":1000,"f":{"hi":32,"rhi":64}},
 {"c":"ALP","n":"Alkaline phosphatase","na":"الفوسفاتاز القلوي","u":"U/L","lo":40,"hi":129,"rlo":30,"rhi":200,"k":{"lo":100,"hi":400,"rlo":60,"rhi":500}},
 {"c":"TBIL","n":"Total bilirubin","na":"البيليروبين الكلي","u":"µmol/L","hi":21,"rhi":34,"chi":250},
 {"c":"ALB","n":"Albumin","na":"الألبومين","u":"g/L","lo":35,"hi":52,"rlo":30,"rhi":55}
]'::jsonb where id='lft';
update public.tests set analytes = '[
 {"c":"NA","n":"Sodium","na":"الصوديوم","u":"mmol/L","lo":135,"hi":145,"rlo":130,"rhi":150,"clo":120,"chi":160},
 {"c":"K","n":"Potassium","na":"البوتاسيوم","u":"mmol/L","lo":3.5,"hi":5.1,"rlo":3,"rhi":5.5,"clo":2.8,"chi":6.5},
 {"c":"CL","n":"Chloride","na":"الكلور","u":"mmol/L","lo":98,"hi":107,"rlo":95,"rhi":110}
]'::jsonb where id='lytes';
update public.tests set analytes = '[{"c":"MG","n":"Magnesium","na":"المغنيسيوم","u":"mmol/L","lo":0.7,"hi":1,"rlo":0.6,"rhi":1.2,"clo":0.4}]'::jsonb where id='mg';
update public.tests set analytes = '[{"c":"UACR","n":"Albumin/creatinine ratio","na":"نسبة الألبومين إلى الكرياتينين","u":"mg/mmol","hi":3}]'::jsonb where id='uacr';
update public.tests set analytes = '[{"c":"URIC","n":"Uric acid","na":"حمض اليوريك","u":"µmol/L","lo":200,"hi":420,"rlo":120,"rhi":480,"f":{"lo":150,"hi":360,"rlo":100,"rhi":420},"k":{"lo":120,"hi":330,"rlo":90,"rhi":380}}]'::jsonb where id='uric';
update public.tests set analytes = '[
 {"c":"TSH","n":"TSH","na":"هرمون TSH","u":"mIU/L","lo":0.4,"hi":4,"rlo":0.1,"rhi":10},
 {"c":"FT4","n":"Free T4","na":"هرمون T4 الحر","u":"pmol/L","lo":12,"hi":22,"rlo":10,"rhi":25}
]'::jsonb where id='thyroid';
update public.tests set analytes = '[{"c":"TSH","n":"TSH","na":"هرمون TSH","u":"mIU/L","lo":0.4,"hi":4,"rlo":0.1,"rhi":10}]'::jsonb where id='tsh';
update public.tests set analytes = '[
 {"c":"SBP","n":"Systolic pressure","na":"الضغط الانقباضي","u":"mmHg","lo":90,"hi":129,"rlo":85,"rhi":139,"clo":70,"chi":179},
 {"c":"DBP","n":"Diastolic pressure","na":"الضغط الانبساطي","u":"mmHg","lo":60,"hi":84,"rlo":50,"rhi":89,"chi":119},
 {"c":"HR","n":"Pulse","na":"النبض","u":"bpm","lo":60,"hi":100,"rlo":50,"rhi":110,"clo":40,"chi":140},
 {"c":"SPO2","n":"Oxygen saturation","na":"تشبّع الأكسجين","u":"%","lo":95,"rlo":92,"clo":90}
]'::jsonb where id='vitals';
update public.tests set analytes = '[{"c":"B12","n":"Vitamin B12","na":"فيتامين B12","u":"pg/mL","lo":200,"hi":900,"rlo":150,"rhi":2000}]'::jsonb where id='b12';
update public.tests set analytes = '[{"c":"FERR","n":"Ferritin","na":"الفيريتين","u":"ng/mL","lo":30,"hi":400,"rlo":15,"rhi":1000,"f":{"lo":15,"hi":150,"rlo":10,"rhi":500},"k":{"lo":15,"hi":150,"rlo":10,"rhi":300}}]'::jsonb where id='ferritin';
update public.tests set analytes = '[{"c":"FOL","n":"Folate","na":"حمض الفوليك","u":"nmol/L","lo":7,"hi":45,"rlo":5,"rhi":100}]'::jsonb where id='folate';
update public.tests set analytes = '[
 {"c":"IRON","n":"Serum iron","na":"حديد الدم","u":"µmol/L","lo":10,"hi":30,"rlo":7,"rhi":40},
 {"c":"TIBC","n":"Total iron-binding capacity","na":"السعة الكلية لربط الحديد","u":"µmol/L","lo":45,"hi":72,"rlo":40,"rhi":80}
]'::jsonb where id='iron';
update public.tests set analytes = '[{"c":"VITD","n":"25-OH Vitamin D","na":"فيتامين د 25-OH","u":"ng/mL","lo":30,"hi":100,"rlo":20,"rhi":150}]'::jsonb where id='vitd';

-- new: premarital screening tests (blood disorders + infections, as in the MOH premarital programme)
insert into public.tests(id,cat,name_en,name_ar,desc_en,desc_ar,price,fasting_hours,tube,tat_hours,analytes,sort,active) values
 ('hbelec','premarital','Haemoglobin Electrophoresis (thalassaemia & sickle cell)','الرحلان الكهربائي للهيموجلوبين (الثلاسيميا والأنيميا المنجلية)',
  'HPLC test that shows if you carry thalassaemia or the sickle cell gene. Key for couples before marriage.',
  'فحص HPLC يبيّن إذا كنت حاملاً لجين الثلاسيميا أو الأنيميا المنجلية. أساسي للمقبلين على الزواج.',10,0,'Lavender (EDTA)',48,
  '[{"c":"HBA2","n":"HbA2","na":"هيموجلوبين A2","u":"%","lo":2,"hi":3.5,"rlo":1.5},{"c":"HBF","n":"HbF","na":"هيموجلوبين F","u":"%","hi":1,"rhi":2},{"c":"HBS","n":"HbS (sickle)","na":"هيموجلوبين S (المنجلي)","u":"%","hi":0}]'::jsonb,23,true),
 ('g6pd','premarital','G6PD Enzyme (quantitative)','إنزيم G6PD (كمّي)',
  'Checks for G6PD deficiency (favism), common in Oman.','يكشف نقص إنزيم G6PD (الفوال)، وهو شائع في عُمان.',6,0,'Lavender (EDTA)',24,
  '[{"c":"G6PD","n":"G6PD activity","na":"نشاط إنزيم G6PD","u":"U/g Hb","lo":7,"rlo":4}]'::jsonb,24,true),
 ('hbsag','premarital','Hepatitis B Surface Antigen (HBsAg)','المستضد السطحي لالتهاب الكبد B',
  'Screens for hepatitis B infection. Results are private and shared only with you.','يكشف عدوى التهاب الكبد B. النتيجة سرية ولا تُرسل إلا لك.',4,0,'Gold (SST)',24,
  '[{"c":"HBSAG","n":"HBsAg (index)","na":"HBsAg (مؤشر)","u":"S/CO","hi":0.99,"nod":true}]'::jsonb,25,true),
 ('hcv','premarital','Hepatitis C Antibody (Anti-HCV)','الأجسام المضادة لالتهاب الكبد C',
  'Screens for hepatitis C. Private result.','يكشف التهاب الكبد C. نتيجة سرية.',5,0,'Gold (SST)',24,
  '[{"c":"HCV","n":"Anti-HCV (index)","na":"Anti-HCV (مؤشر)","u":"S/CO","hi":0.99,"nod":true}]'::jsonb,26,true),
 ('hiv','premarital','HIV 1/2 Antigen & Antibody (4th generation)','فحص HIV 1/2 (الجيل الرابع)',
  'Confidential HIV screen. A reactive result is always confirmed before anything is reported.','فحص سري لفيروس HIV. أي نتيجة إيجابية تُؤكَّد دائماً قبل إبلاغك.',5,0,'Gold (SST)',24,
  '[{"c":"HIV","n":"HIV Ag/Ab (index)","na":"HIV Ag/Ab (مؤشر)","u":"S/CO","hi":0.99,"nod":true}]'::jsonb,27,true),
 ('syph','premarital','Syphilis Antibody (TPHA)','الأجسام المضادة للزهري (TPHA)',
  'Confidential syphilis screen.','فحص سري للزهري.',4,0,'Gold (SST)',24,
  '[{"c":"TPHA","n":"Treponema antibody (index)","na":"أجسام الزهري (مؤشر)","u":"S/CO","hi":0.99,"nod":true}]'::jsonb,28,true)
on conflict (id) do update set analytes=excluded.analytes, price=excluded.price, name_en=excluded.name_en, name_ar=excluded.name_ar, desc_en=excluded.desc_en, desc_ar=excluded.desc_ar, cat=excluded.cat, active=true;

insert into public.packages(id,name_en,name_ar,desc_en,desc_ar,test_ids,price,badge,sort,active) values
 ('premarital','Premarital Screening (per person)','فحص ما قبل الزواج (للشخص الواحد)',
  'Same tests as the Ministry of Health premarital programme: blood count, thalassaemia & sickle cell, G6PD, hepatitis B & C, HIV and syphilis. Book one for each partner. Fully confidential; a doctor explains the results to the couple if needed.',
  'نفس فحوصات برنامج فحص ما قبل الزواج في وزارة الصحة: صورة الدم، الثلاسيميا والأنيميا المنجلية، G6PD، التهاب الكبد B وC، HIV والزهري. احجز لكل طرف. سرية تامة، والطبيب يشرح النتائج للزوجين عند الحاجة.',
  array['cbc','hbelec','g6pd','hbsag','hcv','hiv','syph'],29,'new',9,true)
on conflict (id) do update set test_ids=excluded.test_ids, price=excluded.price, desc_en=excluded.desc_en, desc_ar=excluded.desc_ar, name_en=excluded.name_en, name_ar=excluded.name_ar, badge=excluded.badge, active=true;

-- demo generators pass the person's sex and age
create or replace function public._demo_results(o public.orders) returns jsonb language sql set search_path to 'public' as $$
  select public._gen_results(o.test_ids, (select value#>>'{}' from public.settings where key='demo_results'), o.patient_gender, public._order_age(o.person))
$$;

-- point the two demo generators at the new helper
do $$ declare d text; f text; begin
  foreach f in array array['_auto_step','demo_advance'] loop
    select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=f;
    d := replace(d, $q$public._gen_results(o.test_ids, (select value#>>'{}' from public.settings where key='demo_results'))$q$, 'public._demo_results(o)');
    execute d;
  end loop;
end $$;

-- re-read every existing result with the new rules (values are not changed)
update public.orders set results = results where results is not null and results <> '{}'::jsonb;
