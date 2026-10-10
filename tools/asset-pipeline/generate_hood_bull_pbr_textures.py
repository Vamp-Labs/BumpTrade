#!/usr/bin/env python3
"""
PBR Texture Synthesizer for BUMP.TRADE Hood Bull 3D Model.
Generates 2048x2048 high-resolution PBR maps matching docs/Bump.Trade Hood Bull Texture PRD.png:
1. Albedo / Base Color (Metallic Emerald Green #00B84B, Twill Carbon Fiber, Gold & Neon Bull Mascot Logo, Dual White Stripes with Yellow Pinstripes, '$85' Display)
2. Normal Map (Sobel gradient filter from height map: panel seams, embossed Bull Logo, louvers, carbon weave)
3. Roughness Map (0.14 clearcoat, 0.34 carbon, 0.88 rubber, 0.09 chrome/gold)
4. Metallic Map (0.92 metallic body paint, 0.98 gold crest, 0.0 vinyl/rubber)
5. Emissive Map (Glowing #00FF6A Bull eyes & horn tips, door crest chevrons, '$85' readout, rear logo)
"""

import os
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUTPUT_DIR = "/home/cn/Projects/Personal/3d/public/models/textures/hood_bull"
RES = 2048

def create_pbr_maps():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    w, h = RES, RES

    # Initialize Canvases
    # 1. Albedo (RGB) - Metallic emerald / neon green body (#00B84B → #00FF6A family)
    albedo = Image.new("RGB", (w, h), (0, 184, 75))
    draw_alb = ImageDraw.Draw(albedo)

    # 2. Height map for Normal map generation (Grayscale L, 128 mid)
    height_map = Image.new("L", (w, h), 128)
    draw_h = ImageDraw.Draw(height_map)

    # 3. Roughness (Grayscale L, 36 = ~0.14 glossy clearcoat)
    roughness = Image.new("L", (w, h), 36)
    draw_r = ImageDraw.Draw(roughness)

    # 4. Metallic (Grayscale L, 235 = ~0.92 metalness)
    metallic = Image.new("L", (w, h), 235)
    draw_m = ImageDraw.Draw(metallic)

    # 5. Emissive (RGB, (0, 0, 0) default black)
    emissive = Image.new("RGB", (w, h), (0, 0, 0))
    draw_emi = ImageDraw.Draw(emissive)

    # =========================================================================
    # A. METALLIC EMERALD GREEN PAINT TEXTURE (Micro-flakes & subtle depth)
    # =========================================================================
    print("Generating metallic paint flakes and depth gradient...")
    np_alb = np.array(albedo, dtype=np.int16)
    np.random.seed(42)

    # Fine metallic flake sparkle
    noise = np.random.normal(0, 10, (h, w, 3)).astype(np.int16)

    # Lateral vignette: slightly darker emerald green towards outer door edges (rockers)
    x_coords = np.linspace(-1, 1, w)
    vignette = (1.0 - 0.22 * (x_coords ** 2)).reshape(1, w, 1)
    np_alb = (np_alb * vignette).astype(np.int16)
    np_alb = np.clip(np_alb + noise, 0, 255).astype(np.uint8)

    albedo = Image.fromarray(np_alb, mode="RGB")
    draw_alb = ImageDraw.Draw(albedo)

    center_x = w // 2

    # =========================================================================
    # B. CENTER TWILL CARBON FIBER INLAY (Hood & Roof Center: U in [0.37, 0.63])
    # =========================================================================
    print("Drawing twill carbon fiber weave...")
    carbon_x0 = int(w * 0.37)
    carbon_x1 = int(w * 0.63)
    carbon_y0 = int(h * 0.08)
    carbon_y1 = int(h * 0.92)

    # Fill base carbon dark graphite
    draw_alb.rectangle([carbon_x0, carbon_y0, carbon_x1, carbon_y1], fill=(14, 16, 18))
    draw_r.rectangle([carbon_x0, carbon_y0, carbon_x1, carbon_y1], fill=86)   # ~0.34 roughness
    draw_m.rectangle([carbon_x0, carbon_y0, carbon_x1, carbon_y1], fill=48)   # ~0.19 metalness

    # Diagonal twill weave pattern
    step = 8
    for y in range(carbon_y0, carbon_y1, step * 2):
        for x in range(carbon_x0, carbon_x1, step * 2):
            x_end1 = min(x + step - 1, carbon_x1)
            y_end1 = min(y + step - 1, carbon_y1)
            if x <= x_end1 and y <= y_end1:
                draw_alb.rectangle([x, y, x_end1, y_end1], fill=(28, 32, 36))
                draw_h.rectangle([x, y, x_end1, y_end1], fill=142)

            x_start2 = x + step
            y_start2 = y + step
            x_end2 = min(x + step * 2 - 1, carbon_x1)
            y_end2 = min(y + step * 2 - 1, carbon_y1)
            if x_start2 <= x_end2 and y_start2 <= y_end2:
                draw_alb.rectangle([x_start2, y_start2, x_end2, y_end2], fill=(28, 32, 36))

    # =========================================================================
    # C. DUAL WHITE RACING STRIPES WITH ELECTRIC YELLOW PINSTRIPES
    # =========================================================================
    print("Drawing dual racing stripes...")
    stripe_w = int(w * 0.040)      # ~82px
    pin_w = int(w * 0.007)         # ~14px
    gap = int(w * 0.060)           # ~123px center gap

    left_sx = center_x - (gap // 2) - stripe_w
    right_sx = center_x + (gap // 2)
    sy0 = int(h * 0.03)
    sy1 = int(h * 0.97)

    for sx in [left_sx, right_sx]:
        # Yellow pinstripe left
        draw_alb.rectangle([sx - pin_w, sy0, sx, sy1], fill=(255, 214, 0))
        # Main white stripe
        draw_alb.rectangle([sx, sy0, sx + stripe_w, sy1], fill=(250, 252, 255))
        # Yellow pinstripe right
        draw_alb.rectangle([sx + stripe_w, sy0, sx + stripe_w + pin_w, sy1], fill=(255, 214, 0))

        # Roughness: 0.16 for smooth vinyl decal
        draw_r.rectangle([sx - pin_w, sy0, sx + stripe_w + pin_w, sy1], fill=42)
        # Metalness: 0.0 (non-metallic vinyl)
        draw_m.rectangle([sx - pin_w, sy0, sx + stripe_w + pin_w, sy1], fill=0)
        # Height: slight raised decal edge
        draw_h.rectangle([sx - pin_w, sy0, sx + stripe_w + pin_w, sy1], fill=140)

    # =========================================================================
    # D. BULL MASCOT HEAD EMBLEM DRAWING HELPER
    # =========================================================================
    def draw_bull_mascot(draw_a, draw_hgt, draw_ruf, draw_met, draw_em, cx, cy, scale, angle_deg=0.0):
        """
        Draws the stylized PRD Bull Mascot head with:
        - 24K Gold Horns with Glowing #00FF6A Neon Tips
        - Polished Gold Crown & Forehead Plate
        - Glowing Neon Green Fierce Eyes (#00FF6A)
        - Muzzle / Snout Plate
        - Outer Neon Green & Gold glowing outlines
        Supports rotation for door mounting.
        """
        rad = math.radians(angle_deg)
        cos_a, sin_a = math.cos(rad), math.sin(rad)

        def transform_pts(pts):
            res = []
            for px, py in pts:
                dx = px * scale
                dy = py * scale
                rx = dx * cos_a - dy * sin_a
                ry = dx * sin_a + dy * cos_a
                res.append((int(cx + rx), int(cy + ry)))
            return res

        # Raw local coordinates (centered at (0, 0), top = -Y)
        # Horns
        horn_l_raw = [
            (-22, -32),
            (-55, -75),
            (-98, -115),
            (-120, -145),
            (-100, -135),
            (-50, -68),
            (-18, -24),
        ]
        horn_r_raw = [(-x, y) for x, y in horn_l_raw]

        horn_tip_l_raw = [
            (-88, -108),
            (-120, -145),
            (-100, -135),
        ]
        horn_tip_r_raw = [(-x, y) for x, y in horn_tip_l_raw]

        # Crown / Forehead plate
        crown_raw = [
            (0, -48),
            (-38, -30),
            (-48, 8),
            (0, 32),
            (48, 8),
            (38, -30),
        ]

        # Muzzle / Snout
        snout_raw = [
            (-30, 20),
            (-34, 55),
            (0, 72),
            (34, 55),
            (30, 20),
            (0, 28),
        ]

        # Eyes
        eye_l_raw = [
            (-32, -4),
            (-12, 6),
            (-30, 10),
        ]
        eye_r_raw = [(-x, y) for x, y in eye_l_raw]

        # Transform all
        horn_l = transform_pts(horn_l_raw)
        horn_r = transform_pts(horn_r_raw)
        horn_tip_l = transform_pts(horn_tip_l_raw)
        horn_tip_r = transform_pts(horn_tip_r_raw)
        crown = transform_pts(crown_raw)
        snout = transform_pts(snout_raw)
        eye_l = transform_pts(eye_l_raw)
        eye_r = transform_pts(eye_r_raw)

        # 1. Draw Horns (24K Gold Body)
        for h_pts in [horn_l, horn_r]:
            draw_a.polygon(h_pts, fill=(255, 200, 36))
            draw_hgt.polygon(h_pts, fill=180)
            draw_ruf.polygon(h_pts, fill=22)
            draw_met.polygon(h_pts, fill=250)

        # 2. Glowing Neon Green Horn Tips
        for tip_pts in [horn_tip_l, horn_tip_r]:
            draw_a.polygon(tip_pts, fill=(0, 255, 106))
            draw_em.polygon(tip_pts, fill=(0, 255, 106))
            draw_hgt.polygon(tip_pts, fill=195)
            draw_ruf.polygon(tip_pts, fill=20)
            draw_met.polygon(tip_pts, fill=220)

        # 3. Crown Plate (Polished 24K Gold)
        draw_a.polygon(crown, fill=(255, 215, 48))
        draw_hgt.polygon(crown, fill=195)
        draw_ruf.polygon(crown, fill=22)
        draw_met.polygon(crown, fill=250)

        # 4. Snout Plate (Gold with Amber tone)
        draw_a.polygon(snout, fill=(235, 185, 30))
        draw_hgt.polygon(snout, fill=185)
        draw_ruf.polygon(snout, fill=28)
        draw_met.polygon(snout, fill=240)

        # 5. Glowing Neon Green Eyes
        for e_pts in [eye_l, eye_r]:
            draw_a.polygon(e_pts, fill=(0, 255, 106))
            draw_em.polygon(e_pts, fill=(0, 255, 106))
            draw_hgt.polygon(e_pts, fill=210)
            draw_ruf.polygon(e_pts, fill=15)
            draw_met.polygon(e_pts, fill=150)

        # 6. Glowing Outline Accents
        line_w = max(2, int(3.0 * scale))
        for poly in [horn_l, horn_r, crown, snout]:
            draw_a.line(poly + [poly[0]], fill=(0, 255, 106), width=line_w)
            draw_em.line(poly + [poly[0]], fill=(0, 255, 106), width=line_w)

    # =========================================================================
    # E. HOOD BULL MASCOT EMBLEM (Center of Hood: py = 330, U = 0.50)
    # =========================================================================
    print("Drawing Hood Bull Mascot Emblem on center of hood...")
    # Prominently scaled at py = 330 (scale=1.65, dominating center hood between racing stripes)
    draw_bull_mascot(draw_alb, draw_h, draw_r, draw_m, draw_emi, center_x, 330, scale=1.65, angle_deg=0.0)

    # Helper function for digital 7-segment / geometric characters (used by digital screen readout)
    def draw_digital_char(draw_tgt, char, cx_c, cy_c, sz):
        hw_c = sz // 2
        hh_c = int(sz * 0.88)
        lw = 5
        if char == '$':
            draw_tgt.line([(cx_c, cy_c - hh_c - 5), (cx_c, cy_c + hh_c + 5)], fill=(0, 255, 106), width=lw)
            draw_tgt.line([(cx_c + hw_c, cy_c - hh_c), (cx_c - hw_c, cy_c - hh_c), (cx_c - hw_c, cy_c), (cx_c + hw_c, cy_c), (cx_c + hw_c, cy_c + hh_c), (cx_c - hw_c, cy_c + hh_c)], fill=(0, 255, 106), width=lw)
        elif char == '8':
            draw_tgt.rectangle([cx_c - hw_c, cy_c - hh_c, cx_c + hw_c, cy_c], outline=(0, 255, 106), width=lw)
            draw_tgt.rectangle([cx_c - hw_c, cy_c, cx_c + hw_c, cy_c + hh_c], outline=(0, 255, 106), width=lw)
        elif char == '5':
            draw_tgt.line([(cx_c + hw_c, cy_c - hh_c), (cx_c - hw_c, cy_c - hh_c), (cx_c - hw_c, cy_c), (cx_c + hw_c, cy_c), (cx_c + hw_c, cy_c + hh_c), (cx_c - hw_c, cy_c + hh_c)], fill=(0, 255, 106), width=lw)

    # =========================================================================
    # F. SIDE DOOR BULL MASCOT DECALS & RACING SPEED CHEVRONS
    # =========================================================================
    print("Drawing properly oriented side door Bull graphics...")
    # On Left Door (U = 0.14, V = 0.50):
    # U is Vertical (+U is UP towards roof). py is Longitudinal (+py is REAR, -py is FRONT).
    # Angle: +90 deg rotates local horns (dy < 0) to +X (towards roof)!
    door_l_x = int(w * 0.14)
    door_y = int(h * 0.50)
    draw_bull_mascot(draw_alb, draw_h, draw_r, draw_m, draw_emi, door_l_x, door_y, scale=1.15, angle_deg=90.0)

    # Horizontal racing speed chevrons trailing towards rear (+py) on Left Door
    for u_off in [-28, 0, 28]:
        y_start = door_y + 85 + abs(u_off) // 2
        y_end = door_y + 320
        draw_alb.line([(door_l_x + u_off, y_start), (door_l_x + u_off, y_end)], fill=(0, 255, 106), width=6)
        draw_emi.line([(door_l_x + u_off, y_start), (door_l_x + u_off, y_end)], fill=(0, 255, 106), width=6)
        draw_h.line([(door_l_x + u_off, y_start), (door_l_x + u_off, y_end)], fill=160, width=6)
        # Trailing angled chevron barb
        draw_alb.line([(door_l_x + u_off, y_end), (door_l_x + u_off - 12, y_end - 18)], fill=(0, 255, 106), width=5)
        draw_emi.line([(door_l_x + u_off, y_end), (door_l_x + u_off - 12, y_end - 18)], fill=(0, 255, 106), width=5)

    # On Right Door (U = 0.86, V = 0.50):
    # U decreases towards roof (+U is rocker, -U is roof).
    # Angle: -90 deg rotates local horns (dy < 0) to -X (towards roof)!
    door_r_x = int(w * 0.86)
    draw_bull_mascot(draw_alb, draw_h, draw_r, draw_m, draw_emi, door_r_x, door_y, scale=1.15, angle_deg=-90.0)

    # Horizontal racing speed chevrons trailing towards rear (+py) on Right Door
    for u_off in [-28, 0, 28]:
        y_start = door_y + 85 + abs(u_off) // 2
        y_end = door_y + 320
        draw_alb.line([(door_r_x + u_off, y_start), (door_r_x + u_off, y_end)], fill=(0, 255, 106), width=6)
        draw_emi.line([(door_r_x + u_off, y_start), (door_r_x + u_off, y_end)], fill=(0, 255, 106), width=6)
        draw_h.line([(door_r_x + u_off, y_start), (door_r_x + u_off, y_end)], fill=160, width=6)
        # Trailing angled chevron barb
        draw_alb.line([(door_r_x + u_off, y_end), (door_r_x + u_off + 12, y_end - 18)], fill=(0, 255, 106), width=5)
        draw_emi.line([(door_r_x + u_off, y_end), (door_r_x + u_off + 12, y_end - 18)], fill=(0, 255, 106), width=5)

    # =========================================================================
    # H. HOOD AIR LOUVER EXTRACTORS (U = 0.33 & U = 0.67, py = 430..530)
    # =========================================================================
    print("Drawing hood louvers and panel seams...")
    for louver_cx in [int(w * 0.32), int(w * 0.68)]:
        for l_i in range(5):
            ly = 430 + (l_i * 22)
            # Slanted aerodynamic vent slat
            draw_alb.rectangle([louver_cx - 42, ly, louver_cx + 42, ly + 8], fill=(10, 12, 14))
            draw_h.rectangle([louver_cx - 42, ly, louver_cx + 42, ly + 8], fill=75)
            draw_r.rectangle([louver_cx - 42, ly, louver_cx + 42, ly + 8], fill=180)
            draw_m.rectangle([louver_cx - 42, ly, louver_cx + 42, ly + 8], fill=40)
            # Thin neon green accent edge on top of each slat
            draw_alb.line([(louver_cx - 42, ly), (louver_cx + 42, ly)], fill=(0, 255, 106), width=2)
            draw_emi.line([(louver_cx - 42, ly), (louver_cx + 42, ly)], fill=(0, 255, 106), width=2)

    # Panel Shut Lines / Seams
    seam_lines = [
        # Hood cut-off line
        [(int(w * 0.22), 620), (int(w * 0.78), 620)],
        # Left fender seam
        [(int(w * 0.24), 200), (int(w * 0.24), 620)],
        # Right fender seam
        [(int(w * 0.76), 200), (int(w * 0.76), 620)],
        # Rear deck seam
        [(int(w * 0.22), 1600), (int(w * 0.78), 1600)],
    ]
    for line in seam_lines:
        draw_alb.line(line, fill=(8, 24, 12), width=3)
        draw_h.line(line, fill=60, width=4)
        draw_r.line(line, fill=140, width=3)

    # =========================================================================
    # I. REAR TRANSOM "BUMP.TRADE" BRANDING (py = 1880)
    # =========================================================================
    print("Drawing rear transom branding...")
    rear_y = 1880
    draw_alb.rectangle([center_x - 180, rear_y - 30, center_x + 180, rear_y + 30], fill=(8, 10, 12), outline=(0, 255, 106), width=3)
    draw_emi.rectangle([center_x - 180, rear_y - 30, center_x + 180, rear_y + 30], outline=(0, 255, 106), width=3)
    draw_h.rectangle([center_x - 180, rear_y - 30, center_x + 180, rear_y + 30], fill=160)

    # Draw geometric "BUMP.TRADE" letters
    draw_alb.text((center_x - 110, rear_y - 14), "BUMP.TRADE", fill=(255, 255, 255))
    draw_emi.text((center_x - 110, rear_y - 14), "BUMP.TRADE", fill=(0, 255, 106))

    # =========================================================================
    # J. TANGENT-SPACE NORMAL MAP (Sobel filter from height map)
    # =========================================================================
    print("Computing Sobel tangent-space normal map...")
    h_arr = np.array(height_map, dtype=np.float32) / 255.0

    dy, dx = np.gradient(h_arr)
    bump_strength = 5.0
    nx = -dx * bump_strength
    ny = -dy * bump_strength
    nz = np.ones_like(nx)

    norm = np.sqrt(nx**2 + ny**2 + nz**2)
    nx /= norm
    ny /= norm
    nz /= norm

    norm_r = ((nx * 0.5 + 0.5) * 255).astype(np.uint8)
    norm_g = ((ny * 0.5 + 0.5) * 255).astype(np.uint8)
    norm_b = ((nz * 0.5 + 0.5) * 255).astype(np.uint8)
    normal_map = Image.fromarray(np.stack([norm_r, norm_g, norm_b], axis=-1), mode="RGB")

    # Save Body PBR Maps
    print("Saving body PBR textures to disk...")
    albedo.save(os.path.join(OUTPUT_DIR, "body_albedo.png"), quality=95)
    normal_map.save(os.path.join(OUTPUT_DIR, "body_normal.png"), quality=95)
    roughness.save(os.path.join(OUTPUT_DIR, "body_roughness.png"), quality=95)
    metallic.save(os.path.join(OUTPUT_DIR, "body_metallic.png"), quality=95)
    emissive.save(os.path.join(OUTPUT_DIR, "body_emissive.png"), quality=95)

    # =========================================================================
    # K. BUMPER TEXTURE: SOLID MATTE HEAVY-DUTY RUBBER (1024x256)
    # =========================================================================
    print("Generating bumper PBR texture (solid dark matte rubber with ribs)...")
    bmp_w, bmp_h = 1024, 256
    # Solid dark charcoal/black rubber #16181A (Zero white/green wash!)
    bmp_alb = Image.new("RGB", (bmp_w, bmp_h), (22, 24, 26))
    bmp_draw = ImageDraw.Draw(bmp_alb)

    # Subtle rubber grain noise
    np_bmp = np.array(bmp_alb, dtype=np.int16)
    noise_bmp = np.random.normal(0, 4, (bmp_h, bmp_w, 3)).astype(np.int16)
    np_bmp = np.clip(np_bmp + noise_bmp, 0, 255).astype(np.uint8)
    bmp_alb = Image.fromarray(np_bmp, mode="RGB")
    bmp_draw = ImageDraw.Draw(bmp_alb)

    # 4 Heavy-duty horizontal impact absorption ribs
    for ry in [35, 75, 115, 155]:
        # Recessed dark groove
        bmp_draw.rectangle([0, ry, bmp_w, ry + 12], fill=(12, 14, 16))
        # Top impact highlight bevel
        bmp_draw.line([(0, ry), (bmp_w, ry)], fill=(38, 42, 46), width=2)
        # Bottom shadow
        bmp_draw.line([(0, ry + 12), (bmp_w, ry + 12)], fill=(8, 10, 12), width=2)

    # Pure black emissive for rubber bumper (Slot 1 NeonGreen provides the underglow)
    bmp_emi = Image.new("RGB", (bmp_w, bmp_h), (0, 0, 0))

    bmp_alb.save(os.path.join(OUTPUT_DIR, "bumper_albedo.png"))
    bmp_emi.save(os.path.join(OUTPUT_DIR, "bumper_emissive.png"))

    # =========================================================================
    # L. WHEEL RIM TEXTURE (512x512)
    # =========================================================================
    print("Generating wheel rim PBR texture...")
    wh_sz = 512
    wh_alb = Image.new("RGB", (wh_sz, wh_sz), (18, 20, 22))
    wh_draw = ImageDraw.Draw(wh_alb)
    wh_emi = Image.new("RGB", (wh_sz, wh_sz), (0, 0, 0))
    wh_emi_draw = ImageDraw.Draw(wh_emi)

    wh_cx, wh_cy = wh_sz // 2, wh_sz // 2

    # Outer Neon Green Rim Lip (radius 228, width 26)
    wh_draw.ellipse([wh_cx - 232, wh_cy - 232, wh_cx + 232, wh_cy + 232], outline=(0, 255, 106), width=26)
    wh_emi_draw.ellipse([wh_cx - 232, wh_cy - 232, wh_cx + 232, wh_cy + 232], outline=(0, 255, 106), width=26)

    # Inner dark chrome wheel well
    wh_draw.ellipse([wh_cx - 216, wh_cy - 216, wh_cx + 216, wh_cy + 216], outline=(35, 40, 46), width=8)

    # 5 Polished chrome aero spokes
    for i in range(5):
        ang = (i / 5.0) * math.pi * 2.0
        ex = wh_cx + int(math.cos(ang) * 210)
        ey = wh_cy + int(math.sin(ang) * 210)
        wh_draw.line([(wh_cx, wh_cy), (ex, ey)], fill=(225, 235, 245), width=26)

    # Center 24K Gold Bull Mascot Cap
    wh_draw.ellipse([wh_cx - 60, wh_cy - 60, wh_cx + 60, wh_cy + 60], fill=(255, 215, 40), outline=(0, 255, 106), width=5)
    wh_emi_draw.ellipse([wh_cx - 60, wh_cy - 60, wh_cx + 60, wh_cy + 60], outline=(0, 255, 106), width=5)

    # Bull Horns silhouette on gold center cap
    cap_horns = [
        (wh_cx - 30, wh_cy - 10),
        (wh_cx - 45, wh_cy - 35),
        (wh_cx - 32, wh_cy - 30),
        (wh_cx, wh_cy - 12),
        (wh_cx + 32, wh_cy - 30),
        (wh_cx + 45, wh_cy - 35),
        (wh_cx + 30, wh_cy - 10),
    ]
    wh_draw.polygon(cap_horns, fill=(18, 20, 24))

    wh_alb.save(os.path.join(OUTPUT_DIR, "wheel_albedo.png"))
    wh_emi.save(os.path.join(OUTPUT_DIR, "wheel_emissive.png"))

    # =========================================================================
    # M. DEDICATED DIGITAL SCREEN TEXTURE (512x256)
    # =========================================================================
    print("Generating dedicated digital screen texture ($85 readout)...")
    sc_w, sc_h = 512, 256
    sc_alb = Image.new("RGB", (sc_w, sc_h), (8, 12, 14))
    sc_draw = ImageDraw.Draw(sc_alb)
    sc_emi = Image.new("RGB", (sc_w, sc_h), (0, 0, 0))
    sc_emi_draw = ImageDraw.Draw(sc_emi)

    # Neon Green Glowing Rounded Border
    sc_draw.rounded_rectangle([12, 12, sc_w - 12, sc_h - 12], radius=24, outline=(0, 255, 106), width=10)
    sc_emi_draw.rounded_rectangle([12, 12, sc_w - 12, sc_h - 12], radius=24, outline=(0, 255, 106), width=10)

    # Glowing Digital "$85" Text (Bold modern sans typography matching PRD Close-Up #3)
    font_path = '/usr/share/fonts/liberation/LiberationSans-Bold.ttf'
    if os.path.exists(font_path):
        from PIL import ImageFont
        font = ImageFont.truetype(font_path, 135)
        bbox = sc_draw.textbbox((0, 0), '$85', font=font)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        tx = (sc_w - tw) // 2 - bbox[0]
        ty = (sc_h - th) // 2 - bbox[1] - 4
        sc_draw.text((tx, ty), '$85', fill=(0, 255, 106), font=font)
        sc_emi_draw.text((tx, ty), '$85', fill=(0, 255, 106), font=font)
    else:
        sc_cx, sc_cy = sc_w // 2, sc_h // 2
        sc_char_sz = 95
        for c, offset_x in [('$', -125), ('8', 0), ('5', 125)]:
            draw_digital_char(sc_draw, c, sc_cx + offset_x, sc_cy, sc_char_sz)
            draw_digital_char(sc_emi_draw, c, sc_cx + offset_x, sc_cy, sc_char_sz)

    sc_alb.save(os.path.join(OUTPUT_DIR, "screen_albedo.png"))
    sc_emi.save(os.path.join(OUTPUT_DIR, "screen_emissive.png"))

    print("=== ALL PBR TEXTURE MAPS GENERATED SUCCESSFULLY ===")

if __name__ == '__main__':
    create_pbr_maps()
