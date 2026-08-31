#!/usr/bin/env python3
"""
Meraj device-character face-state generator.

Renders ONE base device character — cream/gold oval body, dark glass
screen-face, "Meraj" display panel, "M" speaker, "CASHIEA / PLAN TRACK
GROW TOGETHER" branding — and derives the 6 face states from it.

IMPORTANT: every face state is drawn onto a copy of the SAME base
render, so only the screen-face content changes between variants.
Swapping between them in the app reads as one continuous device.

Output (512x512 transparent PNGs): public/meraj/face-{state}.png
Contact sheet:                    public/meraj/faces-preview.png

Usage:  python3 scripts/generate-meraj-faces.py
Requires: Pillow (pip install --user pillow)
"""

import os
from PIL import Image, ImageDraw, ImageFont

# ────────────────────────────────────────────────────────────────
# Config
# ────────────────────────────────────────────────────────────────
S = 1024                      # master render size (downscaled to 512)
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'meraj')

FONT_DIR = '/usr/share/fonts/truetype/dejavu'
SERIF_BOLD = os.path.join(FONT_DIR, 'DejaVuSerif-Bold.ttf')
SANS = os.path.join(FONT_DIR, 'DejaVuSans.ttf')
SANS_BOLD = os.path.join(FONT_DIR, 'DejaVuSans-Bold.ttf')

# Palette
CREAM_TOP   = (249, 239, 214)   # body gradient top
CREAM_BOT   = (226, 188, 131)   # body gradient bottom
RIM         = (181, 138, 63)    # gold rim
SCREEN_TOP  = (38, 47, 62)      # dark glass gradient top
SCREEN_BOT  = (18, 22, 31)      # dark glass gradient bottom
SCREEN_EDGE = (10, 12, 16)
PANEL_BG    = (255, 248, 233)   # "Meraj" display panel
PANEL_RIM   = (201, 163, 92)
PANEL_TEXT  = (110, 80, 32)     # deep bronze
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
    """Vertical gradient image."""
    g = Image.new('RGB', (1, h))
    for y in range(h):
        t = y / max(1, h - 1)
        g.putpixel((0, y), tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return g.resize((w, h), Image.BILINEAR)

def mask_rr(box, radius):
    """1-bit mask of a rounded rectangle (mask size = box size)."""
    w, h = box[2] - box[0], box[3] - box[1]
    m = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle((0, 0, w - 1, h - 1), radius=radius, fill=255)
    return m

def draw_spaced(d, text, cx, cy, font, fill, spacing=0):
    """Draw text centred at (cx, cy) with letter spacing."""
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
# Base device render (identical for every state)
# ────────────────────────────────────────────────────────────────
def render_base():
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # ── Oval cream/gold body ────────────────────────────────────
    body = (182, 52, 842, 972)
    body_mask = mask_rr(body, 300)
    grad = vgrad(660, 920, CREAM_TOP, CREAM_BOT)
    img.paste(grad, (182, 52), body_mask)
    d.rounded_rectangle(body, radius=300, outline=RIM, width=26)
    # soft inner highlight so the rim reads as 3D
    d.rounded_rectangle((198, 68, 826, 956), radius=284, outline=(255, 250, 235, 70), width=3)

    # ── Dark glass screen-face ──────────────────────────────────
    screen = (292, 150, 732, 630)
    sgrad = vgrad(440, 480, SCREEN_TOP, SCREEN_BOT)
    img.paste(sgrad, (292, 150), mask_rr(screen, 44))
    d.rounded_rectangle(screen, radius=44, outline=SCREEN_EDGE, width=4)
    # glass sheen band near the top of the screen
    img.paste(Image.new('RGBA', (420, 84), (255, 255, 255, 16)), (302, 158),
              mask_rr((302, 158, 722, 242), 30))

    # ── "Meraj" display panel ───────────────────────────────────
    panel = (352, 672, 672, 764)
    d.rounded_rectangle(panel, radius=26, fill=PANEL_BG, outline=PANEL_RIM, width=5)
    d.text((512, 714), 'Meraj', font=load(66, serif=True), fill=PANEL_TEXT, anchor='mm')

    # ── "M" speaker ─────────────────────────────────────────────
    d.ellipse((478, 806, 546, 874), fill=SPEAKER_BG, outline=RIM, width=7)
    d.text((512, 839), 'M', font=load(46, bold=True), fill=SPEAKER_M, anchor='mm')

    # ── Branding ────────────────────────────────────────────────
    draw_spaced(d, 'CASHIEA', 512, 896, load(24, bold=True), BRAND_MAIN, spacing=5)
    draw_spaced(d, 'PLAN · TRACK · GROW TOGETHER', 512, 928, load(17), BRAND_SUB, spacing=1)

    return img

# ────────────────────────────────────────────────────────────────
# Face states — drawn ONLY inside the screen (292..732, 150..630)
# ────────────────────────────────────────────────────────────────
def eyes_round(d, y=330, size=(30, 38), pupil_dx=0, pupil_dy=0):
    for cx in (432, 592):
        d.ellipse((cx - size[0] // 2, y - size[1] // 2, cx + size[0] // 2, y + size[1] // 2), fill=FACE)
        # glass sparkle
        d.ellipse((cx + pupil_dx - 9, y + pupil_dy - 13, cx + pupil_dx + 3, y + pupil_dy - 1), fill=(255, 255, 255, 190))

def bars(d, centers, widths, heights, baseline, fill=FACE, radius=8, alpha=None):
    for cx, w, h in zip(centers, widths, heights):
        col = fill if alpha is None else (*fill[:3], alpha)
        d.rounded_rectangle((cx - w // 2, baseline - h, cx + w // 2, baseline), radius=radius, fill=col)

def face_neutral(d):
    eyes_round(d)
    d.rounded_rectangle((472, 415, 552, 427), radius=6, fill=FACE)

def face_happy(d):
    for cx in (432, 592):
        d.arc((cx - 32, 306, cx + 32, 348), 180, 360, fill=FACE, width=11)
    d.chord((472, 392, 552, 472), 0, 180, fill=FACE)
    for cx in (404, 600):
        d.ellipse((cx - 11, 402, cx + 11, 424), fill=(232, 178, 122, 70))

def face_sad(d):
    for cx in (432, 592):
        d.line((cx - 36, 292, cx + 4, 310), fill=FACE, width=9)      # worried brows
        d.line((cx + 36, 292, cx - 4, 310), fill=FACE, width=9)
    eyes_round(d, y=338, size=(26, 32))
    d.arc((472, 386, 552, 462), 180, 360, fill=FACE, width=11)

def face_listening(d):
    eyes_round(d)
    d.rounded_rectangle((400, 448, 624, 453), radius=2, fill=(242, 219, 168, 120))
    bars(d, [448, 480, 512, 544, 576], [12] * 5, [34, 60, 84, 58, 30], 448, radius=6)
    # small live dot (listening indicator)
    d.ellipse((648, 180, 676, 208), fill=(120, 200, 140, 235))
    d.ellipse((654, 186, 670, 202), fill=(190, 240, 200, 255))

def face_thinking(d):
    for cx in (432, 592):
        d.ellipse((cx - 15, 311, cx + 15, 349), outline=FACE, width=5)
        d.ellipse((cx + 1, 318, cx + 13, 330), fill=FACE)             # pupils up
    d.rounded_rectangle((482, 428, 542, 436), radius=4, fill=FACE_DIM)
    for r, cx, a in ((8, 472, 150), (12, 512, 210), (16, 552, 255)):
        d.ellipse((cx - r, 470 - r, cx + r, 470 + r), fill=(*FACE[:3], a))

def face_speaking(d):
    eyes_round(d)
    bars(d, [448, 480, 512, 544, 576], [16] * 5, [24, 46, 66, 44, 22], 470, radius=8)

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
    base = render_base()
    finals = {}
    for state in STATES:
        img = base.copy()
        FACES[state](ImageDraw.Draw(img))
        img = img.resize((512, 512), Image.LANCZOS)
        path = os.path.join(OUT_DIR, f'face-{state}.png')
        img.save(path)
        finals[state] = img
        print('wrote', path)

    # Contact sheet (3 x 2) for quick visual QA
    cell = 512
    label_h = 46
    sheet = Image.new('RGB', (3 * cell, 2 * (cell + label_h)), (246, 240, 227))
    sd = ImageDraw.Draw(sheet)
    font = load(26, bold=True)
    for i, state in enumerate(STATES):
        col, row = i % 3, i // 3
        x, y = col * cell, row * (cell + label_h)
        sheet.paste(finals[state], (x, y), finals[state])
        w = sd.textlength(state, font=font)
        sd.text((x + (cell - w) / 2, y + cell + 8), state, font=font, fill=(110, 80, 32))
    preview = os.path.join(OUT_DIR, 'faces-preview.png')
    sheet.save(preview)
    print('wrote', preview)

if __name__ == '__main__':
    main()
