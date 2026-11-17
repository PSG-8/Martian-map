#!/usr/bin/env python3
"""IMAAR presentation video pipeline.

usage:
  pipeline.py prep KEY        # audio clean + transcribe + align + cut + face crop/grade  -> work/KEY.*
  pipeline.py build           # render every section and the final video -> out/IMAAR_TeamAUREX.mp4
  pipeline.py qa              # contact sheet of the final video -> out/qa.jpg
Paths are relative to the kit directory (where this file lives).
"""
import json, os, re, subprocess, sys, math, difflib, shutil, statistics

KIT = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.join(KIT, 'work'); OUT = os.path.join(KIT, 'out'); GFX = os.path.join(KIT, 'gfx'); FONTS = os.path.join(KIT, 'fonts')
os.makedirs(WORK, exist_ok=True); os.makedirs(OUT, exist_ok=True)
CFG = json.load(open(os.path.join(KIT, 'config.json')))
FPS = 30
PLUM = '0x1E0E24'
PRESET = os.environ.get('PRESET', 'medium')
ENC = ['-c:v', 'libx264', '-preset', PRESET, '-crf', '15', '-pix_fmt', 'yuv420p', '-r', str(FPS)]
AENC = ['-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-ac', '2']

def sh(cmd, quiet=True):
    if not quiet: print('+', ' '.join(cmd)[:400], flush=True)
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr[-3000:]); raise SystemExit(f'command failed: {cmd[0]}')
    return r

def probe(path):
    r = sh(['ffprobe', '-v', 'error', '-show_entries', 'format=duration:stream=index,codec_type,width,height,channels,r_frame_rate:stream_tags=rotate:stream_side_data=rotation', '-of', 'json', path])
    return json.loads(r.stdout)

def dur(path):
    return float(probe(path)['format']['duration'])

def spk(key):
    return next(s for s in CFG['speakers'] if s['key'] == key)

# ------------------------------------------------------------------ text helpers
FILLERS = {'um', 'uh', 'uhm', 'umm', 'ah', 'er', 'erm', 'hmm', 'mm', 'eh', 'uhh'}
def norm(w):
    return re.sub(r'[^a-z0-9]', '', w.lower().replace('&', 'and'))

def script_tokens(text):
    return [t for t in re.split(r'\s+', text.strip()) if t]

# ------------------------------------------------------------------ PREP
def clean_audio(src, key):
    raw = f'{WORK}/{key}_raw.wav'
    sh(['ffmpeg', '-y', '-i', src, '-vn', '-ac', '2', '-ar', '48000', '-c:a', 'pcm_s16le', raw])
    # pick channel: compare loudness of L and R
    lv = []
    for ch in ('c0', 'c1'):
        r = subprocess.run(['ffmpeg', '-i', raw, '-af', f'pan=mono|c0={ch},volumedetect', '-f', 'null', '-'], capture_output=True, text=True)
        m = re.search(r'mean_volume: (-?[\d.]+) dB', r.stderr); lv.append(float(m.group(1)) if m else -99)
    pan = 'pan=mono|c0=c0' if lv[0] - lv[1] > 6 else ('pan=mono|c0=c1' if lv[1] - lv[0] > 6 else 'pan=mono|c0=0.5*c0+0.5*c1')
    model = os.path.join(KIT, 'models', 'bd.rnnn')
    chain = [pan, 'highpass=f=75', 'lowpass=f=15000']
    if os.path.exists(model):
        chain.append(f"arnndn=m='{model}':mix=0.9")
    chain += ['afftdn=nr=10:nf=-42:tn=1', 'deesser=i=0.35:m=0.5:f=0.5',
              'equalizer=f=180:t=q:w=1.0:g=-1.5', 'equalizer=f=3200:t=q:w=1.2:g=2.5', 'equalizer=f=9000:t=q:w=1.0:g=1',
              'acompressor=threshold=-22dB:ratio=3:attack=6:release=140:makeup=4',
              'loudnorm=I=-16:TP=-1.5:LRA=9']
    out = f'{WORK}/{key}_clean.wav'
    sh(['ffmpeg', '-y', '-i', raw, '-af', ','.join(chain), '-ar', '48000', '-c:a', 'pcm_s16le', out])
    return out, {'channel_levels': lv, 'pan': pan}

def transcribe(wav, key):
    from faster_whisper import WhisperModel
    model = WhisperModel(CFG.get('whisper_model', 'small.en'), device='cpu', compute_type='int8')
    prompt = CFG.get('vocab_prompt', '')
    segs, info = model.transcribe(wav, language='en', word_timestamps=True, beam_size=5, initial_prompt=prompt,
                                  vad_filter=False, condition_on_previous_text=False)
    words = []
    for s in segs:
        for w in s.words:
            words.append({'w': w.word.strip(), 'a': round(w.start, 3), 'b': round(w.end, 3), 'p': round(w.probability, 3)})
    json.dump(words, open(f'{WORK}/{key}_whisper.json', 'w'), indent=0)
    return words

def align(script, words):
    """Map script tokens to whisper word timings. Returns (aligned tokens, cut spans, notes)."""
    st = script_tokens(script); sn = [norm(t) for t in st]
    wn = [norm(w['w']) for w in words]
    sm = difflib.SequenceMatcher(None, sn, wn, autojunk=False)
    out = [None]*len(st); cuts = []; notes = []
    ops = sm.get_opcodes()
    for k, (tag, i1, i2, j1, j2) in enumerate(ops):
        if tag == 'equal':
            for d in range(i2-i1):
                w = words[j1+d]; out[i1+d] = {'t': st[i1+d], 'a': w['a'], 'b': w['b']}
        elif tag == 'replace':
            sj = ' '.join(sn[i1:i2]); wj = ' '.join(wn[j1:j2])
            ratio = difflib.SequenceMatcher(None, sj, wj).ratio()
            a, b = words[j1]['a'], words[j2-1]['b']
            if ratio >= 0.5:
                lens = [max(1, len(sn[i])) for i in range(i1, i2)]; tot = sum(lens); t = a
                for d, L in enumerate(lens):
                    nt = t + (b-a)*L/tot; out[i1+d] = {'t': st[i1+d], 'a': round(t, 3), 'b': round(nt, 3)}; t = nt
            else:
                notes.append(f'spoken differs: script "{" ".join(st[i1:i2])}" vs heard "{" ".join(w["w"] for w in words[j1:j2])}"')
                for d in range(j2-j1):
                    w = words[j1+d]; out.append({'t': w['w'], 'a': w['a'], 'b': w['b'], 'spoken': True})
                for i in range(i1, i2): out[i] = {'t': st[i], 'skip': True}
        elif tag == 'delete':
            if i2-i1 >= 3:
                notes.append(f'not heard: "{" ".join(st[i1:i2])}"')
            for i in range(i1, i2): out[i] = {'t': st[i], 'interp': True}
        elif tag == 'insert':
            block = words[j1:j2]; bn = [norm(w['w']) for w in block]
            # false start: inserted words re-appear in the next few script tokens
            nxt = set(sn[i1:i1+len(bn)+4])
            is_restart = len(bn) > 0 and sum(1 for x in bn if x in nxt) >= max(1, math.ceil(0.6*len(bn)))
            only_fill = all(x in FILLERS or x == '' for x in bn)
            if is_restart or only_fill:
                # cut from the first inserted word to just before the next real word
                nb = words[j2]['a'] if j2 < len(words) else block[-1]['b']
                cuts.append((block[0]['a'] - 0.04, nb - 0.06))
                notes.append(('restart' if is_restart else 'filler') + f' cut: "{" ".join(w["w"] for w in block)}"')
            else:
                notes.append(f'extra spoken words kept: "{" ".join(w["w"] for w in block)}"')
                for w in block: out.append({'t': w['w'], 'a': w['a'], 'b': w['b'], 'spoken': True})
    # interpolate unheard tokens between neighbours
    toks = [o for o in out[:len(st)]]
    for i, o in enumerate(toks):
        if o and o.get('interp'):
            prev = next((toks[j] for j in range(i-1, -1, -1) if toks[j] and 'a' in toks[j]), None)
            nxt = next((toks[j] for j in range(i+1, len(toks)) if toks[j] and 'a' in toks[j]), None)
            if prev and nxt:
                o['a'] = prev['b']; o['b'] = max(prev['b'] + 0.05, nxt['a'])
            else:
                o['skip'] = True
    extra = out[len(st):]
    allw = [o for o in toks if o and not o.get('skip') and 'a' in o] + extra
    allw.sort(key=lambda o: o['a'])
    # drop words that fall inside cut spans
    allw = [o for o in allw if not any(c0 <= (o['a']+o['b'])/2 <= c1 for c0, c1 in cuts)]
    return allw, cuts, notes

def keep_segments(words, cuts, total):
    """Speech segments with tightened pauses and removed false starts/fillers."""
    if not words: return [(0, total)]
    lead, tail = 0.22, 0.40
    segs = []
    a = max(0, words[0]['a'] - lead); prev_end = words[0]['b']
    for w0, w1 in zip(words, words[1:]):
        gap = w1['a'] - w0['b']
        sentence = w0['t'].rstrip().endswith(('.', '?', '!'))
        maxgap = 0.42 if sentence else 0.30
        cut_between = any(w0['b'] - 0.01 <= c0 and c1 <= w1['a'] + 0.01 for c0, c1 in cuts)
        if gap > maxgap + 0.15 or cut_between:
            keep = maxgap / 2
            segs.append((a, min(w0['b'] + keep, w1['a'] - 0.02)))
            a = max(w0['b'] + 0.02, w1['a'] - keep)
    segs.append((a, min(total, words[-1]['b'] + tail)))
    # merge tiny segments
    m = []
    for s in segs:
        if s[1] - s[0] < 0.08: continue
        if m and s[0] - m[-1][1] < 0.04: m[-1] = (m[-1][0], s[1])
        else: m.append(s)
    return m

def remap(words, segs):
    out = []; off = 0
    for a, b in segs:
        for w in words:
            mid = (w['a'] + w['b'])/2
            if a <= mid <= b:
                out.append({**w, 'a': round(max(0, w['a']-a)+off, 3), 'b': round(min(b, w['b'])-a+off, 3)})
        off += b - a
    return out, off

def face_box(src, total, key):
    try:
        return _face_box(src, total, key)
    except Exception as e:
        print('face detection unavailable:', e); return None

def _face_box(src, total, key):
    """Median face location over sampled frames (source pixel coords)."""
    import cv2, numpy as np
    info = probe(src); v = next(s for s in info['streams'] if s['codec_type'] == 'video')
    casc = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    boxes = []; lumas = []
    for i in range(12):
        t = total*(0.08 + 0.84*i/11)
        tmp = f'{WORK}/{key}_probe.png'
        sh(['ffmpeg', '-y', '-ss', f'{t:.2f}', '-i', src, '-frames:v', '1', '-vf', 'scale=1280:-2', tmp])
        img = cv2.imread(tmp); h, w = img.shape[:2]
        g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        fs = casc.detectMultiScale(g, 1.1, 6, minSize=(int(h*0.08), int(h*0.08)))
        if len(fs):
            x, y, fw, fh = max(fs, key=lambda f: f[2]*f[3]); boxes.append((x+fw/2, y+fh/2, fh, w, h))
            yuv = cv2.cvtColor(img, cv2.COLOR_BGR2YUV)[y:y+fh, x:x+fw, 0]; lumas.append(float(yuv.mean())/255)
    if not boxes:
        return None
    cx = statistics.median(b[0] for b in boxes); cy = statistics.median(b[1] for b in boxes); fh = statistics.median(b[2] for b in boxes)
    w, h = boxes[0][3], boxes[0][4]
    return {'cx': cx/w, 'cy': cy/h, 'fh': fh/h, 'luma': statistics.median(lumas) if lumas else 0.5, 'n': len(boxes)}

def prep(key):
    s = spk(key); src = os.path.join(WORK, s['src'])
    total = dur(src)
    info = probe(src); v = next(x for x in info['streams'] if x['codec_type'] == 'video')
    W0, H0 = v['width'], v['height']
    print(f'[{key}] source {W0}x{H0} {total:.1f}s', flush=True)
    clean, ainfo = clean_audio(src, key)
    words = transcribe(clean, key)
    aligned, cuts, notes = align(s['script'], words)
    segs = keep_segments(aligned, cuts, total)
    new_words, newdur = remap(aligned, segs)
    fb = face_box(src, total, key) or {'cx': 0.5, 'cy': 0.42, 'fh': 0.22, 'luma': 0.5, 'n': 0}
    # rotation-aware display size
    rot = 0
    for sd in v.get('side_data_list', []) or []:
        if 'rotation' in sd: rot = int(sd['rotation'])
    if abs(rot) in (90, 270): W0, H0 = H0, W0
    ch = min(H0, max(fb['fh']*H0*4.4, H0*0.60)); cw = ch*2/3
    if cw > W0: cw = W0; ch = cw*1.5
    cx = fb['cx']*W0; cy = fb['cy']*H0
    x0 = min(max(0, cx - cw/2), W0 - cw); y0 = min(max(0, cy - 0.36*ch), H0 - ch)
    target = 0.50
    gamma = max(0.78, min(1.40, math.log(target)/math.log(max(0.08, min(0.92, fb['luma'])))))
    grade = f'eq=gamma={gamma:.3f}:contrast=1.06:saturation=1.10,unsharp=5:5:0.55:5:5:0.0'
    crop = f'crop={int(cw)//2*2}:{int(ch)//2*2}:{int(x0)}:{int(y0)},scale=352:528:flags=lanczos,hqdn3d=1.0:1.0:3:3,{grade},fps={FPS},format=yuv420p'
    # build cut graph
    fv = []; fa = []
    for i, (a, b) in enumerate(segs):
        fv.append(f'[0:v]trim=start={a:.3f}:end={b:.3f},setpts=PTS-STARTPTS[v{i}]')
        d = b - a; fd = min(0.012, d/4)
        fa.append(f'[1:a]atrim=start={a:.3f}:end={b:.3f},asetpts=PTS-STARTPTS,afade=t=in:d={fd:.3f},afade=t=out:st={d-fd:.3f}:d={fd:.3f}[a{i}]')
    n = len(segs)
    graph = ';'.join(fv + fa) + ';' + ''.join(f'[v{i}][a{i}]' for i in range(n)) + f'concat=n={n}:v=1:a=1[vc][ac];[vc]{crop}[vo]'
    sh(['ffmpeg', '-y', '-i', src, '-i', clean, '-filter_complex', graph, '-map', '[vo]', '-map', '[ac]',
        '-c:v', 'libx264', '-preset', PRESET, '-crf', '14', '-pix_fmt', 'yuv420p', '-c:a', 'pcm_s16le', '-ar', '48000', f'{WORK}/{key}_face.mov'])
    sh(['ffmpeg', '-y', '-i', f'{WORK}/{key}_face.mov', '-vn', '-c:a', 'pcm_s16le', f'{WORK}/{key}_voice.wav'])
    meta = {'key': key, 'src_dur': total, 'dur': dur(f'{WORK}/{key}_voice.wav'), 'segments': segs, 'cuts': cuts, 'notes': notes,
            'face': fb, 'crop': [int(x0), int(y0), int(cw), int(ch)], 'gamma': gamma, 'audio': ainfo, 'src_size': [W0, H0]}
    json.dump(new_words, open(f'{WORK}/{key}_words.json', 'w'), indent=0)
    json.dump(meta, open(f'{WORK}/{key}_meta.json', 'w'), indent=1)
    heard = ' '.join(w['w'] for w in words)
    print(json.dumps({k: meta[k] for k in ('dur', 'src_dur', 'face', 'crop', 'gamma', 'notes')}, indent=1))
    print('HEARD:', heard)

# ------------------------------------------------------------------ SUBTITLES
KEYWORDS = {'imaar', 'aurex', 'imaar,', 'aurex,'}
def cues_from_words(words, max_chars=78, max_dur=4.2):
    cues = []; cur = []
    def flush():
        if cur: cues.append(list(cur)); cur.clear()
    for i, w in enumerate(words):
        cur.append(w)
        txt = ' '.join(x['t'] for x in cur)
        end_sent = w['t'].endswith(('.', '?', '!'))
        soft = w['t'].endswith((',', ':', ';'))
        nxt = words[i+1] if i+1 < len(words) else None
        gap = (nxt['a'] - w['b']) if nxt else 9
        span = w['b'] - cur[0]['a']
        if end_sent or gap > 0.5 or (soft and len(txt) > 40) or len(txt) > max_chars - 10 or span > max_dur:
            flush()
    flush()
    return cues

def split_lines(text, maxline=40):
    if len(text) <= maxline: return [text]
    words = text.split(' '); best = None
    for i in range(1, len(words)):
        l1, l2 = ' '.join(words[:i]), ' '.join(words[i:])
        sc = max(len(l1), len(l2)) + (0 if l1.endswith(',') else 2)
        if best is None or sc < best[0]: best = (sc, l1, l2)
    return [best[1], best[2]]

def ass_time(t):
    t = max(0, t); h = int(t//3600); m = int(t % 3600//60); s = t % 60
    return f'{h}:{m:02d}:{s:05.2f}'

def write_ass(words, path, dur_total):
    hdr = """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,Inter SemiBold,46,&H00FFFFFF,&H00FFFFFF,&H00140820,&H96000000,0,0,0,0,100,100,0.2,0,1,1.2,2.2,5,40,40,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    lines = []
    cues = cues_from_words(words)
    for k, c in enumerate(cues):
        a = c[0]['a'] - 0.06; b = c[-1]['b'] + 0.25
        if k+1 < len(cues): b = min(b, cues[k+1][0]['a'] - 0.06)
        b = min(b, dur_total - 0.05)
        txt = ' '.join(x['t'] for x in c)
        parts = split_lines(txt)
        def color(seg):
            return ' '.join(('{\\c&H5FD3C5&}' + t + '{\\c&HFFFFFF&}') if norm(t) in ('imaar', 'aurex') else t for t in seg.split(' '))
        body = '\\N'.join(color(p) for p in parts)
        lines.append(f'Dialogue: 0,{ass_time(a)},{ass_time(b)},Sub,,0,0,0,,{{\\pos(960,966)\\fad(90,90)}}{body}')
    open(path, 'w').write(hdr + '\n'.join(lines) + '\n')

# ------------------------------------------------------------------ SIM TRACKS
def sim_clip(name):
    return os.path.join(KIT, CFG['sim'][name])

def sim_track(shots, D, out, size=(1472, 828), anchors_words=None, zoom=0.0, xf=0.6):
    """shots: [{clip,a,b, anchor?}] -> video of exactly D seconds, crossfaded."""
    # slot boundaries
    starts = [0.0]
    for sh_ in shots[1:]:
        t = None
        if sh_.get('anchor') and anchors_words:
            t = find_phrase(anchors_words, sh_['anchor'])
        starts.append(t)
    # fill missing starts proportionally to footage length
    lens = [s['b'] - s['a'] for s in shots]
    for i in range(1, len(shots)):
        if starts[i] is None:
            j = next((k for k in range(i+1, len(shots)) if starts[k] is not None), None)
            end = starts[j] if j is not None else D
            prev = starts[i-1]; rem = sum(lens[i-1:(j if j is not None else len(shots))])
            starts[i] = prev + (end - prev) * lens[i-1] / rem
    starts = [min(max(0, s), D - 1.0) for s in starts]
    for i in range(1, len(starts)): starts[i] = max(starts[i], starts[i-1] + 1.5)
    ends = starts[1:] + [D]
    parts = []; inputs = []
    for i, (s, (t0, t1)) in enumerate(zip(shots, zip(starts, ends))):
        slot = (t1 - t0) + (xf if i < len(shots)-1 else 0)
        L = s['b'] - s['a']; speed = L / slot
        speed = max(0.5, min(1.6, speed)); take = slot * speed
        a = s['a']; cd = dur(sim_clip(s['clip']))
        if a + take > cd: a = max(0, cd - take)
        inputs += ['-ss', f'{a:.3f}', '-t', f'{take+0.2:.3f}', '-i', sim_clip(s['clip'])]
        z = f",scale={int(size[0]*(1+zoom))}:{int(size[1]*(1+zoom))},crop={size[0]}:{size[1]}" if zoom else ''
        parts.append(f'[{i}:v]setpts=(PTS-STARTPTS)/{speed:.4f},fps={FPS},scale={size[0]}:{size[1]}:flags=lanczos{z},trim=duration={slot:.3f},setpts=PTS-STARTPTS,format=yuv420p,settb=AVTB[s{i}]')
    g = ';'.join(parts); last = 's0'; acc = ends[0] - starts[0]
    for i in range(1, len(shots)):
        g += f';[{last}][s{i}]xfade=transition=fade:duration={xf}:offset={acc:.3f}[x{i}]'; last = f'x{i}'
        acc += ends[i] - starts[i]
    g += f';[{last}]trim=duration={D:.3f},setpts=PTS-STARTPTS[vo]'
    sh(['ffmpeg', '-y'] + inputs + ['-filter_complex', g, '-map', '[vo]', '-an', '-c:v', 'libx264', '-preset', PRESET, '-crf', '14', '-pix_fmt', 'yuv420p', out])
    return list(zip(starts, ends))

def find_phrase(words, phrase):
    pn = [norm(x) for x in phrase.split()]; wn = [norm(w['t']) for w in words]
    for i in range(len(wn) - len(pn) + 1):
        if wn[i:i+len(pn)] == pn: return max(0, words[i]['a'] - 0.3)
    # fuzzy fallback on first two tokens
    for i in range(len(wn)):
        if wn[i] == pn[0] and (len(pn) == 1 or (i+1 < len(wn) and wn[i+1] == pn[1])): return max(0, words[i]['a'] - 0.3)
    return None

# ------------------------------------------------------------------ SECTIONS
def img_in(name, D):
    return ['-loop', '1', '-framerate', str(FPS), '-t', f'{D:.3f}', '-i', os.path.join(GFX, name)]

def silence(D):
    return ['-f', 'lavfi', '-t', f'{D:.3f}', '-i', 'anullsrc=r=48000:cl=stereo']

def fades(D, fin=0.35, fout=0.35):
    return f'fade=t=in:st=0:d={fin}:color={PLUM},fade=t=out:st={D-fout:.3f}:d={fout}:color={PLUM}'

def blurred_bg(clip, a, D, out, zoom=0.05):
    sh(['ffmpeg', '-y', '-ss', f'{a}', '-t', f'{D+0.2}', '-i', sim_clip(clip), '-filter_complex',
        f"[0:v]fps={FPS},scale=480:270,boxblur=6:2,scale=1920:1080:flags=bicubic,scale='1920*(1+{zoom}*t/{D})':-2:eval=frame,crop=1920:1080,trim=duration={D},setpts=PTS-STARTPTS,format=yuv420p[v]",
        '-map', '[v]', '-c:v', 'libx264', '-preset', PRESET, '-crf', '16', out])

def sec_title(D, out):
    bg = f'{WORK}/bg_title.mp4'; t = CFG['title_bg']; blurred_bg(t['clip'], t['a'], D, bg)
    ins = ['-i', bg] + img_in('title_scrim.png', D) + img_in('title_top.png', D) + img_in('title_main.png', D) + img_in('title_card.png', D) + img_in('title_utas.png', D) + silence(D)
    g = ('[0:v][1:v]overlay[b0];'
         '[2:v]format=rgba,fade=t=in:st=0.25:d=0.6:alpha=1[l1];[b0][l1]overlay[b1];'
         '[3:v]format=rgba,fade=t=in:st=0.7:d=0.7:alpha=1[l2];[b1][l2]overlay[b2];'
         '[4:v]format=rgba,fade=t=in:st=1.3:d=0.7:alpha=1[l3];[b2][l3]overlay[b3];'
         '[5:v]format=rgba,fade=t=in:st=1.8:d=0.6:alpha=1[l4];[b3][l4]overlay[b4];'
         f'[b4]{fades(D, 0.6, 0.45)}[v]')
    sh(['ffmpeg', '-y'] + ins + ['-filter_complex', g, '-map', '[v]', '-map', '6:a', '-t', f'{D:.3f}'] + ENC + AENC + [out])

def sec_fullshot(shots, overlays, D, out, zoom=0.04):
    """full-screen sim footage with timed overlay PNGs: overlays=[(png, t0, t1)]"""
    st = f'{WORK}/fs_{os.path.basename(out)}.mp4'
    sim_track(shots, D, st, size=(1920, 1080), zoom=zoom, xf=0.45)
    ins = ['-i', st]
    for png, t0, t1 in overlays: ins += img_in(png, D)
    ins += silence(D)
    g = ''; last = '0:v'
    for i, (png, t0, t1) in enumerate(overlays, 1):
        fo = min(0.35, (t1-t0)/3)
        g += f'[{i}:v]format=rgba,fade=t=in:st={t0:.3f}:d=0.35:alpha=1,fade=t=out:st={t1-fo:.3f}:d={fo:.3f}:alpha=1[o{i}];[{last}][o{i}]overlay[c{i}];'
        last = f'c{i}'
    g += f'[{last}]{fades(D, 0.3, 0.3)}[v]'
    sh(['ffmpeg', '-y'] + ins + ['-filter_complex', g, '-map', '[v]', '-map', f'{len(overlays)+1}:a', '-t', f'{D:.3f}'] + ENC + AENC + [out])

def sec_main(key, out):
    s = spk(key); words = json.load(open(f'{WORK}/{key}_words.json'))
    D = dur(f'{WORK}/{key}_voice.wav')
    ass = f'{WORK}/{key}.ass'; write_ass(words, ass, D)
    st = f'{WORK}/{key}_sim.mp4'; slots = sim_track(CFG['plans'][key], D, st, anchors_words=words)
    ins = img_in('main_bg.png', D) + ['-i', st, '-i', f'{WORK}/{key}_face.mov'] + img_in('mask_stage.png', D) + img_in('mask_face.png', D) \
        + img_in('frames.png', D) + img_in('col_logos.png', D) + img_in(f'chapter{s["chapter"]}.png', D) + img_in(f'name_{key}.png', D)
    g = ('[1:v]format=rgba[sv];[3:v]format=gray[m1];[sv][m1]alphamerge[sm];[0:v][sm]overlay=32:32[b1];'
         '[2:v]format=rgba[fv];[4:v]format=gray[m2];[fv][m2]alphamerge[fm];[b1][fm]overlay=1536:332[b2];'
         '[b2][5:v]overlay[b3];[b3][6:v]overlay[b4];'
         '[7:v]format=rgba,fade=t=in:st=0.45:d=0.5:alpha=1[ch];[b4][ch]overlay[b5];'
         '[8:v]format=rgba,fade=t=in:st=0.7:d=0.5:alpha=1[nm];[b5][nm]overlay[b6];'
         f"[b6]subtitles='{ass}':fontsdir='{FONTS}'[b7];[b7]{fades(D, 0.3, 0.3)}[v];"
         f'[2:a]aformat=sample_rates=48000:channel_layouts=stereo,afade=t=in:d=0.05,afade=t=out:st={D-0.08:.3f}:d=0.08[a]')
    sh(['ffmpeg', '-y'] + ins + ['-filter_complex', g, '-map', '[v]', '-map', '[a]', '-t', f'{D:.3f}'] + ENC + AENC + [out])
    return D, slots

def sec_end(D, out):
    bg = f'{WORK}/bg_end.mp4'; e = CFG['end_bg']; blurred_bg(e['clip'], e['a'], D, bg, zoom=0.04)
    ins = ['-i', bg] + img_in('title_scrim.png', D) + img_in('end_main.png', D) + img_in('end_team.png', D) + silence(D)
    g = ('[0:v][1:v]overlay[b0];'
         '[2:v]format=rgba,fade=t=in:st=0.3:d=0.7:alpha=1[l1];[b0][l1]overlay[b1];'
         '[3:v]format=rgba,fade=t=in:st=1.2:d=0.8:alpha=1[l2];[b1][l2]overlay[b2];'
         f'[b2]fade=t=in:st=0:d=0.5:color={PLUM},fade=t=out:st={D-1.0:.3f}:d=1.0:color=black[v]')
    sh(['ffmpeg', '-y'] + ins + ['-filter_complex', g, '-map', '[v]', '-map', '4:a', '-t', f'{D:.3f}'] + ENC + AENC + [out])

def build():
    order = [s['key'] for s in CFG['speakers']]
    main_d = sum(dur(f'{WORK}/{k}_voice.wav') for k in order)
    T_TITLE, T_CH, T_END = 8.5, 3.2, 8.0
    fixed = T_TITLE + 3*T_CH + T_END
    target = CFG.get('target_seconds', 190)
    teaser = max(0.0, min(16.0, target - fixed - main_d))
    print(f'speech {main_d:.1f}s, fixed {fixed:.1f}s, teaser {teaser:.1f}s -> total ~{main_d+fixed+teaser:.1f}s', flush=True)
    secs = []
    sec_title(T_TITLE, f'{WORK}/s00_title.mp4'); secs.append('s00_title.mp4')
    if teaser >= 6:
        feats = CFG['teaser']
        nf = 5 if teaser >= 12 else (4 if teaser >= 9 else 3)
        feats = feats[:nf]; per = teaser / nf
        shots = [{'clip': f['clip'], 'a': f['a'], 'b': f['a'] + per} for f in feats]
        ov = [(f['png'], i*per + (0.15 if i else 0.3), (i+1)*per - 0.1) for i, f in enumerate(feats)]
        sec_fullshot(shots, ov, teaser, f'{WORK}/s01_teaser.mp4'); secs.append('s01_teaser.mp4')
    report = {}
    for n, k in enumerate(order, 1):
        c = CFG['chapters'][n-1]
        sec_fullshot([{'clip': c['clip'], 'a': c['a'], 'b': c['a'] + T_CH}], [(f'chapfull{n}.png', 0.15, T_CH - 0.1)], T_CH, f'{WORK}/s{n}0_ch.mp4', zoom=0.05)
        secs.append(f's{n}0_ch.mp4')
        D, slots = sec_main(k, f'{WORK}/s{n}1_{k}.mp4'); secs.append(f's{n}1_{k}.mp4'); report[k] = {'dur': D, 'sim_slots': slots}
    sec_end(T_END, f'{WORK}/s90_end.mp4'); secs.append('s90_end.mp4')
    lst = f'{WORK}/concat.txt'; open(lst, 'w').write(''.join(f"file '{WORK}/{s}'\n" for s in secs))
    sh(['ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', f'{WORK}/joined.mp4'])
    # optional music bed, ducked under speech
    final = f'{OUT}/IMAAR_TeamAUREX.mp4'
    music = os.path.join(KIT, CFG.get('music', 'music/none.mp3'))
    if os.path.exists(music):
        D = dur(f'{WORK}/joined.mp4')
        g = (f'[1:a]aloop=loop=-1:size=2e9,atrim=duration={D:.3f},volume={CFG.get("music_gain", 0.16)},afade=t=in:d=1.5,afade=t=out:st={D-3:.3f}:d=3[m];'
             '[0:a]asplit=2[v1][v2];[m][v2]sidechaincompress=threshold=0.02:ratio=10:attack=40:release=600[md];'
             '[v1][md]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.2:LRA=11[a]')
        sh(['ffmpeg', '-y', '-i', f'{WORK}/joined.mp4', '-i', music, '-filter_complex', g, '-map', '0:v', '-map', '[a]', '-c:v', 'copy'] + AENC + ['-movflags', '+faststart', final])
    else:
        sh(['ffmpeg', '-y', '-i', f'{WORK}/joined.mp4', '-af', 'loudnorm=I=-14:TP=-1.2:LRA=11', '-c:v', 'copy'] + AENC + ['-movflags', '+faststart', final])
    report['total'] = dur(final); report['sections'] = secs
    json.dump(report, open(f'{OUT}/report.json', 'w'), indent=1); print(json.dumps(report, indent=1))

def qa(path=None, n=12, cols=4, w=480):
    path = path or f'{OUT}/IMAAR_TeamAUREX.mp4'; D = dur(path)
    sh(['ffmpeg', '-y', '-i', path, '-vf', f'fps={n}/{D:.3f},scale={w}:-2,tile={cols}x{math.ceil(n/cols)}', '-frames:v', '1', '-q:v', '5', f'{OUT}/qa.jpg'])

if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'prep': prep(sys.argv[2])
    elif cmd == 'build': build()
    elif cmd == 'qa': qa(*(sys.argv[2:3] or []))
    elif cmd == 'sec_main': print(sec_main(sys.argv[2], f'{WORK}/test_{sys.argv[2]}.mp4'))
