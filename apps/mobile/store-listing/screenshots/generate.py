"""
Generate 6 Google Play Store screenshot mockups for the Smartout app.
Each image: 1080x1920 RGB PNG with dark theme and phone frame.
"""

from PIL import Image, ImageDraw, ImageFont
import os

# --- Constants ---
W, H = 1080, 1920
BG = "#111111"
FRAME = "#1a1a1a"
ORANGE = "#D97706"
ORANGE_LIGHT = "#FA7A3C"
WHITE = "#FFFFFF"
GRAY = "#9CA3AF"
DARK_CARD = "#262626"
DARK_INNER = "#1F1F1F"
GREEN = "#22C55E"
RED = "#EF4444"
YELLOW = "#EAB308"

OUT_DIR = os.path.dirname(os.path.abspath(__file__))

# Fonts
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"


def font(size, bold=False, mono=False):
    path = FONT_MONO if mono else (FONT_BOLD if bold else FONT_REG)
    return ImageFont.truetype(path, size)


def new_image():
    return Image.new("RGB", (W, H), BG)


def draw_phone_frame(draw, top=280, bottom=1780):
    """Draw phone frame and return inner content area coords."""
    frame_left, frame_right = 80, W - 80
    r = 40
    draw.rounded_rectangle(
        [frame_left, top, frame_right, bottom], radius=r, fill=FRAME
    )
    # Status bar
    bar_y = top + 20
    draw.text((frame_left + 30, bar_y), "9:41", fill=WHITE, font=font(28))
    # Battery icon (simple rectangle)
    bx = frame_right - 70
    draw.rounded_rectangle([bx, bar_y + 4, bx + 40, bar_y + 22], radius=4, fill=WHITE)
    # Wifi dots
    draw.ellipse([bx - 30, bar_y + 8, bx - 16, bar_y + 22], fill=WHITE)
    # Signal
    draw.ellipse([bx - 56, bar_y + 8, bx - 42, bar_y + 22], fill=WHITE)

    inner_left = frame_left + 24
    inner_right = frame_right - 24
    inner_top = top + 60
    inner_bottom = bottom - 24
    return inner_left, inner_top, inner_right, inner_bottom


def draw_caption(draw, text, y=180):
    """Draw centered caption text above the phone."""
    bbox = draw.textbbox((0, 0), text, font=font(42, bold=True))
    tw = bbox[2] - bbox[0]
    draw.text(((W - tw) // 2, y), text, fill=WHITE, font=font(42, bold=True))


def draw_card(draw, x, y, w, h, fill=DARK_CARD, radius=20):
    draw.rounded_rectangle([x, y, x + w, y + h], radius=radius, fill=fill)


def draw_progress_bar(draw, x, y, w, h, pct, color=ORANGE):
    draw.rounded_rectangle([x, y, x + w, y + h], radius=h // 2, fill="#333333")
    if pct > 0:
        fill_w = max(h, int(w * pct))
        draw.rounded_rectangle([x, y, x + fill_w, y + h], radius=h // 2, fill=color)


# === Screenshot 1: Home ===
def screenshot_01():
    img = new_image()
    draw = ImageDraw.Draw(img)
    draw_caption(draw, "Se vakten din i sanntid")
    il, it, ir, ib = draw_phone_frame(draw)
    cx = il
    cw = ir - il

    # App header
    y = it + 20
    draw.text((cx + 20, y), "smartout", fill=ORANGE, font=font(36, bold=True))
    y += 60

    # Greeting
    draw.text((cx + 20, y), "God morgen, Sofia", fill=WHITE, font=font(44, bold=True))
    y += 60
    draw.text((cx + 20, y), "Klar for en ny dag?", fill=GRAY, font=font(28))
    y += 70

    # Next shift card
    draw_card(draw, cx + 10, y, cw - 20, 260)
    cy = y + 20
    draw.text((cx + 30, cy), "NESTE VAKT", fill=ORANGE, font=font(22, bold=True))
    cy += 40
    draw.text((cx + 30, cy), "I dag", fill=WHITE, font=font(38, bold=True))
    draw.text((cx + 200, cy), "14:00 – 22:00", fill=WHITE, font=font(38, bold=True))
    cy += 55
    # Role badge
    draw.rounded_rectangle([cx + 30, cy, cx + 180, cy + 40], radius=12, fill=ORANGE)
    draw.text((cx + 46, cy + 6), "Servitør", fill=WHITE, font=font(24, bold=True))
    cy += 50
    draw.text((cx + 30, cy), "Storgata Bistro · Sal 1", fill=GRAY, font=font(24))
    y += 290

    # Quick stats row
    draw_card(draw, cx + 10, y, (cw - 30) // 2, 140)
    draw.text((cx + 30, y + 20), "Timer denne uken", fill=GRAY, font=font(20))
    draw.text((cx + 30, y + 55), "24.5", fill=WHITE, font=font(48, bold=True))

    rx = cx + (cw + 10) // 2
    draw_card(draw, rx, y, (cw - 30) // 2, 140)
    draw.text((rx + 20, y + 20), "Opplæring", fill=GRAY, font=font(20))
    draw.text((rx + 20, y + 55), "82%", fill=GREEN, font=font(48, bold=True))
    y += 170

    # Upcoming section
    draw.text((cx + 20, y), "Kommende", fill=WHITE, font=font(30, bold=True))
    y += 50

    shifts = [
        ("Tirsdag 15. mar", "10:00 – 18:00", "Kokk"),
        ("Onsdag 16. mar", "16:00 – 23:00", "Servitør"),
        ("Fredag 18. mar", "14:00 – 22:00", "Servitør"),
    ]
    for day, time, role in shifts:
        draw_card(draw, cx + 10, y, cw - 20, 90)
        draw.text((cx + 30, y + 15), day, fill=WHITE, font=font(24))
        draw.text((cx + 30, y + 48), time, fill=GRAY, font=font(22))
        # Role tag right aligned
        rbbox = draw.textbbox((0, 0), role, font=font(20))
        rw = rbbox[2] - rbbox[0]
        draw.rounded_rectangle(
            [ir - 44 - rw - 16, y + 30, ir - 44, y + 62], radius=10, fill="#333333"
        )
        draw.text((ir - 44 - rw - 8, y + 34), role, fill=ORANGE, font=font(20))
        y += 105

    # Bottom nav
    nav_y = ib - 70
    draw.line([(il, nav_y), (ir, nav_y)], fill="#333333", width=1)
    nav_items = ["Hjem", "Vakter", "Chat", "Profil"]
    nav_w = cw // len(nav_items)
    for i, item in enumerate(nav_items):
        nx = cx + i * nav_w
        col = ORANGE if i == 0 else GRAY
        # Icon placeholder (circle)
        icon_cx = nx + nav_w // 2
        draw.ellipse([icon_cx - 10, nav_y + 12, icon_cx + 10, nav_y + 32], fill=col)
        bbox = draw.textbbox((0, 0), item, font=font(18))
        tw = bbox[2] - bbox[0]
        draw.text((icon_cx - tw // 2, nav_y + 38), item, fill=col, font=font(18))

    img.save(os.path.join(OUT_DIR, "screenshot-01-home.png"))
    print("1/6 done")


# === Screenshot 2: Punch ===
def screenshot_02():
    img = new_image()
    draw = ImageDraw.Draw(img)
    draw_caption(draw, "Stemple inn med ett trykk")
    il, it, ir, ib = draw_phone_frame(draw)
    cx = il
    cw = ir - il
    center_x = (il + ir) // 2

    y = it + 30
    draw.text((cx + 20, y), "smartout", fill=ORANGE, font=font(36, bold=True))
    y += 80

    # Status
    status_text = "På vakt"
    bbox = draw.textbbox((0, 0), status_text, font=font(36, bold=True))
    tw = bbox[2] - bbox[0]
    draw.text((center_x - tw // 2, y), status_text, fill=GREEN, font=font(36, bold=True))
    y += 60

    info = "Storgata Bistro · Servitør"
    bbox = draw.textbbox((0, 0), info, font=font(24))
    tw = bbox[2] - bbox[0]
    draw.text((center_x - tw // 2, y), info, fill=GRAY, font=font(24))
    y += 80

    # Large timer
    timer = "03:24:15"
    bbox = draw.textbbox((0, 0), timer, font=font(72, mono=True))
    tw = bbox[2] - bbox[0]
    draw.text((center_x - tw // 2, y), timer, fill=WHITE, font=font(72, mono=True))
    y += 120

    # Big circle button
    btn_r = 120
    btn_cy = y + btn_r + 40
    # Outer ring
    draw.ellipse(
        [center_x - btn_r - 8, btn_cy - btn_r - 8,
         center_x + btn_r + 8, btn_cy + btn_r + 8],
        fill=ORANGE_LIGHT,
    )
    draw.ellipse(
        [center_x - btn_r, btn_cy - btn_r,
         center_x + btn_r, btn_cy + btn_r],
        fill=ORANGE,
    )
    # Text inside button
    btn_text = "STEMPLE\nUT"
    lines = btn_text.split("\n")
    for i, line in enumerate(lines):
        bbox = draw.textbbox((0, 0), line, font=font(36, bold=True))
        tw = bbox[2] - bbox[0]
        draw.text(
            (center_x - tw // 2, btn_cy - 30 + i * 44),
            line, fill=WHITE, font=font(36, bold=True)
        )

    y = btn_cy + btn_r + 60

    # Shift info card
    draw_card(draw, cx + 10, y, cw - 20, 180)
    draw.text((cx + 30, y + 20), "Vaktdetaljer", fill=GRAY, font=font(22))
    draw.text((cx + 30, y + 55), "Stemplet inn:", fill=GRAY, font=font(24))
    draw.text((cx + 250, y + 55), "14:00", fill=WHITE, font=font(24, bold=True))
    draw.text((cx + 30, y + 90), "Planlagt slutt:", fill=GRAY, font=font(24))
    draw.text((cx + 250, y + 90), "22:00", fill=WHITE, font=font(24, bold=True))
    draw.text((cx + 30, y + 125), "Pause:", fill=GRAY, font=font(24))
    draw.text((cx + 250, y + 125), "30 min", fill=WHITE, font=font(24, bold=True))
    y += 210

    # Break button
    brk_w = 300
    draw.rounded_rectangle(
        [center_x - brk_w // 2, y, center_x + brk_w // 2, y + 56],
        radius=28, fill="#333333"
    )
    brk_text = "Start pause"
    bbox = draw.textbbox((0, 0), brk_text, font=font(26, bold=True))
    tw = bbox[2] - bbox[0]
    draw.text((center_x - tw // 2, y + 12), brk_text, fill=WHITE, font=font(26, bold=True))

    img.save(os.path.join(OUT_DIR, "screenshot-02-punch.png"))
    print("2/6 done")


# === Screenshot 3: Shifts ===
def screenshot_03():
    img = new_image()
    draw = ImageDraw.Draw(img)
    draw_caption(draw, "Hele uken din, oversiktlig")
    il, it, ir, ib = draw_phone_frame(draw)
    cx = il
    cw = ir - il

    y = it + 20
    draw.text((cx + 20, y), "Vakter", fill=WHITE, font=font(40, bold=True))
    y += 60

    # Week selector
    draw.text((cx + 20, y), "Uke 12", fill=ORANGE, font=font(28, bold=True))
    draw.text((cx + 200, y), "15. – 21. mars 2026", fill=GRAY, font=font(24))
    y += 60

    # Day blocks
    days = [
        ("Man 15", "10:00 – 18:00", "Kokk", ORANGE, 8.0),
        ("Tir 16", "14:00 – 22:00", "Servitør", "#3B82F6", 8.0),
        ("Ons 17", "16:00 – 23:00", "Servitør", "#3B82F6", 7.0),
        ("Tor 18", "Fri", None, None, 0),
        ("Fre 19", "14:00 – 22:00", "Servitør", "#3B82F6", 8.0),
        ("Lør 20", "12:00 – 22:00", "Kokk", ORANGE, 10.0),
        ("Søn 21", "Fri", None, None, 0),
    ]

    for day_label, time, role, color, hours in days:
        is_off = role is None
        card_h = 100 if not is_off else 70
        draw_card(draw, cx + 10, y, cw - 20, card_h)

        # Day color bar
        bar_color = color if color else "#333333"
        draw.rounded_rectangle(
            [cx + 10, y, cx + 18, y + card_h], radius=4, fill=bar_color
        )

        draw.text((cx + 34, y + 14), day_label, fill=WHITE, font=font(26, bold=True))

        if is_off:
            draw.text((cx + 34, y + 46), "Fri", fill=GRAY, font=font(22))
        else:
            draw.text((cx + 34, y + 50), time, fill=GRAY, font=font(22))
            draw.text((cx + 34, y + 76), role, fill=color, font=font(20))
            # Hours right aligned
            h_text = f"{hours:.0f}t"
            bbox = draw.textbbox((0, 0), h_text, font=font(26, bold=True))
            tw = bbox[2] - bbox[0]
            draw.text((ir - 50 - tw, y + 34), h_text, fill=WHITE, font=font(26, bold=True))

        y += card_h + 12

    # Week summary
    y += 10
    draw_card(draw, cx + 10, y, cw - 20, 100, fill="#1a2a1a")
    draw.text((cx + 30, y + 16), "Totalt denne uken", fill=GRAY, font=font(22))
    draw.text((cx + 30, y + 50), "41.0 timer", fill=GREEN, font=font(34, bold=True))
    draw.text((cx + 340, y + 50), "· 5 vakter", fill=GRAY, font=font(28))

    img.save(os.path.join(OUT_DIR, "screenshot-03-shifts.png"))
    print("3/6 done")


# === Screenshot 4: Chat ===
def screenshot_04():
    img = new_image()
    draw = ImageDraw.Draw(img)
    draw_caption(draw, "Hold kontakten med teamet")
    il, it, ir, ib = draw_phone_frame(draw)
    cx = il
    cw = ir - il

    y = it + 20
    draw.text((cx + 20, y), "Meldinger", fill=WHITE, font=font(40, bold=True))
    y += 70

    # Channels header
    draw.text((cx + 20, y), "KANALER", fill=GRAY, font=font(20, bold=True))
    y += 40

    channels = [
        ("#kjøkken", "Lars: Bestillingen er klar!", "14:32", 3),
        ("#bar", "Maria: Hvem tar baren i kveld?", "13:15", 0),
        ("#service", "Admin: Ny rutine for allergener", "12:00", 1),
        ("#generelt", "Sofia: Takk for i går alle!", "09:45", 0),
    ]

    for name, msg, time, unread in channels:
        draw_card(draw, cx + 10, y, cw - 20, 90)
        # Channel icon
        draw.rounded_rectangle([cx + 26, y + 20, cx + 74, y + 68], radius=16, fill=ORANGE)
        draw.text((cx + 38, y + 28), "#", fill=WHITE, font=font(28, bold=True))

        draw.text((cx + 90, y + 18), name, fill=WHITE, font=font(26, bold=True))
        draw.text((cx + 90, y + 52), msg, fill=GRAY, font=font(20))

        # Time
        bbox = draw.textbbox((0, 0), time, font=font(18))
        tw = bbox[2] - bbox[0]
        draw.text((ir - 50 - tw, y + 20), time, fill=GRAY, font=font(18))

        # Unread badge
        if unread > 0:
            badge_x = ir - 60
            draw.ellipse([badge_x, y + 52, badge_x + 28, y + 80], fill=ORANGE)
            badge_text = str(unread)
            bbox = draw.textbbox((0, 0), badge_text, font=font(18, bold=True))
            tw = bbox[2] - bbox[0]
            draw.text((badge_x + 14 - tw // 2, y + 56), badge_text, fill=WHITE, font=font(18, bold=True))

        y += 105

    # DMs header
    y += 10
    draw.text((cx + 20, y), "DIREKTEMELDINGER", fill=GRAY, font=font(20, bold=True))
    y += 40

    dms = [
        ("Lars Henriksen", "Kan du bytte vakt fredag?", "11:20", True, True),
        ("Maria Olsen", "Ser deg i morgen!", "Lør", True, False),
        ("Admin", "Velkommen til teamet!", "Tor", False, False),
    ]

    for name, msg, time, online, unread in dms:
        draw_card(draw, cx + 10, y, cw - 20, 90)
        # Avatar circle
        avatar_cx = cx + 50
        avatar_cy = y + 45
        draw.ellipse([avatar_cx - 24, avatar_cy - 24, avatar_cx + 24, avatar_cy + 24], fill="#444444")
        # Initials
        initials = name[0]
        bbox = draw.textbbox((0, 0), initials, font=font(24, bold=True))
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        draw.text((avatar_cx - tw // 2, avatar_cy - th // 2 - 4), initials, fill=WHITE, font=font(24, bold=True))
        # Online indicator
        if online:
            draw.ellipse([avatar_cx + 14, avatar_cy + 10, avatar_cx + 26, avatar_cy + 22], fill=GREEN)

        draw.text((cx + 90, y + 18), name, fill=WHITE, font=font(26, bold=True))
        draw.text((cx + 90, y + 52), msg, fill=GRAY, font=font(20))

        bbox = draw.textbbox((0, 0), time, font=font(18))
        tw = bbox[2] - bbox[0]
        draw.text((ir - 50 - tw, y + 20), time, fill=GRAY, font=font(18))

        if unread:
            dot_x = ir - 54
            draw.ellipse([dot_x, y + 55, dot_x + 16, y + 71], fill=ORANGE)

        y += 105

    img.save(os.path.join(OUT_DIR, "screenshot-04-chat.png"))
    print("4/6 done")


# === Screenshot 5: Training ===
def screenshot_05():
    img = new_image()
    draw = ImageDraw.Draw(img)
    draw_caption(draw, "Fullfør opplæring i appen")
    il, it, ir, ib = draw_phone_frame(draw)
    cx = il
    cw = ir - il

    y = it + 20
    draw.text((cx + 20, y), "Opplæring", fill=WHITE, font=font(40, bold=True))
    y += 60

    # Overall progress
    draw_card(draw, cx + 10, y, cw - 20, 110, fill="#1a2a1a")
    draw.text((cx + 30, y + 16), "Din fremgang", fill=GRAY, font=font(22))
    draw.text((cx + 30, y + 50), "82%", fill=GREEN, font=font(42, bold=True))
    draw_progress_bar(draw, cx + 160, y + 60, cw - 200, 20, 0.82, GREEN)
    y += 130

    # Section header
    draw.text((cx + 20, y), "AKTIVE KURS", fill=GRAY, font=font(20, bold=True))
    y += 40

    courses = [
        ("Skjenkeansvarlig", "4 av 6 moduler fullført", 0.67, ORANGE, False),
        ("Mattrygghet", "Alle moduler fullført", 1.0, GREEN, True),
        ("HACCP Kontroll", "Ny – start i dag!", 0.0, "#3B82F6", False),
        ("Allergenhåndtering", "2 av 4 moduler fullført", 0.5, YELLOW, False),
        ("Brannvern", "3 av 3 moduler fullført", 1.0, GREEN, True),
    ]

    for title, subtitle, pct, color, completed in courses:
        card_h = 140
        draw_card(draw, cx + 10, y, cw - 20, card_h)

        # Icon area
        icon_x = cx + 30
        icon_y = y + 20
        draw.rounded_rectangle(
            [icon_x, icon_y, icon_x + 56, icon_y + 56], radius=14, fill=color
        )
        if completed:
            draw.text((icon_x + 12, icon_y + 10), "✓", fill=WHITE, font=font(30, bold=True))
        else:
            # Book icon placeholder
            draw.rounded_rectangle(
                [icon_x + 14, icon_y + 12, icon_x + 42, icon_y + 44],
                radius=4, fill="#00000044"
            )

        draw.text((cx + 100, y + 22), title, fill=WHITE, font=font(26, bold=True))
        draw.text((cx + 100, y + 56), subtitle, fill=GRAY, font=font(20))

        # Progress bar
        draw_progress_bar(draw, cx + 100, y + 90, cw - 150, 16, pct, color)

        # Percentage right
        pct_text = f"{int(pct * 100)}%"
        bbox = draw.textbbox((0, 0), pct_text, font=font(22, bold=True))
        tw = bbox[2] - bbox[0]
        draw.text((ir - 50 - tw, y + 22), pct_text, fill=color, font=font(22, bold=True))

        y += card_h + 12

    img.save(os.path.join(OUT_DIR, "screenshot-05-training.png"))
    print("5/6 done")


# === Screenshot 6: Safety / HMS ===
def screenshot_06():
    img = new_image()
    draw = ImageDraw.Draw(img)
    draw_caption(draw, "HMS rett fra mobilen")
    il, it, ir, ib = draw_phone_frame(draw)
    cx = il
    cw = ir - il

    y = it + 20
    draw.text((cx + 20, y), "HMS & HACCP", fill=WHITE, font=font(40, bold=True))
    y += 60

    # Status bar
    draw_card(draw, cx + 10, y, cw - 20, 80, fill="#1a2a1a")
    draw.text((cx + 30, y + 12), "Dagens kontroller", fill=GRAY, font=font(22))
    draw.text((cx + 30, y + 42), "5 av 6 fullført", fill=GREEN, font=font(28, bold=True))
    # Circle progress indicator
    circ_x = ir - 80
    circ_y = y + 40
    draw.arc([circ_x - 22, circ_y - 22, circ_x + 22, circ_y + 22], 0, 360, fill="#333333", width=5)
    draw.arc([circ_x - 22, circ_y - 22, circ_x + 22, circ_y + 22], -90, 210, fill=GREEN, width=5)
    y += 100

    # Temperature section
    draw.text((cx + 20, y), "TEMPERATURKONTROLL", fill=GRAY, font=font(20, bold=True))
    y += 40

    temps = [
        ("Kjøleskap 1", "3.2°C", "✓", GREEN, "08:15"),
        ("Kjøleskap 2", "7.8°C", "⚠", YELLOW, "08:16"),
        ("Fryser", "-18.5°C", "✓", GREEN, "08:14"),
        ("Buffet", "62.4°C", "✓", GREEN, "11:30"),
        ("Salatbar", "4.1°C", "✓", GREEN, "11:32"),
    ]

    for name, temp, icon, color, time in temps:
        draw_card(draw, cx + 10, y, cw - 20, 90)

        # Status circle
        draw.ellipse([cx + 26, y + 25, cx + 66, y + 65], fill=color)
        draw.text((cx + 34, y + 30), icon, fill=WHITE, font=font(24, bold=True))

        draw.text((cx + 84, y + 18), name, fill=WHITE, font=font(26, bold=True))
        draw.text((cx + 84, y + 52), f"Målt kl. {time}", fill=GRAY, font=font(20))

        # Temperature right aligned
        bbox = draw.textbbox((0, 0), temp, font=font(30, bold=True))
        tw = bbox[2] - bbox[0]
        draw.text((ir - 50 - tw, y + 28), temp, fill=color, font=font(30, bold=True))

        y += 105

    # Warning card for deviation
    y += 10
    draw_card(draw, cx + 10, y, cw - 20, 120, fill="#2a1a1a")
    draw.text((cx + 30, y + 16), "⚠  Avvik registrert", fill=YELLOW, font=font(24, bold=True))
    draw.text(
        (cx + 30, y + 50),
        "Kjøleskap 2 over 5°C.\nTiltak påkrevd innen 30 min.",
        fill=GRAY, font=font(20)
    )
    y += 140

    # Action button
    btn_w = cw - 40
    draw.rounded_rectangle(
        [cx + 20, y, cx + 20 + btn_w, y + 56], radius=28, fill=ORANGE
    )
    btn_text = "Registrer nytt avvik"
    bbox = draw.textbbox((0, 0), btn_text, font=font(26, bold=True))
    tw = bbox[2] - bbox[0]
    draw.text(
        (cx + 20 + btn_w // 2 - tw // 2, y + 12),
        btn_text, fill=WHITE, font=font(26, bold=True)
    )

    img.save(os.path.join(OUT_DIR, "screenshot-06-safety.png"))
    print("6/6 done")


if __name__ == "__main__":
    screenshot_01()
    screenshot_02()
    screenshot_03()
    screenshot_04()
    screenshot_05()
    screenshot_06()
    print(f"\nAll screenshots saved to {OUT_DIR}")
