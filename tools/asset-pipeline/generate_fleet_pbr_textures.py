#!/usr/bin/env python3
"""
PBR Texture Synthesizer for BUMP.TRADE Fleet Vehicles (AAA High-Fidelity Overhaul).
Generates 2048x2048 high-resolution PBR maps matching docs/car/prd.md:
1. HOOD BEAR (Deep Crimson Metallic #960E18, Matte Carbon Center, Snarling Bear Crest, Heavy Louvers, '$120' Screen, Red Glow)
2. TSLA RACER (High-Gloss Pearl White #F8FAFC, Dual Crimson & Cyan Racing Stripes, Tech 'T' Wing Logo, '$200' Screen, Cyan Glow)
3. NVDA AI (Obsidian Stealth #12151B with titanium pearl, radioactive lime #00FF66 & cyber purple #BF55EC circuit traces, AI Eye Crest, '$150' Screen)
4. GOLD WHALE (Opulent 24K Liquid Gold Chrome #FFD700, High-Gloss Black Carbon Center, Diamond Crest, Wood Yacht Deck, '$500' Screen, Gold Glow)
"""

import os
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

TEXTURES_BASE = "/home/cn/Projects/Personal/3d/public/models/textures"
RES = 2048

def generate_sobel_normal(height_img, strength=2.8):
    h_arr = np.array(height_img, dtype=np.float32) / 255.0
    dx = (np.roll(h_arr, -1, axis=1) - np.roll(h_arr, 1, axis=1)) * strength
    dy = (np.roll(h_arr, -1, axis=0) - np.roll(h_arr, 1, axis=0)) * strength
    dz = np.ones_like(h_arr)

    norm = np.sqrt(dx**2 + dy**2 + dz**2)
    nx = ((-dx / norm) * 0.5 + 0.5) * 255.0
    ny = (((dy / norm) * 0.5 + 0.5) * 255.0)
    nz = ((dz / norm) * 0.5 + 0.5) * 255.0

    normal_rgb = np.stack([nx, ny, nz], axis=-1).astype(np.uint8)
    return Image.fromarray(normal_rgb, mode="RGB")

def draw_twill_carbon(draw_alb, draw_h, draw_r, draw_m, x0, y0, x1, y1, step=8):
    draw_alb.rectangle([x0, y0, x1, y1], fill=(14, 16, 18))
    draw_r.rectangle([x0, y0, x1, y1], fill=88)   # ~0.35 roughness
    draw_m.rectangle([x0, y0, x1, y1], fill=46)   # ~0.18 metalness

    for y in range(y0, y1, step * 2):
        for x in range(x0, x1, step * 2):
            xe1 = min(x + step - 1, x1)
            ye1 = min(y + step - 1, y1)
            if x <= xe1 and y <= ye1:
                draw_alb.rectangle([x, y, xe1, ye1], fill=(30, 34, 38))
                draw_h.rectangle([x, y, xe1, ye1], fill=146)
            xs2 = x + step
            ys2 = y + step
            xe2 = min(x + step * 2 - 1, x1)
            ye2 = min(y + step * 2 - 1, y1)
            if xs2 <= xe2 and ys2 <= ye2:
                draw_alb.rectangle([xs2, ys2, xe2, ye2], fill=(30, 34, 38))

def draw_digital_screen(out_dir, cash_text, glow_rgb, bg_rgb=(10, 12, 16)):
    sw, sh = 512, 256
    alb = Image.new("RGB", (sw, sh), bg_rgb)
    emi = Image.new("RGB", (sw, sh), (0, 0, 0))
    draw_a = ImageDraw.Draw(alb)
    draw_e = ImageDraw.Draw(emi)

    # Double high-tech border
    draw_a.rounded_rectangle([10, 10, sw - 10, sh - 10], radius=20, outline=glow_rgb, width=8)
    draw_e.rounded_rectangle([10, 10, sw - 10, sh - 10], radius=20, outline=glow_rgb, width=8)
    draw_a.rounded_rectangle([20, 20, sw - 20, sh - 20], radius=14, outline=(40, 48, 58), width=3)

    # Matrix grid dots in background
    for gx in range(30, sw - 30, 16):
        for gy in range(30, sh - 30, 16):
            draw_a.point((gx, gy), fill=(24, 32, 42))

    char_w = 56
    char_h = 100
    start_x = (sw - (len(cash_text) * (char_w + 16))) // 2
    cy = sh // 2

    for i, ch in enumerate(cash_text):
        cx = start_x + i * (char_w + 16) + char_w // 2
        hw = char_w // 2
        hh = char_h // 2
        lw = 10

        def draw_seg(pts):
            draw_a.line(pts, fill=glow_rgb, width=lw)
            draw_e.line(pts, fill=glow_rgb, width=lw)

        if ch == '$':
            draw_seg([(cx, cy - hh - 6), (cx, cy + hh + 6)])
            draw_seg([(cx + hw, cy - hh), (cx - hw, cy - hh), (cx - hw, cy), (cx + hw, cy), (cx + hw, cy + hh), (cx - hw, cy + hh)])
        elif ch == '1':
            draw_seg([(cx + hw // 2, cy - hh), (cx + hw // 2, cy + hh)])
            draw_seg([(cx - hw // 2, cy - hh + 18), (cx + hw // 2, cy - hh)])
        elif ch == '2':
            draw_seg([(cx - hw, cy - hh), (cx + hw, cy - hh), (cx + hw, cy), (cx - hw, cy), (cx - hw, cy + hh), (cx + hw, cy + hh)])
        elif ch == '0':
            draw_a.rectangle([cx - hw, cy - hh, cx + hw, cy + hh], outline=glow_rgb, width=lw)
            draw_e.rectangle([cx - hw, cy - hh, cx + hw, cy + hh], outline=glow_rgb, width=lw)
        elif ch == '4':
            draw_seg([(cx - hw, cy - hh), (cx - hw, cy), (cx + hw, cy)])
            draw_seg([(cx + hw, cy - hh), (cx + hw, cy + hh)])
        elif ch == '5':
            draw_seg([(cx + hw, cy - hh), (cx - hw, cy - hh), (cx - hw, cy), (cx + hw, cy), (cx + hw, cy + hh), (cx - hw, cy + hh)])
        elif ch == '6':
            draw_seg([(cx + hw, cy - hh), (cx - hw, cy - hh), (cx - hw, cy + hh), (cx + hw, cy + hh), (cx + hw, cy), (cx - hw, cy)])
        elif ch == '9':
            draw_seg([(cx - hw, cy + hh), (cx + hw, cy + hh), (cx + hw, cy - hh), (cx - hw, cy - hh), (cx - hw, cy), (cx + hw, cy)])

    alb.save(os.path.join(out_dir, "screen_albedo.png"))
    emi.save(os.path.join(out_dir, "screen_emissive.png"))

def draw_wheel_maps(out_dir, lip_glow_rgb, rim_base_rgb=(24, 26, 30), style='standard'):
    rw, rh = 512, 512
    alb = Image.new("RGB", (rw, rh), rim_base_rgb)
    emi = Image.new("RGB", (rw, rh), (0, 0, 0))
    draw_a = ImageDraw.Draw(alb)
    draw_e = ImageDraw.Draw(emi)

    cx, cy = 256, 256
    # Outer lip glow ring
    draw_a.ellipse([14, 14, rw - 14, rh - 14], outline=lip_glow_rgb, width=18)
    draw_e.ellipse([14, 14, rw - 14, rh - 14], outline=lip_glow_rgb, width=18)

    # Rim barrel
    draw_a.ellipse([45, 45, rw - 45, rh - 45], outline=(15, 17, 20), width=16)

    if style == 'gold':
        # 24K Gold multi-wire spokes & diamond hub
        for a_deg in range(0, 360, 24):
            rad = math.radians(a_deg)
            x2 = cx + int(math.cos(rad) * 190)
            y2 = cy + int(math.sin(rad) * 190)
            draw_a.line([(cx, cy), (x2, y2)], fill=(255, 215, 0), width=6)
        draw_a.ellipse([70, 70, rw - 70, rh - 70], outline=(255, 215, 0), width=10)
        draw_a.ellipse([180, 180, rw - 180, rh - 180], fill=(255, 220, 30), outline=(255, 255, 255), width=6)
    elif style == 'beadlock':
        # Aggressive Mud-Terrain Knobby Tire Tread Blocks around outer rim
        for t_deg in range(0, 360, 15):
            rad = math.radians(t_deg)
            x1 = cx + int(math.cos(rad) * 222)
            y1 = cy + int(math.sin(rad) * 222)
            x2 = cx + int(math.cos(rad) * 252)
            y2 = cy + int(math.sin(rad) * 252)
            draw_a.line([(x1, y1), (x2, y2)], fill=(8, 9, 10), width=10)
            # Tread shoulder bevel
            draw_a.line([(x1, y1), (x2, y2)], fill=(32, 36, 42), width=3)

        # Industrial Beadlock Outer Ring
        draw_a.ellipse([26, 26, rw - 26, rh - 26], outline=(140, 145, 155), width=14)
        draw_a.ellipse([34, 34, rw - 34, rh - 34], outline=(50, 54, 62), width=4)

        # 12 Heavy Industrial Chrome Beadlock Bolts
        for b_deg in range(0, 360, 30):
            rad = math.radians(b_deg)
            bx = cx + int(math.cos(rad) * 228)
            by = cy + int(math.sin(rad) * 228)
            draw_a.ellipse([bx - 7, by - 7, bx + 7, by + 7], fill=(235, 240, 248), outline=(30, 32, 38), width=2)
            # Bolt center recess
            draw_a.ellipse([bx - 2, by - 2, bx + 2, by + 2], fill=(60, 65, 75))

        # 6 Heavy Cast-Iron Wheel Spokes
        for a_deg in range(0, 360, 60):
            rad = math.radians(a_deg)
            x2 = cx + int(math.cos(rad) * 185)
            y2 = cy + int(math.sin(rad) * 185)
            draw_a.line([(cx, cy), (x2, y2)], fill=(45, 48, 56), width=26)
            draw_a.line([(cx, cy), (x2, y2)], fill=(75, 82, 94), width=6)

        # Recessed Center Hub & Crimson Ring
        draw_a.ellipse([175, 175, rw - 175, rh - 175], fill=(20, 22, 26), outline=lip_glow_rgb, width=8)
        draw_e.ellipse([175, 175, rw - 175, rh - 175], outline=lip_glow_rgb, width=8)
        # Center Bear Paw relief
        draw_a.ellipse([240, 240, 272, 272], fill=(235, 20, 45))
        draw_e.ellipse([240, 240, 272, 272], fill=(235, 20, 45))
    elif style == 'aero':
        # Le Mans turbofan aero disc with cooling vanes
        draw_a.ellipse([60, 60, rw - 60, rh - 60], fill=(240, 245, 250), outline=(180, 190, 205), width=8)
        for a_deg in range(0, 360, 30):
            rad = math.radians(a_deg)
            x1 = cx + int(math.cos(rad) * 90)
            y1 = cy + int(math.sin(rad) * 90)
            x2 = cx + int(math.cos(rad) * 180)
            y2 = cy + int(math.sin(rad) * 180)
            draw_a.line([(x1, y1), (x2, y2)], fill=(0, 217, 255), width=5)
            draw_e.line([(x1, y1), (x2, y2)], fill=(0, 217, 255), width=5)
        draw_a.ellipse([190, 190, rw - 190, rh - 190], fill=(15, 18, 24), outline=(0, 217, 255), width=6)
    elif style == 'muscle':
        # Classic 5-Spoke Deep Muscle Mag Wheels with Polished Chrome Rim & Red Accent
        draw_a.ellipse([28, 28, rw - 28, rh - 28], outline=(225, 230, 240), width=18)
        draw_a.ellipse([46, 46, rw - 46, rh - 46], outline=(15, 17, 20), width=6)
        # 5 Heavy Muscle Mag Spokes
        for a_deg in range(0, 360, 72):
            rad = math.radians(a_deg - 18)
            x2 = cx + int(math.cos(rad) * 182)
            y2 = cy + int(math.sin(rad) * 182)
            draw_a.line([(cx, cy), (x2, y2)], fill=(215, 222, 232), width=32)
            draw_a.line([(cx, cy), (x2, y2)], fill=(45, 48, 56), width=10)
        # Chrome Center Hub & Red Accent Ring
        draw_a.ellipse([175, 175, rw - 175, rh - 175], fill=(235, 240, 248), outline=lip_glow_rgb, width=8)
        draw_e.ellipse([175, 175, rw - 175, rh - 175], outline=lip_glow_rgb, width=8)
        draw_a.ellipse([236, 236, 276, 276], fill=lip_glow_rgb)
        draw_e.ellipse([236, 236, 276, 276], fill=lip_glow_rgb)
    elif style == 'buggy':
        # Aggressive Baja Dune Buggy Knobby Tread Blocks & Gold Beadlock Ring
        for t_deg in range(0, 360, 15):
            rad = math.radians(t_deg)
            x1 = cx + int(math.cos(rad) * 215)
            y1 = cy + int(math.sin(rad) * 215)
            x2 = cx + int(math.cos(rad) * 252)
            y2 = cy + int(math.sin(rad) * 252)
            draw_a.line([(x1, y1), (x2, y2)], fill=(12, 13, 15), width=14)
            draw_a.line([(x1, y1), (x2, y2)], fill=(48, 52, 60), width=4)

        # Gold Powder-Coated Beadlock Ring
        draw_a.ellipse([24, 24, rw - 24, rh - 24], outline=(255, 170, 0), width=16)
        draw_e.ellipse([24, 24, rw - 24, rh - 24], outline=(255, 170, 0), width=16)

        # 16 Heavy Steel Beadlock Bolts
        for b_deg in range(0, 360, 22):
            rad = math.radians(b_deg)
            bx = cx + int(math.cos(rad) * 228)
            by = cy + int(math.sin(rad) * 228)
            draw_a.ellipse([bx - 6, by - 6, bx + 6, by + 6], fill=(240, 245, 255), outline=(20, 22, 26), width=2)
            draw_a.ellipse([bx - 2, by - 2, bx + 2, by + 2], fill=(60, 65, 75))

        # 6 Heavy Tubular Buggy Spokes
        for a_deg in range(0, 360, 60):
            rad = math.radians(a_deg)
            x2 = cx + int(math.cos(rad) * 182)
            y2 = cy + int(math.sin(rad) * 182)
            draw_a.line([(cx, cy), (x2, y2)], fill=(32, 35, 42), width=24)
            draw_a.line([(cx, cy), (x2, y2)], fill=(255, 170, 0), width=6)
            draw_e.line([(cx, cy), (x2, y2)], fill=(255, 170, 0), width=6)

        # Recessed Center Hub & Dogecoin 'Ð' Relief
        draw_a.ellipse([175, 175, rw - 175, rh - 175], fill=(20, 22, 26), outline=(255, 200, 0), width=8)
        draw_e.ellipse([175, 175, rw - 175, rh - 175], outline=(255, 200, 0), width=8)
        draw_a.ellipse([230, 230, 282, 282], fill=(255, 215, 0))
        draw_e.ellipse([230, 230, 282, 282], fill=(255, 215, 0))
    else: # hex
        # Stealth hexagonal hub & angled spokes
        for a_deg in range(0, 360, 60):
            rad = math.radians(a_deg)
            x2 = cx + int(math.cos(rad) * 180)
            y2 = cy + int(math.sin(rad) * 180)
            draw_a.line([(cx, cy), (x2, y2)], fill=(191, 85, 236), width=12)
            draw_e.line([(cx, cy), (x2, y2)], fill=(191, 85, 236), width=6)
        draw_a.ellipse([185, 185, rw - 185, rh - 185], fill=(15, 18, 24), outline=(0, 255, 102), width=6)

    alb.save(os.path.join(out_dir, "wheel_albedo.png"))
    emi.save(os.path.join(out_dir, "wheel_emissive.png"))

def draw_bumper_maps(out_dir, neon_glow_rgb):
    bw, bh = 1024, 256
    alb = Image.new("RGB", (bw, bh), (16, 18, 20))
    emi = Image.new("RGB", (bw, bh), (0, 0, 0))
    draw_a = ImageDraw.Draw(alb)
    draw_e = ImageDraw.Draw(emi)

    # Heavy dual-tier ribbed rubber impact cushions
    for x in range(0, bw, 28):
        # Deep groove
        draw_a.line([(x, 0), (x, bh)], fill=(8, 9, 10), width=8)
        # Highlight rib
        draw_a.line([(x + 8, 4), (x + 8, bh - 36)], fill=(32, 36, 42), width=12)

    # Industrial steel bracket plates with hex bolts
    for bx in range(64, bw, 192):
        draw_a.rectangle([bx - 20, 10, bx + 20, bh - 40], fill=(42, 46, 54), outline=(70, 76, 88), width=2)
        draw_a.ellipse([bx - 6, 24, bx + 6, 36], fill=(200, 205, 215))
        draw_a.ellipse([bx - 6, bh - 64, bx + 6, bh - 52], fill=(200, 205, 215))

    # Intense lower neon hazard channel
    draw_a.rectangle([0, bh - 36, bw, bh], fill=neon_glow_rgb)
    draw_e.rectangle([0, bh - 36, bw, bh], fill=neon_glow_rgb)
    draw_a.rectangle([0, bh - 36, bw, bh - 30], fill=(255, 255, 255))
    draw_e.rectangle([0, bh - 36, bw, bh - 30], fill=(255, 255, 255))

    alb.save(os.path.join(out_dir, "bumper_albedo.png"))
    emi.save(os.path.join(out_dir, "bumper_emissive.png"))


# =============================================================================
# 1. HOOD BEAR (HEAVY / MUSCULAR BRAWLER)
# =============================================================================
def generate_hood_bear():
    print("=== Generating HOOD BEAR AAA PBR Textures (High-Fidelity Overhaul) ===")
    out_dir = os.path.join(TEXTURES_BASE, "hood_bear")
    os.makedirs(out_dir, exist_ok=True)
    w, h = RES, RES

    # Base: Deep Blood Crimson Metallic #8A0A14 to #4E040A
    albedo = Image.new("RGB", (w, h), (138, 10, 20))
    height_map = Image.new("L", (w, h), 128)
    roughness = Image.new("L", (w, h), 38)
    metallic = Image.new("L", (w, h), 242)
    emissive = Image.new("RGB", (w, h), (0, 0, 0))

    # Multi-layer metallic micro-flakes & rich curvature vignette
    np_alb = np.array(albedo, dtype=np.int16)
    np.random.seed(404)
    fine_noise = np.random.normal(0, 12, (h, w, 3)).astype(np.int16)
    flake_noise = (np.random.choice([0, 25, 45], size=(h, w, 1), p=[0.92, 0.06, 0.02])).astype(np.int16)
    
    x_coords = np.linspace(-1, 1, w)
    vignette = (1.0 - 0.32 * (x_coords ** 2) - 0.12 * (np.linspace(-1, 1, h)**2).reshape(h, 1)).reshape(h, w, 1)
    np_alb = np.clip((np_alb * vignette) + fine_noise + flake_noise, 0, 255).astype(np.uint8)
    albedo = Image.fromarray(np_alb, mode="RGB")

    draw_a = ImageDraw.Draw(albedo)
    draw_h = ImageDraw.Draw(height_map)
    draw_r = ImageDraw.Draw(roughness)
    draw_m = ImageDraw.Draw(metallic)
    draw_e = ImageDraw.Draw(emissive)

    cx = w // 2

    # 1. Center High-Contrast Twill Carbon Fiber Power Bulge (U: 0.33 to 0.67)
    draw_twill_carbon(draw_a, draw_h, draw_r, draw_m, int(w * 0.33), int(h * 0.05), int(w * 0.67), int(h * 0.95), step=8)

    # 2. Heavy Industrial Armor Panel Seams & Rivets
    # Hood perimeter armor seams
    for seam_x in [int(w * 0.33), int(w * 0.67)]:
        draw_a.line([(seam_x - 2, int(h * 0.05)), (seam_x - 2, int(h * 0.95))], fill=(15, 16, 18), width=3)
        draw_a.line([(seam_x + 2, int(h * 0.05)), (seam_x + 2, int(h * 0.95))], fill=(70, 75, 85), width=2)
        draw_h.line([(seam_x, int(h * 0.05)), (seam_x, int(h * 0.95))], fill=60, width=4)

        # Industrial Hex Rivets along the seams
        for ry in range(int(h * 0.08), int(h * 0.92), 48):
            draw_a.ellipse([seam_x - 6, ry - 6, seam_x + 6, ry + 6], fill=(210, 215, 225), outline=(40, 42, 48), width=2)
            draw_h.ellipse([seam_x - 5, ry - 5, seam_x + 5, ry + 5], fill=220)
            draw_r.ellipse([seam_x - 6, ry - 6, seam_x + 6, ry + 6], fill=40)
            draw_m.ellipse([seam_x - 6, ry - 6, seam_x + 6, ry + 6], fill=250)

    # 3. Aggressive Crimson & Glowing Ember Racing Stripes
    cw = int(w * 0.16)
    pin_w = 22
    for sx in [cx - cw, cx + cw - pin_w]:
        # Crimson outer stripe
        draw_a.rectangle([sx, int(h * 0.04), sx + pin_w, int(h * 0.96)], fill=(235, 15, 35))
        draw_e.rectangle([sx, int(h * 0.04), sx + pin_w, int(h * 0.96)], fill=(210, 10, 25))
        draw_h.rectangle([sx, int(h * 0.04), sx + pin_w, int(h * 0.96)], fill=155)
        # Intense fiery orange/amber center pinstripe
        draw_a.rectangle([sx + 6, int(h * 0.04), sx + pin_w - 6, int(h * 0.96)], fill=(255, 140, 10))
        draw_e.rectangle([sx + 6, int(h * 0.04), sx + pin_w - 6, int(h * 0.96)], fill=(255, 140, 10))

    # 4. Deep Hood Cooling Louvers (Air Extractors) with Cast-Iron Frame
    for ly in range(int(h * 0.11), int(h * 0.25), 24):
        for lx in [cx - 210, cx + 70]:
            # Louver frame
            draw_a.rectangle([lx - 4, ly - 2, lx + 144, ly + 14], fill=(18, 20, 24), outline=(75, 80, 90), width=2)
            draw_a.rectangle([lx, ly, lx + 140, ly + 10], fill=(8, 9, 11))
            draw_h.rectangle([lx, ly, lx + 140, ly + 10], fill=45)
            draw_r.rectangle([lx, ly, lx + 140, ly + 10], fill=110)
            draw_m.rectangle([lx, ly, lx + 140, ly + 10], fill=200)

    # 5. Stamped Diamond-Plate Steel Armor on Rocker Sills
    for sx0, sx1 in [(int(w * 0.03), int(w * 0.17)), (int(w * 0.83), int(w * 0.97))]:
        draw_a.rectangle([sx0, int(h * 0.32), sx1, int(h * 0.70)], fill=(34, 38, 44), outline=(60, 66, 76), width=3)
        draw_r.rectangle([sx0, int(h * 0.32), sx1, int(h * 0.70)], fill=60)
        draw_m.rectangle([sx0, int(h * 0.32), sx1, int(h * 0.70)], fill=245)
        draw_h.rectangle([sx0, int(h * 0.32), sx1, int(h * 0.70)], fill=140)
        # Diamond plate studs
        for py in range(int(h * 0.33), int(h * 0.69), 28):
            for px in range(sx0 + 12, sx1 - 12, 28):
                # Slanted raised diamond bars
                draw_a.polygon([(px - 8, py - 3), (px, py - 6), (px + 8, py + 3), (px, py + 6)], fill=(120, 130, 145))
                draw_h.polygon([(px - 8, py - 3), (px, py - 6), (px + 8, py + 3), (px, py + 6)], fill=210)

    # 6. Precision Snarling Grizzly Bear Crest Helper
    def draw_grizzly_crest(bx, by, sc):
        # Outer heraldic shield backdrop
        shld_pts = [
            (int(bx - 120 * sc), int(by - 110 * sc)),
            (int(bx + 120 * sc), int(by - 110 * sc)),
            (int(bx + 110 * sc), int(by + 20 * sc)),
            (int(bx), int(by + 130 * sc)),
            (int(bx - 110 * sc), int(by + 20 * sc)),
        ]
        draw_a.polygon(shld_pts, fill=(16, 18, 22), outline=(235, 20, 45), width=int(5 * sc))
        draw_e.polygon(shld_pts, outline=(235, 20, 45), width=int(5 * sc))
        draw_h.polygon(shld_pts, fill=180)

        # Gold heraldic inner border
        shld_in = [
            (int(bx - 105 * sc), int(by - 98 * sc)),
            (int(bx + 105 * sc), int(by - 98 * sc)),
            (int(bx + 96 * sc), int(by + 16 * sc)),
            (int(bx), int(by + 115 * sc)),
            (int(bx - 96 * sc), int(by + 16 * sc)),
        ]
        draw_a.polygon(shld_in, outline=(245, 190, 30), width=int(3 * sc))

        # Fierce Grizzly Head Silhouette
        head_pts = [
            (int(bx - 60 * sc), int(by - 55 * sc)),
            (int(bx - 92 * sc), int(by - 95 * sc)),  # Ear L tip
            (int(bx - 82 * sc), int(by - 105 * sc)), # Ear L top
            (int(bx - 42 * sc), int(by - 82 * sc)),  # Ear L base
            (int(bx), int(by - 70 * sc)),           # Forehead
            (int(bx + 42 * sc), int(by - 82 * sc)),  # Ear R base
            (int(bx + 82 * sc), int(by - 105 * sc)), # Ear R top
            (int(bx + 92 * sc), int(by - 95 * sc)),  # Ear R tip
            (int(bx + 60 * sc), int(by - 55 * sc)),
            (int(bx + 85 * sc), int(by + 5 * sc)),   # Cheek R
            (int(bx + 50 * sc), int(by + 65 * sc)),  # Jaw R
            (int(bx), int(by + 85 * sc)),           # Chin
            (int(bx - 50 * sc), int(by + 65 * sc)),  # Jaw L
            (int(bx - 85 * sc), int(by + 5 * sc)),   # Cheek L
        ]
        draw_a.polygon(head_pts, fill=(28, 30, 36), outline=(255, 30, 55), width=int(4 * sc))
        draw_e.polygon(head_pts, outline=(255, 30, 55), width=int(4 * sc))
        draw_h.polygon(head_pts, fill=220)

        # Snout & Open Muzzle
        draw_a.ellipse([int(bx - 36 * sc), int(by + 5 * sc), int(bx + 36 * sc), int(by + 60 * sc)], fill=(16, 17, 20), outline=(240, 180, 20), width=int(2 * sc))
        draw_h.ellipse([int(bx - 36 * sc), int(by + 5 * sc), int(bx + 36 * sc), int(by + 60 * sc)], fill=240)

        # Dark Nose
        draw_a.polygon([(int(bx - 18 * sc), int(by + 12 * sc)), (int(bx + 18 * sc), int(by + 12 * sc)), (int(bx), int(by + 28 * sc))], fill=(8, 9, 11))

        # Sharp Predatory White Fangs & Teeth
        fang_pts = [
            # Upper left canines
            [(int(bx - 26 * sc), int(by + 40 * sc)), (int(bx - 18 * sc), int(by + 62 * sc)), (int(bx - 10 * sc), int(by + 40 * sc))],
            # Upper right canines
            [(int(bx + 10 * sc), int(by + 40 * sc)), (int(bx + 18 * sc), int(by + 62 * sc)), (int(bx + 26 * sc), int(by + 40 * sc))],
            # Lower left canines
            [(int(bx - 20 * sc), int(by + 62 * sc)), (int(bx - 14 * sc), int(by + 44 * sc)), (int(bx - 8 * sc), int(by + 62 * sc))],
            # Lower right canines
            [(int(bx + 8 * sc), int(by + 62 * sc)), (int(bx + 14 * sc), int(by + 44 * sc)), (int(bx + 20 * sc), int(by + 62 * sc))],
        ]
        for f in fang_pts:
            draw_a.polygon(f, fill=(255, 255, 255), outline=(180, 180, 190))
            draw_h.polygon(f, fill=250)

        # Glowing Angled Demon Eyes
        eye_l = [(int(bx - 42 * sc), int(by - 22 * sc)), (int(bx - 14 * sc), int(by - 10 * sc)), (int(bx - 38 * sc), int(by + 2 * sc))]
        eye_r = [(int(bx + 42 * sc), int(by - 22 * sc)), (int(bx + 14 * sc), int(by - 10 * sc)), (int(bx + 38 * sc), int(by + 2 * sc))]
        draw_a.polygon(eye_l, fill=(255, 35, 50))
        draw_e.polygon(eye_l, fill=(255, 45, 60))
        draw_a.polygon(eye_r, fill=(255, 35, 50))
        draw_e.polygon(eye_r, fill=(255, 45, 60))

        # Fiery Orange inner eye pupil
        draw_a.ellipse([int(bx - 26 * sc), int(by - 14 * sc), int(bx - 20 * sc), int(by - 8 * sc)], fill=(255, 170, 0))
        draw_e.ellipse([int(bx - 26 * sc), int(by - 14 * sc), int(bx - 20 * sc), int(by - 8 * sc)], fill=(255, 170, 0))
        draw_a.ellipse([int(bx + 20 * sc), int(by - 14 * sc), int(bx + 26 * sc), int(by - 8 * sc)], fill=(255, 170, 0))
        draw_e.ellipse([int(bx + 20 * sc), int(by - 14 * sc), int(bx + 26 * sc), int(by - 8 * sc)], fill=(255, 170, 0))

        # Glowing Claw Slash Scratches across the shield
        claw_slashes = [
            ((int(bx - 130 * sc), int(by - 40 * sc)), (int(bx + 130 * sc), int(by + 25 * sc))),
            ((int(bx - 120 * sc), int(by - 10 * sc)), (int(bx + 120 * sc), int(by + 55 * sc))),
            ((int(bx - 110 * sc), int(by + 20 * sc)), (int(bx + 110 * sc), int(by + 85 * sc))),
        ]
        for p1, p2 in claw_slashes:
            draw_a.line([p1, p2], fill=(255, 25, 45), width=int(6 * sc))
            draw_e.line([p1, p2], fill=(255, 25, 45), width=int(6 * sc))
            draw_h.line([p1, p2], fill=240, width=int(6 * sc))

    # Stamped Bear Crests on Hood and Doors
    draw_grizzly_crest(cx, 380, 1.85)
    draw_grizzly_crest(int(w * 0.11), int(h * 0.51), 1.25)
    draw_grizzly_crest(int(w * 0.89), int(h * 0.51), 1.25)

    albedo.save(os.path.join(out_dir, "body_albedo.png"))
    roughness.save(os.path.join(out_dir, "body_roughness.png"))
    metallic.save(os.path.join(out_dir, "body_metallic.png"))
    emissive.save(os.path.join(out_dir, "body_emissive.png"))
    normal = generate_sobel_normal(height_map, strength=3.4)
    normal.save(os.path.join(out_dir, "body_normal.png"))

    draw_digital_screen(out_dir, "$120", (255, 20, 50))
    draw_wheel_maps(out_dir, (255, 20, 50), (24, 26, 30), style='beadlock')
    draw_bumper_maps(out_dir, (255, 20, 50))


# =============================================================================
# 2. TSLA RACER (SPEEDSTER / TECH LE MANS PROTOTYPE)
# =============================================================================
def generate_tsla_racer():
    print("=== Generating TSLA RACER AAA PBR Textures ===")
    out_dir = os.path.join(TEXTURES_BASE, "tsla_racer")
    os.makedirs(out_dir, exist_ok=True)
    w, h = RES, RES

    # Base: High-Gloss Pearl White #F8FAFC
    albedo = Image.new("RGB", (w, h), (248, 250, 252))
    height_map = Image.new("L", (w, h), 128)
    roughness = Image.new("L", (w, h), 24)
    metallic = Image.new("L", (w, h), 215)
    emissive = Image.new("RGB", (w, h), (0, 0, 0))

    np_alb = np.array(albedo, dtype=np.int16)
    np.random.seed(102)
    noise = np.random.normal(0, 6, (h, w, 3)).astype(np.int16)
    np_alb = np.clip(np_alb + noise, 0, 255).astype(np.uint8)
    albedo = Image.fromarray(np_alb, mode="RGB")

    draw_a = ImageDraw.Draw(albedo)
    draw_h = ImageDraw.Draw(height_map)
    draw_r = ImageDraw.Draw(roughness)
    draw_m = ImageDraw.Draw(metallic)
    draw_e = ImageDraw.Draw(emissive)

    cx = w // 2

    # Center Aerodynamic Spine Carbon Fiber Weave (U: 0.44 to 0.56)
    draw_twill_carbon(draw_a, draw_h, draw_r, draw_m, int(w * 0.44), int(h * 0.05), int(w * 0.56), int(h * 0.95), step=6)

    # Dual Crimson Red Racing Stripes (#E81E25) with Electric Cyan Pinstripes (#00D9FF)
    stripe_w = int(w * 0.040)
    gap = int(w * 0.070)
    for sx in [cx - (gap // 2) - stripe_w, cx + (gap // 2)]:
        # Electric cyan pinstripe left
        draw_a.rectangle([sx - 10, int(h * 0.03), sx, int(h * 0.97)], fill=(0, 217, 255))
        draw_e.rectangle([sx - 10, int(h * 0.03), sx, int(h * 0.97)], fill=(0, 217, 255))
        # Main Crimson stripe
        draw_a.rectangle([sx, int(h * 0.03), sx + stripe_w, int(h * 0.97)], fill=(232, 30, 37))
        draw_r.rectangle([sx, int(h * 0.03), sx + stripe_w, int(h * 0.97)], fill=36)
        draw_m.rectangle([sx, int(h * 0.03), sx + stripe_w, int(h * 0.97)], fill=30)
        # Electric cyan pinstripe right
        draw_a.rectangle([sx + stripe_w, int(h * 0.03), sx + stripe_w + 10, int(h * 0.97)], fill=(0, 217, 255))
        draw_e.rectangle([sx + stripe_w, int(h * 0.03), sx + stripe_w + 10, int(h * 0.97)], fill=(0, 217, 255))

    # Embossed Aerodynamic NACA Ducts on Hood
    for dx in [cx - 220, cx + 160]:
        naca_pts = [(dx + 30, int(h * 0.14)), (dx + 60, int(h * 0.14)), (dx + 80, int(h * 0.22)), (dx + 10, int(h * 0.22))]
        draw_a.polygon(naca_pts, fill=(15, 18, 24))
        draw_h.polygon(naca_pts, fill=60)
        draw_r.polygon(naca_pts, fill=90)

    # Tech 'T' Wing Logo Helper
    def draw_tech_crest(tx, ty, sc):
        wing_pts = [
            (int(tx - 70 * sc), int(ty - 55 * sc)),
            (int(tx), int(ty - 68 * sc)),
            (int(tx + 70 * sc), int(ty - 55 * sc)),
            (int(tx + 58 * sc), int(ty - 38 * sc)),
            (int(tx), int(ty - 50 * sc)),
            (int(tx - 58 * sc), int(ty - 38 * sc)),
        ]
        draw_a.polygon(wing_pts, fill=(232, 30, 37), outline=(0, 217, 255))
        draw_e.polygon(wing_pts, outline=(0, 217, 255))
        stem_pts = [
            (int(tx - 22 * sc), int(ty - 28 * sc)),
            (int(tx + 22 * sc), int(ty - 28 * sc)),
            (int(tx + 12 * sc), int(ty + 65 * sc)),
            (int(tx - 12 * sc), int(ty + 65 * sc)),
        ]
        draw_a.polygon(stem_pts, fill=(232, 30, 37), outline=(0, 217, 255))
        draw_e.polygon(stem_pts, outline=(0, 217, 255))
        draw_h.polygon(wing_pts + stem_pts, fill=220)

    # Hood & Door Decals
    draw_tech_crest(cx, 340, 1.6)
    draw_tech_crest(int(w * 0.14), int(h * 0.50), 1.2)
    draw_tech_crest(int(w * 0.86), int(h * 0.50), 1.2)

    albedo.save(os.path.join(out_dir, "body_albedo.png"))
    roughness.save(os.path.join(out_dir, "body_roughness.png"))
    metallic.save(os.path.join(out_dir, "body_metallic.png"))
    emissive.save(os.path.join(out_dir, "body_emissive.png"))
    normal = generate_sobel_normal(height_map, strength=2.6)
    normal.save(os.path.join(out_dir, "body_normal.png"))

    draw_digital_screen(out_dir, "$200", (0, 217, 255))
    draw_wheel_maps(out_dir, (0, 217, 255), (240, 245, 250), style='aero')
    draw_bumper_maps(out_dir, (0, 217, 255))


# =============================================================================
# 3. NVDA AI (STEALTH FIGHTER / PRECISION CORNERING)
# =============================================================================
def generate_nvda_ai():
    print("=== Generating NVDA AI AAA PBR Textures ===")
    out_dir = os.path.join(TEXTURES_BASE, "nvda_ai")
    os.makedirs(out_dir, exist_ok=True)
    w, h = RES, RES

    # Base: Titanium Metallic Obsidian Stealth #2A303C (Chiseled Gunmetal)
    albedo = Image.new("RGB", (w, h), (42, 48, 60))
    height_map = Image.new("L", (w, h), 128)
    roughness = Image.new("L", (w, h), 48)
    metallic = Image.new("L", (w, h), 180)
    emissive = Image.new("RGB", (w, h), (0, 0, 0))

    np_alb = np.array(albedo, dtype=np.int16)
    np.random.seed(103)
    noise = np.random.normal(0, 6, (h, w, 3)).astype(np.int16)
    np_alb = np.clip(np_alb + noise, 0, 255).astype(np.uint8)
    albedo = Image.fromarray(np_alb, mode="RGB")

    draw_a = ImageDraw.Draw(albedo)
    draw_h = ImageDraw.Draw(height_map)
    draw_r = ImageDraw.Draw(roughness)
    draw_m = ImageDraw.Draw(metallic)
    draw_e = ImageDraw.Draw(emissive)

    cx = w // 2
    lime_green = (0, 255, 120)
    cyber_purple = (195, 80, 245)

    # Center Chiseled Twill Carbon Fiber Weave (U: 0.42 to 0.58)
    draw_twill_carbon(draw_a, draw_h, draw_r, draw_m, int(w * 0.42), int(h * 0.05), int(w * 0.58), int(h * 0.95), step=6)

    # Hexagonal Matrix Pattern across Hood & Deck
    for hy in range(int(h * 0.08), int(h * 0.32), 48):
        for hx in range(cx - 300, cx + 300, 56):
            hex_pts = []
            for i in range(6):
                ang = math.radians(60 * i)
                hex_pts.append((int(hx + 20 * math.cos(ang)), int(hy + 20 * math.sin(ang))))
            draw_a.polygon(hex_pts, fill=(32, 38, 48), outline=(60, 72, 90), width=2)
            draw_h.polygon(hex_pts, fill=145)

    # Dual Cyber Circuit Traces along Fenders & Shoulders
    cw = int(w * 0.14)
    for off in [-cw, cw]:
        # Lime circuit trace
        draw_a.line([(cx + off, int(h * 0.05)), (cx + off, int(h * 0.95))], fill=lime_green, width=16)
        draw_e.line([(cx + off, int(h * 0.05)), (cx + off, int(h * 0.95))], fill=lime_green, width=16)
        # Purple circuit trace
        draw_a.line([(cx + off + 20, int(h * 0.05)), (cx + off + 20, int(h * 0.95))], fill=cyber_purple, width=10)
        draw_e.line([(cx + off + 20, int(h * 0.05)), (cx + off + 20, int(h * 0.95))], fill=cyber_purple, width=10)

        # 45-degree circuit node branches
        for by in range(int(h * 0.15), int(h * 0.85), 180):
            sign = 1 if off > 0 else -1
            draw_a.line([(cx + off, by), (cx + off + sign * 60, by + 60)], fill=lime_green, width=8)
            draw_e.line([(cx + off, by), (cx + off + sign * 60, by + 60)], fill=lime_green, width=8)
            draw_a.ellipse([cx + off + sign * 60 - 10, by + 60 - 10, cx + off + sign * 60 + 10, by + 60 + 10], fill=lime_green)
            draw_e.ellipse([cx + off + sign * 60 - 10, by + 60 - 10, cx + off + sign * 60 + 10, by + 60 + 10], fill=lime_green)

    # AI Eye Mascot Emblem Helper
    def draw_ai_emblem(ax, ay, sc):
        hex_pts = []
        for i in range(6):
            ang = math.radians(60 * i - 30)
            hex_pts.append((int(ax + 65 * sc * math.cos(ang)), int(ay + 65 * sc * math.sin(ang))))
        draw_a.polygon(hex_pts, fill=(18, 22, 30), outline=cyber_purple)
        draw_e.polygon(hex_pts, outline=cyber_purple)
        draw_h.polygon(hex_pts, fill=210)

        # Glowing AI Eye iris
        draw_a.ellipse([int(ax - 38 * sc), int(ay - 22 * sc), int(ax + 38 * sc), int(ay + 22 * sc)], fill=lime_green)
        draw_e.ellipse([int(ax - 38 * sc), int(ay - 22 * sc), int(ax + 38 * sc), int(ay + 22 * sc)], fill=lime_green)
        # Center black slit pupil
        draw_a.ellipse([int(ax - 12 * sc), int(ay - 16 * sc), int(ax + 12 * sc), int(ay + 16 * sc)], fill=(8, 10, 14))

    draw_ai_emblem(cx, 340, 1.7)
    draw_ai_emblem(int(w * 0.14), int(h * 0.50), 1.2)
    draw_ai_emblem(int(w * 0.86), int(h * 0.50), 1.2)

    albedo.save(os.path.join(out_dir, "body_albedo.png"))
    roughness.save(os.path.join(out_dir, "body_roughness.png"))
    metallic.save(os.path.join(out_dir, "body_metallic.png"))
    emissive.save(os.path.join(out_dir, "body_emissive.png"))
    normal = generate_sobel_normal(height_map, strength=2.6)
    normal.save(os.path.join(out_dir, "body_normal.png"))

    draw_digital_screen(out_dir, "$150", cyber_purple)
    draw_wheel_maps(out_dir, cyber_purple, (18, 20, 26), style='hex')
    draw_bumper_maps(out_dir, cyber_purple)


# =============================================================================
# 4. GOLD WHALE (LUXURY / 24K GOLD SPEEDBOAT HYPER-GT)
# =============================================================================
def generate_gold_whale():
    print("=== Generating GOLD WHALE AAA PBR Textures ===")
    out_dir = os.path.join(TEXTURES_BASE, "gold_whale")
    os.makedirs(out_dir, exist_ok=True)
    w, h = RES, RES

    # Base: Rich Liquid 24K Gold Metallic #FFCA18 with warm amber tones
    albedo = Image.new("RGB", (w, h), (255, 206, 28))
    height_map = Image.new("L", (w, h), 128)
    roughness = Image.new("L", (w, h), 22)
    metallic = Image.new("L", (w, h), 245)
    emissive = Image.new("RGB", (w, h), (0, 0, 0))

    # Fine golden pearlescent sparkles
    np_alb = np.array(albedo, dtype=np.int16)
    np.random.seed(104)
    noise = np.random.normal(0, 8, (h, w, 3)).astype(np.int16)
    np_alb = np.clip(np_alb + noise, 0, 255).astype(np.uint8)
    albedo = Image.fromarray(np_alb, mode="RGB")

    draw_a = ImageDraw.Draw(albedo)
    draw_h = ImageDraw.Draw(height_map)
    draw_r = ImageDraw.Draw(roughness)
    draw_m = ImageDraw.Draw(metallic)
    draw_e = ImageDraw.Draw(emissive)

    cx = w // 2

    # High-Gloss Black Twill Carbon Center Spine (U: 0.36 to 0.64)
    draw_twill_carbon(draw_a, draw_h, draw_r, draw_m, int(w * 0.36), int(h * 0.05), int(w * 0.64), int(h * 0.95), step=8)

    # Liquid Gold & Pure White Diamond Pinstripes
    cw = int(w * 0.14)
    pin_w = 12
    for sx in [cx - cw, cx + cw - pin_w]:
        draw_a.rectangle([sx, int(h * 0.04), sx + pin_w, int(h * 0.96)], fill=(255, 255, 255))
        draw_e.rectangle([sx, int(h * 0.04), sx + pin_w, int(h * 0.96)], fill=(255, 235, 180))
        draw_a.rectangle([sx + 3, int(h * 0.04), sx + pin_w - 3, int(h * 0.96)], fill=(255, 215, 0))

    # Mahogany Yacht Deck Wood Planks on Rear Deck (Y: 0.65 to 0.94)
    for px in range(cx - 240, cx + 240, 32):
        draw_a.rectangle([px, int(h * 0.66), px + 28, int(h * 0.94)], fill=(86, 38, 18))
        draw_a.line([(px, int(h * 0.66)), (px, int(h * 0.94))], fill=(255, 215, 0), width=2)
        draw_r.rectangle([px, int(h * 0.66), px + 28, int(h * 0.94)], fill=45)
        draw_m.rectangle([px, int(h * 0.66), px + 28, int(h * 0.94)], fill=15)

    # Brilliant Diamond Crest Helper
    def draw_diamond_crest(dx, dy, sc):
        top_pts = [
            (int(dx - 45 * sc), int(dy - 40 * sc)),
            (int(dx + 45 * sc), int(dy - 40 * sc)),
            (int(dx + 70 * sc), int(dy - 10 * sc)),
            (int(dx), int(dy + 70 * sc)),
            (int(dx - 70 * sc), int(dy - 10 * sc)),
        ]
        draw_a.polygon(top_pts, fill=(255, 255, 255), outline=(255, 215, 0))
        draw_e.polygon(top_pts, outline=(255, 215, 0))
        draw_h.polygon(top_pts, fill=230)

        # Brilliant internal facet cuts
        draw_a.line([(int(dx - 45 * sc), int(dy - 40 * sc)), (int(dx), int(dy + 70 * sc))], fill=(200, 225, 255), width=3)
        draw_a.line([(int(dx + 45 * sc), int(dy - 40 * sc)), (int(dx), int(dy + 70 * sc))], fill=(200, 225, 255), width=3)
        draw_a.line([(int(dx - 70 * sc), int(dy - 10 * sc)), (int(dx + 70 * sc), int(dy - 10 * sc))], fill=(200, 225, 255), width=3)
        draw_a.line([(int(dx - 22 * sc), int(dy - 40 * sc)), (int(dx - 35 * sc), int(dy - 10 * sc))], fill=(200, 225, 255), width=3)
        draw_a.line([(int(dx + 22 * sc), int(dy - 40 * sc)), (int(dx + 35 * sc), int(dy - 10 * sc))], fill=(200, 225, 255), width=3)

    draw_diamond_crest(cx, 340, 1.8)
    draw_diamond_crest(int(w * 0.14), int(h * 0.50), 1.3)
    draw_diamond_crest(int(w * 0.86), int(h * 0.50), 1.3)

    albedo.save(os.path.join(out_dir, "body_albedo.png"))
    roughness.save(os.path.join(out_dir, "body_roughness.png"))
    metallic.save(os.path.join(out_dir, "body_metallic.png"))
    emissive.save(os.path.join(out_dir, "body_emissive.png"))
    normal = generate_sobel_normal(height_map, strength=2.8)
    normal.save(os.path.join(out_dir, "body_normal.png"))

    draw_digital_screen(out_dir, "$500", (255, 215, 0))
    draw_wheel_maps(out_dir, (255, 215, 0), (255, 215, 0), style='gold')
    draw_bumper_maps(out_dir, (255, 215, 0))


def generate_hood_bull():
    print("=== Generating HOOD BULL AAA PBR Textures ===")
    import generate_hood_bull_pbr_textures
    generate_hood_bull_pbr_textures.create_pbr_maps()


def generate_gme_ape():
    print("=== Generating GME APE AAA PBR Textures ===")
    out_dir = os.path.join(TEXTURES_BASE, "gme_ape")
    os.makedirs(out_dir, exist_ok=True)

    w, h = RES, RES
    # Satin Midnight Charcoal Body Base (#1C1E26)
    albedo = Image.new("RGB", (w, h), (28, 30, 38))
    roughness = Image.new("L", (w, h), 65)     # ~0.25 satin clearcoat
    metallic = Image.new("L", (w, h), 215)     # ~0.84 metallic clearcoat
    height_map = Image.new("L", (w, h), 128)
    emissive = Image.new("RGB", (w, h), (0, 0, 0))

    draw_a = ImageDraw.Draw(albedo)
    draw_h = ImageDraw.Draw(height_map)
    draw_r = ImageDraw.Draw(roughness)
    draw_m = ImageDraw.Draw(metallic)
    draw_e = ImageDraw.Draw(emissive)

    cx = w // 2

    # Dual Wide Crimson Muscle Racing Stripes (#FF1E42)
    sw = int(w * 0.12)
    gap = int(w * 0.035)
    stripe_l = (cx - gap - sw, int(h * 0.04), cx - gap, int(h * 0.96))
    stripe_r = (cx + gap, int(h * 0.04), cx + gap + sw, int(h * 0.96))

    for sx0, sy0, sx1, sy1 in [stripe_l, stripe_r]:
        draw_a.rectangle([sx0, sy0, sx1, sy1], fill=(255, 30, 66))
        draw_h.rectangle([sx0, sy0, sx1, sy1], fill=150)
        # Inner Diamond Cyan Pinstripes
        draw_a.line([(sx0 + 8, sy0), (sx0 + 8, sy1)], fill=(0, 240, 255), width=6)
        draw_a.line([(sx1 - 8, sy0), (sx1 - 8, sy1)], fill=(0, 240, 255), width=6)
        draw_e.line([(sx0 + 8, sy0), (sx0 + 8, sy1)], fill=(0, 180, 220), width=4)
        draw_e.line([(sx1 - 8, sy0), (sx1 - 8, sy1)], fill=(0, 180, 220), width=4)

    # Exposed Supercharger Blower Cutout Seam on Hood (Y: 0.22 to 0.42)
    bx0, by0, bx1, by1 = cx - 180, int(h * 0.22), cx + 180, int(h * 0.42)
    draw_a.rectangle([bx0, by0, bx1, by1], fill=(12, 14, 18), outline=(220, 225, 235), width=10)
    draw_h.rectangle([bx0, by0, bx1, by1], fill=60)
    draw_r.rectangle([bx0, by0, bx1, by1], fill=190)
    draw_m.rectangle([bx0, by0, bx1, by1], fill=240)

    # Roaring Gorilla Mascot Crest on Hood (Front Cowl, Y: 0.14)
    def draw_gorilla_crest(dx, dy, sc):
        # Brow ridge and head silhouette
        head_pts = [
            (int(dx - 55 * sc), int(dy - 40 * sc)),
            (int(dx + 55 * sc), int(dy - 40 * sc)),
            (int(dx + 70 * sc), int(dy - 10 * sc)),
            (int(dx + 50 * sc), int(dy + 45 * sc)),
            (int(dx), int(dy + 65 * sc)),
            (int(dx - 50 * sc), int(dy + 45 * sc)),
            (int(dx - 70 * sc), int(dy - 10 * sc)),
        ]
        draw_a.polygon(head_pts, fill=(18, 20, 24), outline=(255, 30, 66))
        draw_h.polygon(head_pts, fill=190)

        # Iconic Red Headband Tied Across Forehead
        hb_y = int(dy - 25 * sc)
        hb_h = int(18 * sc)
        draw_a.rectangle([int(dx - 65 * sc), hb_y, int(dx + 65 * sc), hb_y + hb_h], fill=(255, 30, 66))
        draw_e.rectangle([int(dx - 65 * sc), hb_y, int(dx + 65 * sc), hb_y + hb_h], fill=(255, 30, 66))
        # Headband fluttering knot ribbons trailing to the left
        draw_a.polygon([(int(dx - 65 * sc), hb_y), (int(dx - 110 * sc), hb_y - 20), (int(dx - 85 * sc), hb_y + 35)], fill=(255, 30, 66))
        draw_e.polygon([(int(dx - 65 * sc), hb_y), (int(dx - 110 * sc), hb_y - 20), (int(dx - 85 * sc), hb_y + 35)], fill=(255, 30, 66))

        # Diamond eyes
        for eye_x in [int(dx - 22 * sc), int(dx + 22 * sc)]:
            eye_pts = [(eye_x, hb_y + hb_h + 8), (eye_x + 10, hb_y + hb_h + 16), (eye_x, hb_y + hb_h + 24), (eye_x - 10, hb_y + hb_h + 16)]
            draw_a.polygon(eye_pts, fill=(0, 240, 255))
            draw_e.polygon(eye_pts, fill=(0, 240, 255))

        # Roaring Muzzle & Diamond Teeth
        draw_a.arc([int(dx - 35 * sc), int(dy + 15 * sc), int(dx + 35 * sc), int(dy + 50 * sc)], 0, 180, fill=(255, 255, 255), width=6)

    draw_gorilla_crest(cx, int(h * 0.14), 1.8)

    # Diamond Hands Door Crests (X: 0.14W and 0.86W, Y: 0.50H)
    def draw_diamond_hands(dx, dy, sc):
        pts = [
            (int(dx - 35 * sc), int(dy - 30 * sc)),
            (int(dx + 35 * sc), int(dy - 30 * sc)),
            (int(dx + 55 * sc), int(dy)),
            (int(dx), int(dy + 55 * sc)),
            (int(dx - 55 * sc), int(dy)),
        ]
        draw_a.polygon(pts, fill=(0, 240, 255), outline=(255, 255, 255))
        draw_e.polygon(pts, fill=(0, 180, 220), outline=(255, 255, 255))
        draw_h.polygon(pts, fill=220)
        draw_a.line([(int(dx - 35 * sc), int(dy - 30 * sc)), (int(dx), int(dy + 55 * sc))], fill=(255, 255, 255), width=3)
        draw_a.line([(int(dx + 35 * sc), int(dy - 30 * sc)), (int(dx), int(dy + 55 * sc))], fill=(255, 255, 255), width=3)

    draw_diamond_hands(int(w * 0.14), int(h * 0.50), 1.4)
    draw_diamond_hands(int(w * 0.86), int(h * 0.50), 1.4)

    # Rocket Booster Afterburner Rings on Rear Deck (Y: 0.84H, X: cx +- 180)
    for rx in [cx - 180, cx + 180]:
        draw_a.ellipse([rx - 60, int(h * 0.84) - 60, rx + 60, int(h * 0.84) + 60], outline=(255, 100, 0), width=12)
        draw_e.ellipse([rx - 60, int(h * 0.84) - 60, rx + 60, int(h * 0.84) + 60], outline=(255, 140, 20), width=12)
        draw_a.ellipse([rx - 30, int(h * 0.84) - 30, rx + 30, int(h * 0.84) + 30], fill=(0, 220, 255))
        draw_e.ellipse([rx - 30, int(h * 0.84) - 30, rx + 30, int(h * 0.84) + 30], fill=(0, 240, 255))

    albedo.save(os.path.join(out_dir, "body_albedo.png"))
    roughness.save(os.path.join(out_dir, "body_roughness.png"))
    metallic.save(os.path.join(out_dir, "body_metallic.png"))
    emissive.save(os.path.join(out_dir, "body_emissive.png"))
    normal = generate_sobel_normal(height_map, strength=2.8)
    normal.save(os.path.join(out_dir, "body_normal.png"))

    draw_digital_screen(out_dir, "$420", (255, 30, 66))
    draw_wheel_maps(out_dir, (255, 30, 66), style='muscle')
    draw_bumper_maps(out_dir, (255, 30, 66))
    print("-> Saved GME APE textures in", out_dir)


def generate_doge_kart():
    print("Generating AAA PBR maps for DOGE BARK...")
    out_dir = os.path.join(TEXTURES_BASE, "doge_kart")
    os.makedirs(out_dir, exist_ok=True)

    w, h = RES, RES
    # 1. Albedo: Warm golden amber / Shiba orange base with cream belly panels and black carbon frame
    albedo = Image.new("RGB", (w, h), (245, 158, 11)) # #f59e0b
    height_map = Image.new("L", (w, h), 128)
    roughness = Image.new("L", (w, h), 90) # ~0.35 satin powder coat
    metallic = Image.new("L", (w, h), 170) # ~0.67 metallic orange
    emissive = Image.new("RGB", (w, h), (0, 0, 0))

    draw_a = ImageDraw.Draw(albedo)
    draw_h = ImageDraw.Draw(height_map)
    draw_r = ImageDraw.Draw(roughness)
    draw_m = ImageDraw.Draw(metallic)
    draw_e = ImageDraw.Draw(emissive)

    cx = w // 2

    # Center Body Spine & Hood Scoop (Cream #fef3c7)
    cw = 240
    hood_scoop_pts = [
        (cx - cw, int(h * 0.12)),
        (cx + cw, int(h * 0.12)),
        (cx + cw + 40, int(h * 0.44)),
        (cx - cw - 40, int(h * 0.44))
    ]
    draw_a.polygon(hood_scoop_pts, fill=(254, 243, 199)) # Cream white
    draw_h.polygon(hood_scoop_pts, fill=165)
    draw_r.polygon(hood_scoop_pts, fill=45) # Glossy
    draw_m.polygon(hood_scoop_pts, fill=30)

    # Comic Doge Golden Pinstripes along hood and side panels
    for side in [-1, 1]:
        px = cx + side * (cw + 50)
        draw_a.line([(px, int(h * 0.10)), (px + side * 40, int(h * 0.88))], fill=(255, 220, 40), width=16)
        draw_e.line([(px, int(h * 0.10)), (px + side * 40, int(h * 0.88))], fill=(255, 180, 0), width=8)

    # Twill Carbon Fiber Cockpit Floor & Rear Radiator Deck (Y: 0.46 to 0.88)
    draw_twill_carbon(draw_a, draw_h, draw_r, draw_m, cx - 380, int(h * 0.46), cx + 380, int(h * 0.88), step=8)

    # Golden Dogecoin 'Ð' Medallion on Hood (Center Cowl, Y: 0.26)
    coin_r = 140
    coin_y = int(h * 0.26)
    draw_a.ellipse([cx - coin_r, coin_y - coin_r, cx + coin_r, coin_y + coin_r], fill=(255, 215, 0), outline=(255, 245, 160), width=14)
    draw_e.ellipse([cx - coin_r, coin_y - coin_r, cx + coin_r, coin_y + coin_r], outline=(255, 200, 0), width=10)
    draw_h.ellipse([cx - coin_r, coin_y - coin_r, cx + coin_r, coin_y + coin_r], fill=220)
    draw_r.ellipse([cx - coin_r, coin_y - coin_r, cx + coin_r, coin_y + coin_r], fill=25)
    draw_m.ellipse([cx - coin_r, coin_y - coin_r, cx + coin_r, coin_y + coin_r], fill=245)

    # Stylized 'Ð' Letter in Medallion
    dw = 48
    dh = 75
    # D arc
    draw_a.arc([cx - dw + 10, coin_y - dh, cx + dw + 25, coin_y + dh], -90, 90, fill=(20, 22, 26), width=22)
    draw_a.line([(cx - dw + 10, coin_y - dh), (cx - dw + 10, coin_y + dh)], fill=(20, 22, 26), width=22)
    # Crossbar
    draw_a.line([(cx - dw - 15, coin_y), (cx + dw - 10, coin_y)], fill=(20, 22, 26), width=18)
    draw_e.arc([cx - dw + 10, coin_y - dh, cx + dw + 25, coin_y + dh], -90, 90, fill=(255, 220, 50), width=6)
    draw_e.line([(cx - dw + 10, coin_y - dh), (cx - dw + 10, coin_y + dh)], fill=(255, 220, 50), width=6)

    # Doge Meme Comic Watermarks across Door Panels
    draw_a.text((int(w * 0.08), int(h * 0.38)), "MUCH WOW", fill=(255, 235, 120))
    draw_a.text((int(w * 0.08), int(h * 0.58)), "SUCH BUMP", fill=(255, 210, 60))
    draw_a.text((int(w * 0.78), int(h * 0.38)), "VERY SPEED", fill=(255, 235, 120))
    draw_a.text((int(w * 0.76), int(h * 0.58)), "TO THE MOON", fill=(255, 210, 60))

    # Dual Rear Megaphone Exhaust Blast Ports (Y: 0.88H, X: cx +- 220)
    for ex in [cx - 220, cx + 220]:
        draw_a.ellipse([ex - 50, int(h * 0.88) - 50, ex + 50, int(h * 0.88) + 50], outline=(220, 225, 235), width=10)
        draw_h.ellipse([ex - 50, int(h * 0.88) - 50, ex + 50, int(h * 0.88) + 50], fill=60)
        draw_r.ellipse([ex - 50, int(h * 0.88) - 50, ex + 50, int(h * 0.88) + 50], fill=15)
        draw_m.ellipse([ex - 50, int(h * 0.88) - 50, ex + 50, int(h * 0.88) + 50], fill=250)
        draw_e.ellipse([ex - 25, int(h * 0.88) - 25, ex + 25, int(h * 0.88) + 25], fill=(255, 170, 0))

    albedo.save(os.path.join(out_dir, "body_albedo.png"))
    roughness.save(os.path.join(out_dir, "body_roughness.png"))
    metallic.save(os.path.join(out_dir, "body_metallic.png"))
    emissive.save(os.path.join(out_dir, "body_emissive.png"))
    normal = generate_sobel_normal(height_map, strength=2.8)
    normal.save(os.path.join(out_dir, "body_normal.png"))

    draw_digital_screen(out_dir, "$69", (255, 208, 0))
    draw_wheel_maps(out_dir, (255, 170, 0), style='buggy')
    draw_bumper_maps(out_dir, (255, 170, 0))
    print("-> Saved DOGE BARK textures in", out_dir)


def main():
    import sys
    target = os.environ.get("BUILD_CAR", sys.argv[1] if len(sys.argv) > 1 else "all").lower()
    print(f"=== STARTING AAA FLEET PBR TEXTURE SYNTHESIS (Target: {target}) ===")
    if target in ["all", "hood_bull"]:
        generate_hood_bull()
    if target in ["all", "hood_bear"]:
        generate_hood_bear()
    if target in ["all", "tsla_racer"]:
        generate_tsla_racer()
    if target in ["all", "nvda_ai"]:
        generate_nvda_ai()
    if target in ["all", "gold_whale"]:
        generate_gold_whale()
    if target in ["all", "gme_ape"]:
        generate_gme_ape()
    if target in ["all", "doge_kart"]:
        generate_doge_kart()
    print("=== AAA TEXTURES SYNTHESIS COMPLETE ===")


if __name__ == '__main__':
    main()

