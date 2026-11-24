# Videos

## Story film (v28) — `media/iLabAtHome_Story.mp4`
Flat motion graphics drawn from the site's own illustrations; every frame is computed from time `t` in an HTML page and captured with Playwright at 30 fps, then encoded with ffmpeg.
- Voice: Kokoro (open model, `kokoro-onnx`, files from Hugging Face `fastrtc/kokoro-onnx`), voice `am_michael`, speed 0.96, one clip per sentence, 0.55 s gaps.
- Clarity check: faster-whisper `small.en` transcribed the narration back almost word for word.
- Music: soft synthesized pad, −16 LUFS overall loudness.
- Subtitles: English line + Arabic translation, burned in.

Script (English → Arabic):
1. This is iLab at home. → هذا آي لاب@هوم.
2. Need a blood test, but the lab is far away, and the wait is long? → تحتاج فحص دم، بس المختبر بعيد والانتظار طويل؟
3. Book from your phone in one minute. Pick a test or a package, then choose the time and the place. → احجز من جوالك في دقيقة: اختر الفحص أو الباقة، وحدد الوقت والمكان.
4. A licensed nurse, matched to your gender, comes to your door and takes the sample safely. → ممرض مرخّص من نفس جنسك يوصل لبابك ويسحب العينة بأمان.
5. Your sample travels in a cold box, at two to eight degrees, to an accredited partner lab. → العينة تنتقل في صندوق مبرّد من ٢ إلى ٨ درجات إلى مختبر شريك معتمد.
6. Within one to two days, your report arrives on your phone, with every result explained in plain words. → وخلال يوم إلى يومين يوصلك تقريرك على الجوال، مع شرح واضح لكل نتيجة.
7. Need a doctor? Talk to a male or female doctor by video, before your tests or after your results. There is a dentist too. → تحتاج طبيب؟ كلّم طبيب أو طبيبة بالفيديو قبل الفحص أو بعد النتائج، وفي طبيب أسنان بعد.
8. Premarital screening, checks for children, and packages for seniors. All in one place. → فحص ما قبل الزواج، وفحوصات الأطفال، وباقات كبار السن، كلها في مكان واحد.
9. iLab at home. Your health, at your doorstep. → آي لاب@هوم. صحتك عند باب بيتك.

## Explainer — `media/iLabAtHome_HowItWorks.mp4`
Source on branch `film-ex`. v28 re-render: same narration/music track, visuals rendered locally with the v28 `js/art.js` and `js/hero3d.js` (new logo).
