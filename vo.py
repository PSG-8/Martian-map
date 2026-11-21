# Male narration with Kokoro (open model), per sentence -> vo.wav + warp.json aligned to the original visual cues
import json, numpy as np, soundfile as sf
from kokoro import KPipeline
cues = json.load(open('cues.json'))
SENT = ["This is eye-lab at Home: lab tests at your doorstep, across North Al Sharqiyah.",
 "Sign up in a minute, with your phone, your email, or your Google account.",
 "Choose a single test, or a family package, for kids, for adults, and for seniors over sixty.",
 "Pick a time, drop a pin on your home, and pay securely by card, Apple Pay, or your company's health program.",
 "A licensed nurse is notified instantly, accepts your request, and heads to your door.",
 "The nurse checks your ID, collects the sample, and seals it in a cold box, between two and eight degrees.",
 "A courier carries it to a partner laboratory, and you can follow every step, live.",
 "When your results are ready, you get a clear report: normal, needs review, or urgent,",
 "with diet tips, a doctor's advice, and the nearest hospital.",
 "Download it as a PDF, share it with your doctor, and book your next check in one tap.",
 "eye-lab at Home. Book. Test.",
 "Get your results, without leaving home."]
assert len(SENT) == len(cues)
pipe = KPipeline(lang_code='a'); SR = 24000
def say(t):
  parts = [a for _, _, a in pipe(t, voice='am_michael', speed=1.0)]
  a = np.concatenate([np.asarray(p, dtype=np.float32) for p in parts])
  # trim leading/trailing silence
  idx = np.where(np.abs(a) > 0.01)[0]; return a[max(0, idx[0] - 240): idx[-1] + 2400]
out = [np.zeros(int(.3 * SR), np.float32)]; t = .3; new = []
for i, s in enumerate(SENT):
  a = say(s); new.append([round(t, 3), round(t + len(a) / SR, 3)]); out.append(a); t += len(a) / SR
  gap = .12 if i == 7 else .32; out.append(np.zeros(int(gap * SR), np.float32)); t += gap
sf.write('vo_raw.wav', np.concatenate(out), SR)
knots = [[0, 0], [new[0][0], cues[0][0]]]
for i in range(len(cues)):
  knots.append([new[i][1], cues[i][1]])
  if i + 1 < len(cues): knots.append([new[i + 1][0], cues[i + 1][0]])
L = round(new[-1][1] + 3.0, 2); knots.append([L, 61.5])
json.dump({'knots': knots, 'new': new, 'dur': L}, open('warp.json', 'w'))
open('LEN', 'w').write(str(L)); print('len', L, new)
