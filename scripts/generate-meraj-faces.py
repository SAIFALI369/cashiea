#!/usr/bin/env python3
"""
Meraj device-character — animated sprite-sheet generator.

Produces VIDEO-LIKE flipbook animation for the mascot:

  public/meraj/device-body.png      static base render (empty dark screen)
  public/meraj/sheet-{state}.png    8-frame sprite sheet (1760x240) of the
                                    screen-face animation for that state

States (8 frames each, looped by CSS `steps()`):
  neutral   — resting eyes, occasional blink, subtle pupil drift
  happy     — closed happy eyes, big smile, twinkling sparkles
  sad       — worried brows, slow blink, sighing frown
  listening — dancing waveform bars + pulsing live dot
  thinking  — pupils searching, pulsing thought dots
  speaking  — chattering mouth-waveform, squints and blinks

IMPORTANT: only the screen-face layer animates. The body (cream/gold
oval, "Meraj" panel, "M" speaker, branding) is rendered ONCE and stays
identical across every state — the app stacks the animated face sheet
on top of it, so swapping states reads as one continuous device.

Usage:  python3 scripts/generate-meraj-faces.py
Requires: Pillow (pip install --user pillow)
"""

import os
from PIL import Image, ImageDraw, ImageFont

# ────────────────────────────────────────────────────────────────
# Config
# ────────────────────────────────────────────────────────────────
S = 1024                        # master body render size (downscaled to 512)
FRAMES = 8                      # frames per state
FW, FH = 220, 240               # face frame size (exactly the screen rect @512)
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'meraj')

FONT_DIR = '/usr/share/fonts/truetype/dejavu'
SERIF_BOLD = os.path.join(FONT_DIR, 'DejaVuSerif-Bold.ttf')
SANS = os.path.join(FONT_DIR, 'DejaVuSans.ttf')
SANS_BOLD = os.path.join(FONT_DIR, 'DejaVuSans-Bold.ttf')

# Palette
CREAM_TOP   = (249, 239, 214)
CREAM_BOT   = (226, 188, 131)
RIM         = (181, 138, 63)
SCREEN_TOP  = (38, 47, 62)
SCREEN_BOT  = (18, 22, 31)
SCREEN_EDGE = (10, 12, 16)
PANEL_BG    = (255, 248, 233)
PANEL_RIM   = (201, 163, 92)
PANEL_TEXT  = (110, 80, 32)
SPEAKER_BG  = (32, 38, 47)
SPEAKER_M   = (232, 201, 143)
BRAND_MAIN  = (138, 106, 47)
BRAND_SUB   = (160, 128, 72)
FACE        = (242, 219, 168)   # face elements on the glass screen
FACE_DIM    = (242, 219, 168, 150)

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

# ────────────────────────────────────────────────────────────────
# Base device render (static, shared by every state)
# ────────────────────────────────────────────────────────────────
def render_body():
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    body = (182, 52, 842, 972)
    grad = vgrad(660, 920, CREAM_TOP, CREAM_BOT)
    img.paste(grad, (182, 52), mask_rr(body, 300))
    d.rounded_rectangle(body, radius=300, outline=RIM, width=26)
    d.rounded_rectangle((198, 68, 826, 956), radius=284, outline=(255, 250, 235, 70), width=3)

    screen = (292, 150, 732, 630)
    sgrad = vgrad(440, 480, SCREEN_TOP, SCREEN_BOT)
    img.paste(sgrad, (292, 150), mask_rr(screen, 44))
    d.rounded_rectangle(screen, radius=44, outline=SCREEN_EDGE, width=4)
    img.paste(Image.new('RGBA', (420, 84), (255, 255, 255, 16)), (302, 158),
              mask_rr((302, 158, 722, 242), 30))

    panel = (352, 672, 672, 764)
    d.rounded_rectangle(panel, radius=26, fill=PANEL_BG, outline=PANEL_RIM, width=5)
    d.text((512, 714), 'Meraj', font=load(66, serif=True), fill=PANEL_TEXT, anchor='mm')

    d.ellipse((478, 806, 546, 874), fill=SPEAKER_BG, outline=RIM, width=7)
    d.text((512, 839), 'M', font=load(46, bold=True), fill=SPEAKER_M, anchor='mm')

    draw_spaced(d, 'CASHIEA', 512, 896, load(24, bold=True), BRAND_MAIN, spacing=5)
    draw_spaced(d, 'PLAN · TRACK · GROW TOGETHER', 512, 928, load(17), BRAND_SUB, spacing=1)

    return img.resize((512, 512), Image.LANCZOS)

# ────────────────────────────────────────────────────────────────
# Face animation — authored in local 220x240 screen coordinates
# (screen rect at 512px: x 146..366, y 75..315 → 220x240)
# ────────────────────────────────────────────────────────────────
EYE_X = (70, 150)          # eye centers
EYE_Y = 90

def blink(d, cx, y=EYE_Y):
    """Closed eyelid."""
    d.rounded_rectangle((cx - 9, y - 2, cx + 9, y + 2), radius=2, fill=FACE)

def eye(d, cx, y=EYE_Y, w=15, h=19, dx=0, dy=0):
    d.ellipse((cx - w / 2 + dx, y - h / 2 + dy, cx + w / 2 + dx, y + h / 2 + dy), fill=FACE)
    d.ellipse((cx + dx - 4, y + dy - 9, cx + dx + 2, y + dy - 3), fill=(255, 255, 255, 190))

def eyes_resting(d, f, blink_frames, drift=0, y=EYE_Y, w=15, h=19):
    for cx in EYE_X:
        if f in blink_frames:
            blink(d, cx, y)
        else:
            dx = drift * (1 if f % 3 == 1 else (-1 if f % 5 == 4 else 0))
            eye(d, cx, y, w, h, dx)

def mouth_bar(d, y=128, half=26, h=6, fill=FACE):
    d.rounded_rectangle((110 - half, y, 110 + half, y + h), radius=h / 2, fill=fill)

def wave_bars(d, f, xs, widths, base_heights, baseline, wave, radius, fill=FACE):
    m = wave[f % len(wave)]
    for cx, w, h in zip(xs, widths, base_heights):
        d.rounded_rectangle((cx - w / 2, baseline - h * m, cx + w / 2, baseline),
                            radius=radius, fill=fill)

# ── neutral: resting, occasional blink, pupil drift ─────────────
def face_neutral(d, f):
    eyes_resting(d, f, blink_frames=(4,), drift=2)
    mouth_bar(d)

# ── happy: closed happy eyes, smile, twinkling sparkles ─────────
def sparkle(d, cx, cy, r, alpha):
    col = (255, 245, 200, alpha)
    d.polygon([(cx, cy - r), (cx + r * 0.28, cy - r * 0.28), (cx + r, cy),
               (cx + r * 0.28, cy + r * 0.28), (cx, cy + r),
               (cx - r * 0.28, cy + r * 0.28), (cx - r, cy),
               (cx - r * 0.28, cy - r * 0.28)], fill=col)

def face_happy(d, f):
    for cx in EYE_X:
        d.arc((cx - 16, 78, cx + 16, 99), 180, 360, fill=FACE, width=6)
    widen = 3 if f == 5 else 0
    d.chord((86 - widen, 121, 134 + widen, 161), 0, 180, fill=FACE)
    for cx in (56, 164):
        d.ellipse((cx - 5, 128, cx + 5, 138), fill=(232, 178, 122, 70))
    if f in (3, 6):
        sparkle(d, 44, 60, 8, 200)
        sparkle(d, 176, 60, 6, 160)

# ── sad: worried brows (breathing), slow blink, sighing frown, tear ──
SAD_BROW_DIP = [0, 0, 1, 1, 2, 1, 1, 0]     # brows lower as he worries
SAD_TEAR_Y = {5: 108, 6: 114, 7: 120}        # tear forms, then slides

def face_sad(d, f):
    dip = SAD_BROW_DIP[f]
    for cx in EYE_X:
        d.line((cx - 18, 70 + dip, cx + 2, 79 + dip), fill=FACE, width=5)
        d.line((cx + 18, 70 + dip, cx - 2, 79 + dip), fill=FACE, width=5)
    if f in (4, 5):
        for cx in EYE_X:
            blink(d, cx, 94)
    else:
        eyes_resting(d, f, blink_frames=(), y=94, w=13, h=16)
    # sighing frown — corners sag a little more mid-sigh
    sag = 1 if f in (2, 3) else (2 if f >= 6 else 0)
    d.arc((86 - sag, 118 + sag, 134 + sag, 156 + sag), 180, 360, fill=FACE, width=6)
    # tear under the right eye
    if f in SAD_TEAR_Y:
        ty = SAD_TEAR_Y[f]
        d.ellipse((164 - 3, ty - 5, 164 + 3, ty + 5), fill=(140, 190, 230, 220))

# ── listening: dancing waveform + pulsing live dot ──────────────
LISTEN_WAVE = [1.0, 1.35, 0.75, 1.6, 1.15, 0.7, 1.5, 0.95]

def face_listening(d, f):
    eyes_resting(d, f, blink_frames=(6,))
    d.rounded_rectangle((54, 149, 166, 151), radius=1, fill=(242, 219, 168, 120))
    wave_bars(d, f, [78, 94, 110, 126, 142], [6] * 5, [17, 30, 42, 29, 15], 149,
              LISTEN_WAVE, radius=3)
    r = 6 + (f % 3)
    a = 235 - (f % 4) * 35
    d.ellipse((178 - r, 16 - r, 178 + r, 16 + r), fill=(120, 200, 140, a))
    d.ellipse((178 - r / 2, 16 - r / 2, 178 + r / 2, 16 + r / 2), fill=(190, 240, 200, 255))

# ── thinking: searching pupils + pulsing thought dots ───────────
THINK_PULSE = [0.0, 0.5, 1.0, 0.5, 0.0, 0.5, 1.0, 0.75]

def face_thinking(d, f):
    up = -1 if f >= 4 else 1          # pupils search right, then left
    for cx in EYE_X:
        d.ellipse((cx - 8, EYE_Y - 10, cx + 8, EYE_Y + 10), outline=FACE, width=3)
        if f not in (6,):
            d.ellipse((cx + 3 * up - 3, EYE_Y - 6 - 3, cx + 3 * up + 3, EYE_Y - 6 + 3), fill=FACE)
    mouth_bar(d, y=134, half=10, h=5, fill=FACE_DIM)
    pulse = THINK_PULSE[f]
    for r, cx, a in ((4, 90, 150), (6, 110, 210), (8, 130, 255)):
        rr = r * (0.8 + 0.3 * pulse)
        d.ellipse((cx - rr, 160 - rr, cx + rr, 160 + rr), fill=(*FACE[:3], int(a * (0.6 + 0.4 * pulse))))

# ── speaking: chattering mouth-waveform, squints & blinks ───────
SPEAK_WAVE = [0.45, 1.25, 0.7, 1.45, 1.0, 0.55, 1.3, 0.85]

def face_speaking(d, f):
    if f == 7:
        for cx in EYE_X:
            blink(d, cx)
    elif f == 3:  # excited squint
        for cx in EYE_X:
            eye(d, cx, 94, 15, 11)
    else:
        eyes_resting(d, f, blink_frames=())
    wave_bars(d, f, [78, 94, 110, 126, 142], [8] * 5, [12, 23, 33, 22, 11], 160,
              SPEAK_WAVE, radius=4)

FACES = {
    'neutral':   face_neutral,
    'happy':     face_happy,
    'sad':       face_sad,
    'listening': face_listening,
    'thinking':  face_thinking,
    'speaking':  face_speaking,
}

# ────────────────────────────────────────────────────────────────
# Render
# ────────────────────────────────────────────────────────────────
def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    body_path = os.path.join(OUT_DIR, 'device-body.png')
    render_body().save(body_path)
    print('wrote', body_path)

    for state in STATES:
        sheet = Image.new('RGBA', (FW * FRAMES, FH), (0, 0, 0, 0))
        for f in range(FRAMES):
            frame = Image.new('RGBA', (FW, FH), (0, 0, 0, 0))
            FACES[state](ImageDraw.Draw(frame), f)
            sheet.paste(frame, (f * FW, 0))
        path = os.path.join(OUT_DIR, f'sheet-{state}.png')
        sheet.save(path)
        print('wrote', path)

if __name__ == '__main__':
    main()
