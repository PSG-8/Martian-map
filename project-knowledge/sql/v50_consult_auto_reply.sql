-- v50 (owner's request): if a patient books a consultation or writes in it and nobody (doctor) answers within 2 minutes,
-- the patient gets one warm automatic message matched to their topic, with 🤍 and a prayer for good health.
-- It is clearly marked as an automatic message from the iLab@home team (never shown as the doctor), gives no diagnosis,
-- sends emergencies to 9999, and is limited to 3 per consultation. Runs every minute with pg_cron.
alter table public.consult_messages add column if not exists auto boolean not null default false;

-- the chat shows automatic messages as 'auto' (not as the doctor, not as "mine" for the doctor)
do $$
declare d text;
begin
  d := pg_get_functiondef('public.consult_msgs(text, uuid, bigint)'::regprocedure);
  if position('m.auto' in d) = 0 then
    if position('''mine'',m.sender_id=v.id,''who'',case when m.sender_id=c.doctor_id then ''doctor'' else ''patient'' end' in d) = 0 then raise exception 'v50: consult_msgs shape changed'; end if;
    execute replace(d, '''mine'',m.sender_id=v.id,''who'',case when m.sender_id=c.doctor_id then ''doctor'' else ''patient'' end',
                       '''mine'',(m.sender_id=v.id and not m.auto),''who'',case when m.auto then ''auto'' when m.sender_id=c.doctor_id then ''doctor'' else ''patient'' end');
  end if;
end $$;

create or replace function public._consult_auto_text(p_text text, p_name text, p_doc_female boolean, p_ar boolean)
returns text language plpgsql immutable as $f$
declare s text := lower(coalesce(p_text, '')); tip text; who text; head text; tail text;
begin
  if s ~ '(ألم في الصدر|الم في الصدر|ألم صدر|الم صدر|ضيق تنفس|ضيق في التنفس|ضيق النفس|إغماء|اغماء|نزيف|جلطة|chest pain|shortness of breath|cannot breathe|can''t breathe|faint|bleeding|stroke)' then
    tip := case when p_ar then 'إذا عندك ألم في الصدر أو ضيق في التنفس أو إغماء أو نزيف، لا تنتظر الرد: اتصل على 9999 أو روح أقرب طوارئ الحين، سلامتك أهم شي 🤍'
                else 'If you have chest pain, trouble breathing, fainting or bleeding, please do not wait for a reply: call 9999 or go to the nearest emergency now. Your safety comes first 🤍' end;
  elsif s ~ '(سكر|سكري|السكري|diabet|glucose|hba1c|sugar)' then
    tip := case when p_ar then 'نعرف إن متابعة السكر تتعب أحياناً، وأنت قدها 🤍 حاول تشرب مي كفاية، وإذا عندك جهاز قياس اكتب لنا آخر قراءاتك عشان تشوفها الطبيبة.'
                else 'Looking after sugar levels can be tiring, and you are doing well 🤍 Try to drink enough water, and if you have a meter, write your latest readings here for the doctor.' end;
  elsif s ~ '(ضغط|pressure|blood pressure)' then
    tip := case when p_ar then 'خذ نفس عميق وارتاح شوي 🤍 إذا عندك جهاز ضغط قيس وأنت جالس وهادي، واكتب لنا القراءة.'
                else 'Take a deep breath and rest a little 🤍 If you have a blood pressure monitor, measure while seated and calm, and write the reading here.' end;
  elsif s ~ '(حامل|حمل|pregnan)' then
    tip := case when p_ar then 'الله يتمم لك على خير ويرزقك بالذرية الصالحة 🤍 اكتبي لنا كم أسبوع وأي شي تحسين فيه، والطبيبة بتطمنك.'
                else 'Wishing you a healthy, easy pregnancy 🤍 Tell us how many weeks you are and how you feel, and the doctor will reassure you.' end;
  elsif s ~ '(طفل|طفلة|ولدي|بنتي|اطفال|أطفال|رضيع|child|baby|son|daughter|kid)' then
    tip := case when p_ar then 'الله يحفظ لك عيالك ويشفيهم 🤍 اكتب لنا عمر الطفل ووش الأعراض ومن متى، وإذا حرارته عالية جداً أو صار خامل لا تتردد تروح الطوارئ.'
                else 'May God keep your little one safe and well 🤍 Tell us the child''s age, the symptoms and since when. If the fever is very high or the child is unusually drowsy, go to the emergency.' end;
  elsif s ~ '(حرارة|حمى|زكام|كحة|سعال|برد|انفلونزا|fever|cough|cold|flu)' then
    tip := case when p_ar then 'الله يشفيك 🤍 ارتاح واشرب سوائل دافية ومي كفاية، واكتب لنا من متى بدت الأعراض وكم الحرارة إذا قستها.'
                else 'Get well soon 🤍 Rest, drink warm fluids and enough water, and tell us when it started and your temperature if you measured it.' end;
  elsif s ~ '(أسنان|اسنان|ضرس|لثة|سن |tooth|teeth|gum|dental)' then
    tip := case when p_ar then 'سلامة أسنانك 🤍 إلين ما يرد عليك الطبيب، المضمضة بمي دافي وملح تريحك، واكتب لنا وين الألم ومن متى.'
                else 'Sorry about the tooth pain 🤍 Until the dentist replies, rinsing with warm salty water can help. Tell us where it hurts and since when.' end;
  elsif s ~ '(فقر الدم|انيميا|أنيميا|حديد|فيتامين|anemia|anaemia|iron|vitamin|b12)' then
    tip := case when p_ar then 'إن شاء الله بسيطة 🤍 إذا عندك نتيجة فحص حديثة اكتب لنا رقمها أو افتحها من طلباتك، والطبيبة بتشرح لك كل شي بهدوء.'
                else 'Hopefully nothing serious 🤍 If you have a recent result, write the number here or open it from your requests, and the doctor will explain everything calmly.' end;
  elsif s ~ '(قلب|كوليسترول|دهون|cholesterol|heart|lipid)' then
    tip := case when p_ar then 'قلبك غالي علينا 🤍 اكتب لنا أي أعراض تحس فيها، وإذا عندك نتيجة دهون حديثة شاركها، والطبيبة بترد عليك.'
                else 'Your heart matters to us 🤍 Tell us any symptoms you feel, and share a recent cholesterol result if you have one.' end;
  elsif s ~ '(غدة|الغدة|درقية|thyroid|tsh)' then
    tip := case when p_ar then 'الغدة تحتاج متابعة بهدوء، وإن شاء الله أمورك طيبة 🤍 اكتب لنا آخر نتيجة TSH إذا عندك وأي دواء تاخذه.'
                else 'Thyroid care just needs calm follow-up 🤍 Share your latest TSH result if you have it and any medicine you take.' end;
  elsif s ~ '(كلى|كلية|كبد|kidney|liver|creatinine)' then
    tip := case when p_ar then 'إن شاء الله خير 🤍 اشرب مي كفاية، واكتب لنا نتيجة فحصك الأخير أو افتحها من طلباتك عشان تراجعها الطبيبة.'
                else 'Hopefully all is well 🤍 Drink enough water, and share your latest result so the doctor can review it.' end;
  elsif s ~ '(ألم|الم|وجع|يوجع|pain|ache|hurt)' then
    tip := case when p_ar then 'سلامتك من كل شر 🤍 اكتب لنا وين الألم وقوته من 10 ومن متى، عشان الطبيبة تفهم حالتك أكثر.'
                else 'Sorry you are in pain 🤍 Tell us where it hurts, how strong it is out of 10, and since when, so the doctor understands better.' end;
  elsif s ~ '(نتيجة|نتائج|تحليل|فحص|تقرير|result|report|test)' then
    tip := case when p_ar then 'نتايجك بين أيادي أمينة 🤍 الطبيبة بتراجعها وتشرح لك كل رقم بهدوء، وإذا عندك سؤال معيّن اكتبه هنا.'
                else 'Your results are in good hands 🤍 The doctor will review them and explain each number calmly. Write any question you have here.' end;
  else
    tip := case when p_ar then 'اكتب لنا أعراضك ومن متى بدت، وأي دواء تاخذه، عشان الطبيبة تساعدك بأحسن شكل 🤍'
                else 'Tell us your symptoms, when they started and any medicine you take, so the doctor can help you best 🤍' end;
  end if;
  if p_ar then
    who := case when p_doc_female then 'الطبيبة بتشوف استشارتك وترد عليك' else 'الطبيب بيشوف استشارتك ويرد عليك' end;
    head := '🤍 حياك الله' || case when coalesce(p_name, '') <> '' then ' يا ' || p_name else '' end || '، وصلتنا رسالتك وسلامتك تهمّنا.';
    tail := who || ' بأقرب وقت إن شاء الله.' || chr(10) || 'الله يشفيك ويعافيك ويكتب لك الصحة والعافية، ولا تشوف شر 🤍🤍' || chr(10) || '— رسالة تلقائية من فريق آي لاب@هوم';
  else
    head := '🤍 Hello' || case when coalesce(p_name, '') <> '' then ' ' || p_name else '' end || ', we received your message and your wellbeing matters to us.';
    tail := 'The doctor will see your consultation and reply as soon as possible.' || chr(10) || 'Wishing you good health and a speedy recovery 🤍🤍' || chr(10) || '— automatic message from the iLab@home team';
  end if;
  return head || chr(10) || tip || chr(10) || tail;
end $f$;

create or replace function public._consult_auto_reply() returns integer
language plpgsql security definer set search_path = public as $f$
declare r record; n int := 0; txt text; ar boolean; nm text; fem boolean; msg text;
begin
  for r in
    select c.*, p.full_name pname, d.meta->>'gender' dgender,
           (select m.body from public.consult_messages m where m.consult_id = c.id and m.sender_id = c.patient_id order by m.id desc limit 1) last_body,
           greatest(c.created_at, coalesce((select max(m.created_at) from public.consult_messages m where m.consult_id = c.id and m.sender_id = c.patient_id), c.created_at)) anchor
      from public.consults c join public.app_users p on p.id = c.patient_id join public.app_users d on d.id = c.doctor_id
     where c.status in ('booked', 'live')
       and (select count(*) from public.consult_messages m where m.consult_id = c.id and m.auto) < 3
  loop
    continue when r.anchor > now() - interval '2 minutes' or r.anchor < now() - interval '24 hours';
    continue when exists (select 1 from public.consult_messages m where m.consult_id = r.id and m.created_at >= r.anchor and (m.auto or m.sender_id = r.doctor_id));
    txt := coalesce(r.reason, '') || ' ' || coalesce(r.last_body, '') || case when r.kind like 'dental%' then ' dental' else '' end;
    ar := coalesce(r.last_body, r.reason, '') ~ '[؀-ۿ]' or coalesce(r.last_body, r.reason, '') !~ '[A-Za-z]';
    nm := split_part(coalesce(r.pname, ''), ' ', 1); fem := coalesce(r.dgender, 'female') = 'female';
    msg := public._consult_auto_text(txt, nm, fem, ar);
    insert into public.consult_messages(consult_id, sender_id, body, auto) values (r.id, r.doctor_id, msg, true);
    perform public._notify(r.patient_id, null, 'consult_msg', '🤍 iLab@home · ' || r.code, '🤍 آي لاب@هوم · ' || r.code, left(msg, 80), left(msg, 80));
    n := n + 1;
  end loop;
  return n;
end $f$;
revoke all on function public._consult_auto_reply() from public, anon, authenticated;
revoke all on function public._consult_auto_text(text, text, boolean, boolean) from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'consult-auto-reply';
select cron.schedule('consult-auto-reply', '* * * * *', 'select public._consult_auto_reply()');
