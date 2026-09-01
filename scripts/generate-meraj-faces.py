#!/usr/bin/env python3
"""
Meraj device-character — animated sprite-sheet + video-frame generator.

DESIGN (v3 — "floating TV"):
  • Body: smooth green SQUIRCLE (superellipse), TV form factor.
    Body aspect 1.20 : 1 (520x432 on a 600x512 canvas) — wide enough to
    read as a TV screen, round enough to stay cute.
  • Screen: wide inset display, aspect 1.52 : 1 (408x268) — the TV panel.
    Screen content is authored as BLACK screen + WHITE eyes/mouth
    (light theme). In dark mode the app applies `filter: invert(1)` to
    the screen layer → WHITE screen + BLACK eyes/mouth. One asset set,
    both themes.
  • Bezel: "CASHIEA" on the top bezel; "M" badge + "Meraj" wordmark,
    tagline, speaker dots and a standby LED on the bottom bezel — like
    a cute TV's front panel.
  • Animation: normalized phase-based motion (works at any frame count).
    Sheets: 8 frames @ 12fps (sprite/flipbook mode).
    Videos: 24 frames @ 24fps (real .webm loops, built by
    scripts/build-meraj-videos.mjs with a static ffmpeg).

Outputs:
  public/meraj/device-body.png            static shared body (screen hole)
  public/meraj/sheet-{state}.png          8-frame strips (3264x268)
  public/meraj/animation-preview*.gif     light + dark animated previews
  public/meraj/preview-light|dark.png     stills
  scripts/video-frames/{state}/frame_*.png  24-frame sequences (gitignored)

States: neutral, happy, sad, listening, thinking, speaking.

Usage:  python3 scripts/generate-meraj-faces.py
Then:   node scripts/build-meraj-videos.mjs
Requires: Pillow (pip install --user pillow)
"""

import math
import os
from PIL import Image, ImageDraw, ImageFont, ImageChops

# ────────────────────────────────────────────────────────────────
# Config
# ────────────────────────────────────────────────────────────────
W, H = 600, 512                # canvas (body render)
FRAMES = 8                     # sprite-sheet frames
VIDEO_FRAMES = 24              # video-loop frames (24fps)
SHEET_FPS = 12
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'meraj')
FRAME_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'scripts', 'video-frames')

FONT_DIR = '/usr/share/fonts/truetype/dejavu'
SERIF_BOLD = os.path.join(FONT_DIR, 'DejaVuSerif-Bold.ttf')
SANS = os.path.join(FONT_DIR, 'DejaVuSans.ttf')
SANS_BOLD = os.path.join(FONT_DIR, 'DejaVuSans-Bold.ttf')

# Palette — green body, cream bezel details
BODY_TOP = (162, 232, 188)     # soft mint highlight
BODY_BOT = (40, 165, 102)      # emerald base
RIM = (16, 108, 72)            # deep green rim
BADGE_GREEN = (24, 122, 82)    # "M" letter on the badge
DOT_GREEN = (16, 104, 68)      # speaker dots
CREAM = (252, 250, 241)        # bezel text / badge
LED = (250, 204, 120)          # standby light
SCREEN_BG = (14, 16, 20)       # black glass screen (light theme)
FACE_W = (250, 248, 242)       # white eyes/mouth (light theme)

# Geometry — body / screen / bezel
BODY_CX, BODY_CY, BODY_RX, BODY_RY = 300, 256, 260, 216   # 520x432
SCREEN_BOX = (96, 122, 504, 390)                           # 408x268, r=30 — vertically CENTERED
SCREEN_R = 30

STATES = ['neutral', 'happy', 'sad', 'listening', 'thinking', 'speaking']

# ────────────────────────────────────────────────────────────────
# Helpers
# ────────────────────────────────────────────────────────────────
def vgrad(w, h, top, bottom):
    g = Image.new('RGB', (1, h))
    for y in range(h):
        t = y / max(1, h - 1)
        g.putpixel((0, y), tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return g.resize((w, h), Image.BILINEAR)

def mask_rr(box, radius):
    w, h = box[2] - box[0], box[3] - box[1]
    m = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle((0, 0, w - 1, h - 1), radius=radius, fill=255)
    return m

def superellipse_pts(cx, cy, rx, ry, n=2.7, steps=288):
    pts = []
    for i in range(steps):
        a = 2 * math.pi * i / steps
        c, s = math.cos(a), math.sin(a)
        pts.append((cx + rx * math.copysign(abs(c) ** (2 / n), c),
                    cy + ry * math.copysign(abs(s) ** (2 / n), s)))
    return pts

def draw_spaced(d, text, cx, cy, font, fill, spacing=0):
    widths = [d.textlength(ch, font=font) for ch in text]
    total = sum(widths) + spacing * (len(text) - 1)
    x = cx - total / 2
    for ch, w in zip(text, widths):
        d.text((x, cy), ch, font=font, fill=fill, anchor='lm')
        x += w + spacing

def load(size, bold=False, serif=False):
    path = SERIF_BOLD if serif else (SANS_BOLD if bold else SANS)
    return ImageFont.truetype(path, size)

def invert_rgba(img):
    rgb = ImageChops.invert(img.convert('RGB'))
    out = rgb.convert('RGBA')
    out.putalpha(img.getchannel('A'))
    return out

# ────────────────────────────────────────────────────────────────
# Body render — static, shared by every state (screen left as a hole)
# ────────────────────────────────────────────────────────────────
def render_body():
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    body_pts = superellipse_pts(BODY_CX, BODY_CY, BODY_RX, BODY_RY, n=2.7)
    body_mask = Image.new('L', (W, H), 0)
    ImageDraw.Draw(body_mask).polygon(body_pts, fill=255)

    # smooth green gradient fill (composite keeps alpha=255 inside the mask)
    grad = vgrad(W, H, BODY_TOP, BODY_BOT).convert('RGBA')
    img = Image.composite(grad, img, body_mask)

    # soft accents — layered and alpha-composited so the body stays opaque
    accents = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ad = ImageDraw.Draw(accents)
    ad.ellipse((BODY_CX - 200, BODY_CY - 190, BODY_CX + 40, BODY_CY - 40),   # glossy highlight
               fill=(255, 255, 255, 58))
    ad.ellipse((BODY_CX + 60, BODY_CY + 90, BODY_CX + 260, BODY_CY + 220),   # warm sheen
               fill=(255, 255, 255, 26))
    ad.rounded_rectangle((88, 114, 512, 398), radius=38, fill=(0, 0, 0, 62))  # bezel shadow ring
    ad.rounded_rectangle((98, 124, 502, 388), radius=28, outline=(255, 255, 255, 30), width=2)
    inner_pts = superellipse_pts(BODY_CX, BODY_CY, BODY_RX - 12, BODY_RY - 12, n=2.7)
    ad.polygon(inner_pts, outline=(255, 255, 255, 26), width=3)             # inner light line
    # clip accents to the body silhouette so nothing bleeds past the edges
    accents = Image.composite(accents, Image.new('RGBA', (W, H), (0, 0, 0, 0)), body_mask)
    img.alpha_composite(accents)

    # rim: deep green outline
    d.polygon(body_pts, outline=RIM, width=12)

    # cut the screen hole (transparent window for the animated face layer)
    hole = Image.new('RGBA', (SCREEN_BOX[2] - SCREEN_BOX[0], SCREEN_BOX[3] - SCREEN_BOX[1]), (0, 0, 0, 0))
    img.paste(hole, (SCREEN_BOX[0], SCREEN_BOX[1]), mask_rr(SCREEN_BOX, SCREEN_R))

    # ── bezel content (opaque, drawn directly) ──
    draw_spaced(d, 'CASHIEA', BODY_CX, 61, load(16, bold=True), CREAM, spacing=6)

    d.ellipse((179, 403, 221, 445), fill=CREAM)                    # M badge
    d.text((200, 424), 'M', font=load(26, bold=True), fill=BADGE_GREEN, anchor='mm')
    d.text((312, 424), 'Meraj', font=load(36, serif=True), fill=CREAM, anchor='mm')
    draw_spaced(d, 'PLAN · TRACK · GROW TOGETHER', BODY_CX, 462, load(13), CREAM, spacing=1)

    for i in range(5):                                            # speaker dots
        x = 274 + i * 13
        d.ellipse((x - 3.5, 486.5, x + 3.5, 493.5), fill=DOT_GREEN)
    d.ellipse((106, 486, 114, 494), fill=LED)                     # standby LED

    return img

# ────────────────────────────────────────────────────────────────
# Screen-face animation — screen-local coords (408x268), phase t
# ────────────────────────────────────────────────────────────────
SW, SH = SCREEN_BOX[2] - SCREEN_BOX[0], SCREEN_BOX[3] - SCREEN_BOX[1]   # 408x268
EYE_X = (152, 256)
EYE_Y = 118

def op(color, alpha):
    """Pre-blend a translucent color against the black screen so the
    screen layer stays opaque (alpha=255) — safe to invert in dark mode."""
    return tuple(int(SCREEN_BG[i] + (color[i] - SCREEN_BG[i]) * (alpha / 255)) for i in range(3))

def screen_bg(d):
    d.rounded_rectangle((0, 0, SW - 1, SH - 1), radius=SCREEN_R, fill=SCREEN_BG)
    d.rounded_rectangle((8, 8, SW - 9, 96), radius=22, fill=op((255, 255, 255), 10))

def blink(d, cx, y=EYE_Y, w=10, h=5):
    d.rounded_rectangle((cx - w, y - h / 2, cx + w, y + h / 2), radius=2, fill=FACE_W)

def eye(d, cx, y=EYE_Y, w=13, h=17, dx=0, dy=0):
    d.ellipse((cx - w + dx, y - h + dy, cx + w + dx, y + h + dy), fill=FACE_W)

def eyes_resting(d, t, blinks, y=EYE_Y, w=13, h=17):
    for cx in EYE_X:
        if any(a <= t < b for a, b in blinks):
            blink(d, cx, y)
        else:
            dx = 3 * math.sin(2 * math.pi * t)
            dy = 1.2 * math.sin(4 * math.pi * t) * 0.5
            eye(d, cx, y, w, h, dx, dy)

def wave_bars(d, t, xs, widths, base_heights, baseline, freq, spread, radius, fill=FACE_W):
    for i, (cx, w, h) in enumerate(zip(xs, widths, base_heights)):
        m = 1 + spread * math.sin(2 * math.pi * freq * t + 0.9 * i)
        d.rounded_rectangle((cx - w / 2, baseline - h * m, cx + w / 2, baseline),
                            radius=radius, fill=fill)

# ── neutral: resting, blink, subtle drift ───────────────────────
def face_neutral(d, t):
    eyes_resting(d, t, [(0.45, 0.52), (0.9, 0.97)])
    mh = 11 if 0.35 <= t < 0.45 else 7          # tiny breath-mouth
    d.rounded_rectangle((172, 196 - mh / 2, 236, 196 + mh / 2), radius=mh / 2, fill=FACE_W)

# ── happy: closed happy eyes, smile, twinkling sparkles ─────────
def sparkle(d, cx, cy, r, alpha):
    d.polygon([(cx, cy - r), (cx + r * 0.28, cy - r * 0.28), (cx + r, cy),
               (cx + r * 0.28, cy + r * 0.28), (cx, cy + r),
               (cx - r * 0.28, cy + r * 0.28), (cx - r, cy),
               (cx - r * 0.28, cy - r * 0.28)], fill=op((255, 252, 240), alpha))

def face_happy(d, t):
    for cx in EYE_X:
        d.arc((cx - 16, 104, cx + 16, 125), 180, 360, fill=FACE_W, width=6)
    widen = 3 if 0.55 <= t < 0.65 else 0
    d.chord((172 - widen, 172, 236 + widen, 224), 0, 180, fill=FACE_W)
    for cx, cy, rx, ry in ((118, 205, 16, 8), (290, 205, 16, 8)):
        d.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=op((255, 255, 255), 26))
    for phase, (x, y, r) in zip((0.0, 0.5), ((96, 60, 9), (318, 52, 7))):
        a = 0.5 + 0.5 * math.sin(4 * math.pi * t + 2 * math.pi * phase)
        if a > 0.55:
            sparkle(d, x, y, r, int(255 * (a - 0.55) / 0.45))

# ── sad: worried brows, slow blink, sighing frown, tear ─────────
def face_sad(d, t):
    dip = 2.5 * math.sin(math.pi * t) ** 2
    for cx in EYE_X:
        d.line((cx - 18, 94 + dip, cx + 2, 103 + dip), fill=FACE_W, width=5)
        d.line((cx + 18, 94 + dip, cx - 2, 103 + dip), fill=FACE_W, width=5)
    if 0.55 <= t < 0.62:
        for cx in EYE_X:
            blink(d, cx, 130)
    else:
        eyes_resting(d, t, [], y=130, w=11, h=13)
    sag = 2 if t >= 0.75 else (1 if 0.25 <= t < 0.5 else 0)
    d.arc((172 - sag, 182 + sag, 236 + sag, 224 + sag), 180, 360, fill=FACE_W, width=6)
    if t >= 0.62:
        p = min(1.0, (t - 0.62) / 0.12)
        ty = 150 + 14 * min(1.0, (t - 0.62) / 0.38)
        d.ellipse((265, ty - 5, 271, ty + 5), fill=op((250, 248, 242), 220 * p))

# ── listening: dancing waveform + pulsing live dot ──────────────
def face_listening(d, t):
    eyes_resting(d, t, [(0.7, 0.77)])
    d.rounded_rectangle((110, 202, 298, 203), radius=1, fill=op((250, 248, 242), 115))
    for i, (cx, h) in enumerate(zip((150, 176, 202, 228, 254), (22, 38, 54, 36, 18))):
        m = 1 + 0.45 * math.sin(2 * math.pi * t + 0.9 * i)
        d.rounded_rectangle((cx - 3.5, 200 - h * m, cx + 3.5, 200), radius=3, fill=FACE_W)
    r = 6 + 2.5 * math.sin(4 * math.pi * t)
    a = 200 + 55 * math.sin(4 * math.pi * t)
    d.ellipse((366 - r, 34 - r, 366 + r, 34 + r), fill=op((120, 200, 140), max(60, a)))
    d.ellipse((366 - r / 2, 34 - r / 2, 366 + r / 2, 34 + r / 2), fill=op((190, 240, 200), 255))

# ── thinking: searching pupils + pulsing thought dots ───────────
def face_thinking(d, t):
    dx = 7 * math.sin(2 * math.pi * t)
    for cx in EYE_X:
        d.ellipse((cx - 14, 104, cx + 14, 132), outline=FACE_W, width=5)
        if not 0.88 <= t < 0.94:
            d.ellipse((cx + dx - 6, 112 - 6, cx + dx + 6, 112 + 6), fill=FACE_W)
    d.rounded_rectangle((186, 203, 222, 208), radius=2.5, fill=op((250, 248, 242), 110))
    for i, (x, r) in enumerate(zip((176, 204, 232), (5, 7, 9))):
        p = max(0.0, math.sin(2 * math.pi * t + 0.8 * i)) ** 2
        rr = r * (0.85 + 0.3 * p)
        d.ellipse((x - rr, 218 - rr, x + rr, 218 + rr), fill=op(FACE_W, 120 + 135 * p))

# ── speaking: chattering mouth-waveform, squints & blinks ───────
def face_speaking(d, t):
    if 0.8 <= t < 0.87:
        for cx in EYE_X:
            blink(d, cx)
    elif 0.3 <= t < 0.38:                      # excited squint
        for cx in EYE_X:
            d.ellipse((cx - 13, 112, cx + 13, 126), fill=FACE_W)
    else:
        eyes_resting(d, t, [])
    for i, (cx, h) in enumerate(zip((150, 176, 202, 228, 254), (14, 26, 38, 24, 11))):
        m = 0.55 + 0.45 * math.sin(6 * math.pi * t + 0.7 * i)
        d.rounded_rectangle((cx - 4.5, 214 - max(3.0, h * m), cx + 4.5, 214), radius=4, fill=FACE_W)

FACES = {
    'neutral':   face_neutral,
    'happy':     face_happy,
    'sad':       face_sad,
    'listening': face_listening,
    'thinking':  face_thinking,
    'speaking':  face_speaking,
}

# ────────────────────────────────────────────────────────────────
# Render helpers
# ────────────────────────────────────────────────────────────────
def render_face(state, t):
    frame = Image.new('RGBA', (SW, SH), (0, 0, 0, 0))
    d = ImageDraw.Draw(frame)
    screen_bg(d)
    FACES[state](d, t)
    return frame

def compose(body, face_frame):
    canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    canvas.alpha_composite(face_frame, (SCREEN_BOX[0], SCREEN_BOX[1]))
    canvas.alpha_composite(body)
    return canvas

def make_gif(body, invert=False, path='animation-preview.gif'):
    frames = []
    for state in STATES:
        for f in range(FRAMES):
            face = render_face(state, f / FRAMES)
            if invert:
                face = invert_rgba(face)
            frames.append(compose(body, face).resize((400, 341), Image.LANCZOS)
                          .convert('P', palette=Image.ADAPTIVE, colors=128))
    frames[0].save(os.path.join(OUT_DIR, path), save_all=True, append_images=frames[1:],
                   duration=int(1000 / SHEET_FPS), loop=0, transparency=0, disposal=2, optimize=False)

# ────────────────────────────────────────────────────────────────
# Main
# ────────────────────────────────────────────────────────────────
def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(FRAME_DIR, exist_ok=True)

    body = render_body()
    body_path = os.path.join(OUT_DIR, 'device-body.png')
    body.save(body_path)
    print('wrote', body_path)

    for state in STATES:
        # 8-frame sprite sheet
        sheet = Image.new('RGBA', (SW * FRAMES, SH), (0, 0, 0, 0))
        for f in range(FRAMES):
            sheet.paste(render_face(state, f / FRAMES), (f * SW, 0))
        sheet_path = os.path.join(OUT_DIR, f'sheet-{state}.png')
        sheet.save(sheet_path)
        print('wrote', sheet_path)

        # 24-frame sequence for the .webm build
        state_dir = os.path.join(FRAME_DIR, state)
        os.makedirs(state_dir, exist_ok=True)
        for f in range(VIDEO_FRAMES):
            render_face(state, f / VIDEO_FRAMES).save(
                os.path.join(state_dir, f'frame_{f:02d}.png'))
        print('wrote', state_dir, f'{VIDEO_FRAMES} frames')

    make_gif(body, invert=False, path='animation-preview.gif')
    make_gif(body, invert=True, path='animation-preview-dark.gif')
    print('wrote animation-preview.gif + animation-preview-dark.gif')

    for name, invert in (('preview-light.png', False), ('preview-dark.png', True)):
        face = render_face('neutral', 0.25)
        if invert:
            face = invert_rgba(face)
        compose(body, face).save(os.path.join(OUT_DIR, name))
        print('wrote', name)

if __name__ == '__main__':
    main()
