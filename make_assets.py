"""Builds every static graphic layer for the IMAAR video (1920x1080)."""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np, os

OUT = '/tmp/iv/kit/gfx'; os.makedirs(OUT, exist_ok=True)
W, H = 1920, 1080
GF = '/usr/share/fonts/truetype/google-fonts/'
IF = '/usr/share/fonts/opentype/inter/'
def F(name, size):
    p = {'pb': GF+'Poppins-Bold.ttf', 'ps': GF+'Poppins-Medium.ttf', 'pr': GF+'Poppins-Regular.ttf',
         'ib': IF+'Inter-Bold.otf', 'is': IF+'Inter-SemiBold.otf', 'im': IF+'Inter-Medium.otf', 'ir': IF+'Inter-Regular.otf',
         'ix': IF+'InterDisplay-ExtraBold.otf', 'ik': IF+'InterDisplay-Black.otf'}[name]
    return ImageFont.truetype(p, size)

# competition palette (sampled from the official IET-GCC slide)
PLUM_D = (30, 14, 36); PLUM = (76, 43, 74); LILAC = (126, 82, 141); VIOLET = (73, 39, 90)
LIME = (197, 211, 95); WHITE = (255, 255, 255); MUTED = (214, 200, 222)

# layout constants (shared with render.py)
STAGE = (32, 32, 1472, 828)          # x, y, w, h  (16:9)
COLX, COLW = 1536, 352
FACE = (1536, 332, 352, 528)          # 2:3 portrait
SUB_Y0, SUB_Y1 = 884, 1048

def rr_mask(w, h, r, scale=4):
    m = Image.new('L', (w*scale, h*scale), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, w*scale-1, h*scale-1], r*scale, fill=255)
    return m.resize((w, h), Image.LANCZOS)

def text_c(d, cx, y, s, f, fill, spacing=0):
    if spacing:
        tw = sum(d.textlength(ch, font=f) for ch in s) + spacing*(len(s)-1); x = cx - tw/2
        for ch in s:
            d.text((x, y), ch, font=f, fill=fill); x += d.textlength(ch, font=f) + spacing
    else:
        d.text((cx - d.textlength(s, font=f)/2, y), s, font=f, fill=fill)

def spaced(d, x, y, s, f, fill, spacing):
    for ch in s:
        d.text((x, y), ch, font=f, fill=fill); x += d.textlength(ch, font=f) + spacing
    return x

def gradient_bg():
    y = np.linspace(0, 1, H)[:, None]; x = np.linspace(0, 1, W)[None, :]
    top = np.array(PLUM_D); bot = np.array((52, 26, 58))
    base = top[None, None, :]*(1-y[..., None]) + bot[None, None, :]*y[..., None]
    base = np.broadcast_to(base, (H, W, 3)).copy()
    # soft lilac glow behind the column and a faint one bottom-left
    for (gx, gy, rad, col, k) in [(1700, 300, 700, LILAC, .35), (200, 1000, 800, VIOLET, .30)]:
        d = np.sqrt((np.arange(W)[None, :]-gx)**2 + (np.arange(H)[:, None]-gy)**2)
        a = np.clip(1 - d/rad, 0, 1)**2 * k
        base = base*(1-a[..., None]) + np.array(col)[None, None, :]*a[..., None]
    img = Image.fromarray(base.astype('uint8'))
    # subtle dot grid
    d = ImageDraw.Draw(img, 'RGBA')
    for gx in range(16, W, 32):
        for gy in range(16, H, 32):
            d.point((gx, gy), fill=(255, 255, 255, 18))
    return img

def logos():
    src = Image.open('/mnt/user-data/uploads/91adabb9-image.jpg').convert('RGB')
    iet = src.crop((488, 17, 802, 73)).resize((628, 112), Image.LANCZOS).filter(ImageFilter.UnsharpMask(1.2, 80, 2))
    gcc = src.crop((4, 12, 186, 106)).resize((546, 282), Image.LANCZOS).filter(ImageFilter.UnsharpMask(1.2, 80, 2))
    utas = Image.open('/tmp/lab/pusht/assets/utas-ibra-logo.png').convert('RGBA')
    return iet, gcc, utas

def card(w, h, r, fill, outline=None, ow=2, shadow=True):
    pad = 40 if shadow else 0
    im = Image.new('RGBA', (w+2*pad, h+2*pad), (0, 0, 0, 0))
    if shadow:
        sh = Image.new('RGBA', im.size, (0, 0, 0, 0))
        ImageDraw.Draw(sh).rounded_rectangle([pad, pad+10, pad+w, pad+h+10], r, fill=(0, 0, 0, 120))
        im = Image.alpha_composite(im, sh.filter(ImageFilter.GaussianBlur(18)))
    lay = Image.new('RGBA', im.size, (0, 0, 0, 0)); ImageDraw.Draw(lay).rounded_rectangle([pad, pad, pad+w, pad+h], r, fill=fill, outline=outline, width=ow)
    return Image.alpha_composite(im, lay), pad

def paste_logo_on_white(base, logo, box, r=14, padx=18, pady=12):
    x, y, w, h = box
    c, p = card(w, h, r, (255, 255, 255, 255), shadow=False)
    base.alpha_composite(c, (x-p, y-p))
    lw, lh = logo.size; s = min((w-2*padx)/lw, (h-2*pady)/lh)
    lg = logo.resize((int(lw*s), int(lh*s)), Image.LANCZOS).convert('RGBA')
    base.alpha_composite(lg, (int(x+(w-lg.width)/2), int(y+(h-lg.height)/2)))

def main_layout():
    iet, gcc, utas = logos()
    img = gradient_bg().convert('RGBA')
    sx, sy, sw, sh = STAGE
    # stage drop shadow
    shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle([sx, sy+12, sx+sw, sy+sh+12], 22, fill=(0, 0, 0, 150))
    img = Image.alpha_composite(img, shadow.filter(ImageFilter.GaussianBlur(22)))
    fx, fy, fw, fh = FACE
    shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle([fx, fy+12, fx+fw, fy+fh+12], 24, fill=(0, 0, 0, 150))
    img = Image.alpha_composite(img, shadow.filter(ImageFilter.GaussianBlur(22)))
    d = ImageDraw.Draw(img)
    # column header: wordmark + team
    cx = COLX + COLW/2
    d.text((COLX+4, 30), 'IMAAR', font=F('pb', 72), fill=WHITE)
    d.text((COLX+8, 122), 'Autonomous weeding robot', font=F('im', 20), fill=MUTED)
    d.rounded_rectangle([COLX+4, 160, COLX+4+12, 160+12], 3, fill=LIME)
    d.text((COLX+26, 152), 'Team AUREX', font=F('ps', 24), fill=LIME)
    d.text((COLX+26, 184), 'UTAS Ibra · Oman', font=F('ir', 20), fill=MUTED)
    img.save(f'{OUT}/main_bg.png')
    # stage frame (thin border, drawn above the sim)
    fr = Image.new('RGBA', (W, H), (0, 0, 0, 0)); dd = ImageDraw.Draw(fr)
    dd.rounded_rectangle([sx, sy, sx+sw-1, sy+sh-1], 20, outline=(255, 255, 255, 46), width=2)
    # facecam frame: lime accent border
    dd.rounded_rectangle([fx-3, fy-3, fx+fw+2, fy+fh+2], 25, outline=LIME+(255,), width=4)
    fr.save(f'{OUT}/frames.png')
    rr_mask(sw, sh, 20).save(f'{OUT}/mask_stage.png')
    rr_mask(fw, fh, 22).save(f'{OUT}/mask_face.png')
    # small logo strip under the stage? keep logos in the column above the facecam
    lg = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    paste_logo_on_white(lg, utas, (COLX+4, 236, 168, 64), r=12, padx=10, pady=6)
    paste_logo_on_white(lg, iet, (COLX+180, 236, 168, 64), r=12, padx=10, pady=8)
    lg.save(f'{OUT}/col_logos.png')

def chapter(n, title):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    x, y = STAGE[0] + 24, STAGE[1] + STAGE[3] - 24 - 54
    # chip sits bottom-left inside the stage? No: top-left of stage is the sim's own IMAAR panel.
    # Place it on the stage's bottom edge, left of centre, overlapping the frame line
    f1, f2 = F('pb', 22), F('ps', 22)
    t1 = f'0{n}'; t2 = title.upper()
    w = 28 + d.textlength(t1, font=f1) + 18 + sum(d.textlength(c, font=f2) for c in t2) + 2*(len(t2)-1) + 28
    x = STAGE[0] + 28; y = STAGE[1] + STAGE[3] - 27
    c, p = card(int(w), 54, 27, (30, 14, 36, 235), outline=LIME+(255,), ow=2)
    im.alpha_composite(c, (int(x-p), int(y-p)))
    d.text((x+28, y+12), t1, font=f1, fill=LIME)
    spaced(d, x+28+d.textlength(t1, font=f1)+18, y+12, t2, f2, WHITE, 2)
    im.save(f'{OUT}/chapter{n}.png')

def nametag(key, name, role):
    fx, fy, fw, fh = FACE
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    # scrim gradient at bottom of facecam
    g = Image.new('RGBA', (fw, 170), (0, 0, 0, 0)); gd = ImageDraw.Draw(g)
    for i in range(170):
        gd.line([(0, i), (fw, i)], fill=(20, 8, 26, int(215*(i/170)**1.6)))
    m = rr_mask(fw, fh, 22).crop((0, fh-170, fw, fh))
    g.putalpha(Image.fromarray((np.array(g.getchannel('A')).astype(float)*np.array(m)/255).astype('uint8')))
    im.alpha_composite(g, (fx, fy+fh-170))
    d = ImageDraw.Draw(im)
    parts = name.split(' '); first = parts[0]; rest = ' '.join(parts[1:])
    f1 = F('pb', 30); f2 = F('ps', 19)
    # fit first line
    line1 = name if d.textlength(name, font=f1) <= fw-36 else first
    line2 = '' if line1 == name else rest
    y = fy + fh - 22 - 26 - (36 if line2 else 0) - 30
    d.text((fx+18, y), line1, font=f1, fill=WHITE); y += 38
    if line2:
        d.text((fx+18, y), line2, font=F('ps', 22), fill=WHITE); y += 32
    d.text((fx+18, y+2), role, font=f2, fill=LIME)
    im.save(f'{OUT}/name_{key}.png')

def title_layers():
    iet, gcc, utas = logos()
    # overlay to darken the blurred sim behind the title
    ov = Image.new('RGBA', (W, H)); a = np.zeros((H, W, 4), 'uint8')
    a[..., :3] = PLUM_D; yy = np.linspace(0, 1, H)[:, None]
    a[..., 3] = (np.clip(170 + 60*np.abs(yy-0.45)*2, 0, 235)).astype('uint8').repeat(W, 1)
    Image.fromarray(a, 'RGBA').save(f'{OUT}/title_scrim.png')
    # top band: IET logo centred, GCC tiles both sides, event line
    top = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(top)
    paste_logo_on_white(top, iet, (W//2-230, 48, 460, 96), r=16, padx=22, pady=12)
    g = gcc.resize((220, 114), Image.LANCZOS).convert('RGBA')
    gm = rr_mask(220, 114, 16); g.putalpha(gm)
    top.alpha_composite(g, (80, 40)); top.alpha_composite(g, (W-80-220, 40))
    text_c(d, W//2, 168, '10TH IET-GCC ROBOTICS CHALLENGE 2026', F('is', 26), WHITE, spacing=3)
    text_c(d, W//2, 206, '12 NOVEMBER 2026  ·  UNIVERSITY OF BAHRAIN', F('im', 22), MUTED, spacing=3)
    top.save(f'{OUT}/title_top.png')
    # left: project title
    t = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(t)
    d.text((120, 330), 'PRESENTATION', font=F('is', 22), fill=LIME)
    d.text((112, 352), 'IMAAR', font=F('pb', 190), fill=WHITE)
    fsub = F('ir', 34)
    for i, line in enumerate(['Soil-safe weed management and field safety', 'with an autonomous agricultural robot.']):
        d.text((120, 600 + i*48), line, font=fsub, fill=(236, 228, 240))
    d.rounded_rectangle([120, 722, 120+120, 728], 3, fill=LIME)
    t.save(f'{OUT}/title_main.png')
    # right: team card
    cw, ch = 660, 470; cx0, cy0 = W-120-cw, 318
    c, p = card(cw, ch, 26, (73, 39, 90, 225), outline=(255, 255, 255, 40), ow=2)
    tc = Image.new('RGBA', (W, H), (0, 0, 0, 0)); tc.alpha_composite(c, (cx0-p, cy0-p)); d = ImageDraw.Draw(tc)
    x = cx0 + 44; y = cy0 + 36
    d.text((x, y), 'TEAM MEMBERS', font=F('is', 18), fill=MUTED); y += 30
    d.text((x, y), 'Team AUREX', font=F('pb', 46), fill=LIME); y += 68
    for n in ['BILARAB SUWAILAM ALMUSALLAMI', 'LUJAIN KHALID ALRAWAHI', 'BAYAN SAID ALI ALRAWAHI']:
        d.text((x, y), n, font=F('ps', 27), fill=WHITE); y += 42
    y += 14; d.line([(x, y), (x+cw-88, y)], fill=(255, 255, 255, 50), width=2); y += 22
    d.text((x, y), 'UTAS IBRA / OMAN', font=F('pb', 30), fill=WHITE); y += 44
    d.text((x, y), 'University of Technology and Applied Sciences – Ibra', font=F('ir', 21), fill=MUTED); y += 40
    d.text((x, y), 'Team advisor: AMER NOOR KHAN', font=F('im', 23), fill=WHITE)
    tc.save(f'{OUT}/title_card.png')
    # bottom-left UTAS logo chip
    u = Image.new('RGBA', (W, H), (0, 0, 0, 0)); paste_logo_on_white(u, utas, (120, 860, 300, 112), r=16, padx=16, pady=10)
    u.save(f'{OUT}/title_utas.png')

def end_layers():
    iet, gcc, utas = logos()
    e = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(e)
    text_c(d, W//2, 250, 'OUR VISION', F('is', 26), LIME, spacing=6)
    text_c(d, W//2, 300, 'Smarter and safer farming.', F('pb', 92), WHITE)
    text_c(d, W//2, 440, 'AI  ·  Robotics  ·  Drone technology — in one autonomous system', F('ir', 30), MUTED)
    e.save(f'{OUT}/end_main.png')
    b = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(b)
    text_c(d, W//2, 560, 'IMAAR', F('pb', 120), WHITE)
    text_c(d, W//2, 712, 'Team AUREX  ·  UTAS Ibra, Oman', F('ps', 32), LIME)
    text_c(d, W//2, 760, 'Bilarab Almusallami  ·  Lujain Alrawahi  ·  Bayan Alrawahi   |   Advisor: Amer Noor Khan', F('ir', 24), MUTED)
    paste_logo_on_white(b, utas, (W//2-450, 860, 280, 104), r=16, padx=14, pady=10)
    paste_logo_on_white(b, iet, (W//2-140, 860, 360, 104), r=16, padx=18, pady=14)
    g = gcc.resize((200, 104), Image.LANCZOS).convert('RGBA'); g.putalpha(rr_mask(200, 104, 16)); b.alpha_composite(g, (W//2+250, 860))
    text_c(d, W//2, 996, 'Thank you', F('ps', 28), WHITE)
    text_c(d, W//2, 1044, 'Music: “Wholesome” by Kevin MacLeod (incompetech.com) · Licensed under CC BY 4.0', F('ir', 17), MUTED)
    b.save(f'{OUT}/end_team.png')

def chapter_full(n, title, who):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    a = np.zeros((H, W, 4), 'uint8'); a[..., :3] = PLUM_D
    xx = np.linspace(0, 1, W)[None, :]
    a[..., 3] = (np.clip(250 - np.clip(xx-0.34, 0, 1)*560, 0, 250)).astype('uint8').repeat(H, 0)
    im = Image.fromarray(a, 'RGBA'); d = ImageDraw.Draw(im)
    d.text((140, 330), f'0{n}', font=F('pb', 150), fill=LIME)
    d.text((140, 520), title, font=F('pb', 96), fill=WHITE)
    d.rounded_rectangle([146, 664, 146+110, 670], 3, fill=LIME)
    d.text((146, 700), who, font=F('ps', 34), fill=MUTED)
    im.save(f'{OUT}/chapfull{n}.png')

def feature(i, kicker, line):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    a = np.zeros((H, W, 4), 'uint8'); a[..., :3] = PLUM_D
    yy = np.linspace(0, 1, H)[:, None]
    a[..., 3] = (np.clip((yy-0.50)*3.2, 0, 1)*245).astype('uint8').repeat(W, 1)
    im = Image.fromarray(a, 'RGBA'); d = ImageDraw.Draw(im)
    spaced(d, 140, 820, kicker.upper(), F('is', 26), LIME, 5)
    d.text((136, 862), line, font=F('pb', 70), fill=WHITE)
    im.save(f'{OUT}/feat{i}.png')

if __name__ == '__main__':
    main_layout()
    chapter(1, 'The challenge'); chapter(2, 'How IMAAR works'); chapter(3, 'Tools & impact')
    nametag('lujain', 'LUJAIN KHALID ALRAWAHI', 'Team AUREX')
    nametag('bilarab', 'BILARAB SUWAILAM ALMUSALLAMI', 'Team AUREX')
    nametag('bayan', 'BAYAN SAID ALI ALRAWAHI', 'Team AUREX')
    title_layers(); end_layers()
    chapter_full(1, 'The challenge', 'Lujain Khalid Alrawahi')
    chapter_full(2, 'How IMAAR works', 'Bilarab Suwailam Almusallami')
    chapter_full(3, 'Tools & impact', 'Bayan Said Ali Alrawahi')
    chapter_full(4, 'IMAAR in action', 'Our 3D field simulation')
    feats = [('Scout drone', 'Scans the whole field first'), ('AI vision', 'Crop, weed or danger?'),
             ('Safety first', 'Four checks before every action'), ('Hook-screw', 'Lifts the root, keeps the soil'),
             ('Auto docking', 'Recharge · clean · empty · change tools'),
             ('Day and night', 'Warm white light, no UV'), ('Man-down alert', 'A fall stops the rover, the drone flies out')]
    for i, (k, l) in enumerate(feats, 1): feature(i, k, l)
    print('ok', sorted(os.listdir(OUT)))
