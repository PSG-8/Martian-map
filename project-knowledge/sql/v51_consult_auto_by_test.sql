-- v51 (owner's request): the automatic consultation message is now a warm letter like a doctor's note: greets the
-- patient by name with ❤️, thanks them for the specific test they did, mentions the result(s) outside the normal range
-- (name, value, unit) calmly and without diagnosis, adds a test-specific wish, and is signed by the iLab@home team.
-- Emergencies still go first (call 9999). Still clearly marked as automatic.

-- intro / wish per test (Arabic, English)
create or replace function public._auto_test_lines(p_tests text[], p_ar boolean, out intro text, out wish text)
language plpgsql immutable as $f$
declare t text[] := coalesce(p_tests, '{}');
begin
  if t && array['hbelec','hiv','hbsag','hcv','syph','g6pd'] then
    intro := case when p_ar then 'نشكر لك ثقتك بنا وحرصك على إجراء فحص ما قبل الزواج، فاهتمامك بصحتك وصحة شريك حياتك خطوة جميلة ومسؤولة لبناء مستقبل صحي وسعيد.' else 'Thank you for trusting us with your premarital check. Caring for your health and your future partner''s is a beautiful, responsible step towards a healthy, happy future.' end;
    wish := case when p_ar then 'نتمنى لك ولشريك حياتك حياة مليئة بالصحة والسعادة، وأن يكتب الله لكما كل خير.' else 'We wish you and your partner a life full of health and happiness.' end;
  elsif t && array['hpvself','psa','fit'] then
    intro := case when p_ar then 'نشكر لك ثقتك بنا وحرصك على الكشف المبكر، فهالخطوة وعي وشجاعة نفخر فيها، والكشف المبكر يحمي صحتك بإذن الله.' else 'Thank you for choosing early screening. It is a brave, wise step, and early checks protect your health.' end;
    wish := case when p_ar then 'نتمنى لك دوام الصحة والطمأنينة، ويحفظك الله من كل شر.' else 'We wish you lasting health and peace of mind.' end;
  elsif t && array['fbs','hba1c','rbs'] then
    intro := case when p_ar then 'نشكر لك ثقتك بنا وحرصك على فحص السكر، فمتابعته بانتظام من أهم خطوات العناية بنفسك، وأنت قدها.' else 'Thank you for checking your sugar levels with us. Regular follow-up is one of the best ways to look after yourself.' end;
    wish := case when p_ar then 'نتمنى لك صحة دايمة وقراءات مطمئنة دايماً بإذن الله.' else 'We wish you good health and reassuring readings always.' end;
  elsif t && array['lipid'] then
    intro := case when p_ar then 'نشكر لك ثقتك بنا وحرصك على فحص الدهون والكوليسترول، فقلبك يستاهل هالاهتمام كله.' else 'Thank you for checking your cholesterol with us. Your heart deserves this care.' end;
    wish := case when p_ar then 'نتمنى لك قلب سليم وحياة مليانة نشاط وعافية.' else 'We wish you a healthy heart and an active life.' end;
  elsif t && array['thyroid','tsh'] then
    intro := case when p_ar then 'نشكر لك ثقتك بنا وحرصك على فحص الغدة الدرقية، فهي صغيرة بس تأثيرها كبير على طاقتك ومزاجك.' else 'Thank you for checking your thyroid with us. It is small but has a big effect on your energy and mood.' end;
    wish := case when p_ar then 'نتمنى لك طاقة ونشاط وصحة دايمة.' else 'We wish you energy and lasting health.' end;
  elsif t && array['vitd','b12','ferritin','iron','folate','calcium','mg'] then
    intro := case when p_ar then 'نشكر لك ثقتك بنا وحرصك على فحص الفيتامينات والمعادن، فجسمك يستاهل تعطيه حقه من الطاقة والنشاط.' else 'Thank you for checking your vitamins and minerals with us. Your body deserves the energy it needs.' end;
    wish := case when p_ar then 'نتمنى لك نشاط وحيوية وصحة دايمة.' else 'We wish you energy and good health.' end;
  elsif t && array['kft','uacr','uric','lytes'] then
    intro := case when p_ar then 'نشكر لك ثقتك بنا وحرصك على فحص وظائف الكلى، فمتابعتها تحمي صحتك على المدى البعيد.' else 'Thank you for checking your kidney function with us. Follow-up protects your health in the long run.' end;
    wish := case when p_ar then 'نتمنى لك صحة وعافية دايمة.' else 'We wish you lasting health.' end;
  elsif t && array['lft'] then
    intro := case when p_ar then 'نشكر لك ثقتك بنا وحرصك على فحص وظائف الكبد، فهالمتابعة من أجمل صور الاهتمام بنفسك.' else 'Thank you for checking your liver function with us.' end;
    wish := case when p_ar then 'نتمنى لك صحة وعافية دايمة.' else 'We wish you lasting health.' end;
  elsif t && array['cbc','crp'] then
    intro := case when p_ar then 'نشكر لك ثقتك بنا وحرصك على فحص صورة الدم، فهو يعطينا صورة واضحة عن صحتك العامة.' else 'Thank you for doing your blood count with us. It gives a clear picture of your general health.' end;
    wish := case when p_ar then 'نتمنى لك دوام الصحة والعافية.' else 'We wish you lasting health.' end;
  elsif t && array['urine','ucult','stoolop','hpylori'] then
    intro := case when p_ar then 'نشكر لك ثقتك بنا وحرصك على إجراء الفحص، فمعرفة السبب أول خطوة للراحة إن شاء الله.' else 'Thank you for doing this test with us. Knowing the cause is the first step to feeling better.' end;
    wish := case when p_ar then 'الله يشفيك ويعافيك ولا يريك شر.' else 'Wishing you a speedy recovery.' end;
  elsif t && array['ige','ttg'] then
    intro := case when p_ar then 'نشكر لك ثقتك بنا وحرصك على فحص الحساسية، فمعرفة السبب تريحك وتسهّل عليك يومك.' else 'Thank you for doing your allergy test with us. Knowing the cause makes daily life easier.' end;
    wish := case when p_ar then 'نتمنى لك راحة وصحة دايمة.' else 'We wish you comfort and good health.' end;
  elsif t && array['resp','igra'] then
    intro := case when p_ar then 'نشكر لك ثقتك بنا وحرصك على إجراء الفحص، فحرصك يحميك ويحمي اللي حولك.' else 'Thank you for doing this test with us. Your care protects you and those around you.' end;
    wish := case when p_ar then 'الله يشفيك ويعافيك ويحفظ أهلك.' else 'Wishing you and your family good health.' end;
  elsif cardinality(t) > 0 then
    intro := case when p_ar then 'نشكر لك ثقتك بنا وحرصك على إجراء فحوصاتك، فاهتمامك بصحتك خطوة جميلة نفخر فيها.' else 'Thank you for trusting us with your tests. Caring for your health is a step we are proud of.' end;
    wish := case when p_ar then 'نتمنى لك دوام الصحة والعافية.' else 'We wish you lasting health.' end;
  else
    intro := null; wish := case when p_ar then 'نتمنى لك دوام الصحة والعافية، والله يشفيك ويعافيك ولا يريك شر.' else 'We wish you good health and a speedy recovery.' end;
  end if;
end $f$;

-- the full letter for one consultation
create or replace function public._consult_auto_letter(p_consult uuid, p_last text) returns text
language plpgsql stable security definer set search_path = public as $f$
declare c public.consults; p public.app_users; d public.app_users; o public.orders; ar boolean; fem_p boolean; fem_d boolean;
  nm text; lines record; res text := ''; flag record; n int := 0; topic text; src text; dname text;
begin
  select * into c from public.consults where id = p_consult; if not found then return null; end if;
  select * into p from public.app_users where id = c.patient_id; select * into d from public.app_users where id = c.doctor_id;
  src := coalesce(p_last, c.reason, '');
  ar := src ~ '[؀-ۿ]' or src !~ '[A-Za-z]';
  -- emergencies first, short and clear
  if lower(coalesce(c.reason, '') || ' ' || coalesce(p_last, '')) ~ '(ألم في الصدر|الم في الصدر|ألم صدر|الم صدر|ضيق تنفس|ضيق في التنفس|ضيق النفس|إغماء|اغماء|نزيف|جلطة|chest pain|shortness of breath|cannot breathe|faint|bleeding|stroke)' then
    return public._consult_auto_text(coalesce(c.reason, '') || ' ' || coalesce(p_last, ''), split_part(coalesce(p.full_name, ''), ' ', 1), coalesce(d.meta->>'gender', 'female') = 'female', ar);
  end if;
  if c.order_id is not null then select * into o from public.orders where id = c.order_id and patient_id = c.patient_id; end if;
  if o.id is null and c.kind = 'post' then select * into o from public.orders where patient_id = c.patient_id and status = 'completed' order by published_at desc nulls last limit 1; end if;
  nm := split_part(coalesce(o.person->>'name', p.full_name, ''), ' ', 1);
  fem_p := coalesce(o.patient_gender, p.meta->>'gender', 'male') = 'female';
  fem_d := coalesce(d.meta->>'gender', 'female') = 'female';
  dname := split_part(regexp_replace(coalesce(d.full_name, ''), '^Dr\.?\s*', ''), ' ', 1);
  select * into lines from public._auto_test_lines(o.test_ids, ar);
  -- results outside the normal range, calmly
  if o.id is not null and o.results is not null and jsonb_typeof(o.results) = 'object' then
    for flag in
      select k, (v->>'v') val, v->>'f' f, coalesce(a->>(case when ar then 'na' else 'n' end), k) aname, coalesce(a->>'u', '') unit
        from jsonb_each(o.results) e(k, v)
        left join lateral (select x from public.tests t, jsonb_array_elements(t.analytes) x where t.id = any(o.test_ids) and x->>'c' = e.k limit 1) aa(a) on true
       where v->>'f' in ('H', 'L', 'HH', 'LL') limit 3
    loop
      n := n + 1;
      res := res || case when ar then 'أظهرت النتائج ' || case when flag.f like 'H%' then 'ارتفاعاً' else 'انخفاضاً' end || ' في ' || flag.aname || ' لتصل إلى ' || flag.val || case when flag.unit <> '' then ' ' || flag.unit else '' end || '. '
                          else 'Your results show a ' || case when flag.f like 'H%' then 'higher' else 'lower' end || ' ' || flag.aname || ' of ' || flag.val || case when flag.unit <> '' then ' ' || flag.unit else '' end || '. ' end;
    end loop;
    if n > 0 then
      res := res || case when ar then 'لا داعي للقلق أو التسرع في الحكم على النتيجة، فهذا لا يعني بالضرورة وجود مرض، لكنها تحتاج مراجعة الطبيب للتأكد من سببها واستكمال التقييم إذا لزم الأمر.'
                         else 'There is no need to worry or rush to conclusions; this does not necessarily mean an illness, but the doctor will review it to check the cause.' end;
    else
      res := case when ar then 'والحمد لله، نتائجك ضمن المعدل الطبيعي 🤍 والطبيب' || case when fem_d then 'ة' else '' end || ' بيطمنك ويجاوب على أي سؤال عندك.'
                  else 'Thankfully your results are within the normal range 🤍 and the doctor will answer any question you have.' end;
    end if;
  elsif o.id is not null then
    res := case when ar then 'وأول ما تجهز نتايجك بتوصلك على طول، وبتراجعها معك الطبيب' || case when fem_d then 'ة' else '' end || '.' else 'As soon as your results are ready you will get them, and the doctor will go through them with you.' end;
  else
    topic := public._consult_auto_text(coalesce(c.reason, '') || ' ' || coalesce(p_last, '') || case when c.kind like 'dental%' then ' dental' else '' end, '', fem_d, ar);
    res := split_part(topic, chr(10), 2);    -- the topic line (diabetes, pressure, children, fever, teeth ...)
  end if;
  if ar then
    return (case when fem_p then 'عزيزتي ' else 'عزيزي ' end) || coalesce(nullif(nm, ''), '') || ' ❤️،' || chr(10) || chr(10)
      || coalesce(lines.intro || chr(10) || chr(10), 'وصلتنا استشارتك، وسلامتك تهمّنا كثير 🤍' || chr(10) || chr(10))
      || res || chr(10) || chr(10)
      || case when fem_d then 'الدكتورة ' else 'الدكتور ' end || dname || case when fem_d then ' بتشوف استشارتك وترد عليك' else ' بيشوف استشارتك ويرد عليك' end || ' بأقرب وقت إن شاء الله.' || chr(10) || chr(10)
      || lines.wish || chr(10) || chr(10)
      || 'مع خالص تمنياتنا، فريق آي لاب@هوم ❤️' || chr(10) || '(رسالة تلقائية)';
  else
    return 'Dear ' || coalesce(nullif(nm, ''), 'friend') || ' ❤️,' || chr(10) || chr(10)
      || coalesce(lines.intro || chr(10) || chr(10), 'We received your consultation, and your wellbeing matters to us 🤍' || chr(10) || chr(10))
      || res || chr(10) || chr(10)
      || 'Dr. ' || dname || ' will see your consultation and reply as soon as possible.' || chr(10) || chr(10)
      || lines.wish || chr(10) || chr(10)
      || 'With our warmest wishes, the iLab@home team ❤️' || chr(10) || '(automatic message)';
  end if;
end $f$;

-- the every-minute job now sends the letter
create or replace function public._consult_auto_reply() returns integer
language plpgsql security definer set search_path = public as $f$
declare r record; n int := 0; msg text;
begin
  for r in
    select c.*,
           (select m.body from public.consult_messages m where m.consult_id = c.id and m.sender_id = c.patient_id order by m.id desc limit 1) last_body,
           greatest(c.created_at, coalesce((select max(m.created_at) from public.consult_messages m where m.consult_id = c.id and m.sender_id = c.patient_id), c.created_at)) anchor
      from public.consults c
     where c.status in ('booked', 'live')
       and (select count(*) from public.consult_messages m where m.consult_id = c.id and m.auto) < 3
  loop
    continue when r.anchor > now() - interval '2 minutes' or r.anchor < now() - interval '24 hours';
    continue when exists (select 1 from public.consult_messages m where m.consult_id = r.id and m.created_at >= r.anchor and (m.auto or m.sender_id = r.doctor_id));
    msg := public._consult_auto_letter(r.id, r.last_body);
    continue when msg is null;
    insert into public.consult_messages(consult_id, sender_id, body, auto) values (r.id, r.doctor_id, msg, true);
    perform public._notify(r.patient_id, null, 'consult_msg', '❤️ iLab@home · ' || r.code, '❤️ آي لاب@هوم · ' || r.code, left(msg, 80), left(msg, 80));
    n := n + 1;
  end loop;
  return n;
end $f$;
revoke all on function public._consult_auto_reply() from public, anon, authenticated;
revoke all on function public._consult_auto_letter(uuid, text) from public, anon, authenticated;
revoke all on function public._auto_test_lines(text[], boolean) from public, anon, authenticated;

-- v51b (applied): full check-ups (5+ tests, not premarital) get a "comprehensive check" thank-you and wish;
-- in Arabic the doctor's first name is written in Arabic (Huda -> هدى, Salma -> سلمى, Amal -> أمل, ...).
-- Applied as a text patch of _consult_auto_letter (marker /* v51b */), see migration v51b_letter_polish.
