-- v31 (part A): schema + seed data.
-- Self-collection kits, loyalty stamps, coupons, referral, privacy log/requests, sample chain of custody,
-- nurse/courier safety, result share links, company camp (expat) requests, Ramadan night slots.
-- All money figures are planning/demo values (OMR).

-- 1) who collects the sample
alter table public.tests add column if not exists collection text not null default 'nurse';
do $$ begin
  if not exists (select 1 from pg_constraint where conname='tests_collection_chk') then
    alter table public.tests add constraint tests_collection_chk check (collection in ('nurse','self','device'));
  end if;
end $$;
update public.tests set collection='device' where id='vitals';
update public.tests set collection='self' where id='uacr';

alter table public.orders add column if not exists mode text not null default 'nurse';
alter table public.orders add column if not exists disc jsonb not null default '{}'::jsonb;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='orders_mode_chk') then
    alter table public.orders add constraint orders_mode_chk check (mode in ('nurse','self'));
  end if;
end $$;

-- new self-collection tests (kit delivered by courier, patient collects, courier picks it up)
insert into public.tests(id,cat,name_en,name_ar,desc_en,desc_ar,price,fasting_hours,tube,tat_hours,analytes,sort,active,collection) values
 ('urine','selfkit','Urine Analysis (routine)','تحليل البول الروتيني','Infection, sugar, protein and blood in urine. First morning urine is best.','الالتهابات والسكر والبروتين والدم في البول. الأفضل أول بول في الصباح.',2.000,0,'Urine cup',12,
  '[{"c":"UPH","n":"pH","na":"الحموضة","u":"","lo":4.5,"hi":8},{"c":"USG","n":"Specific gravity","na":"الكثافة النوعية","u":"","lo":1.005,"hi":1.03},{"c":"UPRO","n":"Protein","na":"البروتين","u":"mg/dL","hi":14},{"c":"UGLU","n":"Glucose","na":"الجلوكوز","u":"mg/dL","hi":15},{"c":"UWBC","n":"Pus cells","na":"خلايا الصديد","u":"/HPF","hi":5},{"c":"URBC","n":"Red cells","na":"كريات الدم الحمراء","u":"/HPF","hi":3}]'::jsonb,40,true,'self'),
 ('ucult','selfkit','Urine Culture','زراعة البول','Finds the germ behind a urine infection and the right antibiotic. Keep the cup cold.','يحدد الجرثومة المسببة لالتهاب البول والمضاد المناسب. احفظ العلبة باردة.',5.000,0,'Urine cup (sterile)',48,
  '[{"c":"UCX","n":"Colony count","na":"عدد المستعمرات","u":"CFU/mL","hi":9999,"nod":true}]'::jsonb,41,true,'self'),
 ('fit','selfkit','Stool Occult Blood (FIT)','الدم الخفي في البراز (FIT)','Bowel cancer screening for adults 45+. One small stool sample, no diet changes.','فحص الكشف المبكر عن سرطان القولون من عمر 45. عينة براز صغيرة بدون حمية.',6.000,0,'Stool kit',24,
  '[{"c":"FIT","n":"Faecal haemoglobin","na":"هيموجلوبين البراز","u":"ng/mL","hi":99,"nod":true}]'::jsonb,42,true,'self'),
 ('hpylori','selfkit','H. pylori Stool Antigen','جرثومة المعدة (من البراز)','Stomach germ linked to ulcers and heartburn.','جرثومة المعدة المرتبطة بالقرحة والحموضة.',7.000,0,'Stool kit',24,
  '[{"c":"HPSA","n":"H. pylori antigen (index)","na":"مستضد جرثومة المعدة (مؤشر)","u":"S/CO","hi":0.99,"nod":true}]'::jsonb,43,true,'self'),
 ('stoolop','selfkit','Stool Analysis (parasites)','تحليل البراز (الطفيليات)','Worms and parasites; often asked for workers and children.','الديدان والطفيليات؛ يُطلب كثيراً للعمالة والأطفال.',3.000,0,'Stool kit',24,
  '[{"c":"OVA","n":"Ova & parasites seen","na":"بيوض وطفيليات","u":"/slide","hi":0,"nod":true}]'::jsonb,44,true,'self'),
 ('hpvself','selfkit','HPV Self-Swab (women 30–65)','مسحة HPV الذاتية (للنساء 30–65)','Cervical cancer screening with a private self-swab, recommended by the WHO.','الكشف عن سرطان عنق الرحم بمسحة ذاتية خاصة، توصي بها منظمة الصحة العالمية.',18.000,0,'Self-swab kit',72,
  '[{"c":"HPV","n":"High-risk HPV DNA (index)","na":"فيروس HPV عالي الخطورة (مؤشر)","u":"S/CO","hi":0.99,"nod":true}]'::jsonb,45,true,'self'),
 ('resp','selfkit','Flu A/B + COVID-19 Swab','مسحة الإنفلونزا A/B وكوفيد-19','Nose swab for fever and cough.','مسحة أنف للحمى والكحة.',8.000,0,'Self-swab kit',12,
  '[{"c":"FLUA","n":"Influenza A (index)","na":"إنفلونزا A (مؤشر)","u":"S/CO","hi":0.99,"nod":true},{"c":"FLUB","n":"Influenza B (index)","na":"إنفلونزا B (مؤشر)","u":"S/CO","hi":0.99,"nod":true},{"c":"COV2","n":"SARS-CoV-2 (index)","na":"كوفيد-19 (مؤشر)","u":"S/CO","hi":0.99,"nod":true}]'::jsonb,46,true,'self'),
 ('igra','expat','TB Blood Test (IGRA)','فحص السل الكامن (IGRA)','Latent tuberculosis screening, part of residency medical checks. Nurse draws blood.','الكشف عن السل الكامن، جزء من فحص الإقامة الطبي. يسحب الممرض الدم.',22.000,0,'QuantiFERON tubes',48,
  '[{"c":"IGRA","n":"Interferon-gamma (TB)","na":"إنترفيرون غاما (السل)","u":"IU/mL","hi":0.34}]'::jsonb,47,true,'nurse')
on conflict (id) do update set cat=excluded.cat, name_en=excluded.name_en, name_ar=excluded.name_ar, desc_en=excluded.desc_en, desc_ar=excluded.desc_ar,
  price=excluded.price, tube=excluded.tube, tat_hours=excluded.tat_hours, analytes=excluded.analytes, sort=excluded.sort, active=true, collection=excluded.collection;

insert into public.packages(id,name_en,name_ar,desc_en,desc_ar,test_ids,price,badge,sort,active) values
 ('selfkit','Home Self-Kit (no nurse)','عدة الفحص الذاتي (بدون ممرض)','Urine analysis + bowel screening + parasites. A courier brings the kit and takes it back.','تحليل بول + كشف القولون + الطفيليات. المندوب يوصل العدة ويرجع ياخذها.','{urine,fit,stoolop}',9.500,'new',30,true),
 ('expat_pre','Expat Pre-Check (not the official certificate)','فحص مبدئي للعمالة (مو الشهادة الرسمية)','Know early, before the official MOH medical: infections, blood count, urine, stool and TB screening.','اعرف مبكراً قبل فحص الوزارة الرسمي: الالتهابات وصورة الدم والبول والبراز والسل.','{cbc,hbsag,hcv,hiv,syph,urine,stoolop,igra}',38.000,'new',31,true),
 ('housemaid','Domestic Worker Home Check','فحص العاملة المنزلية في البيت','Yearly peace of mind for the family: infections, blood count, urine and parasites, at home.','طمأنينة سنوية للأسرة: الالتهابات وصورة الدم والبول والطفيليات، في البيت.','{cbc,hbsag,hcv,hiv,syph,urine,stoolop}',19.000,'new',32,true)
on conflict (id) do update set name_en=excluded.name_en, name_ar=excluded.name_ar, desc_en=excluded.desc_en, desc_ar=excluded.desc_ar, test_ids=excluded.test_ids, price=excluded.price, badge=excluded.badge, sort=excluded.sort, active=true;

insert into public.settings(key,value) values
 ('self_fee','2.000'::jsonb),
 ('ref_reward','1.000'::jsonb),
 ('stamps_per_free','5'::jsonb),
 ('ramadan','{"from":"2027-02-08","to":"2027-03-09","slots":["20:30","21:30","22:30"]}'::jsonb)
on conflict (key) do nothing;

-- 2) coupons
create table if not exists public.coupons (
  code text primary key check (code ~ '^[A-Z0-9]{3,20}$'),
  kind text not null check (kind in ('pct','fixed')),
  value numeric not null check (value > 0),
  max_uses int, used int not null default 0,
  min_sub numeric not null default 0,
  first_order boolean not null default false,
  expires_on date, active boolean not null default true,
  note text, created_at timestamptz not null default now()
);
create table if not exists public.coupon_uses (
  id bigserial primary key, code text not null references public.coupons(code) on update cascade,
  user_id uuid not null references public.app_users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  amount numeric not null, at timestamptz not null default now()
);
create index if not exists coupon_uses_user on public.coupon_uses(user_id, code);
insert into public.coupons(code,kind,value,max_uses,min_sub,first_order,expires_on,note) values
 ('WELCOME10','pct',10,5000,0,true,null,'10% off the tests of the first order'),
 ('ILAB2','fixed',2,2000,10,false,'2027-06-30','2 OMR off orders of 10 OMR or more'),
 ('RAMADAN15','pct',15,3000,0,false,'2027-03-10','Ramadan offer')
on conflict (code) do nothing;

-- 3) privacy: who opened a report, and data requests
create table if not exists public.report_views (
  id bigserial primary key, order_id uuid not null references public.orders(id) on delete cascade,
  viewer_id uuid references public.app_users(id) on delete set null, viewer_role text not null,
  at timestamptz not null default now()
);
create index if not exists report_views_order on public.report_views(order_id, at desc);
create table if not exists public.privacy_requests (
  id bigserial primary key, user_id uuid not null references public.app_users(id) on delete cascade,
  kind text not null check (kind in ('export','delete','correct')), note text,
  status text not null default 'open' check (status in ('open','done','rejected')),
  reply text, created_at timestamptz not null default now(), done_at timestamptz
);

-- 4) sample chain of custody
create table if not exists public.sample_scans (
  id bigserial primary key, order_id uuid not null references public.orders(id) on delete cascade,
  actor_id uuid references public.app_users(id) on delete set null, actor_role text,
  step text not null check (step in ('collected','pickup','check','handover','lab_received')),
  temp numeric, note text, at timestamptz not null default now()
);
create index if not exists sample_scans_order on public.sample_scans(order_id, at);

-- 5) safety
create table if not exists public.sos_alerts (
  id bigserial primary key, user_id uuid not null references public.app_users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null, lat float8, lng float8, note text,
  created_at timestamptz not null default now(), resolved_at timestamptz, resolved_by uuid references public.app_users(id)
);
create table if not exists public.incidents (
  id bigserial primary key, user_id uuid not null references public.app_users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  kind text not null check (kind in ('needle','faint','sample','safety','vehicle','other')), note text not null,
  status text not null default 'open' check (status in ('open','closed')), created_at timestamptz not null default now()
);

-- 6) share a result with a doctor (time-limited link)
create table if not exists public.share_links (
  token text primary key, order_id uuid not null references public.orders(id) on delete cascade,
  created_by uuid not null references public.app_users(id) on delete cascade,
  expires_at timestamptz not null, views int not null default 0, revoked boolean not null default false,
  created_at timestamptz not null default now()
);

-- 7) company camp visits (expat / workers)
create sequence if not exists public.camp_seq start 1001;
create table if not exists public.camp_requests (
  id uuid primary key default gen_random_uuid(), code text unique not null,
  company_id uuid not null references public.app_users(id) on delete cascade,
  package_id text not null references public.packages(id),
  site text not null, wilayat text, visit_date date not null,
  workers jsonb not null default '[]'::jsonb, consent boolean not null,
  status text not null default 'requested' check (status in ('requested','scheduled','visited','completed','cancelled')),
  results jsonb not null default '{}'::jsonb, note text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

alter table public.coupons enable row level security;
alter table public.coupon_uses enable row level security;
alter table public.report_views enable row level security;
alter table public.privacy_requests enable row level security;
alter table public.sample_scans enable row level security;
alter table public.sos_alerts enable row level security;
alter table public.incidents enable row level security;
alter table public.share_links enable row level security;
alter table public.camp_requests enable row level security;
