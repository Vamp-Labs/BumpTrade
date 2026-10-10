#!/usr/bin/env python3
"""
Blender 5.1 Python Script: Production AAA Distinct 3D Fleet Architecture for BUMP.TRADE.
Faithful to official PRD designs in:
- docs/car/prd.md
- docs/car/69d916c8-53f2-47f2-bc6b-22fd294cdbc1.png

Generates 5 distinct, production-grade automotive models:
0. HOOD BULL (Hero GT Sports Car / Balanced All-Rounder):
   - Sculpted 20-station athletic GT sports car body shell with hood scoop & rear ducktail
   - Twin cowl gold bull horn ornaments sweeping along the hood cowl
   - Dual angled projector headlights with amber DRL brows & clear glass covers
   - Open cockpit with sport bucket seat, rollover headrest nacelle, bull-horn steering wheel
   - Muscular Bull mascot driver with snout, nostrils, gold septum ring, curved horns & aviators
   - Height-calibrated flexible antenna at Z = 1.36m with glowing Lucky Green halo ring
   - 5-spoke deep-dish chrome star rims with Lucky Green glowing lip & green calipers
   - Wrap-around amusement park rubber bumper collar with Lucky Green neon channel

1. HOOD BEAR (Heavy Brawler Tank / Trophy Truck):
   - Muscular power-bulge hood with dual carbon intake scoops & cooling louvers
   - Front heavy-duty tubular steel bull bar with dual amber fog lamps
   - Rectangular dual-projector headlights with red demon-eye halos & glass lenses
   - 4-point tubular steel roll cage with bear-ear gusset plates & rally bucket seat
   - Snarling Grizzly Bear mascot driver with fur, snout, ears, and aviator sunglasses
   - Dual twin heavy chrome exhaust cannons & heavy rear rally diffuser
   - Reinforced thick antenna mast with glowing ruby red contact head
   - Heavy beadlock wheels with knobby treaded tires & crimson calipers
   - Dual-tier heavy-duty industrial rubber bumper with glowing crimson neon channel

2. TSLA RACER (Le Mans Cyber Speedster):
   - Ultra-low dipping aerodynamic needle nose with dual hood NACA air ducts
   - Full-width continuous cyber LED lightbar spanning across the front nose
   - Dual razor-thin projector headlights beneath aerodynamic flush polycarbonate covers
   - Central carbon fiber aerodynamic shark fin spine with cyan glowing trailing edge
   - Speedster cockpit with low-slung seat, Tesla Plaid yoke steering wheel, digital HUD
   - Curved wraparound speedster bubble polycarbonate windscreen with cyan neon border
   - Cyber Robot driver with glossy white helmet & electric cyan curved LED visor
   - Full-width razor ruby red taillight strip across the ducktail spoiler
   - Ultra-thin carbon antenna with electric cyan glowing halo ring contact head
   - Turbofan aero-disc flush wheels with glowing cyan outer ring & racing slick tires
   - Ultra-low flush aerodynamic composite bumper with continuous cyan neon channel

3. NVDA AI (Stealth F-117 / Reventon Polygonal Fighter):
   - Chiseled stealth-fighter polygonal faceted bodywork with crisp geometric creases
   - Dual triangular front stealth air intakes flanking the center nose
   - Sharp diagonal arrowhead LED headlights (> <) glowing in lime & ice white
   - Twin high-mounted sharp vertical stabilizer winglets / fins on rear haunches (18 deg out)
   - Chiseled cockpit with angular cyber steering wheel & angled smoked polygonal windscreen
   - Faceted Cyber Bot driver with angular geometric head & glowing lime pixel matrix eyes
   - Segmented cybernetic neural antenna mast with glowing purple neural orb contact head
   - Hex-pattern composite stealth wheels with radioactive lime rim lip
   - Continuous faceted composite bumper with deep purple glowing neon channel

4. GOLD WHALE (Opulent Riviera Yacht Cruiser / Speedboat Hyper-GT):
   - Commanding elevated yacht bow prow (zt = 0.68m) with sweeping carbon center spine
   - Voluptuous flowing pontoon front fenders curving over large luxury wheels
   - Magnificent front vertical waterfall luxury grille with 24K gold fluted surround
   - Flanked by dual round luxury jewel projector headlights with diamond-cut facets
   - Sweeping rear yacht-tail boat deck with real mahogany wood planking
   - Twin streamlined speedster rollover nacelles behind the headrest
   - Ultra-luxury open yacht cockpit: mahogany floor, quilted leather seat, gold vintage wheel
   - Curved gold-framed vintage speedster windscreen
   - Whale Mascot Driver: blue/grey whale in black tuxedo with 24K gold VIP crown
   - Dual 24K gold-plated antenna masts with glowing brilliant diamond contact heads
   - 24K gold multi-wire luxury spokes with warm golden underglow
   - Continuous gilded luxury bumper with warm golden neon underglow channel
"""

import os
import bpy
import bmesh
import math
from mathutils import Vector, Matrix, Euler

TEXTURES_BASE = "/home/cn/Projects/Personal/3d/public/models/textures"
MODELS_OUT = "/home/cn/Projects/Personal/3d/public/models"

def clean_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for obj in bpy.data.objects:
        bpy.data.objects.remove(obj, do_unlink=True)
    for col in bpy.data.collections:
        bpy.data.collections.remove(col)

def make_transform(pos, scale=None, rot_euler=None):
    mat = Matrix.Translation(pos)
    if rot_euler:
        mat = mat @ rot_euler.to_matrix().to_4x4()
    if scale:
        mat = mat @ Matrix.Diagonal((*scale, 1.0))
    return mat

def make_cylinder(bm, radius=0.2, depth=0.2, segments=16, matrix=Matrix(), cap_ends=True, **kwargs):
    return bmesh.ops.create_cone(
        bm,
        cap_ends=cap_ends,
        cap_tris=kwargs.get('cap_tris', False),
        segments=segments,
        radius1=radius,
        radius2=radius,
        depth=depth,
        matrix=matrix
    )

def set_mat_for_verts(verts, mat_idx):
    faces = {f for v in verts for f in v.link_faces}
    for f in faces:
        f.material_index = mat_idx

def create_pbr_material(name, albedo_path=None, roughness_path=None, metallic_path=None,
                        normal_path=None, emissive_path=None, base_color=(1, 1, 1),
                        default_roughness=0.3, default_metallic=0.0, emissive_color=None,
                        emissive_strength=1.0, alpha=1.0, transmission=0.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    output_node = nodes.new(type='ShaderNodeOutputMaterial')
    bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    links.new(bsdf.outputs['BSDF'], output_node.inputs['Surface'])

    bsdf.inputs['Base Color'].default_value = (*base_color, alpha)
    bsdf.inputs['Roughness'].default_value = default_roughness
    bsdf.inputs['Metallic'].default_value = default_metallic

    if transmission > 0:
        if 'Transmission Weight' in bsdf.inputs:
            bsdf.inputs['Transmission Weight'].default_value = transmission
        elif 'Transmission' in bsdf.inputs:
            bsdf.inputs['Transmission'].default_value = transmission

    tex_coord = None
    if any([albedo_path, roughness_path, metallic_path, normal_path, emissive_path]):
        tex_coord = nodes.new(type='ShaderNodeTexCoord')

    if albedo_path and os.path.exists(albedo_path):
        img_node = nodes.new(type='ShaderNodeTexImage')
        img_node.image = bpy.data.images.load(albedo_path)
        img_node.image.colorspace_settings.name = 'sRGB'
        links.new(tex_coord.outputs['UV'], img_node.inputs['Vector'])
        links.new(img_node.outputs['Color'], bsdf.inputs['Base Color'])

    if roughness_path and os.path.exists(roughness_path):
        img_node = nodes.new(type='ShaderNodeTexImage')
        img_node.image = bpy.data.images.load(roughness_path)
        img_node.image.colorspace_settings.name = 'Non-Color'
        links.new(tex_coord.outputs['UV'], img_node.inputs['Vector'])
        links.new(img_node.outputs['Color'], bsdf.inputs['Roughness'])

    if metallic_path and os.path.exists(metallic_path):
        img_node = nodes.new(type='ShaderNodeTexImage')
        img_node.image = bpy.data.images.load(metallic_path)
        img_node.image.colorspace_settings.name = 'Non-Color'
        links.new(tex_coord.outputs['UV'], img_node.inputs['Vector'])
        links.new(img_node.outputs['Color'], bsdf.inputs['Metallic'])

    if normal_path and os.path.exists(normal_path):
        img_node = nodes.new(type='ShaderNodeTexImage')
        img_node.image = bpy.data.images.load(normal_path)
        img_node.image.colorspace_settings.name = 'Non-Color'
        links.new(tex_coord.outputs['UV'], img_node.inputs['Vector'])
        norm_map = nodes.new(type='ShaderNodeNormalMap')
        norm_map.inputs['Strength'].default_value = 1.0
        links.new(img_node.outputs['Color'], norm_map.inputs['Color'])
        links.new(norm_map.outputs['Normal'], bsdf.inputs['Normal'])

    if emissive_path and os.path.exists(emissive_path):
        img_node = nodes.new(type='ShaderNodeTexImage')
        img_node.image = bpy.data.images.load(emissive_path)
        img_node.image.colorspace_settings.name = 'sRGB'
        links.new(tex_coord.outputs['UV'], img_node.inputs['Vector'])
        if 'Emission Color' in bsdf.inputs:
            links.new(img_node.outputs['Color'], bsdf.inputs['Emission Color'])
            bsdf.inputs['Emission Strength'].default_value = emissive_strength
        elif 'Emission' in bsdf.inputs:
            links.new(img_node.outputs['Color'], bsdf.inputs['Emission'])
            bsdf.inputs['Emission Strength'].default_value = emissive_strength
    elif emissive_color:
        if 'Emission Color' in bsdf.inputs:
            bsdf.inputs['Emission Color'].default_value = (*emissive_color, 1.0)
            bsdf.inputs['Emission Strength'].default_value = emissive_strength
        elif 'Emission' in bsdf.inputs:
            bsdf.inputs['Emission'].default_value = (*emissive_color, 1.0)
            bsdf.inputs['Emission Strength'].default_value = emissive_strength

    return mat

def setup_materials_for_car(car_type, glow_color_rgb):
    tex_dir = os.path.join(TEXTURES_BASE, car_type)
    mats = {}

    body_base = {
        'hood_bull': (0.0, 0.72, 0.29),
        'hood_bear': (0.62, 0.05, 0.09),
        'tsla_racer': (0.95, 0.97, 1.0),
        'nvda_ai': (0.24, 0.28, 0.35),
        'gold_whale': (1.0, 0.82, 0.16),
        'gme_ape': (0.11, 0.12, 0.15),
        'doge_kart': (0.96, 0.62, 0.05),
    }.get(car_type, (0.5, 0.5, 0.5))

    body_metal = 0.90 if car_type == 'gold_whale' else (0.88 if car_type == 'hood_bull' else (0.86 if car_type in ['hood_bear', 'gme_ape'] else (0.72 if car_type == 'doge_kart' else (0.45 if car_type == 'tsla_racer' else 0.65))))
    body_rough = 0.16 if car_type in ['gold_whale', 'tsla_racer', 'hood_bull'] else (0.28 if car_type == 'doge_kart' else (0.22 if car_type == 'gme_ape' else 0.18))

    mats['BodyPaint'] = create_pbr_material(
        'BodyPaint',
        albedo_path=os.path.join(tex_dir, "body_albedo.png"),
        roughness_path=os.path.join(tex_dir, "body_roughness.png"),
        metallic_path=os.path.join(tex_dir, "body_metallic.png"),
        normal_path=os.path.join(tex_dir, "body_normal.png"),
        emissive_path=os.path.join(tex_dir, "body_emissive.png"),
        base_color=body_base,
        default_roughness=body_rough,
        default_metallic=body_metal,
        emissive_strength=5.0
    )

    mats['Rubber'] = create_pbr_material(
        'Rubber',
        albedo_path=os.path.join(tex_dir, "bumper_albedo.png"),
        base_color=(0.08, 0.09, 0.10),
        default_roughness=0.88,
        default_metallic=0.02,
        emissive_strength=0.0
    )

    mats['Wheel'] = create_pbr_material(
        'Wheel',
        albedo_path=os.path.join(tex_dir, "wheel_albedo.png"),
        emissive_path=os.path.join(tex_dir, "wheel_emissive.png"),
        base_color=(0.1, 0.12, 0.14),
        default_roughness=0.14,
        default_metallic=0.85,
        emissive_strength=4.5
    )

    mats['TireRubber'] = create_pbr_material('TireRubber', base_color=(0.02, 0.022, 0.025), default_roughness=0.68, default_metallic=0.04)
    mats['Gold'] = create_pbr_material('Gold', base_color=(1.0, 0.80, 0.14), default_roughness=0.10, default_metallic=0.98)
    mats['NeonAccent'] = create_pbr_material('NeonAccent', base_color=glow_color_rgb, emissive_color=glow_color_rgb, emissive_strength=6.0, default_roughness=0.1)
    mats['LimeAccent'] = create_pbr_material('LimeAccent', base_color=(0.0, 1.0, 0.4), emissive_color=(0.0, 1.0, 0.4), emissive_strength=6.0, default_roughness=0.1)
    mats['PurpleAccent'] = create_pbr_material('PurpleAccent', base_color=(0.75, 0.33, 0.92), emissive_color=(0.75, 0.33, 0.92), emissive_strength=6.0, default_roughness=0.1)
    mats['AmberFog'] = create_pbr_material('AmberFog', base_color=(1.0, 0.65, 0.0), emissive_color=(1.0, 0.65, 0.0), emissive_strength=5.0, default_roughness=0.1)
    mats['AmberDRL'] = create_pbr_material('AmberDRL', base_color=(1.0, 0.62, 0.0), emissive_color=(1.0, 0.62, 0.0), emissive_strength=4.5, default_roughness=0.10)
    mats['Carbon'] = create_pbr_material('Carbon', base_color=(0.03, 0.03, 0.04), default_roughness=0.32, default_metallic=0.25)
    mats['DarkMetal'] = create_pbr_material('DarkMetal', base_color=(0.035, 0.04, 0.048), default_roughness=0.42, default_metallic=0.88)
    mats['SteelBullBar'] = create_pbr_material('SteelBullBar', base_color=(0.14, 0.16, 0.18), default_roughness=0.30, default_metallic=0.92)
    mats['Chrome'] = create_pbr_material('Chrome', base_color=(0.95, 0.97, 1.0), default_roughness=0.04, default_metallic=0.98)
    mats['Glass'] = create_pbr_material('Glass', base_color=(0.08, 0.22, 0.28), default_roughness=0.05, default_metallic=0.1, transmission=0.85, alpha=0.50)
    mats['Headlight'] = create_pbr_material('Headlight', base_color=(1.0, 0.98, 0.88), emissive_color=(1.0, 0.98, 0.88), emissive_strength=5.5, default_roughness=0.08)
    mats['RedDemonEye'] = create_pbr_material('RedDemonEye', base_color=(1.0, 0.05, 0.15), emissive_color=(1.0, 0.05, 0.15), emissive_strength=5.5, default_roughness=0.08)
    mats['Taillight'] = create_pbr_material('Taillight', base_color=(1.0, 0.07, 0.15), emissive_color=(1.0, 0.07, 0.15), emissive_strength=5.5, default_roughness=0.08)
    mats['BrakeDisc'] = create_pbr_material('BrakeDisc', base_color=(0.45, 0.48, 0.52), default_roughness=0.25, default_metallic=0.9)
    mats['RedCaliper'] = create_pbr_material('RedCaliper', base_color=(0.88, 0.08, 0.12), default_roughness=0.20, default_metallic=0.6)
    mats['GreenCaliper'] = create_pbr_material('GreenCaliper', base_color=(0.0, 0.82, 0.35), emissive_color=(0.0, 0.82, 0.35), emissive_strength=2.0, default_roughness=0.20, default_metallic=0.6)
    mats['CyanCaliper'] = create_pbr_material('CyanCaliper', base_color=(0.0, 0.85, 1.0), default_roughness=0.20, default_metallic=0.6)
    mats['LimeCaliper'] = create_pbr_material('LimeCaliper', base_color=(0.0, 1.0, 0.4), default_roughness=0.20, default_metallic=0.6)
    mats['GoldCaliper'] = create_pbr_material('GoldCaliper', base_color=(1.0, 0.80, 0.14), default_roughness=0.15, default_metallic=0.9)
    mats['MahoganyWood'] = create_pbr_material('MahoganyWood', base_color=(0.34, 0.15, 0.08), default_roughness=0.25, default_metallic=0.08)
    mats['CreamLeather'] = create_pbr_material('CreamLeather', base_color=(0.94, 0.91, 0.83), default_roughness=0.52, default_metallic=0.06)
    mats['SilverIceBucket'] = create_pbr_material('SilverIceBucket', base_color=(0.92, 0.94, 0.96), default_roughness=0.10, default_metallic=0.96)
    mats['ChampagneBottle'] = create_pbr_material('ChampagneBottle', base_color=(0.04, 0.16, 0.06), default_roughness=0.06, default_metallic=0.10, transmission=0.85, alpha=0.55)

    # Driver Skins
    mats['BullSkin'] = create_pbr_material('BullSkin', base_color=(0.52, 0.32, 0.18), default_roughness=0.55, default_metallic=0.04)
    mats['BullHorn'] = create_pbr_material('BullHorn', base_color=(0.92, 0.88, 0.76), default_roughness=0.38, default_metallic=0.08)
    mats['BullHornTip'] = create_pbr_material('BullHornTip', base_color=(0.10, 0.08, 0.07), default_roughness=0.32, default_metallic=0.18)
    mats['BullSnout'] = create_pbr_material('BullSnout', base_color=(0.66, 0.46, 0.32), default_roughness=0.50, default_metallic=0.04)
    mats['NoseRing'] = create_pbr_material('NoseRing', base_color=(1.0, 0.82, 0.14), emissive_color=(1.0, 0.82, 0.14), emissive_strength=3.0, default_roughness=0.08, default_metallic=0.98)
    mats['RacingSuit'] = create_pbr_material('RacingSuit', base_color=(0.05, 0.06, 0.07), default_roughness=0.50, default_metallic=0.12)
    mats['BearSkin'] = create_pbr_material('BearSkin', base_color=(0.045, 0.022, 0.012), default_roughness=0.85, default_metallic=0.02)
    mats['BearSnout'] = create_pbr_material('BearSnout', base_color=(0.090, 0.045, 0.025), default_roughness=0.75, default_metallic=0.02)
    mats['BearFangs'] = create_pbr_material('BearFangs', base_color=(0.95, 0.95, 0.92), default_roughness=0.20, default_metallic=0.1)
    mats['BearNose'] = create_pbr_material('BearNose', base_color=(0.02, 0.02, 0.02), default_roughness=0.25, default_metallic=0.05)
    mats['GoldFrames'] = create_pbr_material('GoldFrames', base_color=(1.0, 0.82, 0.18), default_roughness=0.15, default_metallic=0.98)
    mats['CyberRobotWhite'] = create_pbr_material('CyberRobotWhite', base_color=(0.92, 0.94, 0.98), default_roughness=0.12, default_metallic=0.4)
    mats['WhaleSkin'] = create_pbr_material('WhaleSkin', base_color=(0.18, 0.28, 0.42), default_roughness=0.35, default_metallic=0.1)
    mats['WhaleBelly'] = create_pbr_material('WhaleBelly', base_color=(0.90, 0.93, 0.96), default_roughness=0.35, default_metallic=0.04)
    mats['WhaleTuxedo'] = create_pbr_material('WhaleTuxedo', base_color=(0.04, 0.05, 0.06), default_roughness=0.45, default_metallic=0.15)
    mats['BowtieRed'] = create_pbr_material('BowtieRed', base_color=(0.85, 0.08, 0.12), default_roughness=0.35, default_metallic=0.20)
    mats['Sunglasses'] = create_pbr_material('Sunglasses', base_color=(0.01, 0.01, 0.01), default_roughness=0.04, default_metallic=0.95)
    mats['ApeSkin'] = create_pbr_material('ApeSkin', base_color=(0.10, 0.11, 0.13), default_roughness=0.70, default_metallic=0.02)
    mats['ApeSnout'] = create_pbr_material('ApeSnout', base_color=(0.18, 0.19, 0.22), default_roughness=0.60, default_metallic=0.02)
    mats['HeadbandRed'] = create_pbr_material('HeadbandRed', base_color=(1.0, 0.12, 0.26), emissive_color=(1.0, 0.12, 0.26), emissive_strength=4.5, default_roughness=0.35)
    mats['DiamondCyan'] = create_pbr_material('DiamondCyan', base_color=(0.0, 0.94, 1.0), emissive_color=(0.0, 0.94, 1.0), emissive_strength=6.0, default_roughness=0.08)

    mats['Screen'] = create_pbr_material(
        'Screen',
        albedo_path=os.path.join(tex_dir, "screen_albedo.png"),
        emissive_path=os.path.join(tex_dir, "screen_emissive.png"),
        base_color=(0.02, 0.03, 0.04),
        emissive_strength=5.0,
        default_roughness=0.1
    )

    return mats

def create_wheel_wells(car_root, mats, wheel_track, wheel_base, well_radius=0.34, well_width=0.26):
    ww_mesh = bpy.data.meshes.new("WheelWellsMesh")
    ww_obj = bpy.data.objects.new("WheelWells", ww_mesh)
    bpy.context.collection.objects.link(ww_obj)
    ww_obj.parent = car_root
    bm_ww = bmesh.new()

    for sign_x in [-1, 1]:
        for sign_y in [-1, 1]:
            wx = sign_x * (wheel_track - 0.06)
            wy = sign_y * wheel_base
            pts = []
            for a in range(0, 181, 15):
                rad = math.radians(a)
                pts.append(Vector((0.0, math.cos(rad) * well_radius, math.sin(rad) * well_radius)))
            w_in = -sign_x * (well_width - 0.04)
            for i in range(len(pts) - 1):
                p1, p2 = pts[i], pts[i + 1]
                v1 = bm_ww.verts.new(Vector((wx, wy + p1.y, 0.28 + p1.z)))
                v2 = bm_ww.verts.new(Vector((wx, wy + p2.y, 0.28 + p2.z)))
                v3 = bm_ww.verts.new(Vector((wx + w_in, wy + p2.y, 0.28 + p2.z)))
                v4 = bm_ww.verts.new(Vector((wx + w_in, wy + p1.y, 0.28 + p1.z)))
                bm_ww.faces.new([v1, v2, v3, v4])

    bm_ww.to_mesh(ww_mesh)
    bm_ww.free()
    ww_obj.data.materials.append(mats['DarkMetal'])
    return ww_obj

def build_thick_bumper(car_root, mats, perimeter_pts, pw=0.085, ph=0.065, neon_slot='NeonAccent'):
    """
    Constructs a massive, authentic amusement park bumper car rubber collar
    with a recessed lower neon channel.
    """
    mesh = bpy.data.meshes.new("BumperMesh")
    obj = bpy.data.objects.new("Bumper", mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = car_root
    bm = bmesh.new()

    left_pts = [Vector((-p.x, p.y, p.z)) for p in reversed(perimeter_pts[1:-1])]
    all_pts = perimeter_pts + left_pts
    n_pts = len(all_pts)

    ring_loops = []
    prof_angles = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]

    for idx, pt in enumerate(all_pts):
        prev_pt = all_pts[(idx - 1) % n_pts]
        next_pt = all_pts[(idx + 1) % n_pts]
        tangent = (next_pt - prev_pt).normalized()
        up = Vector((0.0, 0.0, 1.0))
        normal = tangent.cross(up).normalized()

        loop = []
        for a in prof_angles:
            rad = math.radians(a)
            offset = normal * (math.cos(rad) * pw) + up * (math.sin(rad) * ph)
            vert = bm.verts.new(pt + offset)
            loop.append(vert)
        ring_loops.append(loop)

    uv_layer = bm.loops.layers.uv.new("UVMap")

    for i in range(n_pts):
        r1 = ring_loops[i]
        r2 = ring_loops[(i + 1) % n_pts]
        u1 = i / n_pts
        u2 = (i + 1) / n_pts
        for j in range(len(prof_angles)):
            j_next = (j + 1) % len(prof_angles)
            v1 = j / len(prof_angles)
            v2 = (j + 1) / len(prof_angles)

            f = bm.faces.new([r1[j], r1[j_next], r2[j_next], r2[j]])
            f.material_index = 0
            f.loops[0][uv_layer].uv = Vector((u1, v1))
            f.loops[1][uv_layer].uv = Vector((u1, v2))
            f.loops[2][uv_layer].uv = Vector((u2, v2))
            f.loops[3][uv_layer].uv = Vector((u2, v1))

    # Recessed lower neon accent channel
    neon_loops = []
    neon_pw = 0.026
    neon_ph = 0.022
    for idx, pt in enumerate(all_pts):
        prev_pt = all_pts[(idx - 1) % n_pts]
        next_pt = all_pts[(idx + 1) % n_pts]
        tangent = (next_pt - prev_pt).normalized()
        up = Vector((0.0, 0.0, 1.0))
        normal = tangent.cross(up).normalized()
        neon_center = pt + up * -0.055 + normal * 0.020
        v1 = bm.verts.new(neon_center + normal * -neon_pw)
        v2 = bm.verts.new(neon_center + normal *  neon_pw)
        v3 = bm.verts.new(neon_center + normal *  neon_pw + up * neon_ph)
        v4 = bm.verts.new(neon_center + normal * -neon_pw + up * neon_ph)
        neon_loops.append([v1, v2, v3, v4])

    for i in range(n_pts):
        nl1 = neon_loops[i]
        nl2 = neon_loops[(i + 1) % n_pts]
        for j in range(4):
            j_next = (j + 1) % 4
            f = bm.faces.new([nl1[j], nl1[j_next], nl2[j_next], nl2[j]])
            f.material_index = 1

    bm.to_mesh(mesh)
    bm.free()

    obj.data.materials.append(mats['Rubber'])
    obj.data.materials.append(mats[neon_slot])

    subsurf = obj.modifiers.new(name="Subdivision", type='SUBSURF')
    subsurf.levels = 1
    for poly in obj.data.polygons:
        poly.use_smooth = True

    return obj

def build_quad_body_shell(bm, sections, wheelbase, y_min, y_max, arch_rad=0.33):
    """
    Constructs an automotive body shell with 16-point ring loops
    and exact automotive UV mapping.
    """
    u_weights = [
        0.50,  # 0: Center Top
        0.58,  # 1: Right racing stripe
        0.66,  # 2: Right pinstripe / valley crease
        0.76,  # 3: Right fender peak
        0.84,  # 4: Right upper shoulder
        0.88,  # 5: Right door waistline
        0.94,  # 6: Right rocker / wheel arch lip
        0.98,  # 7: Right underbody edge
        0.50,  # 8: Center Bottom
        0.02,  # 9: Left underbody edge
        0.06,  # 10: Left rocker / wheel arch lip
        0.12,  # 11: Left door waistline
        0.16,  # 12: Left upper shoulder
        0.24,  # 13: Left fender peak
        0.34,  # 14: Left valley crease
        0.42,  # 15: Left racing stripe
    ]

    ring_verts = []
    ring_uvs = []

    for s in sections:
        loop = []
        uv_loop = []
        y = s["y"]
        hw = s["hw"]
        zt, zp, zw, zb = s["zt"], s["zp"], s["zw"], s["zb"]

        # Circular wheel arch clearance
        dy_f = abs(y - (-wheelbase))
        dy_r = abs(y - wheelbase)
        if dy_f <= arch_rad:
            za = 0.28 + math.sqrt(max(0.0, arch_rad**2 - dy_f**2))
            is_arch = True
        elif dy_r <= arch_rad:
            za = 0.28 + math.sqrt(max(0.0, arch_rad**2 - dy_r**2))
            is_arch = True
        else:
            za = zb
            is_arch = False

        v_coord = 1.0 - ((y - y_min) / (y_max - y_min))

        v0 = bm.verts.new(Vector((0.0, y, zt)))
        v1 = bm.verts.new(Vector((hw * 0.36, y, zt * 0.70 + zp * 0.30)))
        v2 = bm.verts.new(Vector((hw * 0.62, y, zt * 0.30 + zp * 0.70)))
        v3 = bm.verts.new(Vector((hw * 0.82, y, zp)))
        v4 = bm.verts.new(Vector((hw * 0.95, y, zp * 0.50 + zw * 0.50)))
        v5 = bm.verts.new(Vector((hw * 1.00, y, zw)))

        if is_arch:
            v6 = bm.verts.new(Vector((hw * 0.96, y, za)))
            v7 = bm.verts.new(Vector((hw * 0.84, y, za - 0.03)))
        else:
            v6 = bm.verts.new(Vector((hw * 0.94, y, zw * 0.50 + zb * 0.50)))
            v7 = bm.verts.new(Vector((hw * 0.72, y, zb)))

        v8 = bm.verts.new(Vector((0.0, y, zb)))

        if is_arch:
            v9  = bm.verts.new(Vector((-hw * 0.84, y, za - 0.03)))
            v10 = bm.verts.new(Vector((-hw * 0.96, y, za)))
        else:
            v9  = bm.verts.new(Vector((-hw * 0.72, y, zb)))
            v10 = bm.verts.new(Vector((-hw * 0.94, y, zw * 0.50 + zb * 0.50)))

        v11 = bm.verts.new(Vector((-hw * 1.00, y, zw)))
        v12 = bm.verts.new(Vector((-hw * 0.95, y, zp * 0.50 + zw * 0.50)))
        v13 = bm.verts.new(Vector((-hw * 0.82, y, zp)))
        v14 = bm.verts.new(Vector((-hw * 0.62, y, zt * 0.30 + zp * 0.70)))
        v15 = bm.verts.new(Vector((-hw * 0.36, y, zt * 0.70 + zp * 0.30)))

        verts_16 = [v0, v1, v2, v3, v4, v5, v6, v7, v8, v9, v10, v11, v12, v13, v14, v15]
        loop.extend(verts_16)
        for w_idx in range(16):
            uv_loop.append(Vector((u_weights[w_idx], v_coord)))

        ring_verts.append(loop)
        ring_uvs.append(uv_loop)

    uv_layer = bm.loops.layers.uv.new("UVMap")

    # Bridge rings into quads
    for i in range(len(ring_verts) - 1):
        r1, r2 = ring_verts[i], ring_verts[i + 1]
        uv1, uv2 = ring_uvs[i], ring_uvs[i + 1]
        for j in range(16):
            j_next = (j + 1) % 16
            f = bm.faces.new([r1[j], r1[j_next], r2[j_next], r2[j]])
            f.material_index = 0
            f.loops[0][uv_layer].uv = uv1[j]
            f.loops[1][uv_layer].uv = uv1[j_next]
            f.loops[2][uv_layer].uv = uv2[j_next]
            f.loops[3][uv_layer].uv = uv2[j]

    # Front quad cap
    f_cap = ring_verts[0]
    f_uvs = ring_uvs[0]
    f_center = bm.verts.new(Vector((0.0, sections[0]["y"] - 0.04, (sections[0]["zb"] + sections[0]["zt"]) * 0.5)))
    for j in range(16):
        j_next = (j + 1) % 16
        f = bm.faces.new([f_cap[j_next], f_cap[j], f_center])
        f.material_index = 0
        f.loops[0][uv_layer].uv = f_uvs[j_next]
        f.loops[1][uv_layer].uv = f_uvs[j]
        f.loops[2][uv_layer].uv = Vector((0.50, 1.00))

    # Rear quad cap
    r_cap = ring_verts[-1]
    r_uvs = ring_uvs[-1]
    r_center = bm.verts.new(Vector((0.0, sections[-1]["y"] + 0.04, (sections[-1]["zb"] + sections[-1]["zt"]) * 0.5)))
    for j in range(16):
        j_next = (j + 1) % 16
        f = bm.faces.new([r_cap[j], r_cap[j_next], r_center])
        f.material_index = 0
        f.loops[0][uv_layer].uv = r_uvs[j]
        f.loops[1][uv_layer].uv = r_uvs[j_next]
        f.loops[2][uv_layer].uv = Vector((0.50, 0.00))

def build_single_wheel(name, car_root, mats, car_type, pos, is_front):
    sign_x = -1 if pos.x < 0 else 1
    w_mesh = bpy.data.meshes.new(f"{name}_Mesh")
    w_obj = bpy.data.objects.new(name, w_mesh)
    w_obj.location = pos
    bpy.context.collection.objects.link(w_obj)
    w_obj.parent = car_root

    bm = bmesh.new()
    rot = Euler((0, math.radians(90), 0))

    radius = 0.29 if car_type in ['hood_bear', 'hood_bull', 'gme_ape'] else (0.27 if car_type == 'tsla_racer' else 0.28)
    width = 0.23 if car_type == 'gme_ape' else (0.22 if car_type in ['hood_bear', 'hood_bull'] else (0.20 if car_type == 'tsla_racer' else 0.21))

    # 1. Tire Rubber (Slot 0: TireRubber)
    res_t = make_cylinder(bm, cap_ends=True, cap_tris=False, segments=24, radius=radius, depth=width, matrix=make_transform(Vector((0, 0, 0)), rot_euler=rot))
    set_mat_for_verts(res_t['verts'], 0)

    # 2. Main Rim Surface (Slot 1: Wheel PBR)
    rim_rad = radius * 0.72
    rim_depth = width * 0.70 if car_type == 'hood_bull' else width * 0.88
    rim_offset_x = -sign_x * 0.020 if car_type == 'hood_bull' else sign_x * 0.015
    res_r = make_cylinder(bm, cap_ends=True, cap_tris=False, segments=24, radius=rim_rad, depth=rim_depth, matrix=make_transform(Vector((rim_offset_x, 0, 0)), rot_euler=rot))
    set_mat_for_verts(res_r['verts'], 1)

    # 3. Brake Rotor Disc (Slot 2: BrakeDisc)
    res_d = make_cylinder(bm, cap_ends=True, cap_tris=False, segments=16, radius=radius * 0.52, depth=0.03, matrix=make_transform(Vector((-sign_x * 0.02, 0, 0)), rot_euler=rot))
    set_mat_for_verts(res_d['verts'], 2)

    # 4. Brake Caliper (Slot 3: Caliper Mat)
    cal_slot = 3
    res_cal = bmesh.ops.create_cube(bm, size=1.0, matrix=make_transform(Vector((-sign_x * 0.015, 0.0, radius * 0.40)), (0.04, 0.10, 0.08)))
    set_mat_for_verts(res_cal['verts'], cal_slot)

    # Archetype Custom Rim Elements (Slot 4: Custom Accent)
    if car_type == 'hood_bull':
        # 5 Sculpted Chrome Star Spokes (proudly visible on outer rim face)
        sp_len = rim_rad * 0.82
        r_mid = sp_len * 0.48
        for sp_i in range(5):
            a_deg = sp_i * 72
            rad = math.radians(a_deg)
            sp_pos = Vector((
                sign_x * (width * 0.44),
                math.sin(rad) * r_mid,
                math.cos(rad) * r_mid,
            ))
            sp_rot = Euler((-rad, 0, 0))
            res_sp = bmesh.ops.create_cube(
                bm,
                size=1.0,
                matrix=make_transform(
                    sp_pos,
                    (0.024, 0.036, sp_len),
                    rot_euler=sp_rot,
                ),
            )
            set_mat_for_verts(res_sp['verts'], 4)  # Chrome

        # Center Chrome Hub Cap with Bull Accent
        res_hub = make_cylinder(
            bm, radius=rim_rad * 0.28, depth=0.030, segments=16,
            matrix=make_transform(Vector((sign_x * (width * 0.46), 0, 0)), rot_euler=rot)
        )
        set_mat_for_verts(res_hub['verts'], 4)  # Chrome

        # Glowing Lucky Green outer rim lip
        res_lip = make_cylinder(
            bm, radius=rim_rad * 0.96, depth=0.020, segments=24,
            matrix=make_transform(Vector((sign_x * (width * 0.47), 0, 0)), rot_euler=rot)
        )
        set_mat_for_verts(res_lip['verts'], 5)  # NeonAccent
    elif car_type == 'hood_bear':
        # Heavy 6-bolt industrial beadlock ring
        for b_i in range(6):
            a_deg = b_i * 60
            bx = math.cos(math.radians(a_deg)) * (rim_rad * 0.76)
            by = math.sin(math.radians(a_deg)) * (rim_rad * 0.76)
            res_b = bmesh.ops.create_cube(bm, size=1.0, matrix=make_transform(Vector((sign_x * (width * 0.46), bx, by)), (0.02, 0.028, 0.028)))
            set_mat_for_verts(res_b['verts'], 4)
    elif car_type == 'tsla_racer':
        # Turbofan aero disc with cyan rim ring
        res_ad = make_cylinder(bm, cap_ends=True, cap_tris=False, segments=24, radius=rim_rad * 0.94, depth=0.018, matrix=make_transform(Vector((sign_x * (width * 0.48), 0, 0)), rot_euler=rot))
        set_mat_for_verts(res_ad['verts'], 4)
        # 12 directional aerodynamic cooling vanes
        for v_i in range(12):
            a_deg = v_i * 30
            v_rad = math.radians(a_deg)
            vx = math.cos(v_rad) * (rim_rad * 0.65)
            vy = math.sin(v_rad) * (rim_rad * 0.65)
            v_rot = Euler((0, math.radians(90), v_rad + math.radians(18)))
            res_v = bmesh.ops.create_cube(bm, size=1.0, matrix=make_transform(Vector((sign_x * (width * 0.495), vx, vy)), (0.012, 0.05, 0.012), rot_euler=v_rot))
            set_mat_for_verts(res_v['verts'], 1)
        # Center aero hub cap with cyan accent
        res_hub = make_cylinder(bm, cap_ends=True, cap_tris=False, segments=16, radius=rim_rad * 0.28, depth=0.024, matrix=make_transform(Vector((sign_x * (width * 0.50), 0, 0)), rot_euler=rot))
        set_mat_for_verts(res_hub['verts'], 4)
    elif car_type == 'nvda_ai':
        # Directional carbon composite turbine blades & lime speed ring
        # 1. Outer radioactive lime speed ring
        res_ring = make_cylinder(bm, cap_ends=True, cap_tris=False, segments=24, radius=rim_rad * 0.94, depth=0.015, matrix=make_transform(Vector((sign_x * (width * 0.48), 0, 0)), rot_euler=rot))
        set_mat_for_verts(res_ring['verts'], 4) # LimeAccent
        # 2. 6 directional carbon composite turbine blades
        for b_i in range(6):
            a_deg = b_i * 60
            b_rad = math.radians(a_deg)
            bx = math.cos(b_rad) * (rim_rad * 0.60)
            by = math.sin(b_rad) * (rim_rad * 0.60)
            b_rot = Euler((0, math.radians(90), b_rad + math.radians(22)))
            res_b = bmesh.ops.create_cube(bm, size=1.0, matrix=make_transform(Vector((sign_x * (width * 0.49), bx, by)), (0.014, 0.07, 0.016), rot_euler=b_rot))
            set_mat_for_verts(res_b['verts'], 1) # Wheel
        # 3. Center purple anodized hex lock nut
        res_hx = make_cylinder(bm, cap_ends=True, cap_tris=False, segments=6, radius=rim_rad * 0.32, depth=0.024, matrix=make_transform(Vector((sign_x * (width * 0.50), 0, 0)), rot_euler=rot))
        set_mat_for_verts(res_hx['verts'], 5) # PurpleAccent
    elif car_type == 'gold_whale':
        # 24K Gold multi-wire spokes
        for sp_i in range(12):
            a_deg = sp_i * 30
            sp_rot = Euler((math.radians(a_deg), math.radians(90), 0))
            res_sp = bmesh.ops.create_cube(bm, size=1.0, matrix=make_transform(Vector((sign_x * (width * 0.44), 0, 0)), (0.015, rim_rad * 1.8, 0.018), rot_euler=sp_rot))
            set_mat_for_verts(res_sp['verts'], 4)
    elif car_type == 'gme_ape':
        # 5 Deep Muscle Mag Spokes
        sp_len = rim_rad * 0.84
        r_mid = sp_len * 0.48
        for sp_i in range(5):
            a_deg = sp_i * 72
            rad = math.radians(a_deg)
            sp_pos = Vector((
                sign_x * (width * 0.44),
                math.sin(rad) * r_mid,
                math.cos(rad) * r_mid,
            ))
            sp_rot = Euler((-rad, 0, 0))
            res_sp = bmesh.ops.create_cube(
                bm,
                size=1.0,
                matrix=make_transform(
                    sp_pos,
                    (0.026, 0.040, sp_len),
                    rot_euler=sp_rot,
                ),
            )
            set_mat_for_verts(res_sp['verts'], 4)  # Chrome
        # Center Chrome Cap with Red Accent Ring
        res_hub = make_cylinder(
            bm, radius=rim_rad * 0.30, depth=0.035, segments=16,
            matrix=make_transform(Vector((sign_x * (width * 0.46), 0, 0)), rot_euler=rot)
        )
        set_mat_for_verts(res_hub['verts'], 4)  # Chrome
        # Outer Polished Chrome Lip
        res_lip = make_cylinder(
            bm, radius=rim_rad * 0.98, depth=0.022, segments=24,
            matrix=make_transform(Vector((sign_x * (width * 0.47), 0, 0)), rot_euler=rot)
        )
        set_mat_for_verts(res_lip['verts'], 4)  # Chrome
    elif car_type == 'doge_kart':
        # 6 Heavy Tubular Buggy Spokes & Gold Powder-Coated Beadlock Ring
        sp_len = rim_rad * 0.82
        r_mid = sp_len * 0.48
        for sp_i in range(6):
            a_deg = sp_i * 60
            rad = math.radians(a_deg)
            sp_pos = Vector((
                sign_x * (width * 0.44),
                math.sin(rad) * r_mid,
                math.cos(rad) * r_mid,
            ))
            sp_rot = Euler((-rad, 0, 0))
            res_sp = bmesh.ops.create_cube(
                bm,
                size=1.0,
                matrix=make_transform(
                    sp_pos,
                    (0.024, 0.038, sp_len),
                    rot_euler=sp_rot,
                ),
            )
            set_mat_for_verts(res_sp['verts'], 1)  # Wheel (Dark Graphite)
        # Gold Powder-Coated Beadlock Ring & 8 Steel Bolts
        res_bd = make_cylinder(
            bm, radius=rim_rad * 0.94, depth=0.024, segments=24,
            matrix=make_transform(Vector((sign_x * (width * 0.46), 0, 0)), rot_euler=rot)
        )
        set_mat_for_verts(res_bd['verts'], 4)  # Gold Accent / Chrome
        for b_i in range(8):
            a_deg = b_i * 45
            bx = math.cos(math.radians(a_deg)) * (rim_rad * 0.88)
            by = math.sin(math.radians(a_deg)) * (rim_rad * 0.88)
            res_b = bmesh.ops.create_cube(bm, size=1.0, matrix=make_transform(Vector((sign_x * (width * 0.48), bx, by)), (0.015, 0.024, 0.024)))
            set_mat_for_verts(res_b['verts'], 4)
        # Center Dogecoin Hub
        res_hub = make_cylinder(
            bm, radius=rim_rad * 0.32, depth=0.032, segments=16,
            matrix=make_transform(Vector((sign_x * (width * 0.47), 0, 0)), rot_euler=rot)
        )
        set_mat_for_verts(res_hub['verts'], 4)

    bm.to_mesh(w_mesh)
    bm.free()

    w_obj.data.materials.append(mats['TireRubber'])   # 0
    w_obj.data.materials.append(mats['Wheel'])        # 1
    w_obj.data.materials.append(mats['BrakeDisc'])    # 2

    if car_type == 'hood_bull':
        w_obj.data.materials.append(mats['GreenCaliper']) # 3
        w_obj.data.materials.append(mats['Chrome'])       # 4
        w_obj.data.materials.append(mats['NeonAccent'])   # 5
    elif car_type == 'hood_bear':
        w_obj.data.materials.append(mats['RedCaliper'])
        w_obj.data.materials.append(mats['DarkMetal'])
    elif car_type == 'tsla_racer':
        w_obj.data.materials.append(mats['CyanCaliper'])
        w_obj.data.materials.append(mats['NeonAccent'])
    elif car_type == 'nvda_ai':
        w_obj.data.materials.append(mats['LimeCaliper'])
        w_obj.data.materials.append(mats['LimeAccent'])
        w_obj.data.materials.append(mats['PurpleAccent'])
    elif car_type == 'gold_whale':
        w_obj.data.materials.append(mats['GoldCaliper'])
        w_obj.data.materials.append(mats['Gold'])
    elif car_type == 'gme_ape':
        w_obj.data.materials.append(mats['RedCaliper'])   # 3
        w_obj.data.materials.append(mats['Chrome'])       # 4
        w_obj.data.materials.append(mats['NeonAccent'])   # 5

    return w_obj


# =============================================================================
# 0. HOOD BULL (HERO GT SPORTS CAR / BALANCED ALL-ROUNDER)
# =============================================================================
def build_hood_bull_model():
    print("=== Building AAA HOOD BULL (Hero GT Sports Car) Model ===")
    clean_scene()
    mats = setup_materials_for_car('hood_bull', (0.0, 1.0, 0.42))
    car_root = bpy.data.objects.new("CarRoot", None)
    bpy.context.collection.objects.link(car_root)

    track = 0.84
    wheelbase = 0.76

    # 1. SCULPTED GT SPORTS CAR ATHLETIC BODY SHELL (20 CROSS-SECTIONS)
    body_mesh = bpy.data.meshes.new("BodyMesh")
    body_obj = bpy.data.objects.new("Body", body_mesh)
    bpy.context.collection.objects.link(body_obj)
    body_obj.parent = car_root
    bm = bmesh.new()

    sections = [
        # Front nose tip — sits at Z=0.24 above bumper shelf
        {"y": -1.24, "hw": 0.54, "zt": 0.54, "zp": 0.52, "zw": 0.40, "zb": 0.24},
        {"y": -1.14, "hw": 0.68, "zt": 0.60, "zp": 0.58, "zw": 0.45, "zb": 0.24},
        {"y": -1.02, "hw": 0.80, "zt": 0.68, "zp": 0.65, "zw": 0.50, "zb": 0.24},
        # Hood rising
        {"y": -0.88, "hw": 0.88, "zt": 0.74, "zp": 0.71, "zw": 0.55, "zb": 0.24},
        {"y": -0.74, "hw": 0.90, "zt": 0.77, "zp": 0.73, "zw": 0.57, "zb": 0.24},
        {"y": -0.58, "hw": 0.90, "zt": 0.78, "zp": 0.74, "zw": 0.58, "zb": 0.24},  # Hood peak
        # Hood slope toward cockpit
        {"y": -0.42, "hw": 0.88, "zt": 0.73, "zp": 0.71, "zw": 0.56, "zb": 0.24},
        {"y": -0.26, "hw": 0.88, "zt": 0.62, "zp": 0.68, "zw": 0.54, "zb": 0.24},  # Cockpit front sill
        # Deep open cockpit tub — zt drops sharply while panel shoulders stay high
        {"y": -0.12, "hw": 0.88, "zt": 0.46, "zp": 0.67, "zw": 0.53, "zb": 0.24},
        {"y":  0.02, "hw": 0.88, "zt": 0.43, "zp": 0.66, "zw": 0.53, "zb": 0.24},  # Deepest tub
        {"y":  0.18, "hw": 0.88, "zt": 0.45, "zp": 0.67, "zw": 0.53, "zb": 0.24},
        {"y":  0.32, "hw": 0.88, "zt": 0.52, "zp": 0.68, "zw": 0.54, "zb": 0.24},  # Cockpit rear sill
        # Rear deck rising
        {"y":  0.46, "hw": 0.90, "zt": 0.68, "zp": 0.72, "zw": 0.56, "zb": 0.24},
        {"y":  0.60, "hw": 0.92, "zt": 0.73, "zp": 0.74, "zw": 0.58, "zb": 0.24},  # Rear haunch peak
        {"y":  0.74, "hw": 0.92, "zt": 0.74, "zp": 0.74, "zw": 0.58, "zb": 0.24},
        {"y":  0.88, "hw": 0.88, "zt": 0.72, "zp": 0.72, "zw": 0.56, "zb": 0.24},
        # Transom narrowing
        {"y":  1.00, "hw": 0.82, "zt": 0.68, "zp": 0.68, "zw": 0.54, "zb": 0.24},
        {"y":  1.10, "hw": 0.74, "zt": 0.64, "zp": 0.64, "zw": 0.50, "zb": 0.24},
        {"y":  1.18, "hw": 0.64, "zt": 0.60, "zp": 0.60, "zw": 0.46, "zb": 0.24},
        {"y":  1.24, "hw": 0.54, "zt": 0.56, "zp": 0.56, "zw": 0.42, "zb": 0.24},  # Rear tip
    ]

    build_quad_body_shell(bm, sections, wheelbase, -1.24, 1.24, arch_rad=0.35)

    # Hood center carbon intake scoop
    res_ridge = bmesh.ops.create_cube(
        bm, size=1.0,
        matrix=make_transform(
            Vector((0.0, -0.78, 0.795)),
            (0.18, 0.52, 0.028),
            Euler((math.radians(-6), 0, 0))
        )
    )
    set_mat_for_verts(res_ridge["verts"], 1)  # Carbon

    # Rear integrated ducktail lip
    res_duck = bmesh.ops.create_cube(
        bm, size=1.0,
        matrix=make_transform(
            Vector((0.0, 1.20, 0.68)),
            (0.80, 0.08, 0.038),
            Euler((math.radians(24), 0, 0))
        )
    )
    set_mat_for_verts(res_duck["verts"], 0)  # BodyPaint

    # Twin Cowl Bull Horn ornaments on the hood (x = \pm 0.28m)
    for sign_x in [-1, 1]:
        horn_cowl_rot = Euler((math.radians(-12), math.radians(sign_x * 18), math.radians(sign_x * -10)))
        res_chorn = bmesh.ops.create_cone(
            bm, cap_ends=True, cap_tris=False, segments=12,
            radius1=0.032, radius2=0.006, depth=0.18,
            matrix=make_transform(Vector((sign_x * 0.28, -0.56, 0.79)), rot_euler=horn_cowl_rot)
        )
        set_mat_for_verts(res_chorn['verts'], 2)  # Gold

    bm.to_mesh(body_mesh)
    bm.free()
    body_obj.data.materials.append(mats["BodyPaint"])  # 0
    body_obj.data.materials.append(mats["Carbon"])     # 1
    body_obj.data.materials.append(mats["Gold"])       # 2

    sub = body_obj.modifiers.new(name="Subdivision", type="SUBSURF")
    sub.levels = 2
    sub.render_levels = 2
    for poly in body_obj.data.polygons:
        poly.use_smooth = True

    # 2. BUMPER — Wrap-around amusement park rubber collar with recessed Lucky Green neon channel
    bumper_pts = [
        Vector((0.00, -1.36, 0.18)),  # Front nose center
        Vector((0.44, -1.32, 0.18)),
        Vector((0.82, -1.18, 0.18)),  # Front corner
        Vector((0.98, -0.86, 0.18)),
        Vector((1.02, -0.40, 0.18)),  # Side flank (widest point: 2.04m full width)
        Vector((1.02,  0.00, 0.18)),
        Vector((1.02,  0.40, 0.18)),
        Vector((0.98,  0.86, 0.18)),
        Vector((0.82,  1.18, 0.18)),  # Rear corner
        Vector((0.44,  1.32, 0.18)),
        Vector((0.00,  1.36, 0.18)),  # Rear center
    ]
    build_thick_bumper(car_root, mats, bumper_pts, pw=0.090, ph=0.070, neon_slot='NeonAccent')

    # 3. FRONT FASCIA & $85 MONEY DISPLAY
    md_root = bpy.data.objects.new("MoneyDisplay", None)
    bpy.context.collection.objects.link(md_root)
    md_root.parent = car_root

    # Front display box in nose
    f_sc_mesh = bpy.data.meshes.new("FrontMoneyDisplayMesh")
    f_sc_obj = bpy.data.objects.new("FrontMoneyDisplay", f_sc_mesh)
    bpy.context.collection.objects.link(f_sc_obj)
    f_sc_obj.parent = md_root
    bm_fsc = bmesh.new()
    res_ff = bmesh.ops.create_cube(
        bm_fsc, size=1.0,
        matrix=make_transform(Vector((0.0, -1.06, 0.46)), (0.46, 0.06, 0.16), Euler((math.radians(-14), 0, 0)))
    )
    set_mat_for_verts(res_ff['verts'], 0)
    # Non-mirrored UVs from front view (-Y looking towards +Y):
    v1 = bm_fsc.verts.new(Vector(( 0.20, -1.095, 0.39)))
    v2 = bm_fsc.verts.new(Vector((-0.20, -1.095, 0.39)))
    v3 = bm_fsc.verts.new(Vector((-0.20, -1.080, 0.53)))
    v4 = bm_fsc.verts.new(Vector(( 0.20, -1.080, 0.53)))
    f_sc = bm_fsc.faces.new([v1, v2, v3, v4])
    f_sc.material_index = 1
    uv_lf = bm_fsc.loops.layers.uv.new("UVMap")
    for loop, uv in zip(f_sc.loops, [Vector((0, 0)), Vector((1, 0)), Vector((1, 1)), Vector((0, 1))]):
        loop[uv_lf].uv = uv
    bm_fsc.to_mesh(f_sc_mesh)
    bm_fsc.free()
    f_sc_obj.data.materials.append(mats['DarkMetal'])
    f_sc_obj.data.materials.append(mats['Screen'])

    # Rear transom display box ($85)
    r_sc_mesh = bpy.data.meshes.new("RearMoneyDisplayMesh")
    r_sc_obj = bpy.data.objects.new("RearMoneyDisplay", r_sc_mesh)
    bpy.context.collection.objects.link(r_sc_obj)
    r_sc_obj.parent = md_root
    bm_rsc = bmesh.new()
    res_rf = bmesh.ops.create_cube(
        bm_rsc, size=1.0,
        matrix=make_transform(Vector((0.0, 1.20, 0.52)), (0.44, 0.04, 0.14), Euler((math.radians(12), 0, 0)))
    )
    set_mat_for_verts(res_rf['verts'], 0)
    # Rear view (+Y looking towards -Y):
    v1_r = bm_rsc.verts.new(Vector((-0.18, 1.225, 0.46)))
    v2_r = bm_rsc.verts.new(Vector(( 0.18, 1.225, 0.46)))
    v3_r = bm_rsc.verts.new(Vector(( 0.18, 1.220, 0.58)))
    v4_r = bm_rsc.verts.new(Vector((-0.18, 1.220, 0.58)))
    f_rsc = bm_rsc.faces.new([v1_r, v2_r, v3_r, v4_r])
    f_rsc.material_index = 1
    uv_lr = bm_rsc.loops.layers.uv.new("UVMap")
    for loop, uv in zip(f_rsc.loops, [Vector((0, 0)), Vector((1, 0)), Vector((1, 1)), Vector((0, 1))]):
        loop[uv_lr].uv = uv
    bm_rsc.to_mesh(r_sc_mesh)
    bm_rsc.free()
    r_sc_obj.data.materials.append(mats['DarkMetal'])
    r_sc_obj.data.materials.append(mats['Screen'])

    # Recessed lower GT intake grille below front screen
    f_gr_mesh = bpy.data.meshes.new("LowerGrilleMesh")
    f_gr_obj = bpy.data.objects.new("LowerGrille", f_gr_mesh)
    bpy.context.collection.objects.link(f_gr_obj)
    f_gr_obj.parent = car_root
    bm_gr = bmesh.new()
    res_gr = bmesh.ops.create_cube(
        bm_gr, size=1.0,
        matrix=make_transform(Vector((0.0, -1.20, 0.30)), (0.54, 0.05, 0.08))
    )
    set_mat_for_verts(res_gr["verts"], 0)
    bm_gr.to_mesh(f_gr_mesh)
    bm_gr.free()
    f_gr_obj.data.materials.append(mats["DarkMetal"])

    # 4. HEADLIGHTS (L + R) — angled dual-projector buckets + amber DRL brows + glass covers
    for sign, side in [(-1, "L"), (1, "R")]:
        hl_mesh = bpy.data.meshes.new(f"Headlight_{side}_Mesh")
        hl_obj = bpy.data.objects.new(f"Headlight_{side}", hl_mesh)
        hl_obj.location = Vector((sign * 0.38, -1.16, 0.48))
        bpy.context.collection.objects.link(hl_obj)
        hl_obj.parent = car_root
        bm_hl = bmesh.new()

        hl_rot = Euler((math.radians(-10), math.radians(sign * -14), 0))
        # Recessed dark bucket
        res_bk = bmesh.ops.create_cube(
            bm_hl, size=1.0,
            matrix=make_transform(Vector((0, 0, 0)), (0.24, 0.06, 0.13), rot_euler=hl_rot)
        )
        set_mat_for_verts(res_bk["verts"], 0)

        # Dual projector bulbs
        res_p1 = make_cylinder(
            bm_hl, radius=0.038, depth=0.045, segments=14,
            matrix=make_transform(Vector((-sign * 0.045, -0.02, 0.01)), rot_euler=Euler((math.radians(80), 0, 0)))
        )
        res_p2 = make_cylinder(
            bm_hl, radius=0.032, depth=0.045, segments=14,
            matrix=make_transform(Vector(( sign * 0.045, -0.02, 0.01)), rot_euler=Euler((math.radians(80), 0, 0)))
        )
        set_mat_for_verts(res_p1["verts"] + res_p2["verts"], 1)

        # Amber DRL brow above
        res_drl = bmesh.ops.create_cube(
            bm_hl, size=1.0,
            matrix=make_transform(Vector((0, -0.028, 0.052)), (0.22, 0.018, 0.018), rot_euler=hl_rot)
        )
        set_mat_for_verts(res_drl["verts"], 2)

        # Transparent glass cover
        res_lens = bmesh.ops.create_cube(
            bm_hl, size=1.0,
            matrix=make_transform(Vector((0, -0.038, 0.005)), (0.23, 0.010, 0.12), rot_euler=hl_rot)
        )
        set_mat_for_verts(res_lens["verts"], 3)

        bm_hl.to_mesh(hl_mesh)
        bm_hl.free()
        hl_obj.data.materials.append(mats["DarkMetal"])  # 0
        hl_obj.data.materials.append(mats["Headlight"])  # 1
        hl_obj.data.materials.append(mats["AmberDRL"])   # 2
        hl_obj.data.materials.append(mats["Glass"])      # 3

    # 5. TAILLIGHTS (L + R) & REAR DUAL TWIN EXHAUSTS
    for sign, side in [(-1, "L"), (1, "R")]:
        tl_mesh = bpy.data.meshes.new(f"TailLight_{side}_Mesh")
        tl_obj = bpy.data.objects.new(f"TailLight_{side}", tl_mesh)
        tl_obj.location = Vector((sign * 0.42, 1.18, 0.58))
        bpy.context.collection.objects.link(tl_obj)
        tl_obj.parent = car_root
        bm_tl = bmesh.new()

        tl_rot = Euler((math.radians(12), math.radians(sign * 10), 0))
        res_tl = bmesh.ops.create_cube(
            bm_tl, size=1.0,
            matrix=make_transform(Vector((0, 0, 0)), (0.22, 0.05, 0.10), rot_euler=tl_rot)
        )
        set_mat_for_verts(res_tl["verts"], 0)

        bm_tl.to_mesh(tl_mesh)
        bm_tl.free()
        tl_obj.data.materials.append(mats["Taillight"])

    # Dual twin stainless exhaust pipes
    ex_mesh = bpy.data.meshes.new("ExhaustPipesMesh")
    ex_obj = bpy.data.objects.new("ExhaustPipes", ex_mesh)
    bpy.context.collection.objects.link(ex_obj)
    ex_obj.parent = car_root
    bm_ex = bmesh.new()
    for sign_x in [-1, 1]:
        for e_off in [-0.04, 0.04]:
            res_ex = make_cylinder(
                bm_ex, radius=0.032, depth=0.14, segments=14,
                matrix=make_transform(Vector((sign_x * 0.32 + e_off, 1.26, 0.28)), rot_euler=Euler((math.radians(90), 0, 0)))
            )
            set_mat_for_verts(res_ex['verts'], 0)
    bm_ex.to_mesh(ex_mesh)
    bm_ex.free()
    ex_obj.data.materials.append(mats['Chrome'])

    # 6. COCKPIT — open tub with sport seat, rollover headrest nacelle, bull-horn steering wheel
    cp_mesh = bpy.data.meshes.new("CockpitMesh")
    cp_obj = bpy.data.objects.new("Cockpit", cp_mesh)
    bpy.context.collection.objects.link(cp_obj)
    cp_obj.parent = car_root
    bm_cp = bmesh.new()

    # Tub floor
    res_tub = bmesh.ops.create_cube(
        bm_cp, size=1.0,
        matrix=make_transform(Vector((0.0, 0.04, 0.36)), (0.72, 0.70, 0.14))
    )
    set_mat_for_verts(res_tub["verts"], 0)

    # Racing bucket seat shell
    res_seat = bmesh.ops.create_cube(
        bm_cp, size=1.0,
        matrix=make_transform(
            Vector((0.0, 0.28, 0.68)),
            (0.48, 0.12, 0.46),
            Euler((math.radians(12), 0, 0))
        )
    )
    res_sit = bmesh.ops.create_cube(
        bm_cp, size=1.0,
        matrix=make_transform(Vector((0.0, 0.08, 0.46)), (0.44, 0.38, 0.09))
    )
    set_mat_for_verts(res_seat["verts"] + res_sit["verts"], 0)

    # Rollover Headrest Nacelle behind seat
    res_nac = bmesh.ops.create_uvsphere(
        bm_cp, u_segments=14, v_segments=10, radius=0.18,
        matrix=make_transform(Vector((0.0, 0.38, 0.84)), (1.0, 0.65, 0.75))
    )
    set_mat_for_verts(res_nac["verts"], 0)

    # Dashboard panel
    res_dash = bmesh.ops.create_cube(
        bm_cp, size=1.0,
        matrix=make_transform(
            Vector((0.0, -0.20, 0.56)),
            (0.62, 0.10, 0.10),
            Euler((math.radians(-18), 0, 0))
        )
    )
    set_mat_for_verts(res_dash["verts"], 0)

    # Bull-horn sport steering yoke
    res_sw = make_cylinder(
        bm_cp, radius=0.13, depth=0.024, segments=18,
        matrix=make_transform(Vector((0.0, -0.12, 0.68)), rot_euler=Euler((math.radians(30), 0, 0)))
    )
    set_mat_for_verts(res_sw["verts"], 1)

    res_col = make_cylinder(
        bm_cp, radius=0.018, depth=0.26, segments=10,
        matrix=make_transform(Vector((0.0, -0.06, 0.58)), rot_euler=Euler((math.radians(30), 0, 0)))
    )
    set_mat_for_verts(res_col["verts"], 1)

    # Bull horn grips on steering wheel
    for sign in [-1, 1]:
        res_yoke = bmesh.ops.create_cube(
            bm_cp, size=1.0,
            matrix=make_transform(
                Vector((sign * 0.065, -0.12, 0.68)),
                (0.02, 0.12, 0.06),
                Euler((math.radians(30), 0, math.radians(sign * 20)))
            )
        )
        set_mat_for_verts(res_yoke["verts"], 2)  # BullHorn

    bm_cp.to_mesh(cp_mesh)
    bm_cp.free()
    cp_obj.data.materials.append(mats["Carbon"])     # 0
    cp_obj.data.materials.append(mats["DarkMetal"])  # 1
    cp_obj.data.materials.append(mats["BullHorn"])   # 2

    # 7. DRIVER — Charismatic Muscular Bull Mascot
    d_mesh = bpy.data.meshes.new("Driver_Mesh")
    d_obj = bpy.data.objects.new("Driver", d_mesh)
    bpy.context.collection.objects.link(d_obj)
    d_obj.parent = car_root
    bm_d = bmesh.new()

    # Torso in graphite racing suit
    res_torso = bmesh.ops.create_uvsphere(
        bm_d, u_segments=16, v_segments=12, radius=0.22,
        matrix=make_transform(Vector((0.0, 0.08, 0.60)), (1.05, 0.80, 0.85))
    )
    set_mat_for_verts(res_torso["verts"], 0)  # RacingSuit

    # Racing suit white shoulder stripes
    for sign in [-1, 1]:
        res_strap = bmesh.ops.create_cube(
            bm_d, size=1.0,
            matrix=make_transform(Vector((sign * 0.12, 0.06, 0.68)), (0.04, 0.22, 0.024))
        )
        set_mat_for_verts(res_strap["verts"], 1)  # Chrome

    # Bull Head Sphere
    res_head = bmesh.ops.create_uvsphere(
        bm_d, u_segments=18, v_segments=14, radius=0.175,
        matrix=make_transform(Vector((0.0, 0.02, 0.90)))
    )
    set_mat_for_verts(res_head["verts"], 2)  # BullSkin

    # Rounded Bull Snout (muzzle)
    res_snout = bmesh.ops.create_uvsphere(
        bm_d, u_segments=14, v_segments=10, radius=0.11,
        matrix=make_transform(Vector((0.0, -0.12, 0.86)), (1.05, 0.85, 0.75))
    )
    set_mat_for_verts(res_snout["verts"], 3)  # BullSnout

    # Nostrils
    for sign in [-1, 1]:
        res_nos = bmesh.ops.create_cube(
            bm_d, size=1.0,
            matrix=make_transform(Vector((sign * 0.045, -0.185, 0.86)), (0.025, 0.02, 0.035))
        )
        set_mat_for_verts(res_nos["verts"], 9)  # DarkMetal

    # Glowing Gold Septum Nose Ring
    nr_rot = Euler((math.radians(90), 0, 0))
    res_nr = make_cylinder(
        bm_d, radius=0.038, depth=0.012, segments=16,
        matrix=make_transform(Vector((0.0, -0.19, 0.82)), rot_euler=nr_rot)
    )
    set_mat_for_verts(res_nr["verts"], 4)  # NoseRing (Gold)

    # Drooping Bull Ears below the horns
    for sign in [-1, 1]:
        ear_rot = Euler((math.radians(-10), math.radians(sign * 25), math.radians(sign * -15)))
        res_ear = bmesh.ops.create_uvsphere(
            bm_d, u_segments=12, v_segments=8, radius=0.075,
            matrix=make_transform(Vector((sign * 0.17, 0.04, 0.96)), (1.1, 0.6, 0.5), rot_euler=ear_rot)
        )
        set_mat_for_verts(res_ear["verts"], 2)  # BullSkin

    # Smooth 3D Curved Bull Horns (Outward, Forward, Hooking Upward)
    horn_pts_right = [
        (Vector(( 0.10, -0.03, 1.02)), 0.042, 5),  # base (BullHorn)
        (Vector(( 0.16, -0.06, 1.07)), 0.035, 5),  # outward-forward sweep
        (Vector(( 0.21, -0.06, 1.14)), 0.027, 5),  # mid arc
        (Vector(( 0.22, -0.03, 1.20)), 0.018, 6),  # upward hook (BullHornTip)
        (Vector(( 0.18,  0.01, 1.25)), 0.007, 6),  # sharp tip
    ]
    for sign in [-1, 1]:
        rings = []
        for pt, r, m_idx in horn_pts_right:
            loop = []
            cx = sign * pt.x
            cy = pt.y
            cz = pt.z
            for a_idx in range(8):
                a_rad = math.radians(a_idx * 45)
                vx = cx + math.cos(a_rad) * r
                vz = cz + math.sin(a_rad) * r
                loop.append(bm_d.verts.new(Vector((vx, cy, vz))))
            rings.append((loop, m_idx))

        for r_i in range(len(rings) - 1):
            r1, m_i = rings[r_i]
            r2, _   = rings[r_i + 1]
            for j in range(8):
                jn = (j + 1) % 8
                f = bm_d.faces.new([r1[j], r1[jn], r2[jn], r2[j]])
                f.material_index = m_i

        tip_r, tip_m = rings[-1]
        tip_v = bm_d.verts.new(Vector((sign * 0.16, 0.02, 1.27)))
        for j in range(8):
            jn = (j + 1) % 8
            f = bm_d.faces.new([tip_r[jn], tip_r[j], tip_v])
            f.material_index = tip_m

    # Aviator Sunglasses with Dark Mirror Lenses & Gold Wire Frame
    for sign in [-1, 1]:
        lens_rot = Euler((math.radians(10), math.radians(sign * 6), 0))
        res_lens = bmesh.ops.create_uvsphere(
            bm_d, u_segments=14, v_segments=10, radius=0.048,
            matrix=make_transform(Vector((sign * 0.066, -0.155, 0.94)), (1.0, 0.20, 0.85), rot_euler=lens_rot)
        )
        set_mat_for_verts(res_lens["verts"], 7)  # Sunglasses

        res_frm = make_cylinder(
            bm_d, radius=0.052, depth=0.012, segments=16,
            matrix=make_transform(Vector((sign * 0.066, -0.154, 0.94)), rot_euler=Euler((math.radians(80), 0, 0)))
        )
        set_mat_for_verts(res_frm["verts"], 8)  # Gold wire frame

    res_br1 = make_cylinder(
        bm_d, radius=0.005, depth=0.065, segments=8,
        matrix=make_transform(Vector((0.0, -0.158, 0.965)), rot_euler=Euler((0, math.radians(90), 0)))
    )
    res_br2 = make_cylinder(
        bm_d, radius=0.005, depth=0.065, segments=8,
        matrix=make_transform(Vector((0.0, -0.158, 0.945)), rot_euler=Euler((0, math.radians(90), 0)))
    )
    set_mat_for_verts(res_br1["verts"] + res_br2["verts"], 8)  # Gold

    for sign in [-1, 1]:
        res_tarm = make_cylinder(
            bm_d, radius=0.005, depth=0.18, segments=8,
            matrix=make_transform(Vector((sign * 0.12, -0.06, 0.95)), rot_euler=Euler((math.radians(90), math.radians(sign * 18), 0)))
        )
        set_mat_for_verts(res_tarm["verts"], 8)  # Gold

    bm_d.to_mesh(d_mesh)
    bm_d.free()
    d_obj.data.materials.append(mats["RacingSuit"])   # 0
    d_obj.data.materials.append(mats["Chrome"])       # 1
    d_obj.data.materials.append(mats["BullSkin"])     # 2
    d_obj.data.materials.append(mats["BullSnout"])    # 3
    d_obj.data.materials.append(mats["NoseRing"])     # 4
    d_obj.data.materials.append(mats["BullHorn"])     # 5
    d_obj.data.materials.append(mats["BullHornTip"])  # 6
    d_obj.data.materials.append(mats["Sunglasses"])   # 7
    d_obj.data.materials.append(mats["Gold"])         # 8
    d_obj.data.materials.append(mats["DarkMetal"])    # 9
    for poly in d_obj.data.polygons:
        poly.use_smooth = True

    # 8. ANTENNA & GLOWING EMERALD HALO CONTACT HEAD (CALIBRATED TO Z = 1.36m, NO UI CLIPPING)
    ant_mesh = bpy.data.meshes.new("AntennaMesh")
    ant_obj = bpy.data.objects.new("Antenna", ant_mesh)
    bpy.context.collection.objects.link(ant_obj)
    ant_obj.parent = car_root
    bm_ant = bmesh.new()

    # Antenna base mounting collar on rear deck
    res_acol = make_cylinder(
        bm_ant, radius=0.026, depth=0.04, segments=12,
        matrix=make_transform(Vector((0.0, 0.62, 0.68)))
    )
    set_mat_for_verts(res_acol["verts"], 0)

    # Spring sleeve damper
    res_spdam = make_cylinder(
        bm_ant, radius=0.018, depth=0.10, segments=12,
        matrix=make_transform(Vector((0.0, 0.62, 0.74)))
    )
    set_mat_for_verts(res_spdam["verts"], 0)

    # Flexible carbon spring mast rod terminating at Z = 1.22m
    res_mast = make_cylinder(
        bm_ant, radius=0.010, depth=0.48, segments=10,
        matrix=make_transform(Vector((0.0, 0.62, 1.00)))
    )
    set_mat_for_verts(res_mast["verts"], 0)

    bm_ant.to_mesh(ant_mesh)
    bm_ant.free()
    ant_obj.data.materials.append(mats["Carbon"])

    # ContactHead — centered at Z = 1.36m matching HOOD_BULL_CONFIG.dimensions.antennaHeight: 1.45
    ch_mesh = bpy.data.meshes.new("ContactHeadMesh")
    ch_obj = bpy.data.objects.new("ContactHead", ch_mesh)
    ch_obj.location = Vector((0.0, 0.62, 1.36))
    bpy.context.collection.objects.link(ch_obj)
    ch_obj.parent = ant_obj
    bm_ch = bmesh.new()

    # Circular magnetic toroidal halo ring glowing in Lucky Green
    res_ring = make_cylinder(
        bm_ch, radius=0.075, depth=0.018, segments=24,
        matrix=make_transform(Vector((0, 0, 0)), rot_euler=Euler((0, math.radians(90), 0)))
    )
    set_mat_for_verts(res_ring["verts"], 0)  # NeonAccent

    # Dark metallic central core disc
    res_core = make_cylinder(
        bm_ch, radius=0.040, depth=0.012, segments=16,
        matrix=make_transform(Vector((0, 0, 0)), rot_euler=Euler((0, math.radians(90), 0)))
    )
    set_mat_for_verts(res_core["verts"], 1)  # DarkMetal

    bm_ch.to_mesh(ch_mesh)
    bm_ch.free()
    ch_obj.data.materials.append(mats["NeonAccent"])  # 0
    ch_obj.data.materials.append(mats["DarkMetal"])   # 1

    # 9. WHEELS & WELLS
    create_wheel_wells(car_root, mats, track, wheelbase, well_radius=0.35, well_width=0.24)
    build_single_wheel("Wheel_FL", car_root, mats, 'hood_bull', Vector((-track, -wheelbase, 0.28)), True)
    build_single_wheel("Wheel_FR", car_root, mats, 'hood_bull', Vector(( track, -wheelbase, 0.28)), True)
    build_single_wheel("Wheel_RL", car_root, mats, 'hood_bull', Vector((-track,  wheelbase, 0.28)), False)
    build_single_wheel("Wheel_RR", car_root, mats, 'hood_bull', Vector(( track,  wheelbase, 0.28)), False)

    out_path = os.path.join(MODELS_OUT, "hood_bull.glb")
    print(f"Exporting HOOD BULL to {out_path}...")
    bpy.ops.export_scene.gltf(filepath=out_path, export_format='GLB', use_selection=False, export_yup=True, export_apply=True)
    print("=== HOOD BULL EXPORTED ===")


# =============================================================================
# 1. HOOD BEAR (HEAVY / MUSCULAR / TANK BRAWLER)
# =============================================================================
def build_hood_bear_model():
    print("=== Building AAA HOOD BEAR Model ===")
    clean_scene()
    mats = setup_materials_for_car('hood_bear', (1.0, 0.08, 0.20))
    car_root = bpy.data.objects.new("CarRoot", None)
    bpy.context.collection.objects.link(car_root)

    track = 0.94
    wheelbase = 0.80

    # 1. MASSIVE SQUARED JUGGERNAUT TANK BODY SHELL (ZERO SPORTS-CAR WAIST PINCH)
    body_mesh = bpy.data.meshes.new("BodyMesh")
    body_obj = bpy.data.objects.new("Body", body_mesh)
    bpy.context.collection.objects.link(body_obj)
    body_obj.parent = car_root
    bm = bmesh.new()

    sections = [
        # 1. Front Battering-Ram Nose (Tall, flat, massive rectangular fascia)
        {"y": -1.36, "hw": 0.96, "zt": 0.72, "zp": 0.76, "zw": 0.58, "zb": 0.22},
        {"y": -1.24, "hw": 1.06, "zt": 0.74, "zp": 0.79, "zw": 0.62, "zb": 0.22},
        # 2. Boxy Front Wheel Flares (Aggressive wide stance)
        {"y": -1.08, "hw": 1.15, "zt": 0.76, "zp": 0.82, "zw": 0.66, "zb": 0.22},
        {"y": -0.88, "hw": 1.16, "zt": 0.77, "zp": 0.83, "zw": 0.68, "zb": 0.22},
        {"y": -0.70, "hw": 1.14, "zt": 0.78, "zp": 0.84, "zw": 0.66, "zb": 0.22},
        # 3. Slab-Sided Armored Cabin (NO inward sports-car waist taper!)
        {"y": -0.48, "hw": 1.12, "zt": 0.79, "zp": 0.84, "zw": 0.64, "zb": 0.22},
        {"y": -0.24, "hw": 1.12, "zt": 0.80, "zp": 0.84, "zw": 0.62, "zb": 0.22},
        {"y":  0.00, "hw": 1.12, "zt": 0.52, "zp": 0.84, "zw": 0.62, "zb": 0.22}, # Cockpit tub floor drop
        {"y":  0.24, "hw": 1.13, "zt": 0.52, "zp": 0.85, "zw": 0.64, "zb": 0.22},
        # 4. Massive Rear Juggernaut Haunches
        {"y":  0.48, "hw": 1.16, "zt": 0.84, "zp": 0.88, "zw": 0.68, "zb": 0.22},
        {"y":  0.72, "hw": 1.20, "zt": 0.86, "zp": 0.90, "zw": 0.72, "zb": 0.22},
        {"y":  0.92, "hw": 1.20, "zt": 0.88, "zp": 0.91, "zw": 0.72, "zb": 0.22},
        {"y":  1.10, "hw": 1.16, "zt": 0.90, "zp": 0.91, "zw": 0.70, "zb": 0.22},
        # 5. Flat Vertical Tailgate & Transom
        {"y":  1.26, "hw": 1.08, "zt": 0.91, "zp": 0.90, "zw": 0.66, "zb": 0.22},
        {"y":  1.36, "hw": 0.98, "zt": 0.91, "zp": 0.88, "zw": 0.62, "zb": 0.22},
    ]

    build_quad_body_shell(bm, sections, wheelbase, -1.36, 1.36, arch_rad=0.34)

    # Armored power bulge & twin rectangular hood heat extraction louvers
    for sign in [-1, 1]:
        res_sc = bmesh.ops.create_cube(bm, size=1.0, matrix=make_transform(Vector((sign * 0.42, -0.76, 0.82)), (0.22, 0.42, 0.07), Euler((math.radians(-5), 0, 0))))
        set_mat_for_verts(res_sc['verts'], 1)

    # Heavy rectangular rear tailgate armor cap
    res_cap = bmesh.ops.create_cube(bm, size=1.0, matrix=make_transform(Vector((0.0, 1.34, 0.92)), (1.06, 0.12, 0.06)))
    set_mat_for_verts(res_cap['verts'], 0)

    bm.to_mesh(body_mesh)
    bm.free()
    body_obj.data.materials.append(mats['BodyPaint'])  # 0
    body_obj.data.materials.append(mats['Carbon'])     # 1

    subsurf = body_obj.modifiers.new(name="Subdivision", type='SUBSURF')
    subsurf.levels = 2
    for poly in body_obj.data.polygons:
        poly.use_smooth = True

    # 2. HEAVY RECTANGULAR DUAL-TIER BUMPER COLLAR (TANK PROFILE)
    bumper_pts = [
        Vector((0.0,  -1.42, 0.14)),
        Vector((0.56, -1.41, 0.14)),
        Vector((0.98, -1.32, 0.14)),
        Vector((1.16, -1.08, 0.14)),
        Vector((1.18, -0.75, 0.14)),
        Vector((1.14, -0.25, 0.14)),
        Vector((1.14,  0.25, 0.14)),
        Vector((1.22,  0.75, 0.14)),
        Vector((1.22,  1.08, 0.14)),
        Vector((1.04,  1.32, 0.14)),
        Vector((0.58,  1.42, 0.14)),
        Vector((0.0,   1.44, 0.14)),
    ]
    build_thick_bumper(car_root, mats, bumper_pts, pw=0.11, ph=0.085, neon_slot='NeonAccent')

    # 3. HEAVY STEEL BULL BAR / PUSH BUMPER & RECTANGULAR PROJECTORS
    bb_mesh = bpy.data.meshes.new("BullBarMesh")
    bb_obj = bpy.data.objects.new("BullBar", bb_mesh)
    bpy.context.collection.objects.link(bb_obj)
    bb_obj.parent = car_root
    bm_bb = bmesh.new()

    # Heavy tubular bull bar push bumper (Wide Juggernaut Spec)
    res_bbt = make_cylinder(bm_bb, radius=0.040, depth=1.06, segments=16, matrix=make_transform(Vector((0.0, -1.42, 0.46)), rot_euler=Euler((0, math.radians(90), 0))))
    res_bbb = make_cylinder(bm_bb, radius=0.040, depth=1.06, segments=16, matrix=make_transform(Vector((0.0, -1.44, 0.25)), rot_euler=Euler((0, math.radians(90), 0))))
    res_bbl = make_cylinder(bm_bb, radius=0.036, depth=0.32, segments=16, matrix=make_transform(Vector((-0.50, -1.43, 0.35))))
    res_bbr = make_cylinder(bm_bb, radius=0.036, depth=0.32, segments=16, matrix=make_transform(Vector(( 0.50, -1.43, 0.35))))
    # Vertical ram push plates on the bull bar
    for sx in [-0.28, 0.28]:
        res_ram = bmesh.ops.create_cube(bm_bb, size=1.0, matrix=make_transform(Vector((sx, -1.45, 0.36)), (0.07, 0.08, 0.28)))
        set_mat_for_verts(res_ram['verts'], 0)
    set_mat_for_verts(res_bbt['verts'] + res_bbb['verts'] + res_bbl['verts'] + res_bbr['verts'], 0)

    # Amber Fog Lamps mounted on bull bar
    for sign in [-1, 1]:
        res_fog_bk = make_cylinder(bm_bb, radius=0.075, depth=0.06, segments=16, matrix=make_transform(Vector((sign * 0.34, -1.45, 0.40)), rot_euler=Euler((math.radians(90), 0, 0))))
        set_mat_for_verts(res_fog_bk['verts'], 0)
        res_fog_lp = make_cylinder(bm_bb, radius=0.062, depth=0.02, segments=16, matrix=make_transform(Vector((sign * 0.34, -1.48, 0.40)), rot_euler=Euler((math.radians(90), 0, 0))))
        set_mat_for_verts(res_fog_lp['verts'], 1)

    bm_bb.to_mesh(bb_mesh)
    bm_bb.free()
    bb_obj.data.materials.append(mats['SteelBullBar'])
    bb_obj.data.materials.append(mats['AmberFog'])

    # Rectangular Heavy Armor Headlights with Dual Red Demon-Eyes
    for sign, side in [(-1, 'L'), (1, 'R')]:
        hl_mesh = bpy.data.meshes.new(f"Headlight_{side}_Mesh")
        hl_obj = bpy.data.objects.new(f"Headlight_{side}", hl_mesh)
        hl_obj.location = Vector((sign * 0.58, -1.28, 0.56))
        bpy.context.collection.objects.link(hl_obj)
        hl_obj.parent = car_root
        bm_hl = bmesh.new()

        # Recessed bucket backplate (wider, heavier)
        res_bk = bmesh.ops.create_cube(bm_hl, size=1.0, matrix=make_transform(Vector((0, 0, 0)), (0.28, 0.06, 0.16)))
        set_mat_for_verts(res_bk['verts'], 0)
        # Dual red demon eye projector bulbs
        res_p1 = make_cylinder(bm_hl, radius=0.042, depth=0.05, segments=14, matrix=make_transform(Vector((-sign * 0.05, -0.02, 0)), rot_euler=Euler((math.radians(90), 0, 0))))
        res_p2 = make_cylinder(bm_hl, radius=0.038, depth=0.05, segments=14, matrix=make_transform(Vector(( sign * 0.05, -0.02, 0)), rot_euler=Euler((math.radians(90), 0, 0))))
        set_mat_for_verts(res_p1['verts'] + res_p2['verts'], 1)
        # Protective glass lens
        res_lens = bmesh.ops.create_cube(bm_hl, size=1.0, matrix=make_transform(Vector((0, -0.038, 0)), (0.27, 0.015, 0.15)))
        set_mat_for_verts(res_lens['verts'], 2)

        bm_hl.to_mesh(hl_mesh)
        bm_hl.free()
        hl_obj.data.materials.append(mats['DarkMetal'])
        hl_obj.data.materials.append(mats['RedDemonEye'])
        hl_obj.data.materials.append(mats['Glass'])

        # Taillights (Blocky heavy LED units)
        tl_mesh = bpy.data.meshes.new(f"TailLight_{side}_Mesh")
        tl_obj = bpy.data.objects.new(f"TailLight_{side}", tl_mesh)
        tl_obj.location = Vector((sign * 0.62, 1.34, 0.68))
        bpy.context.collection.objects.link(tl_obj)
        tl_obj.parent = car_root
        bm_tl = bmesh.new()
        res_tlb = bmesh.ops.create_cube(bm_tl, size=1.0, matrix=make_transform(Vector((0, 0, 0)), (0.28, 0.06, 0.14)))
        set_mat_for_verts(res_tlb['verts'], 0)
        bm_tl.to_mesh(tl_mesh)
        bm_tl.free()
        tl_obj.data.materials.append(mats['Taillight'])

    # 4. MONEY DISPLAY (PARENT NODE BINDING FOR CARVISUAL & ASSETMANAGER)
    md_root = bpy.data.objects.new("MoneyDisplay", None)
    bpy.context.collection.objects.link(md_root)
    md_root.parent = car_root

    # FRONT MONEY DISPLAY ($120) IN GRILLE CAVITY
    f_sc_mesh = bpy.data.meshes.new("FrontMoneyDisplayMesh")
    f_sc_obj = bpy.data.objects.new("FrontMoneyDisplay", f_sc_mesh)
    bpy.context.collection.objects.link(f_sc_obj)
    f_sc_obj.parent = md_root
    bm_fsc = bmesh.new()
    res_ff = bmesh.ops.create_cube(bm_fsc, size=1.0, matrix=make_transform(Vector((0.0, -1.30, 0.40)), (0.54, 0.04, 0.18)))
    set_mat_for_verts(res_ff['verts'], 0)
    # Non-mirrored UVs from front view (-Y looking towards +Y):
    v1 = bm_fsc.verts.new(Vector(( 0.24, -1.325, 0.32)))  # bottom-left of text
    v2 = bm_fsc.verts.new(Vector((-0.24, -1.325, 0.32)))  # bottom-right of text
    v3 = bm_fsc.verts.new(Vector((-0.24, -1.325, 0.48)))  # top-right of text
    v4 = bm_fsc.verts.new(Vector(( 0.24, -1.325, 0.48)))  # top-left of text
    f_fsc = bm_fsc.faces.new([v1, v2, v3, v4])
    f_fsc.material_index = 1
    uv_lf = bm_fsc.loops.layers.uv.new("UVMap")
    uvs_f = [Vector((0, 0)), Vector((1, 0)), Vector((1, 1)), Vector((0, 1))]
    for loop, uv in zip(f_fsc.loops, uvs_f):
        loop[uv_lf].uv = uv
    bm_fsc.to_mesh(f_sc_mesh)
    bm_fsc.free()
    f_sc_obj.data.materials.append(mats['DarkMetal'])
    f_sc_obj.data.materials.append(mats['Screen'])

    # 5. FORTIFIED COCKPIT WITH 6-POINT STEEL EXO-CAGE & RALLY SEAT
    cockpit_mesh = bpy.data.meshes.new("CockpitMesh")
    cockpit_obj = bpy.data.objects.new("Cockpit", cockpit_mesh)
    bpy.context.collection.objects.link(cockpit_obj)
    cockpit_obj.parent = car_root
    bm_cp = bmesh.new()

    # Recessed heavy tub floor
    res_tub = bmesh.ops.create_cube(bm_cp, size=1.0, matrix=make_transform(Vector((0.0, 0.02, 0.44)), (0.84, 0.72, 0.16)))
    set_mat_for_verts(res_tub['verts'], 0)
    # Deep rally racing bucket seat
    res_bk = bmesh.ops.create_cube(bm_cp, size=1.0, matrix=make_transform(Vector((0.0, 0.28, 0.74)), (0.54, 0.16, 0.48), Euler((math.radians(14), 0, 0))))
    res_sn = bmesh.ops.create_cube(bm_cp, size=1.0, matrix=make_transform(Vector((0.0, 0.10, 0.50)), (0.50, 0.38, 0.10)))
    set_mat_for_verts(res_bk['verts'] + res_sn['verts'], 0)

    # 6-Point Heavy Tubular Steel Exo-Cage
    res_rh = make_cylinder(bm_cp, radius=0.038, depth=0.98, segments=14, matrix=make_transform(Vector((0.0, 0.32, 1.20)), rot_euler=Euler((0, math.radians(90), 0))))
    res_lp = make_cylinder(bm_cp, radius=0.038, depth=0.64, segments=14, matrix=make_transform(Vector((-0.48, 0.32, 0.88))))
    res_rp = make_cylinder(bm_cp, radius=0.038, depth=0.64, segments=14, matrix=make_transform(Vector(( 0.48, 0.32, 0.88))))
    res_ap_l = make_cylinder(bm_cp, radius=0.034, depth=0.62, segments=14, matrix=make_transform(Vector((-0.46, -0.22, 0.88)), rot_euler=Euler((math.radians(-15), 0, 0))))
    res_ap_r = make_cylinder(bm_cp, radius=0.034, depth=0.62, segments=14, matrix=make_transform(Vector(( 0.46, -0.22, 0.88)), rot_euler=Euler((math.radians(-15), 0, 0))))
    res_rf_l = make_cylinder(bm_cp, radius=0.034, depth=0.56, segments=14, matrix=make_transform(Vector((-0.47, 0.05, 1.18)), rot_euler=Euler((math.radians(90), 0, 0))))
    res_rf_r = make_cylinder(bm_cp, radius=0.034, depth=0.56, segments=14, matrix=make_transform(Vector(( 0.47, 0.05, 1.18)), rot_euler=Euler((math.radians(90), 0, 0))))
    res_b1 = make_cylinder(bm_cp, radius=0.032, depth=0.62, segments=14, matrix=make_transform(Vector((-0.36, 0.60, 0.96)), rot_euler=Euler((math.radians(35), 0, math.radians(-15)))))
    res_b2 = make_cylinder(bm_cp, radius=0.032, depth=0.62, segments=14, matrix=make_transform(Vector(( 0.36, 0.60, 0.96)), rot_euler=Euler((math.radians(35), 0, math.radians( 15)))))
    set_mat_for_verts(res_rh['verts'] + res_lp['verts'] + res_rp['verts'] + res_ap_l['verts'] + res_ap_r['verts'] + res_rf_l['verts'] + res_rf_r['verts'] + res_b1['verts'] + res_b2['verts'], 1)

    # Bear ear steel gusset plates on top of roll cage
    res_e1 = make_cylinder(bm_cp, radius=0.11, depth=0.030, segments=16, matrix=make_transform(Vector((-0.48, 0.32, 1.28)), rot_euler=Euler((0, math.radians(90), 0))))
    res_e2 = make_cylinder(bm_cp, radius=0.11, depth=0.030, segments=16, matrix=make_transform(Vector(( 0.48, 0.32, 1.28)), rot_euler=Euler((0, math.radians(90), 0))))
    set_mat_for_verts(res_e1['verts'] + res_e2['verts'], 1)

    # Heavy Rally Steering Wheel
    res_st = make_cylinder(bm_cp, radius=0.15, depth=0.028, segments=18, matrix=make_transform(Vector((0.0, -0.16, 0.72)), rot_euler=Euler((math.radians(32), 0, 0))))
    set_mat_for_verts(res_st['verts'], 0)

    bm_cp.to_mesh(cockpit_mesh)
    bm_cp.free()
    cockpit_obj.data.materials.append(mats['DarkMetal'])
    cockpit_obj.data.materials.append(mats['SteelBullBar'])

    # 6. CHARISMATIC GRIZZLY BEAR MASCOT DRIVER
    d_mesh = bpy.data.meshes.new("Driver_Mesh")
    d_obj = bpy.data.objects.new("Driver", d_mesh)
    bpy.context.collection.objects.link(d_obj)
    d_obj.parent = car_root
    bm_d = bmesh.new()

    # Torso in dark racing suit
    res_dt = bmesh.ops.create_cube(bm_d, size=1.0, matrix=make_transform(Vector((0.0, 0.08, 0.68)), (0.48, 0.32, 0.36)))
    set_mat_for_verts(res_dt['verts'], 0) # DarkMetal
    # Crimson racing harness straps
    for sx in [-0.12, 0.12]:
        res_strap = bmesh.ops.create_cube(bm_d, size=1.0, matrix=make_transform(Vector((sx, 0.06, 0.72)), (0.05, 0.33, 0.30)))
        set_mat_for_verts(res_strap['verts'], 4) # NeonAccent

    # Padded racing arms gripping steering wheel
    res_al = bmesh.ops.create_cube(bm_d, size=1.0, matrix=make_transform(Vector((-0.18, -0.05, 0.72)), (0.10, 0.26, 0.12), Euler((math.radians(-24), math.radians(15), 0))))
    res_ar = bmesh.ops.create_cube(bm_d, size=1.0, matrix=make_transform(Vector(( 0.18, -0.05, 0.72)), (0.10, 0.26, 0.12), Euler((math.radians(-24), math.radians(-15), 0))))
    set_mat_for_verts(res_al['verts'] + res_ar['verts'], 0)

    # Muscular Bear Head with sculpted cheeks
    res_dh = bmesh.ops.create_uvsphere(bm_d, u_segments=16, v_segments=12, radius=0.19, matrix=make_transform(Vector((0.0, 0.04, 1.00)), (1.05, 0.95, 0.95)))
    res_chl = bmesh.ops.create_uvsphere(bm_d, u_segments=12, v_segments=10, radius=0.10, matrix=make_transform(Vector((-0.14, 0.02, 0.95))))
    res_chr = bmesh.ops.create_uvsphere(bm_d, u_segments=12, v_segments=10, radius=0.10, matrix=make_transform(Vector(( 0.14, 0.02, 0.95))))
    set_mat_for_verts(res_dh['verts'] + res_chl['verts'] + res_chr['verts'], 1) # BearSkin

    # Bear Snout & Upper Jaw
    res_sn = bmesh.ops.create_cube(bm_d, size=1.0, matrix=make_transform(Vector((0.0, -0.11, 0.95)), (0.18, 0.16, 0.11)))
    set_mat_for_verts(res_sn['verts'], 2) # BearSnout
    # Glossy black nose pad at the front tip
    res_nose = bmesh.ops.create_cube(bm_d, size=1.0, matrix=make_transform(Vector((0.0, -0.195, 0.985)), (0.07, 0.03, 0.035)))
    set_mat_for_verts(res_nose['verts'], 5) # BearNose

    # Open snarling lower jaw
    res_jaw = bmesh.ops.create_cube(bm_d, size=1.0, matrix=make_transform(Vector((0.0, -0.10, 0.885)), (0.14, 0.14, 0.04), Euler((math.radians(-8), 0, 0))))
    set_mat_for_verts(res_jaw['verts'], 2) # BearSnout

    # Menacing sharp white fangs
    # Upper left & right canines
    res_f1 = make_cylinder(bm_d, radius=0.016, depth=0.042, segments=8, matrix=make_transform(Vector((-0.055, -0.155, 0.905))))
    res_f2 = make_cylinder(bm_d, radius=0.016, depth=0.042, segments=8, matrix=make_transform(Vector(( 0.055, -0.155, 0.905))))
    # Lower left & right canines
    res_f3 = make_cylinder(bm_d, radius=0.014, depth=0.038, segments=8, matrix=make_transform(Vector((-0.045, -0.145, 0.895))))
    res_f4 = make_cylinder(bm_d, radius=0.014, depth=0.038, segments=8, matrix=make_transform(Vector(( 0.045, -0.145, 0.895))))
    set_mat_for_verts(res_f1['verts'] + res_f2['verts'] + res_f3['verts'] + res_f4['verts'], 6) # BearFangs

    # Sculpted Bear Ears (outer fur + inner ear depression)
    res_el = bmesh.ops.create_uvsphere(bm_d, u_segments=12, v_segments=10, radius=0.08, matrix=make_transform(Vector((-0.16, 0.06, 1.15))))
    res_er = bmesh.ops.create_uvsphere(bm_d, u_segments=12, v_segments=10, radius=0.08, matrix=make_transform(Vector(( 0.16, 0.06, 1.15))))
    set_mat_for_verts(res_el['verts'] + res_er['verts'], 1) # BearSkin
    res_iel = bmesh.ops.create_cube(bm_d, size=1.0, matrix=make_transform(Vector((-0.16, 0.04, 1.15)), (0.09, 0.02, 0.09)))
    res_ier = bmesh.ops.create_cube(bm_d, size=1.0, matrix=make_transform(Vector(( 0.16, 0.04, 1.15)), (0.09, 0.02, 0.09)))
    set_mat_for_verts(res_iel['verts'] + res_ier['verts'], 2) # BearSnout

    # Gold-framed Aviator Sunglasses
    # Bridge and rims
    res_bridge = bmesh.ops.create_cube(bm_d, size=1.0, matrix=make_transform(Vector((0.0, -0.115, 1.045)), (0.06, 0.02, 0.012)))
    res_rim_l = bmesh.ops.create_cube(bm_d, size=1.0, matrix=make_transform(Vector((-0.08, -0.115, 1.035)), (0.11, 0.025, 0.075)))
    res_rim_r = bmesh.ops.create_cube(bm_d, size=1.0, matrix=make_transform(Vector(( 0.08, -0.115, 1.035)), (0.11, 0.025, 0.075)))
    set_mat_for_verts(res_bridge['verts'] + res_rim_l['verts'] + res_rim_r['verts'], 7) # GoldFrames
    # Black mirror lenses
    res_lens_l = bmesh.ops.create_cube(bm_d, size=1.0, matrix=make_transform(Vector((-0.08, -0.125, 1.035)), (0.095, 0.015, 0.062)))
    res_lens_r = bmesh.ops.create_cube(bm_d, size=1.0, matrix=make_transform(Vector(( 0.08, -0.125, 1.035)), (0.095, 0.015, 0.062)))
    set_mat_for_verts(res_lens_l['verts'] + res_lens_r['verts'], 3) # Sunglasses

    bm_d.to_mesh(d_mesh)
    bm_d.free()
    d_obj.data.materials.append(mats['DarkMetal'])   # 0
    d_obj.data.materials.append(mats['BearSkin'])    # 1
    d_obj.data.materials.append(mats['BearSnout'])   # 2
    d_obj.data.materials.append(mats['Sunglasses'])  # 3
    d_obj.data.materials.append(mats['NeonAccent'])  # 4
    d_obj.data.materials.append(mats['BearNose'])    # 5
    d_obj.data.materials.append(mats['BearFangs'])   # 6
    d_obj.data.materials.append(mats['GoldFrames'])  # 7
    for poly in d_obj.data.polygons:
        poly.use_smooth = True

    # 7. REAR TRANSOM, DUAL TWIN CANNON EXHAUSTS & REAR MONEY DISPLAY
    r_sc_mesh = bpy.data.meshes.new("RearMoneyDisplayMesh")
    r_sc_obj = bpy.data.objects.new("RearMoneyDisplay", r_sc_mesh)
    bpy.context.collection.objects.link(r_sc_obj)
    r_sc_obj.parent = md_root
    bm_md = bmesh.new()
    res_rf = bmesh.ops.create_cube(bm_md, size=1.0, matrix=make_transform(Vector((0.0, 1.28, 0.62)), (0.64, 0.05, 0.22)))
    set_mat_for_verts(res_rf['verts'], 0)
    # Non-mirrored UVs from rear view (+Y looking towards -Y):
    v1 = bm_md.verts.new(Vector((-0.28, 1.308, 0.53))) # bottom-left of text
    v2 = bm_md.verts.new(Vector(( 0.28, 1.308, 0.53))) # bottom-right of text
    v3 = bm_md.verts.new(Vector(( 0.28, 1.308, 0.71))) # top-right of text
    v4 = bm_md.verts.new(Vector((-0.28, 1.308, 0.71))) # top-left of text
    f_md = bm_md.faces.new([v1, v2, v3, v4])
    f_md.material_index = 1
    uv_l = bm_md.loops.layers.uv.new("UVMap")
    uvs = [Vector((0, 0)), Vector((1, 0)), Vector((1, 1)), Vector((0, 1))]
    for loop, uv in zip(f_md.loops, uvs):
        loop[uv_l].uv = uv

    # Dual twin heavy chrome exhaust cannons
    for sx in [-0.44, -0.32, 0.32, 0.44]:
        res_ex = make_cylinder(bm_md, radius=0.042, depth=0.18, segments=16, matrix=make_transform(Vector((sx, 1.30, 0.34)), rot_euler=Euler((math.radians(90), 0, 0))))
        set_mat_for_verts(res_ex['verts'], 2)

    bm_md.to_mesh(r_sc_mesh)
    bm_md.free()
    r_sc_obj.data.materials.append(mats['DarkMetal'])
    r_sc_obj.data.materials.append(mats['Screen'])
    r_sc_obj.data.materials.append(mats['Chrome'])

    # 8. REINFORCED HEAVY STEEL ANTENNA MAST WITH RED GLOWING HEAD (Z = 1.55m)
    ant_mesh = bpy.data.meshes.new("AntennaMesh")
    ant_obj = bpy.data.objects.new("Antenna", ant_mesh)
    bpy.context.collection.objects.link(ant_obj)
    ant_obj.parent = car_root
    bm_ant = bmesh.new()
    # Mast from rear deck (Z ~ 0.70m) up to ContactHead (Z = 1.55m)
    res_am = make_cylinder(bm_ant, radius=0.030, depth=0.85, segments=14, matrix=make_transform(Vector((0.0, 0.72, 1.125))))
    set_mat_for_verts(res_am['verts'], 0)
    # Steel reinforcement collars along mast
    res_c1 = make_cylinder(bm_ant, radius=0.042, depth=0.05, segments=14, matrix=make_transform(Vector((0.0, 0.72, 0.80))))
    res_c2 = make_cylinder(bm_ant, radius=0.038, depth=0.05, segments=14, matrix=make_transform(Vector((0.0, 0.72, 1.45))))
    set_mat_for_verts(res_c1['verts'] + res_c2['verts'], 0)
    bm_ant.to_mesh(ant_mesh)
    bm_ant.free()
    ant_obj.data.materials.append(mats['SteelBullBar'])

    ch_mesh = bpy.data.meshes.new("ContactHeadMesh")
    ch_obj = bpy.data.objects.new("ContactHead", ch_mesh)
    ch_obj.location = Vector((0.0, 0.72, 1.55))
    bpy.context.collection.objects.link(ch_obj)
    ch_obj.parent = ant_obj
    bm_ch = bmesh.new()
    # Glowing ruby red core orb
    res_hd = bmesh.ops.create_uvsphere(bm_ch, u_segments=16, v_segments=12, radius=0.13)
    set_mat_for_verts(res_hd['verts'], 0)
    # Protective heavy steel cage rings
    res_cg1 = make_cylinder(bm_ch, radius=0.155, depth=0.024, segments=16, matrix=make_transform(Vector((0, 0, 0))))
    res_cg2 = make_cylinder(bm_ch, radius=0.155, depth=0.024, segments=16, matrix=make_transform(Vector((0, 0, 0)), rot_euler=Euler((math.radians(90), 0, 0))))
    set_mat_for_verts(res_cg1['verts'] + res_cg2['verts'], 1)
    bm_ch.to_mesh(ch_mesh)
    bm_ch.free()
    ch_obj.data.materials.append(mats['NeonAccent'])
    ch_obj.data.materials.append(mats['SteelBullBar'])

    # 9. WHEELS & WELLS (WIDE TANK SPEC)
    create_wheel_wells(car_root, mats, track, wheelbase, well_radius=0.36, well_width=0.28)
    build_single_wheel("Wheel_FL", car_root, mats, 'hood_bear', Vector((-track, -wheelbase, 0.30)), True)
    build_single_wheel("Wheel_FR", car_root, mats, 'hood_bear', Vector(( track, -wheelbase, 0.30)), True)
    build_single_wheel("Wheel_RL", car_root, mats, 'hood_bear', Vector((-track,  wheelbase, 0.30)), False)
    build_single_wheel("Wheel_RR", car_root, mats, 'hood_bear', Vector(( track,  wheelbase, 0.30)), False)

    out_path = os.path.join(MODELS_OUT, "hood_bear.glb")
    print(f"Exporting HOOD BEAR to {out_path}...")
    bpy.ops.export_scene.gltf(filepath=out_path, export_format='GLB', use_selection=False, export_yup=True, export_apply=True)
    print("=== HOOD BEAR EXPORTED ===")


# =============================================================================
# 2. TSLA RACER (SPEEDSTER / ULTRA-LOW LE MANS AERODYNAMIC PROTOTYPE)
# =============================================================================
def build_tsla_racer_model():
    print("=== Building AAA TSLA RACER Model ===")
    clean_scene()
    mats = setup_materials_for_car('tsla_racer', (0.0, 0.85, 1.0))
    car_root = bpy.data.objects.new("CarRoot", None)
    bpy.context.collection.objects.link(car_root)

    track = 0.70
    wheelbase = 0.74

    # 1. BODY SHELL: Needle nose, NACA air ducts, low swept Le Mans haunches
    body_mesh = bpy.data.meshes.new("BodyMesh")
    body_obj = bpy.data.objects.new("Body", body_mesh)
    bpy.context.collection.objects.link(body_obj)
    body_obj.parent = car_root
    bm = bmesh.new()

    # Ultra-low, high-downforce aerodynamic Le Mans prototype wedge (W = 1.80m, L = 2.50m, H = 1.30m)
    sections = [
        # Front needle nose tip — ultra-low dipping aerodynamic wedge
        {"y": -1.25, "hw": 0.44, "zt": 0.36, "zp": 0.36, "zw": 0.26, "zb": 0.18},
        {"y": -1.15, "hw": 0.56, "zt": 0.42, "zp": 0.42, "zw": 0.30, "zb": 0.18},
        {"y": -1.02, "hw": 0.68, "zt": 0.48, "zp": 0.48, "zw": 0.34, "zb": 0.18},
        # Hood rising & front fender crest arching over FL/FR wheels (wheel top: 0.52)
        {"y": -0.88, "hw": 0.76, "zt": 0.54, "zp": 0.58, "zw": 0.40, "zb": 0.18},
        {"y": -0.74, "hw": 0.80, "zt": 0.56, "zp": 0.62, "zw": 0.44, "zb": 0.18},
        {"y": -0.60, "hw": 0.78, "zt": 0.52, "zp": 0.58, "zw": 0.40, "zb": 0.18}, # Scalloped hood channel
        # Base of aerodynamic canopy
        {"y": -0.45, "hw": 0.72, "zt": 0.48, "zp": 0.56, "zw": 0.36, "zb": 0.18},
        {"y": -0.28, "hw": 0.68, "zt": 0.44, "zp": 0.56, "zw": 0.34, "zb": 0.18},
        # Deep open monocoque cockpit tub
        {"y": -0.10, "hw": 0.66, "zt": 0.32, "zp": 0.54, "zw": 0.32, "zb": 0.18},
        {"y":  0.10, "hw": 0.66, "zt": 0.32, "zp": 0.54, "zw": 0.32, "zb": 0.18},
        # Rear deck & haunches rising over RL/RR wheels
        {"y":  0.30, "hw": 0.72, "zt": 0.50, "zp": 0.58, "zw": 0.36, "zb": 0.18},
        {"y":  0.50, "hw": 0.78, "zt": 0.54, "zp": 0.62, "zw": 0.42, "zb": 0.18},
        {"y":  0.66, "hw": 0.84, "zt": 0.56, "zp": 0.64, "zw": 0.46, "zb": 0.18},
        {"y":  0.78, "hw": 0.86, "zt": 0.57, "zp": 0.65, "zw": 0.48, "zb": 0.18},
        {"y":  0.88, "hw": 0.82, "zt": 0.57, "zp": 0.64, "zw": 0.46, "zb": 0.18},
        # Taper to rear ducktail spoiler
        {"y":  1.02, "hw": 0.76, "zt": 0.60, "zp": 0.62, "zw": 0.42, "zb": 0.18},
        {"y":  1.15, "hw": 0.68, "zt": 0.66, "zp": 0.64, "zw": 0.36, "zb": 0.18},
        {"y":  1.24, "hw": 0.60, "zt": 0.68, "zp": 0.65, "zw": 0.30, "zb": 0.18},
    ]

    build_quad_body_shell(bm, sections, wheelbase, -1.25, 1.24, arch_rad=0.30)

    # 1B. Central aerodynamic carbon fiber Le Mans dorsal shark fin spine
    res_fin = bmesh.ops.create_cube(bm, size=1.0, matrix=make_transform(Vector((0.0, 0.68, 0.72)), (0.022, 0.88, 0.24), Euler((math.radians(-6), 0, 0))))
    set_mat_for_verts(res_fin['verts'], 1)
    # Glowing cyan trailing edge on the dorsal shark fin
    res_fin_edge = bmesh.ops.create_cube(bm, size=1.0, matrix=make_transform(Vector((0.0, 1.10, 0.75)), (0.026, 0.04, 0.18)))
    set_mat_for_verts(res_fin_edge['verts'], 2)

    # 1C. Front carbon splitter tray & vortex endplates
    res_sp = bmesh.ops.create_cube(bm, size=1.0, matrix=make_transform(Vector((0.0, -1.26, 0.13)), (1.00, 0.12, 0.020)))
    set_mat_for_verts(res_sp['verts'], 1)
    for sign_x in [-1, 1]:
        res_ep = bmesh.ops.create_cube(bm, size=1.0, matrix=make_transform(Vector((sign_x * 0.50, -1.24, 0.16)), (0.018, 0.10, 0.06)))
        set_mat_for_verts(res_ep['verts'], 1)

    # 1D. Rear carbon aerodynamic underbody diffuser strakes
    for dx in [-0.28, -0.09, 0.09, 0.28]:
        res_dif = bmesh.ops.create_cube(bm, size=1.0, matrix=make_transform(Vector((dx, 1.16, 0.18)), (0.016, 0.18, 0.08), Euler((math.radians(14), 0, 0))))
        set_mat_for_verts(res_dif['verts'], 1)

    bm.to_mesh(body_mesh)
    bm.free()
    body_obj.data.materials.append(mats['BodyPaint'])     # 0
    body_obj.data.materials.append(mats['Carbon'])        # 1
    body_obj.data.materials.append(mats['NeonAccent'])    # 2

    subsurf = body_obj.modifiers.new(name="Subdivision", type='SUBSURF')
    subsurf.levels = 2
    for poly in body_obj.data.polygons:
        poly.use_smooth = True

    # 2. ULTRA-LOW FLUSH GROUND-EFFECTS CONTINUOUS BUMPER
    bumper_pts = [
        Vector((0.0,  -1.28, 0.16)),
        Vector((0.34, -1.22, 0.16)),
        Vector((0.62, -1.04, 0.16)),
        Vector((0.78, -0.82, 0.16)),
        Vector((0.82, -0.65, 0.16)),
        Vector((0.70, -0.20, 0.16)),
        Vector((0.70,  0.20, 0.16)),
        Vector((0.84,  0.65, 0.16)),
        Vector((0.86,  0.88, 0.16)),
        Vector((0.74,  1.10, 0.16)),
        Vector((0.44,  1.23, 0.16)),
        Vector((0.0,   1.25, 0.16)),
    ]
    build_thick_bumper(car_root, mats, bumper_pts, pw=0.065, ph=0.050, neon_slot='NeonAccent')

    # 3. CONTINUOUS HORIZON CYBER LED LIGHTBAR & HEADLIGHT PROJECTORS
    # Full-width continuous horizon cyan lightbar across the needle nose
    hl_c_mesh = bpy.data.meshes.new("HorizonLightbarMesh")
    hl_c_obj = bpy.data.objects.new("HorizonLightbar", hl_c_mesh)
    hl_c_obj.location = Vector((0.0, -1.21, 0.36))
    bpy.context.collection.objects.link(hl_c_obj)
    hl_c_obj.parent = car_root
    bm_hlc = bmesh.new()
    res_hlc = bmesh.ops.create_cube(bm_hlc, size=1.0, matrix=make_transform(Vector((0, 0, 0)), (0.90, 0.024, 0.026)))
    set_mat_for_verts(res_hlc['verts'], 0)
    bm_hlc.to_mesh(hl_c_mesh)
    bm_hlc.free()
    hl_c_obj.data.materials.append(mats['NeonAccent'])

    for sign, side in [(-1, 'L'), (1, 'R')]:
        hl_mesh = bpy.data.meshes.new(f"Headlight_{side}_Mesh")
        hl_obj = bpy.data.objects.new(f"Headlight_{side}", hl_mesh)
        hl_obj.location = Vector((sign * 0.32, -1.18, 0.40))
        bpy.context.collection.objects.link(hl_obj)
        hl_obj.parent = car_root
        bm_hl = bmesh.new()

        # Slanted razor projector LED strip
        res_h = bmesh.ops.create_cube(bm_hl, size=1.0, matrix=make_transform(Vector((0, 0, 0)), (0.26, 0.03, 0.04), Euler((0, 0, math.radians(sign * -12)))))
        set_mat_for_verts(res_h['verts'], 0)
        # Flush aerodynamic glass cover
        res_g = bmesh.ops.create_cube(bm_hl, size=1.0, matrix=make_transform(Vector((0, -0.015, 0)), (0.28, 0.01, 0.05), Euler((0, 0, math.radians(sign * -12)))))
        set_mat_for_verts(res_g['verts'], 1)

        bm_hl.to_mesh(hl_mesh)
        bm_hl.free()
        hl_obj.data.materials.append(mats['NeonAccent'])
        hl_obj.data.materials.append(mats['Glass'])

        # Full-width rear razor taillight blade across ducktail
        tl_mesh = bpy.data.meshes.new(f"TailLight_{side}_Mesh")
        tl_obj = bpy.data.objects.new(f"TailLight_{side}", tl_mesh)
        tl_obj.location = Vector((sign * 0.30, 1.22, 0.64))
        bpy.context.collection.objects.link(tl_obj)
        tl_obj.parent = car_root
        bm_tl = bmesh.new()
        res_t = bmesh.ops.create_cube(bm_tl, size=1.0, matrix=make_transform(Vector((0, 0, 0)), (0.30, 0.026, 0.030)))
        set_mat_for_verts(res_t['verts'], 0)
        bm_tl.to_mesh(tl_mesh)
        bm_tl.free()
        tl_obj.data.materials.append(mats['Taillight'])

    # 4. DYNAMIC MONEY DISPLAYS ($200) - BOUND UNDER PARENT 'MoneyDisplay'
    md_root = bpy.data.objects.new("MoneyDisplay", None)
    bpy.context.collection.objects.link(md_root)
    md_root.parent = car_root

    # 4A. Front nose intake display ($200)
    f_sc_mesh = bpy.data.meshes.new("FrontMoneyDisplayMesh")
    f_sc_obj = bpy.data.objects.new("FrontMoneyDisplay", f_sc_mesh)
    bpy.context.collection.objects.link(f_sc_obj)
    f_sc_obj.parent = md_root
    bm_fsc = bmesh.new()
    res_ff = bmesh.ops.create_cube(bm_fsc, size=1.0, matrix=make_transform(Vector((0.0, -1.22, 0.25)), (0.38, 0.03, 0.09), Euler((math.radians(22), 0, 0))))
    set_mat_for_verts(res_ff['verts'], 0)
    v1 = bm_fsc.verts.new(Vector((-0.16, -1.238, 0.21)))
    v2 = bm_fsc.verts.new(Vector(( 0.16, -1.238, 0.21)))
    v3 = bm_fsc.verts.new(Vector(( 0.16, -1.212, 0.30)))
    v4 = bm_fsc.verts.new(Vector((-0.16, -1.212, 0.30)))
    f_fsc = bm_fsc.faces.new([v1, v2, v3, v4])
    f_fsc.material_index = 1
    uv_lf = bm_fsc.loops.layers.uv.new("UVMap")
    uvs_f = [Vector((0, 0)), Vector((1, 0)), Vector((1, 1)), Vector((0, 1))]
    for loop, uv in zip(f_fsc.loops, uvs_f):
        loop[uv_lf].uv = uv
    bm_fsc.to_mesh(f_sc_mesh)
    bm_fsc.free()
    f_sc_obj.data.materials.append(mats['DarkMetal'])
    f_sc_obj.data.materials.append(mats['Screen'])

    # 4B. Rear transom display ($200)
    r_sc_mesh = bpy.data.meshes.new("RearMoneyDisplayMesh")
    r_sc_obj = bpy.data.objects.new("RearMoneyDisplay", r_sc_mesh)
    bpy.context.collection.objects.link(r_sc_obj)
    r_sc_obj.parent = md_root
    bm_rsc = bmesh.new()
    res_rf = bmesh.ops.create_cube(bm_rsc, size=1.0, matrix=make_transform(Vector((0.0, 1.22, 0.46)), (0.48, 0.03, 0.14)))
    set_mat_for_verts(res_rf['verts'], 0)
    v1 = bm_rsc.verts.new(Vector(( 0.20, 1.238, 0.40)))
    v2 = bm_rsc.verts.new(Vector((-0.20, 1.238, 0.40)))
    v3 = bm_rsc.verts.new(Vector((-0.20, 1.238, 0.52)))
    v4 = bm_rsc.verts.new(Vector(( 0.20, 1.238, 0.52)))
    f_rsc = bm_rsc.faces.new([v1, v2, v3, v4])
    f_rsc.material_index = 1
    uv_lr = bm_rsc.loops.layers.uv.new("UVMap")
    uvs_r = [Vector((0, 0)), Vector((1, 0)), Vector((1, 1)), Vector((0, 1))]
    for loop, uv in zip(f_rsc.loops, uvs_r):
        loop[uv_lr].uv = uv
    bm_rsc.to_mesh(r_sc_mesh)
    bm_rsc.free()
    r_sc_obj.data.materials.append(mats['DarkMetal'])
    r_sc_obj.data.materials.append(mats['Screen'])

    # 5. CYBER COCKPIT WITH YOKE & TEARDROP BUBBLE WINDSCREEN
    cp_mesh = bpy.data.meshes.new("CockpitMesh")
    cp_obj = bpy.data.objects.new("Cockpit", cp_mesh)
    bpy.context.collection.objects.link(cp_obj)
    cp_obj.parent = car_root
    bm_cp = bmesh.new()

    # Monocoque tub
    res_tub = bmesh.ops.create_cube(bm_cp, size=1.0, matrix=make_transform(Vector((0.0, 0.0, 0.26)), (0.60, 0.58, 0.12)))
    set_mat_for_verts(res_tub['verts'], 0)
    # Low-slung Le Mans racing bucket seat
    res_st = bmesh.ops.create_cube(bm_cp, size=1.0, matrix=make_transform(Vector((0.0, 0.22, 0.48)), (0.40, 0.12, 0.40), Euler((math.radians(18), 0, 0))))
    set_mat_for_verts(res_st['verts'], 0)
    # Tesla Plaid butterfly/yoke steering wheel
    res_yk = bmesh.ops.create_cube(bm_cp, size=1.0, matrix=make_transform(Vector((0.0, -0.16, 0.46)), (0.28, 0.026, 0.11), Euler((math.radians(24), 0, 0))))
    set_mat_for_verts(res_yk['verts'], 0)
    # Yoke cyan center logo
    res_yk_logo = bmesh.ops.create_cube(bm_cp, size=1.0, matrix=make_transform(Vector((0.0, -0.174, 0.46)), (0.06, 0.010, 0.03), Euler((math.radians(24), 0, 0))))
    set_mat_for_verts(res_yk_logo['verts'], 2)

    # Wraparound Speedster Bubble Windscreen with Glowing Cyan Perimeter Seal
    res_ws = make_cylinder(bm_cp, cap_ends=False, segments=28, radius=0.45, depth=0.18, matrix=make_transform(Vector((0.0, -0.20, 0.48)), rot_euler=Euler((math.radians(38), 0, 0))))
    set_mat_for_verts(res_ws['verts'], 1)
    res_ws_rim = make_cylinder(bm_cp, cap_ends=False, segments=28, radius=0.454, depth=0.016, matrix=make_transform(Vector((0.0, -0.21, 0.57)), rot_euler=Euler((math.radians(38), 0, 0))))
    set_mat_for_verts(res_ws_rim['verts'], 2)

    bm_cp.to_mesh(cp_mesh)
    bm_cp.free()
    cp_obj.data.materials.append(mats['DarkMetal'])     # 0
    cp_obj.data.materials.append(mats['Glass'])         # 1
    cp_obj.data.materials.append(mats['NeonAccent'])    # 2
    for poly in cp_obj.data.polygons:
        poly.use_smooth = True

    # 6. HIGH-TECH CYBER ANDROID DRIVER (DAFT PUNK STYLE)
    d_mesh = bpy.data.meshes.new("Driver_Mesh")
    d_obj = bpy.data.objects.new("Driver", d_mesh)
    bpy.context.collection.objects.link(d_obj)
    d_obj.parent = car_root
    bm_d = bmesh.new()

    # Torso in carbon composite racing suit
    res_dt = bmesh.ops.create_cube(bm_d, size=1.0, matrix=make_transform(Vector((0.0, 0.02, 0.44)), (0.34, 0.24, 0.30)))
    set_mat_for_verts(res_dt['verts'], 0)
    # Glowing cyan cybernetic chest core
    res_dc = make_cylinder(bm_d, cap_ends=True, segments=16, radius=0.045, depth=0.02, matrix=make_transform(Vector((0.0, -0.10, 0.46)), rot_euler=Euler((math.radians(90), 0, 0))))
    set_mat_for_verts(res_dc['verts'], 2)

    # Aerodynamic pearl-white helmet with sculpted chin & collar
    res_dh = bmesh.ops.create_uvsphere(bm_d, u_segments=20, v_segments=16, radius=0.14, matrix=make_transform(Vector((0.0, 0.02, 0.70)), scale=(1.0, 1.12, 1.05)))
    set_mat_for_verts(res_dh['verts'], 1)
    # Helmet neck collar
    res_nc = make_cylinder(bm_d, cap_ends=True, segments=16, radius=0.09, depth=0.04, matrix=make_transform(Vector((0.0, 0.02, 0.58))))
    set_mat_for_verts(res_nc['verts'], 0)
    # Side aerodynamic comms pods
    for sign_x in [-1, 1]:
        res_pod = make_cylinder(bm_d, cap_ends=True, segments=12, radius=0.035, depth=0.025, matrix=make_transform(Vector((sign_x * 0.135, 0.02, 0.70)), rot_euler=Euler((0, math.radians(90), 0))))
        set_mat_for_verts(res_pod['verts'], 0)

    # Curved dark visor with glowing electric cyan holographic digital eyes
    res_vs_bg = bmesh.ops.create_cube(bm_d, size=1.0, matrix=make_transform(Vector((0.0, -0.09, 0.71)), (0.20, 0.03, 0.065)))
    set_mat_for_verts(res_vs_bg['verts'], 0)
    res_vs_glow = bmesh.ops.create_cube(bm_d, size=1.0, matrix=make_transform(Vector((0.0, -0.105, 0.71)), (0.17, 0.012, 0.035)))
    set_mat_for_verts(res_vs_glow['verts'], 2)

    bm_d.to_mesh(d_mesh)
    bm_d.free()
    d_obj.data.materials.append(mats['DarkMetal'])          # 0
    d_obj.data.materials.append(mats['CyberRobotWhite'])    # 1
    d_obj.data.materials.append(mats['NeonAccent'])         # 2
    for poly in d_obj.data.polygons:
        poly.use_smooth = True

    # 7. ULTRA-THIN CARBON ANTENNA WITH CYAN HALO RING (SCALED TO Z = 1.40m)
    ant_mesh = bpy.data.meshes.new("AntennaMesh")
    ant_obj = bpy.data.objects.new("Antenna", ant_mesh)
    bpy.context.collection.objects.link(ant_obj)
    ant_obj.parent = car_root
    bm_ant = bmesh.new()
    # Antenna base collar
    res_col = make_cylinder(bm_ant, radius=0.025, depth=0.04, segments=12, matrix=make_transform(Vector((0.0, 0.40, 0.58))))
    set_mat_for_verts(res_col['verts'], 0)
    # Sleek carbon fiber antenna rod ending at Z = 1.34m
    res_am = make_cylinder(bm_ant, radius=0.009, depth=0.74, segments=12, matrix=make_transform(Vector((0.0, 0.40, 0.95))))
    set_mat_for_verts(res_am['verts'], 0)
    bm_ant.to_mesh(ant_mesh)
    bm_ant.free()
    ant_obj.data.materials.append(mats['Carbon'])

    # Contact Head: High-tech glowing cyan magnetic toroidal halo ring centered at Z = 1.40m
    ch_mesh = bpy.data.meshes.new("ContactHeadMesh")
    ch_obj = bpy.data.objects.new("ContactHead", ch_mesh)
    ch_obj.location = Vector((0.0, 0.40, 1.40))
    bpy.context.collection.objects.link(ch_obj)
    ch_obj.parent = ant_obj
    bm_ch = bmesh.new()
    # Outer magnetic halo ring
    res_ring = make_cylinder(bm_ch, radius=0.12, depth=0.028, segments=24, matrix=make_transform(Vector((0, 0, 0)), rot_euler=Euler((math.radians(90), 0, 0))))
    set_mat_for_verts(res_ring['verts'], 0)
    # Center emitter core
    res_core = bmesh.ops.create_uvsphere(bm_ch, u_segments=12, v_segments=8, radius=0.042)
    set_mat_for_verts(res_core['verts'], 0)
    bm_ch.to_mesh(ch_mesh)
    bm_ch.free()
    ch_obj.data.materials.append(mats['NeonAccent'])

    # 8. WHEELS & WELLS
    create_wheel_wells(car_root, mats, track, wheelbase, well_radius=0.30)
    build_single_wheel("Wheel_FL", car_root, mats, 'tsla_racer', Vector((-track, -wheelbase, 0.26)), True)
    build_single_wheel("Wheel_FR", car_root, mats, 'tsla_racer', Vector(( track, -wheelbase, 0.26)), True)
    build_single_wheel("Wheel_RL", car_root, mats, 'tsla_racer', Vector((-track,  wheelbase, 0.26)), False)
    build_single_wheel("Wheel_RR", car_root, mats, 'tsla_racer', Vector(( track,  wheelbase, 0.26)), False)

    out_path = os.path.join(MODELS_OUT, "tsla_racer.glb")
    print(f"Exporting TSLA RACER to {out_path}...")
    bpy.ops.export_scene.gltf(filepath=out_path, export_format='GLB', use_selection=False, export_yup=True, export_apply=True)
    print("=== TSLA RACER EXPORTED ===")



# =============================================================================
# 3. NVDA AI (STEALTH / CHISELED FACETED POLYGONAL FIGHTER)
# =============================================================================
def build_nvda_ai_model():
    print("=== Building AAA NVDA AI Model (Faceted Stealth Interceptor) ===")
    clean_scene()
    mats = setup_materials_for_car('nvda_ai', (0.75, 0.33, 0.92))
    car_root = bpy.data.objects.new("CarRoot", None)
    bpy.context.collection.objects.link(car_root)

    track = 0.82
    wheelbase = 0.77

    # 1. BODY SHELL: Hard-edged polygonal chamfers with stealth facet geometry
    body_mesh = bpy.data.meshes.new("BodyMesh")
    body_obj = bpy.data.objects.new("Body", body_mesh)
    bpy.context.collection.objects.link(body_obj)
    body_obj.parent = car_root
    bm = bmesh.new()

    sections = [
        {"y": -1.30, "hw": 0.52, "zt": 0.36, "zp": 0.42, "zw": 0.30, "zb": 0.18}, # Chiseled nose tip
        {"y": -1.18, "hw": 0.68, "zt": 0.44, "zp": 0.54, "zw": 0.38, "zb": 0.18},
        {"y": -1.04, "hw": 0.82, "zt": 0.49, "zp": 0.62, "zw": 0.46, "zb": 0.18}, # Over front axle
        {"y": -0.88, "hw": 0.92, "zt": 0.53, "zp": 0.66, "zw": 0.54, "zb": 0.18}, # Front fender peak
        {"y": -0.76, "hw": 0.94, "zt": 0.55, "zp": 0.67, "zw": 0.56, "zb": 0.18},
        {"y": -0.62, "hw": 0.90, "zt": 0.56, "zp": 0.65, "zw": 0.50, "zb": 0.18},
        {"y": -0.44, "hw": 0.82, "zt": 0.58, "zp": 0.64, "zw": 0.44, "zb": 0.18}, # Stealth waist pinch
        {"y": -0.26, "hw": 0.78, "zt": 0.62, "zp": 0.65, "zw": 0.42, "zb": 0.18},
        {"y": -0.08, "hw": 0.76, "zt": 0.40, "zp": 0.66, "zw": 0.42, "zb": 0.18}, # Cockpit opening
        {"y":  0.12, "hw": 0.76, "zt": 0.40, "zp": 0.67, "zw": 0.42, "zb": 0.18},
        {"y":  0.32, "hw": 0.84, "zt": 0.68, "zp": 0.74, "zw": 0.48, "zb": 0.18}, # Rear canopy transition
        {"y":  0.52, "hw": 0.92, "zt": 0.72, "zp": 0.78, "zw": 0.54, "zb": 0.18},
        {"y":  0.68, "hw": 0.98, "zt": 0.74, "zp": 0.82, "zw": 0.60, "zb": 0.18}, # Over rear axle
        {"y":  0.78, "hw": 1.00, "zt": 0.75, "zp": 0.83, "zw": 0.62, "zb": 0.18}, # Rear haunch peak
        {"y":  0.92, "hw": 0.96, "zt": 0.76, "zp": 0.81, "zw": 0.56, "zb": 0.18},
        {"y":  1.06, "hw": 0.88, "zt": 0.77, "zp": 0.79, "zw": 0.50, "zb": 0.18},
        {"y":  1.20, "hw": 0.78, "zt": 0.78, "zp": 0.76, "zw": 0.44, "zb": 0.18},
        {"y":  1.28, "hw": 0.68, "zt": 0.78, "zp": 0.74, "zw": 0.38, "zb": 0.18}, # Rear faceted transom
    ]

    build_quad_body_shell(bm, sections, wheelbase, -1.30, 1.28)

    # DUAL FORWARD-JUTTING STEALTH CHIN FANGS & CENTRAL HEX INTAKE
    for sign_x in [-1, 1]:
        fang_rot = Euler((math.radians(10), 0, math.radians(-sign_x * 12)))
        # Carbon fang wedge
        res_fang = bmesh.ops.create_cube(bm, size=1.0, matrix=make_transform(Vector((sign_x * 0.46, -1.28, 0.22)), (0.20, 0.34, 0.10), rot_euler=fang_rot))
        set_mat_for_verts(res_fang['verts'], 1) # Carbon
        # Glowing lime under-splitter blade
        res_lip = bmesh.ops.create_cube(bm, size=1.0, matrix=make_transform(Vector((sign_x * 0.47, -1.33, 0.17)), (0.22, 0.28, 0.025), rot_euler=fang_rot))
        set_mat_for_verts(res_lip['verts'], 3) # LimeAccent

    # Razor continuous lime DRL lightbar across nose
    res_drl = bmesh.ops.create_cube(bm, size=1.0, matrix=make_transform(Vector((0.0, -1.29, 0.36)), (0.76, 0.03, 0.025)))
    set_mat_for_verts(res_drl['verts'], 3) # LimeAccent

    # Central Recessed Hex Airflow Intake
    res_intake = bmesh.ops.create_cube(bm, size=1.0, matrix=make_transform(Vector((0.0, -1.25, 0.28)), (0.36, 0.04, 0.10)))
    set_mat_for_verts(res_intake['verts'], 1) # Carbon

    # TWIN CANTED VERTICAL STABILIZER FINS (18° Outward)
    for sign_x in [-1, 1]:
        fin_rot = Euler((math.radians(12), math.radians(sign_x * 18), 0))
        # Main carbon fin blade
        res_wf = bmesh.ops.create_cube(bm, size=1.0, matrix=make_transform(Vector((sign_x * 0.68, 0.90, 0.98)), (0.035, 0.52, 0.32), rot_euler=fin_rot))
        set_mat_for_verts(res_wf['verts'], 1) # Carbon
        # Lime leading edge
        res_lead = bmesh.ops.create_cube(bm, size=1.0, matrix=make_transform(Vector((sign_x * 0.67, 0.68, 0.98)), (0.02, 0.03, 0.30), rot_euler=fin_rot))
        set_mat_for_verts(res_lead['verts'], 3) # LimeAccent
        # Glowing purple trailing edge
        res_edge = bmesh.ops.create_cube(bm, size=1.0, matrix=make_transform(Vector((sign_x * 0.69, 1.15, 0.98)), (0.02, 0.03, 0.30), rot_euler=fin_rot))
        set_mat_for_verts(res_edge['verts'], 2) # PurpleAccent

    bm.to_mesh(body_mesh)
    bm.free()
    body_obj.data.materials.append(mats['BodyPaint'])     # 0
    body_obj.data.materials.append(mats['Carbon'])        # 1
    body_obj.data.materials.append(mats['PurpleAccent'])  # 2
    body_obj.data.materials.append(mats['LimeAccent'])    # 3

    subsurf = body_obj.modifiers.new(name="Subdivision", type='SUBSURF')
    subsurf.levels = 1
    for poly in body_obj.data.polygons:
        poly.use_smooth = True

    # 2. CONTINUOUS GEOMETRIC COMPOSITE BUMPER
    bumper_pts = [
        Vector((0.0, -1.34, 0.12)),
        Vector((0.44, -1.30, 0.12)),
        Vector((0.78, -1.16, 0.12)),
        Vector((0.98, -0.90, 0.12)),
        Vector((1.00, -0.68, 0.12)),
        Vector((0.88, -0.22, 0.12)),
        Vector((0.88,  0.22, 0.12)),
        Vector((1.04,  0.70, 0.12)),
        Vector((1.00,  0.96, 0.12)),
        Vector((0.82,  1.18, 0.12)),
        Vector((0.48,  1.32, 0.12)),
        Vector((0.0,   1.34, 0.12)),
    ]
    build_thick_bumper(car_root, mats, bumper_pts, pw=0.085, ph=0.065, neon_slot='PurpleAccent')

    # 3. DIAGONAL ARROWHEAD HEADLIGHTS (> <) & TAILLIGHTS
    for sign, side in [(-1, 'L'), (1, 'R')]:
        hl_mesh = bpy.data.meshes.new(f"Headlight_{side}_Mesh")
        hl_obj = bpy.data.objects.new(f"Headlight_{side}", hl_mesh)
        hl_obj.location = Vector((sign * 0.42, -1.22, 0.48))
        bpy.context.collection.objects.link(hl_obj)
        hl_obj.parent = car_root
        bm_hl = bmesh.new()

        # Diagonal sharp LED arrow
        res_h = bmesh.ops.create_cube(bm_hl, size=1.0, matrix=make_transform(Vector((0, 0, 0)), (0.24, 0.04, 0.08), rot_euler=Euler((0, 0, math.radians(sign * 28)))))
        set_mat_for_verts(res_h['verts'], 0)
        # Projector core
        res_p = make_cylinder(bm_hl, radius=0.032, depth=0.03, segments=12, matrix=make_transform(Vector((sign * 0.04, -0.015, 0)), rot_euler=Euler((math.radians(90), 0, 0))))
        set_mat_for_verts(res_p['verts'], 1)

        bm_hl.to_mesh(hl_mesh)
        bm_hl.free()
        hl_obj.data.materials.append(mats['LimeAccent'])
        hl_obj.data.materials.append(mats['Headlight'])

        tl_mesh = bpy.data.meshes.new(f"TailLight_{side}_Mesh")
        tl_obj = bpy.data.objects.new(f"TailLight_{side}", tl_mesh)
        tl_obj.location = Vector((sign * 0.44, 1.24, 0.72))
        bpy.context.collection.objects.link(tl_obj)
        tl_obj.parent = car_root
        bm_tl = bmesh.new()
        res_t = bmesh.ops.create_cube(bm_tl, size=1.0, matrix=make_transform(Vector((0, 0, 0)), (0.26, 0.04, 0.08), rot_euler=Euler((0, 0, math.radians(-sign * 22)))))
        set_mat_for_verts(res_t['verts'], 0)
        bm_tl.to_mesh(tl_mesh)
        bm_tl.free()
        tl_obj.data.materials.append(mats['Taillight'])

    # 4. FRONT MONEY DISPLAY ($150)
    f_sc_mesh = bpy.data.meshes.new("FrontMoneyDisplayMesh")
    f_sc_obj = bpy.data.objects.new("FrontMoneyDisplay", f_sc_mesh)
    bpy.context.collection.objects.link(f_sc_obj)
    f_sc_obj.parent = car_root
    bm_fsc = bmesh.new()
    res_ff = bmesh.ops.create_cube(bm_fsc, size=1.0, matrix=make_transform(Vector((0.0, -1.24, 0.32)), (0.46, 0.04, 0.14), Euler((math.radians(18), 0, 0))))
    set_mat_for_verts(res_ff['verts'], 0)
    v1 = bm_fsc.verts.new(Vector((-0.20, -1.262, 0.25)))
    v2 = bm_fsc.verts.new(Vector(( 0.20, -1.262, 0.25)))
    v3 = bm_fsc.verts.new(Vector(( 0.20, -1.232, 0.39)))
    v4 = bm_fsc.verts.new(Vector((-0.20, -1.232, 0.39)))
    f_fsc = bm_fsc.faces.new([v1, v2, v3, v4])
    f_fsc.material_index = 1
    uv_lf = bm_fsc.loops.layers.uv.new("UVMap")
    uvs_f = [Vector((0, 0)), Vector((1, 0)), Vector((1, 1)), Vector((0, 1))]
    for loop, uv in zip(f_fsc.loops, uvs_f):
        loop[uv_lf].uv = uv
    bm_fsc.to_mesh(f_sc_mesh)
    bm_fsc.free()
    f_sc_obj.data.materials.append(mats['DarkMetal'])
    f_sc_obj.data.materials.append(mats['Screen'])

    # 5. CHISELED COCKPIT WITH ANGLED STEALTH WINDSCREEN
    cp_mesh = bpy.data.meshes.new("CockpitMesh")
    cp_obj = bpy.data.objects.new("Cockpit", cp_mesh)
    bpy.context.collection.objects.link(cp_obj)
    cp_obj.parent = car_root
    bm_cp = bmesh.new()

    res_tub = bmesh.ops.create_cube(bm_cp, size=1.0, matrix=make_transform(Vector((0.0, 0.02, 0.40)), (0.66, 0.64, 0.14)))
    set_mat_for_verts(res_tub['verts'], 0)
    res_st = bmesh.ops.create_cube(bm_cp, size=1.0, matrix=make_transform(Vector((0.0, 0.26, 0.68)), (0.46, 0.12, 0.46), Euler((math.radians(16), 0, 0))))
    set_mat_for_verts(res_st['verts'], 0)
    # Angular Cyber Steering Wheel
    res_sw = make_cylinder(bm_cp, radius=0.13, depth=0.03, segments=6, matrix=make_transform(Vector((0.0, -0.16, 0.64)), rot_euler=Euler((math.radians(28), 0, 0))))
    set_mat_for_verts(res_sw['verts'], 1)
    # Angled Polygonal Smoked Glass Deflector
    res_ws = bmesh.ops.create_cube(bm_cp, size=1.0, matrix=make_transform(Vector((0.0, -0.22, 0.64)), (0.58, 0.02, 0.16), Euler((math.radians(34), 0, 0))))
    set_mat_for_verts(res_ws['verts'], 2)

    bm_cp.to_mesh(cp_mesh)
    bm_cp.free()
    cp_obj.data.materials.append(mats['DarkMetal'])
    cp_obj.data.materials.append(mats['Carbon'])
    cp_obj.data.materials.append(mats['Glass'])

    # 6. FACETED CYBER BOT DRIVER (AI NEURAL CORE)
    d_mesh = bpy.data.meshes.new("Driver_Mesh")
    d_obj = bpy.data.objects.new("Driver", d_mesh)
    bpy.context.collection.objects.link(d_obj)
    d_obj.parent = car_root
    bm_d = bmesh.new()

    # Torso: Carbon chest plate with glowing neural circuit lines
    res_dt = bmesh.ops.create_cube(bm_d, size=1.0, matrix=make_transform(Vector((0.0, 0.02, 0.62)), (0.44, 0.30, 0.38)))
    set_mat_for_verts(res_dt['verts'], 0) # Carbon
    # Chest power core
    res_core = bmesh.ops.create_cube(bm_d, size=1.0, matrix=make_transform(Vector((0.0, -0.14, 0.64)), (0.12, 0.02, 0.12)))
    set_mat_for_verts(res_core['verts'], 2) # LimeAccent
    # Angled shoulder pauldrons
    for sign_p in [-1, 1]:
        res_pld = bmesh.ops.create_cube(bm_d, size=1.0, matrix=make_transform(Vector((sign_p * 0.25, 0.02, 0.72)), (0.12, 0.16, 0.08), Euler((0, math.radians(sign_p * 18), 0))))
        set_mat_for_verts(res_pld['verts'], 0) # Carbon
    # Hydraulic cyber collar
    res_col = make_cylinder(bm_d, radius=0.12, depth=0.08, segments=12, matrix=make_transform(Vector((0.0, 0.02, 0.82))))
    set_mat_for_verts(res_col['verts'], 1) # DarkMetal

    # Sculpted Mecha Helmet Dome
    res_dh = bmesh.ops.create_uvsphere(bm_d, u_segments=16, v_segments=12, radius=0.17, matrix=make_transform(Vector((0.0, 0.02, 0.95)), (0.95, 1.05, 1.0), Euler((math.radians(10), 0, 0))))
    set_mat_for_verts(res_dh['verts'], 1) # DarkMetal

    # Angled Side Cheek Armor Plates & Comms Pods
    for sign_c in [-1, 1]:
        res_chk = bmesh.ops.create_cube(bm_d, size=1.0, matrix=make_transform(Vector((sign_c * 0.15, -0.02, 0.92)), (0.04, 0.18, 0.14), Euler((0, 0, math.radians(-sign_c * 15)))))
        set_mat_for_verts(res_chk['verts'], 0) # Carbon
        res_pod = make_cylinder(bm_d, radius=0.032, depth=0.035, segments=10, matrix=make_transform(Vector((sign_c * 0.18, 0.02, 0.95)), rot_euler=Euler((0, math.radians(90), 0))))
        set_mat_for_verts(res_pod['verts'], 2) # LimeAccent

    # Chin rebreather / cyber jaw
    res_jaw = bmesh.ops.create_cube(bm_d, size=1.0, matrix=make_transform(Vector((0.0, -0.12, 0.86)), (0.12, 0.10, 0.08), Euler((math.radians(20), 0, 0))))
    set_mat_for_verts(res_jaw['verts'], 1) # DarkMetal

    # Glowing radioactive lime pixel matrix visor / eyes
    res_fc = bmesh.ops.create_cube(bm_d, size=1.0, matrix=make_transform(Vector((0.0, -0.14, 0.95)), (0.22, 0.03, 0.10), Euler((math.radians(12), 0, 0))))
    set_mat_for_verts(res_fc['verts'], 2) # LimeAccent

    bm_d.to_mesh(d_mesh)
    bm_d.free()
    d_obj.data.materials.append(mats['Carbon'])       # 0
    d_obj.data.materials.append(mats['DarkMetal'])    # 1
    d_obj.data.materials.append(mats['LimeAccent'])   # 2

    # 7. REAR TRANSOM & MONEY DISPLAY ($150)
    md_mesh = bpy.data.meshes.new("MoneyDisplayMesh")
    md_obj = bpy.data.objects.new("MoneyDisplay", md_mesh)
    bpy.context.collection.objects.link(md_obj)
    md_obj.parent = car_root
    bm_md = bmesh.new()
    res_rf = bmesh.ops.create_cube(bm_md, size=1.0, matrix=make_transform(Vector((0.0, 1.25, 0.58)), (0.60, 0.04, 0.20)))
    set_mat_for_verts(res_rf['verts'], 0)
    v1 = bm_md.verts.new(Vector(( 0.26, 1.275, 0.49)))
    v2 = bm_md.verts.new(Vector((-0.26, 1.275, 0.49)))
    v3 = bm_md.verts.new(Vector((-0.26, 1.275, 0.67)))
    v4 = bm_md.verts.new(Vector(( 0.26, 1.275, 0.67)))
    f_md = bm_md.faces.new([v1, v2, v3, v4])
    f_md.material_index = 1
    uv_l = bm_md.loops.layers.uv.new("UVMap")
    uvs = [Vector((0, 0)), Vector((1, 0)), Vector((1, 1)), Vector((0, 1))]
    for loop, uv in zip(f_md.loops, uvs):
        loop[uv_l].uv = uv

    bm_md.to_mesh(md_mesh)
    bm_md.free()
    md_obj.data.materials.append(mats['DarkMetal'])
    md_obj.data.materials.append(mats['Screen'])

    # 8. SEGMENTED CYBERNETIC NEURAL ANTENNA WITH CALIBRATED HEIGHT (Z = 1.35m)
    ant_mesh = bpy.data.meshes.new("AntennaMesh")
    ant_obj = bpy.data.objects.new("Antenna", ant_mesh)
    bpy.context.collection.objects.link(ant_obj)
    ant_obj.parent = car_root
    bm_ant = bmesh.new()
    # 4-stage segmented neural conduit ending at Z = 0.98m
    for seg_i in range(4):
        sz_rad = 0.022 - seg_i * 0.003
        seg_z = 0.70 + seg_i * 0.09
        res_seg = make_cylinder(bm_ant, radius=sz_rad, depth=0.08, segments=12, matrix=make_transform(Vector((0.0, 0.58, seg_z))))
        set_mat_for_verts(res_seg['verts'], 0) # DarkMetal
        # Glowing purple neural joint ring
        res_ring = make_cylinder(bm_ant, radius=sz_rad * 1.35, depth=0.015, segments=12, matrix=make_transform(Vector((0.0, 0.58, seg_z + 0.04))))
        set_mat_for_verts(res_ring['verts'], 1) # PurpleAccent

    bm_ant.to_mesh(ant_mesh)
    bm_ant.free()
    ant_obj.data.materials.append(mats['DarkMetal'])     # 0
    ant_obj.data.materials.append(mats['PurpleAccent'])  # 1

    # Contact head centered at Z = 1.35m (matching NVDA_AI_CONFIG.dimensions.antennaHeight: 1.35)
    ch_mesh = bpy.data.meshes.new("ContactHeadMesh")
    ch_obj = bpy.data.objects.new("ContactHead", ch_mesh)
    ch_obj.location = Vector((0.0, 0.58, 1.35))
    bpy.context.collection.objects.link(ch_obj)
    ch_obj.parent = ant_obj
    bm_ch = bmesh.new()
    res_orb = bmesh.ops.create_uvsphere(bm_ch, u_segments=16, v_segments=12, radius=0.11)
    set_mat_for_verts(res_orb['verts'], 0)
    # Surrounding hex neural ring
    res_hring = make_cylinder(bm_ch, radius=0.16, depth=0.018, segments=6, matrix=make_transform(Vector((0, 0, 0))))
    set_mat_for_verts(res_hring['verts'], 1)

    bm_ch.to_mesh(ch_mesh)
    bm_ch.free()
    ch_obj.data.materials.append(mats['PurpleAccent']) # 0
    ch_obj.data.materials.append(mats['LimeAccent'])   # 1

    # 9. WHEELS & WELLS
    create_wheel_wells(car_root, mats, track, wheelbase)
    build_single_wheel("Wheel_FL", car_root, mats, 'nvda_ai', Vector((-track, -wheelbase, 0.28)), True)
    build_single_wheel("Wheel_FR", car_root, mats, 'nvda_ai', Vector(( track, -wheelbase, 0.28)), True)
    build_single_wheel("Wheel_RL", car_root, mats, 'nvda_ai', Vector((-track,  wheelbase, 0.28)), False)
    build_single_wheel("Wheel_RR", car_root, mats, 'nvda_ai', Vector(( track,  wheelbase, 0.28)), False)

    out_path = os.path.join(MODELS_OUT, "nvda_ai.glb")
    print(f"Exporting NVDA AI to {out_path}...")
    bpy.ops.export_scene.gltf(filepath=out_path, export_format='GLB', use_selection=False, export_yup=True, export_apply=True)
    print("=== NVDA AI EXPORTED ===")


# =============================================================================
# 4. GOLD WHALE (LUXURY / SPEEDBOAT HYPER-GT / DUAL GOLD MASTS)
# =============================================================================
def build_gold_whale_model():
    print("=== Building AAA GOLD WHALE Model ===")
    clean_scene()
    mats = setup_materials_for_car('gold_whale', (1.0, 0.84, 0.0))
    car_root = bpy.data.objects.new("CarRoot", None)
    bpy.context.collection.objects.link(car_root)

    track = 0.88
    wheelbase = 0.82

    # 1. BODY SHELL: Elevated yacht bow prow, voluptuous pontoon fenders, yacht tail deck
    body_mesh = bpy.data.meshes.new("BodyMesh")
    body_obj = bpy.data.objects.new("Body", body_mesh)
    bpy.context.collection.objects.link(body_obj)
    body_obj.parent = car_root
    bm = bmesh.new()

    sections = [
        {"y": -1.38, "hw": 0.66, "zt": 0.66, "zp": 0.70, "zw": 0.50, "zb": 0.22},
        {"y": -1.24, "hw": 0.80, "zt": 0.68, "zp": 0.72, "zw": 0.54, "zb": 0.22},
        {"y": -1.08, "hw": 0.92, "zt": 0.70, "zp": 0.76, "zw": 0.58, "zb": 0.22},
        {"y": -0.92, "hw": 1.02, "zt": 0.72, "zp": 0.80, "zw": 0.64, "zb": 0.22},
        {"y": -0.82, "hw": 1.06, "zt": 0.73, "zp": 0.82, "zw": 0.68, "zb": 0.22},
        {"y": -0.68, "hw": 1.00, "zt": 0.74, "zp": 0.80, "zw": 0.62, "zb": 0.22},
        {"y": -0.50, "hw": 0.94, "zt": 0.76, "zp": 0.78, "zw": 0.56, "zb": 0.22},
        {"y": -0.30, "hw": 0.88, "zt": 0.77, "zp": 0.77, "zw": 0.54, "zb": 0.22},
        {"y": -0.10, "hw": 0.86, "zt": 0.50, "zp": 0.76, "zw": 0.52, "zb": 0.22},
        {"y":  0.10, "hw": 0.86, "zt": 0.50, "zp": 0.76, "zw": 0.52, "zb": 0.22},
        {"y":  0.30, "hw": 0.94, "zt": 0.78, "zp": 0.82, "zw": 0.58, "zb": 0.22},
        {"y":  0.50, "hw": 1.02, "zt": 0.80, "zp": 0.85, "zw": 0.64, "zb": 0.22},
        {"y":  0.70, "hw": 1.10, "zt": 0.82, "zp": 0.88, "zw": 0.70, "zb": 0.22},
        {"y":  0.82, "hw": 1.12, "zt": 0.83, "zp": 0.89, "zw": 0.72, "zb": 0.22},
        {"y":  0.96, "hw": 1.06, "zt": 0.84, "zp": 0.87, "zw": 0.68, "zb": 0.22},
        {"y":  1.12, "hw": 0.96, "zt": 0.84, "zp": 0.84, "zw": 0.60, "zb": 0.22},
        {"y":  1.26, "hw": 0.84, "zt": 0.84, "zp": 0.80, "zw": 0.52, "zb": 0.22},
        {"y":  1.38, "hw": 0.70, "zt": 0.84, "zp": 0.76, "zw": 0.44, "zb": 0.22},
    ]

    build_quad_body_shell(bm, sections, wheelbase, -1.38, 1.38, arch_rad=0.34)

    # Twin speedster rollover nacelles behind headrest
    for sign_x in [-1, 1]:
        res_n = make_cylinder(bm, radius=0.18, depth=0.86, segments=16, matrix=make_transform(Vector((sign_x * 0.38, 0.58, 0.86)), (1.0, 1.0, 0.75), rot_euler=Euler((math.radians(82), 0, 0))))
        set_mat_for_verts(res_n['verts'], 1)

    # 24K Gold Hood Center Ridge & Prow Diamond Mascot
    res_ridge = bmesh.ops.create_cube(bm, size=1.0, matrix=make_transform(Vector((0.0, -0.90, 0.74)), (0.04, 0.95, 0.03)))
    set_mat_for_verts(res_ridge['verts'], 1)
    res_dia = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=8, radius1=0.045, radius2=0.005, depth=0.08, matrix=make_transform(Vector((0.0, -1.36, 0.74)), rot_euler=Euler((math.radians(180), 0, 0))))
    set_mat_for_verts(res_dia['verts'], 1)

    bm.to_mesh(body_mesh)
    bm.free()
    body_obj.data.materials.append(mats['BodyPaint'])
    body_obj.data.materials.append(mats['Gold'])

    subsurf = body_obj.modifiers.new(name="Subdivision", type='SUBSURF')
    subsurf.levels = 2
    for poly in body_obj.data.polygons:
        poly.use_smooth = True

    # 2. CONTINUOUS GILDED LUXURY BUMPER
    bumper_pts = [
        Vector((0.0, -1.45, 0.11)),
        Vector((0.46, -1.42, 0.11)),
        Vector((0.84, -1.28, 0.11)),
        Vector((1.08, -1.02, 0.11)),
        Vector((1.12, -0.78, 0.11)),
        Vector((1.00, -0.25, 0.11)),
        Vector((1.00,  0.25, 0.11)),
        Vector((1.14,  0.78, 0.11)),
        Vector((1.12,  1.08, 0.11)),
        Vector((0.92,  1.34, 0.11)),
        Vector((0.52,  1.46, 0.11)),
        Vector((0.0,   1.48, 0.11)),
    ]
    build_thick_bumper(car_root, mats, bumper_pts, pw=0.088, ph=0.068, neon_slot='NeonAccent')

    # 3. OPULENT VERTICAL WATERFALL 24K GOLD GRILLE & ROUND JEWEL HEADLIGHTS
    grille_mesh = bpy.data.meshes.new("GrilleMesh")
    grille_obj = bpy.data.objects.new("Grille", grille_mesh)
    bpy.context.collection.objects.link(grille_obj)
    grille_obj.parent = car_root
    bm_gr = bmesh.new()

    # Fluted outer gold surround frame
    res_gf = bmesh.ops.create_cube(bm_gr, size=1.0, matrix=make_transform(Vector((0.0, -1.39, 0.50)), (0.54, 0.04, 0.24)))
    set_mat_for_verts(res_gf['verts'], 0)
    # 9 vertical waterfall gold grille flutes
    for vi in range(9):
        vx = (vi - 4) * 0.052
        res_fl = make_cylinder(bm_gr, radius=0.012, depth=0.20, segments=12, matrix=make_transform(Vector((vx, -1.41, 0.50))))
        set_mat_for_verts(res_fl['verts'], 0)

    bm_gr.to_mesh(grille_mesh)
    bm_gr.free()
    grille_obj.data.materials.append(mats['Gold'])

    # Round Jewel Projector Headlights with Diamond-Cut Facets
    for sign, side in [(-1, 'L'), (1, 'R')]:
        hl_mesh = bpy.data.meshes.new(f"Headlight_{side}_Mesh")
        hl_obj = bpy.data.objects.new(f"Headlight_{side}", hl_mesh)
        hl_obj.location = Vector((sign * 0.44, -1.32, 0.56))
        bpy.context.collection.objects.link(hl_obj)
        hl_obj.parent = car_root
        bm_hl = bmesh.new()

        # Gold bezel ring
        res_r = make_cylinder(bm_hl, radius=0.082, depth=0.03, segments=18, matrix=make_transform(Vector((0, 0, 0)), rot_euler=Euler((math.radians(90), 0, 0))))
        set_mat_for_verts(res_r['verts'], 0)
        # Diamond jewel projector core
        res_j = make_cylinder(bm_hl, radius=0.068, depth=0.04, segments=18, matrix=make_transform(Vector((0, -0.015, 0)), rot_euler=Euler((math.radians(90), 0, 0))))
        set_mat_for_verts(res_j['verts'], 1)
        # Clear curved glass cover
        res_g = make_cylinder(bm_hl, radius=0.078, depth=0.01, segments=18, matrix=make_transform(Vector((0, -0.035, 0)), rot_euler=Euler((math.radians(90), 0, 0))))
        set_mat_for_verts(res_g['verts'], 2)

        bm_hl.to_mesh(hl_mesh)
        bm_hl.free()
        hl_obj.data.materials.append(mats['Gold'])
        hl_obj.data.materials.append(mats['Headlight'])
        hl_obj.data.materials.append(mats['Glass'])

        # Taillights
        tl_mesh = bpy.data.meshes.new(f"TailLight_{side}_Mesh")
        tl_obj = bpy.data.objects.new(f"TailLight_{side}", tl_mesh)
        tl_obj.location = Vector((sign * 0.48, 1.34, 0.68))
        bpy.context.collection.objects.link(tl_obj)
        tl_obj.parent = car_root
        bm_tl = bmesh.new()
        res_t = bmesh.ops.create_cube(bm_tl, size=1.0, matrix=make_transform(Vector((0, 0, 0)), (0.24, 0.04, 0.12)))
        set_mat_for_verts(res_t['verts'], 0)
        bm_tl.to_mesh(tl_mesh)
        bm_tl.free()
        tl_obj.data.materials.append(mats['Taillight'])

    # 4. FRONT MONEY DISPLAY ($500) EMBEDDED IN LOWER VALENCE
    f_sc_mesh = bpy.data.meshes.new("FrontMoneyDisplayMesh")
    f_sc_obj = bpy.data.objects.new("FrontMoneyDisplay", f_sc_mesh)
    bpy.context.collection.objects.link(f_sc_obj)
    f_sc_obj.parent = car_root
    bm_fsc = bmesh.new()
    res_ff = bmesh.ops.create_cube(bm_fsc, size=1.0, matrix=make_transform(Vector((0.0, -1.37, 0.30)), (0.48, 0.04, 0.14)))
    set_mat_for_verts(res_ff['verts'], 0)
    v1 = bm_fsc.verts.new(Vector((-0.21, -1.392, 0.23)))
    v2 = bm_fsc.verts.new(Vector(( 0.21, -1.392, 0.23)))
    v3 = bm_fsc.verts.new(Vector(( 0.21, -1.392, 0.37)))
    v4 = bm_fsc.verts.new(Vector((-0.21, -1.392, 0.37)))
    f_fsc = bm_fsc.faces.new([v1, v2, v3, v4])
    f_fsc.material_index = 1
    uv_lf = bm_fsc.loops.layers.uv.new("UVMap")
    uvs_f = [Vector((0, 0)), Vector((1, 0)), Vector((1, 1)), Vector((0, 1))]
    for loop, uv in zip(f_fsc.loops, uvs_f):
        loop[uv_lf].uv = uv
    bm_fsc.to_mesh(f_sc_mesh)
    bm_fsc.free()
    f_sc_obj.data.materials.append(mats['Gold'])
    f_sc_obj.data.materials.append(mats['Screen'])

    # 5. ULTRA-LUXURY YACHT COCKPIT (MAHOGANY DECK, QUILTED CREAM LEATHER, GOLD NARDI WHEEL, CHAMPAGNE COOLER)
    cp_mesh = bpy.data.meshes.new("CockpitMesh")
    cp_obj = bpy.data.objects.new("Cockpit", cp_mesh)
    bpy.context.collection.objects.link(cp_obj)
    cp_obj.parent = car_root
    bm_cp = bmesh.new()

    # Real marine mahogany wood deck floor (Slot 0: MahoganyWood)
    res_tub = bmesh.ops.create_cube(bm_cp, size=1.0, matrix=make_transform(Vector((0.0, 0.04, 0.46)), (0.70, 0.66, 0.14)))
    set_mat_for_verts(res_tub['verts'], 0)

    # Quilted Connolly cream leather seat cushion and backrest (Slot 1: CreamLeather)
    res_seat_cush = bmesh.ops.create_cube(bm_cp, size=1.0, matrix=make_transform(Vector((0.0, 0.12, 0.52)), (0.50, 0.32, 0.10)))
    set_mat_for_verts(res_seat_cush['verts'], 1)
    res_st = bmesh.ops.create_cube(bm_cp, size=1.0, matrix=make_transform(Vector((0.0, 0.28, 0.74)), (0.50, 0.14, 0.46), Euler((math.radians(14), 0, 0))))
    set_mat_for_verts(res_st['verts'], 1)

    # 24K Gold 3-Spoke Vintage Nardi Steering Wheel (Slot 2: Gold)
    res_sw = make_cylinder(bm_cp, radius=0.14, depth=0.02, segments=24, matrix=make_transform(Vector((0.0, -0.16, 0.72)), rot_euler=Euler((math.radians(30), 0, 0))))
    set_mat_for_verts(res_sw['verts'], 2)
    res_shub = make_cylinder(bm_cp, radius=0.045, depth=0.028, segments=16, matrix=make_transform(Vector((0.0, -0.16, 0.72)), rot_euler=Euler((math.radians(30), 0, 0))))
    set_mat_for_verts(res_shub['verts'], 2)
    for sp_deg in [0, 120, 240]:
        sp_rad = math.radians(sp_deg)
        res_sspk = bmesh.ops.create_cube(bm_cp, size=1.0, matrix=make_transform(Vector((math.sin(sp_rad) * 0.07, -0.16 + math.cos(sp_rad) * 0.035, 0.72 + math.cos(sp_rad) * 0.06)), (0.018, 0.012, 0.12), Euler((math.radians(30), 0, -sp_rad))))
        set_mat_for_verts(res_sspk['verts'], 2)

    # Gold-framed vintage speedster split windscreen (Slot 3: Glass, Frame in Gold)
    res_ws = bmesh.ops.create_cube(bm_cp, size=1.0, matrix=make_transform(Vector((0.0, -0.22, 0.72)), (0.64, 0.02, 0.18), Euler((math.radians(32), 0, 0))))
    set_mat_for_verts(res_ws['verts'], 3)
    res_wsf = bmesh.ops.create_cube(bm_cp, size=1.0, matrix=make_transform(Vector((0.0, -0.22, 0.81)), (0.66, 0.03, 0.02), Euler((math.radians(32), 0, 0))))
    set_mat_for_verts(res_wsf['verts'], 2)

    # Silver Ice Bucket & Champagne Bottle VIP Console Prop (Slot 4: SilverIceBucket, Slot 5: ChampagneBottle)
    res_ib = make_cylinder(bm_cp, radius=0.075, depth=0.14, segments=16, matrix=make_transform(Vector((0.24, -0.04, 0.58))))
    set_mat_for_verts(res_ib['verts'], 4)
    res_bot = make_cylinder(bm_cp, radius=0.035, depth=0.18, segments=12, matrix=make_transform(Vector((0.24, -0.04, 0.66)), rot_euler=Euler((math.radians(12), 0, math.radians(15)))))
    set_mat_for_verts(res_bot['verts'], 5)
    res_foil = make_cylinder(bm_cp, radius=0.022, depth=0.06, segments=12, matrix=make_transform(Vector((0.25, -0.02, 0.76)), rot_euler=Euler((math.radians(12), 0, math.radians(15)))))
    set_mat_for_verts(res_foil['verts'], 2)

    bm_cp.to_mesh(cp_mesh)
    bm_cp.free()
    cp_obj.data.materials.append(mats['MahoganyWood'])      # 0
    cp_obj.data.materials.append(mats['CreamLeather'])      # 1
    cp_obj.data.materials.append(mats['Gold'])              # 2
    cp_obj.data.materials.append(mats['Glass'])             # 3
    cp_obj.data.materials.append(mats['SilverIceBucket'])   # 4
    cp_obj.data.materials.append(mats['ChampagneBottle'])   # 5

    # 6. CHARISMATIC BILLIONAIRE WHALE MASCOT DRIVER
    d_mesh = bpy.data.meshes.new("Driver_Mesh")
    d_obj = bpy.data.objects.new("Driver", d_mesh)
    bpy.context.collection.objects.link(d_obj)
    d_obj.parent = car_root
    bm_d = bmesh.new()

    # Tuxedo torso (Slot 0: WhaleTuxedo)
    res_dt = bmesh.ops.create_cube(bm_d, size=1.0, matrix=make_transform(Vector((0.0, 0.08, 0.68)), (0.46, 0.30, 0.36)))
    set_mat_for_verts(res_dt['verts'], 0)

    # Crisp White Pleated Shirt Insert (Slot 1: CyberRobotWhite)
    res_shirt = bmesh.ops.create_cube(bm_d, size=1.0, matrix=make_transform(Vector((0.0, -0.06, 0.70)), (0.16, 0.04, 0.28)))
    set_mat_for_verts(res_shirt['verts'], 1)

    # Ruby Red Bowtie at Collar (Slot 2: BowtieRed)
    res_bt_left = bmesh.ops.create_cone(bm_d, cap_ends=True, cap_tris=False, segments=8, radius1=0.045, radius2=0.01, depth=0.07, matrix=make_transform(Vector((-0.045, -0.09, 0.81)), rot_euler=Euler((0, math.radians(90), 0))))
    set_mat_for_verts(res_bt_left['verts'], 2)
    res_bt_right = bmesh.ops.create_cone(bm_d, cap_ends=True, cap_tris=False, segments=8, radius1=0.045, radius2=0.01, depth=0.07, matrix=make_transform(Vector((0.045, -0.09, 0.81)), rot_euler=Euler((0, -math.radians(90), 0))))
    set_mat_for_verts(res_bt_right['verts'], 2)
    res_bt_knot = make_cylinder(bm_d, radius=0.018, depth=0.025, segments=10, matrix=make_transform(Vector((0.0, -0.095, 0.81))))
    set_mat_for_verts(res_bt_knot['verts'], 2)

    # Whale Head: Hydrodynamic melon dome & snout (Slot 3: WhaleSkin)
    res_dh = bmesh.ops.create_uvsphere(bm_d, u_segments=18, v_segments=14, radius=0.20, matrix=make_transform(Vector((0.0, -0.02, 0.98)), (0.95, 1.15, 0.90)))
    set_mat_for_verts(res_dh['verts'], 3)
    # Broad Whale Snout extending forward
    res_snout = bmesh.ops.create_cube(bm_d, size=1.0, matrix=make_transform(Vector((0.0, -0.16, 0.93)), (0.28, 0.16, 0.12), Euler((math.radians(10), 0, 0))))
    set_mat_for_verts(res_snout['verts'], 3)

    # White Underbelly / Ventral Grooves on lower jaw (Slot 4: WhaleBelly)
    res_belly = bmesh.ops.create_cube(bm_d, size=1.0, matrix=make_transform(Vector((0.0, -0.12, 0.87)), (0.24, 0.18, 0.06)))
    set_mat_for_verts(res_belly['verts'], 4)

    # Pectoral Fin Flippers holding steering wheel (Slot 3: WhaleSkin)
    for sign_x in [-1, 1]:
        res_fin = bmesh.ops.create_cube(bm_d, size=1.0, matrix=make_transform(Vector((sign_x * 0.16, -0.11, 0.74)), (0.12, 0.04, 0.06), Euler((math.radians(25), sign_x * math.radians(20), 0))))
        set_mat_for_verts(res_fin['verts'], 3)

    # Royal 5-Point 24K Gold VIP Crown (Slot 5: Gold, Slot 6: Headlight jewel tips)
    # Base coronet ring
    res_cr_base = make_cylinder(bm_d, radius=0.125, depth=0.035, segments=20, matrix=make_transform(Vector((0.0, -0.01, 1.14))))
    set_mat_for_verts(res_cr_base['verts'], 5)
    # 5 Crown Peaks with jewel tips
    for p_i in range(5):
        p_ang = p_i * (360.0 / 5.0)
        p_rad = math.radians(p_ang)
        px = math.cos(p_rad) * 0.115
        py = -0.01 + math.sin(p_rad) * 0.115
        res_pt = bmesh.ops.create_cone(bm_d, cap_ends=True, cap_tris=False, segments=4, radius1=0.035, radius2=0.005, depth=0.09, matrix=make_transform(Vector((px, py, 1.19)), rot_euler=Euler((math.sin(p_rad) * math.radians(12), -math.cos(p_rad) * math.radians(12), -p_rad))))
        set_mat_for_verts(res_pt['verts'], 5)
        res_gem = bmesh.ops.create_uvsphere(bm_d, u_segments=8, v_segments=6, radius=0.016, matrix=make_transform(Vector((px * 1.08, py * 1.08, 1.24))))
        set_mat_for_verts(res_gem['verts'], 6)

    # Blowhole Spout of Gold Coin Drops (Slot 5: Gold)
    res_spout1 = bmesh.ops.create_uvsphere(bm_d, u_segments=8, v_segments=6, radius=0.022, matrix=make_transform(Vector((0.0, 0.08, 1.15))))
    set_mat_for_verts(res_spout1['verts'], 5)
    res_spout2 = bmesh.ops.create_uvsphere(bm_d, u_segments=8, v_segments=6, radius=0.016, matrix=make_transform(Vector((0.02, 0.09, 1.20))))
    set_mat_for_verts(res_spout2['verts'], 5)

    # Aviator Sunglasses with 24K Gold Wire Frame (Slot 7: Sunglasses, Slot 5: Gold)
    res_br = bmesh.ops.create_cube(bm_d, size=1.0, matrix=make_transform(Vector((0.0, -0.19, 1.02)), (0.26, 0.02, 0.014)))
    set_mat_for_verts(res_br['verts'], 5)
    for sign_x in [-1, 1]:
        res_lens = bmesh.ops.create_cube(bm_d, size=1.0, matrix=make_transform(Vector((sign_x * 0.075, -0.20, 1.00)), (0.095, 0.025, 0.065)))
        set_mat_for_verts(res_lens['verts'], 7)

    bm_d.to_mesh(d_mesh)
    bm_d.free()
    d_obj.data.materials.append(mats['WhaleTuxedo'])        # 0
    d_obj.data.materials.append(mats['CyberRobotWhite'])    # 1
    d_obj.data.materials.append(mats['BowtieRed'])          # 2
    d_obj.data.materials.append(mats['WhaleSkin'])          # 3
    d_obj.data.materials.append(mats['WhaleBelly'])         # 4
    d_obj.data.materials.append(mats['Gold'])               # 5
    d_obj.data.materials.append(mats['Headlight'])          # 6
    d_obj.data.materials.append(mats['Sunglasses'])         # 7
    for poly in d_obj.data.polygons:
        poly.use_smooth = True

    # 7. REAR TRANSOM & MONEY DISPLAY ($500)
    md_mesh = bpy.data.meshes.new("MoneyDisplayMesh")
    md_obj = bpy.data.objects.new("MoneyDisplay", md_mesh)
    bpy.context.collection.objects.link(md_obj)
    md_obj.parent = car_root
    bm_md = bmesh.new()
    res_rf = bmesh.ops.create_cube(bm_md, size=1.0, matrix=make_transform(Vector((0.0, 1.34, 0.64)), (0.64, 0.05, 0.22)))
    set_mat_for_verts(res_rf['verts'], 0)
    v1 = bm_md.verts.new(Vector(( 0.28, 1.368, 0.55)))
    v2 = bm_md.verts.new(Vector((-0.28, 1.368, 0.55)))
    v3 = bm_md.verts.new(Vector((-0.28, 1.368, 0.73)))
    v4 = bm_md.verts.new(Vector(( 0.28, 1.368, 0.73)))
    f_md = bm_md.faces.new([v1, v2, v3, v4])
    f_md.material_index = 1
    uv_l = bm_md.loops.layers.uv.new("UVMap")
    uvs = [Vector((0, 0)), Vector((1, 0)), Vector((1, 1)), Vector((0, 1))]
    for loop, uv in zip(f_md.loops, uvs):
        loop[uv_l].uv = uv

    bm_md.to_mesh(md_mesh)
    bm_md.free()
    md_obj.data.materials.append(mats['Gold'])
    md_obj.data.materials.append(mats['Screen'])

    # 8. DUAL GOLD-PLATED ANTENNA MASTS WITH GLOWING DIAMOND HEADS (CALIBRATED TO Z = 1.50m)
    ant_mesh = bpy.data.meshes.new("AntennaMesh")
    ant_obj = bpy.data.objects.new("Antenna", ant_mesh)
    bpy.context.collection.objects.link(ant_obj)
    ant_obj.parent = car_root
    bm_ant = bmesh.new()
    for sign_x in [-1, 1]:
        mx = sign_x * 0.38
        # Mast from nacelle deck (Z=0.86) to Z=1.42 (depth=0.56, center Z=1.14)
        res_am = make_cylinder(bm_ant, radius=0.016, depth=0.56, segments=12, matrix=make_transform(Vector((mx, 0.58, 1.14))))
        set_mat_for_verts(res_am['verts'], 0)
        # Gold finial mount bracket at base
        res_ab = make_cylinder(bm_ant, radius=0.038, depth=0.04, segments=16, matrix=make_transform(Vector((mx, 0.58, 0.88))))
        set_mat_for_verts(res_ab['verts'], 0)
    bm_ant.to_mesh(ant_mesh)
    bm_ant.free()
    ant_obj.data.materials.append(mats['Gold'])

    # ContactHead: Located at Z = 1.50m matching GOLD_WHALE_CONFIG.dimensions.antennaHeight: 1.50
    ch_mesh = bpy.data.meshes.new("ContactHeadMesh")
    ch_obj = bpy.data.objects.new("ContactHead", ch_mesh)
    ch_obj.location = Vector((0.0, 0.58, 1.50))
    bpy.context.collection.objects.link(ch_obj)
    ch_obj.parent = ant_obj
    bm_ch = bmesh.new()
    for sign_x in [-1, 1]:
        mx = sign_x * 0.38
        # Radiant Faceted Amber/Gold Diamond Crystal
        res_dia_top = bmesh.ops.create_cone(bm_ch, cap_ends=True, cap_tris=False, segments=8, radius1=0.088, radius2=0.02, depth=0.07, matrix=make_transform(Vector((mx, 0.0, 0.035)), rot_euler=Euler((math.radians(180), 0, 0))))
        set_mat_for_verts(res_dia_top['verts'], 0) # NeonAccent
        res_dia_bot = bmesh.ops.create_cone(bm_ch, cap_ends=True, cap_tris=False, segments=8, radius1=0.088, radius2=0.005, depth=0.09, matrix=make_transform(Vector((mx, 0.0, -0.045))))
        set_mat_for_verts(res_dia_bot['verts'], 0) # NeonAccent
        res_girdle = make_cylinder(bm_ch, radius=0.095, depth=0.018, segments=16, matrix=make_transform(Vector((mx, 0.0, 0.0))))
        set_mat_for_verts(res_girdle['verts'], 1)  # Gold

    bm_ch.to_mesh(ch_mesh)
    bm_ch.free()
    ch_obj.data.materials.append(mats['NeonAccent'])
    ch_obj.data.materials.append(mats['Gold'])

    # 9. WHEELS & WELLS
    create_wheel_wells(car_root, mats, track, wheelbase)
    build_single_wheel("Wheel_FL", car_root, mats, 'gold_whale', Vector((-track, -wheelbase, 0.28)), True)
    build_single_wheel("Wheel_FR", car_root, mats, 'gold_whale', Vector(( track, -wheelbase, 0.28)), True)
    build_single_wheel("Wheel_RL", car_root, mats, 'gold_whale', Vector((-track,  wheelbase, 0.28)), False)
    build_single_wheel("Wheel_RR", car_root, mats, 'gold_whale', Vector(( track,  wheelbase, 0.28)), False)

    out_path = os.path.join(MODELS_OUT, "gold_whale.glb")
    print(f"Exporting GOLD WHALE to {out_path}...")
    bpy.ops.export_scene.gltf(filepath=out_path, export_format='GLB', use_selection=False, export_yup=True, export_apply=True)
    print("=== GOLD WHALE EXPORTED ===")


# =============================================================================
# 5. GME APE (RETAIL MUSCLE CAR / DIAMOND HANDS BERSERKER)
# =============================================================================
def build_gme_ape_model():
    print("=== Building AAA GME APE (Retail Muscle Car) Model ===")
    clean_scene()

    mats = setup_materials_for_car('gme_ape', glow_color_rgb=(0.0, 0.94, 1.0))
    car_root = bpy.data.objects.new("CarRoot", None)
    bpy.context.collection.objects.link(car_root)

    track = 0.98
    wheelbase = 0.78
    y_min, y_max = -1.36, 1.36

    # 1. PERIMETER RUBBER BUMPER COLLAR (Wrap-around muscle stance with red neon channel)
    perimeter_pts = [
        Vector((0.0,   -1.36, 0.23)),  # Center front nose
        Vector((0.38,  -1.36, 0.23)),  # Front flat bumper corner
        Vector((0.68,  -1.33, 0.23)),
        Vector((0.96,  -1.22, 0.23)),  # Front corner turn
        Vector((1.02,  -1.02, 0.23)),  # Front fender flare
        Vector((1.00,  -0.78, 0.23)),  # Front wheel center
        Vector((0.96,  -0.45, 0.23)),
        Vector((0.92,   0.00, 0.23)),  # Pinched coke-bottle waist
        Vector((0.98,   0.45, 0.23)),
        Vector((1.04,   0.78, 0.23)),  # Wide flared rear haunch
        Vector((1.06,   1.04, 0.23)),
        Vector((0.96,   1.26, 0.24)),  # Rear corner turn
        Vector((0.65,   1.34, 0.24)),  # Rear transom
        Vector((0.32,   1.36, 0.24)),
        Vector((0.0,    1.36, 0.24)),  # Center rear
    ]
    bumper_obj = build_thick_bumper(car_root, mats, perimeter_pts, pw=0.088, ph=0.068, neon_slot='RedCaliper')

    # 2. 20-STATION MUSCLE CAR BODY SHELL
    bm_body = bmesh.new()
    body_sections = [
        {"y": -1.34, "hw": 0.88, "zt": 0.44, "zp": 0.38, "zw": 0.24, "zb": 0.16},  # Front nose splitter shelf
        {"y": -1.26, "hw": 0.94, "zt": 0.48, "zp": 0.44, "zw": 0.24, "zb": 0.16},  # Grille & quad headlights
        {"y": -1.16, "hw": 0.98, "zt": 0.52, "zp": 0.48, "zw": 0.25, "zb": 0.16},  # Front fender peak
        {"y": -1.02, "hw": 1.01, "zt": 0.55, "zp": 0.50, "zw": 0.25, "zb": 0.16},
        {"y": -0.88, "hw": 1.01, "zt": 0.57, "zp": 0.51, "zw": 0.25, "zb": 0.16},  # Wheel arch front
        {"y": -0.78, "hw": 1.00, "zt": 0.58, "zp": 0.52, "zw": 0.25, "zb": 0.16},  # Front axle
        {"y": -0.66, "hw": 0.98, "zt": 0.57, "zp": 0.51, "zw": 0.25, "zb": 0.16},  # Wheel arch rear
        {"y": -0.52, "hw": 0.94, "zt": 0.56, "zp": 0.50, "zw": 0.25, "zb": 0.16},  # Blower cutout front
        {"y": -0.36, "hw": 0.92, "zt": 0.55, "zp": 0.48, "zw": 0.25, "zb": 0.16},  # Blower cutout mid
        {"y": -0.18, "hw": 0.91, "zt": 0.54, "zp": 0.48, "zw": 0.25, "zb": 0.16},  # Cockpit cowl front
        {"y":  0.00, "hw": 0.92, "zt": 0.54, "zp": 0.49, "zw": 0.25, "zb": 0.16},  # Cockpit waist
        {"y":  0.22, "hw": 0.95, "zt": 0.55, "zp": 0.51, "zw": 0.25, "zb": 0.16},
        {"y":  0.42, "hw": 0.99, "zt": 0.56, "zp": 0.53, "zw": 0.25, "zb": 0.16},  # Swelling rear haunches
        {"y":  0.64, "hw": 1.04, "zt": 0.58, "zp": 0.56, "zw": 0.25, "zb": 0.16},
        {"y":  0.78, "hw": 1.06, "zt": 0.59, "zp": 0.57, "zw": 0.25, "zb": 0.16},  # Rear axle
        {"y":  0.92, "hw": 1.04, "zt": 0.59, "zp": 0.57, "zw": 0.25, "zb": 0.16},
        {"y":  1.08, "hw": 1.01, "zt": 0.60, "zp": 0.56, "zw": 0.25, "zb": 0.16},  # Fastback transition
        {"y":  1.20, "hw": 0.96, "zt": 0.62, "zp": 0.54, "zw": 0.25, "zb": 0.16},  # Ducktail kick
        {"y":  1.30, "hw": 0.88, "zt": 0.63, "zp": 0.50, "zw": 0.24, "zb": 0.16},  # Spoiler lip
        {"y":  1.34, "hw": 0.84, "zt": 0.61, "zp": 0.44, "zw": 0.24, "zb": 0.16},  # Rear transom
    ]
    build_quad_body_shell(bm_body, body_sections, wheelbase, y_min, y_max, arch_rad=0.34)
    body_mesh = bpy.data.meshes.new("BodyMesh")
    bm_body.to_mesh(body_mesh)
    bm_body.free()
    body_obj = bpy.data.objects.new("Body", body_mesh)
    bpy.context.collection.objects.link(body_obj)
    body_obj.parent = car_root
    body_obj.data.materials.append(mats['BodyPaint'])
    body_obj.data.materials.append(mats['DarkMetal'])
    sub_b = body_obj.modifiers.new("Subdivision", 'SUBSURF')
    sub_b.levels = 1

    # 3. EXPOSED TWIN-SCREW SUPERCHARGER BLOWER & TRIPLE RED BUTTERFLIES
    blower_mesh = bpy.data.meshes.new("SuperchargerMesh")
    blower_obj = bpy.data.objects.new("SuperchargerBlower", blower_mesh)
    bpy.context.collection.objects.link(blower_obj)
    blower_obj.parent = body_obj
    bm_bl = bmesh.new()

    # Blower Main Billet Case (aluminum casing)
    res_bcase = bmesh.ops.create_cube(bm_bl, size=1.0, matrix=make_transform(Vector((0.0, -0.44, 0.60)), (0.32, 0.40, 0.15)))
    set_mat_for_verts(res_bcase['verts'], 0) # Chrome

    # Front Drive Snout & Toothed Belt Pulley
    res_snout = make_cylinder(bm_bl, radius=0.045, depth=0.18, segments=16, matrix=make_transform(Vector((0.0, -0.70, 0.58)), rot_euler=Euler((math.radians(90), 0, 0))))
    set_mat_for_verts(res_snout['verts'], 1) # DarkMetal
    res_pulley = make_cylinder(bm_bl, radius=0.075, depth=0.045, segments=24, matrix=make_transform(Vector((0.0, -0.78, 0.58)), rot_euler=Euler((math.radians(90), 0, 0))))
    set_mat_for_verts(res_pulley['verts'], 1) # DarkMetal

    # Classic Bug-Catcher Forward Air Scoop
    res_scoop = bmesh.ops.create_cube(bm_bl, size=1.0, matrix=make_transform(Vector((0.0, -0.40, 0.72)), (0.34, 0.32, 0.12)))
    set_mat_for_verts(res_scoop['verts'], 0) # Chrome
    # Cowled forward lips
    res_lip = bmesh.ops.create_cube(bm_bl, size=1.0, matrix=make_transform(Vector((0.0, -0.56, 0.74)), (0.36, 0.08, 0.14)))
    set_mat_for_verts(res_lip['verts'], 0) # Chrome

    # 3 Triple Anodized Red Butterfly Throttle Valves (X: -0.09, 0.0, 0.09)
    for bf_x in [-0.09, 0.0, 0.09]:
        res_bf = make_cylinder(bm_bl, radius=0.042, depth=0.012, segments=16, matrix=make_transform(Vector((bf_x, -0.59, 0.74)), rot_euler=Euler((math.radians(72), 0, 0))))
        set_mat_for_verts(res_bf['verts'], 2) # RedCaliper (bright anodized red)
        # Center throttle shaft
        res_sh = make_cylinder(bm_bl, radius=0.008, depth=0.34, segments=8, matrix=make_transform(Vector((0.0, -0.59, 0.74)), rot_euler=Euler((0, math.radians(90), 0))))
        set_mat_for_verts(res_sh['verts'], 1) # DarkMetal

    bm_bl.to_mesh(blower_mesh)
    bm_bl.free()
    blower_obj.data.materials.append(mats['Chrome'])      # 0
    blower_obj.data.materials.append(mats['DarkMetal'])   # 1
    blower_obj.data.materials.append(mats['RedCaliper'])  # 2

    # 4. QUAD CIRCULAR HALO HEADLIGHTS & FRONT GRILLE
    hl_l_mesh = bpy.data.meshes.new("HeadlightL_Mesh")
    hl_l_obj = bpy.data.objects.new("Headlight_L", hl_l_mesh)
    bpy.context.collection.objects.link(hl_l_obj)
    hl_l_obj.parent = body_obj
    bm_hl = bmesh.new()
    for hx in [-0.52, -0.70]:
        res_proj = make_cylinder(bm_hl, radius=0.052, depth=0.04, segments=16, matrix=make_transform(Vector((hx, -1.26, 0.42)), rot_euler=Euler((math.radians(90), 0, 0))))
        set_mat_for_verts(res_proj['verts'], 0) # Headlight
        res_halo = make_cylinder(bm_hl, radius=0.068, depth=0.015, segments=20, matrix=make_transform(Vector((hx, -1.275, 0.42)), rot_euler=Euler((math.radians(90), 0, 0))))
        set_mat_for_verts(res_halo['verts'], 1) # AmberDRL
    bm_hl.to_mesh(hl_l_mesh)
    bm_hl.free()
    hl_l_obj.data.materials.append(mats['Headlight'])
    hl_l_obj.data.materials.append(mats['AmberDRL'])

    hl_r_mesh = bpy.data.meshes.new("HeadlightR_Mesh")
    hl_r_obj = bpy.data.objects.new("Headlight_R", hl_r_mesh)
    bpy.context.collection.objects.link(hl_r_obj)
    hl_r_obj.parent = body_obj
    bm_hr = bmesh.new()
    for hx in [0.52, 0.70]:
        res_proj = make_cylinder(bm_hr, radius=0.052, depth=0.04, segments=16, matrix=make_transform(Vector((hx, -1.26, 0.42)), rot_euler=Euler((math.radians(90), 0, 0))))
        set_mat_for_verts(res_proj['verts'], 0)
        res_halo = make_cylinder(bm_hr, radius=0.068, depth=0.015, segments=20, matrix=make_transform(Vector((hx, -1.275, 0.42)), rot_euler=Euler((math.radians(90), 0, 0))))
        set_mat_for_verts(res_halo['verts'], 1)
    bm_hr.to_mesh(hl_r_mesh)
    bm_hr.free()
    hl_r_obj.data.materials.append(mats['Headlight'])
    hl_r_obj.data.materials.append(mats['AmberDRL'])

    # 5. RETRO TRIPLE-SLOT TAILLIGHTS & DUAL ROCKET THRUSTERS ("TO THE MOON!")
    tl_l_mesh = bpy.data.meshes.new("TailLightL_Mesh")
    tl_l_obj = bpy.data.objects.new("TailLight_L", tl_l_mesh)
    bpy.context.collection.objects.link(tl_l_obj)
    tl_l_obj.parent = body_obj
    bm_tl = bmesh.new()
    for slot_i in range(3):
        sx = -0.58 + slot_i * 0.055
        res_sl = bmesh.ops.create_cube(bm_tl, size=1.0, matrix=make_transform(Vector((sx, 1.34, 0.50)), (0.024, 0.025, 0.11)))
        set_mat_for_verts(res_sl['verts'], 0)
    bm_tl.to_mesh(tl_l_mesh)
    bm_tl.free()
    tl_l_obj.data.materials.append(mats['Taillight'])

    tl_r_mesh = bpy.data.meshes.new("TailLightR_Mesh")
    tl_r_obj = bpy.data.objects.new("TailLight_R", tl_r_mesh)
    bpy.context.collection.objects.link(tl_r_obj)
    tl_r_obj.parent = body_obj
    bm_tr = bmesh.new()
    for slot_i in range(3):
        sx = 0.47 + slot_i * 0.055
        res_sr = bmesh.ops.create_cube(bm_tr, size=1.0, matrix=make_transform(Vector((sx, 1.34, 0.50)), (0.024, 0.025, 0.11)))
        set_mat_for_verts(res_sr['verts'], 0)
    bm_tr.to_mesh(tl_r_mesh)
    bm_tr.free()
    tl_r_obj.data.materials.append(mats['Taillight'])

    # Dual Rocket Thruster Nozzles ("To The Moon!") beneath the transom
    rocket_mesh = bpy.data.meshes.new("RocketThrustersMesh")
    rocket_obj = bpy.data.objects.new("RocketThrusters", rocket_mesh)
    bpy.context.collection.objects.link(rocket_obj)
    rocket_obj.parent = body_obj
    bm_rk = bmesh.new()
    for rx in [-0.26, 0.26]:
        # Titanium nozzle cone
        res_cone = bmesh.ops.create_cone(bm_rk, cap_ends=True, cap_tris=False, segments=18, radius1=0.088, radius2=0.058, depth=0.18, matrix=make_transform(Vector((rx, 1.28, 0.32)), rot_euler=Euler((math.radians(90), 0, 0))))
        set_mat_for_verts(res_cone['verts'], 0) # DarkMetal
        # Internal nozzle heat ring
        res_hring = make_cylinder(bm_rk, radius=0.078, depth=0.025, segments=18, matrix=make_transform(Vector((rx, 1.36, 0.32)), rot_euler=Euler((math.radians(90), 0, 0))))
        set_mat_for_verts(res_hring['verts'], 1) # Chrome
        # Radiant afterburner glowing core (Diamond Cyan)
        res_flame = make_cylinder(bm_rk, radius=0.062, depth=0.020, segments=18, matrix=make_transform(Vector((rx, 1.365, 0.32)), rot_euler=Euler((math.radians(90), 0, 0))))
        set_mat_for_verts(res_flame['verts'], 2) # NeonAccent
    bm_rk.to_mesh(rocket_mesh)
    bm_rk.free()
    rocket_obj.data.materials.append(mats['DarkMetal'])
    rocket_obj.data.materials.append(mats['Chrome'])
    rocket_obj.data.materials.append(mats['NeonAccent'])

    # 6. COCKPIT, ROLL CAGE HOOP & MUSCLE STEERING WHEEL
    cockpit_mesh = bpy.data.meshes.new("CockpitMesh")
    cockpit_obj = bpy.data.objects.new("Cockpit", cockpit_mesh)
    bpy.context.collection.objects.link(cockpit_obj)
    cockpit_obj.parent = body_obj
    bm_cp = bmesh.new()

    # Cockpit Tub Floor & Bucket Seat
    res_floor = bmesh.ops.create_cube(bm_cp, size=1.0, matrix=make_transform(Vector((0.0, 0.28, 0.30)), (0.76, 0.78, 0.16)))
    set_mat_for_verts(res_floor['verts'], 0) # DarkMetal
    res_seat = bmesh.ops.create_cube(bm_cp, size=1.0, matrix=make_transform(Vector((0.0, 0.38, 0.54)), (0.54, 0.20, 0.44), rot_euler=Euler((math.radians(-14), 0, 0))))
    set_mat_for_verts(res_seat['verts'], 0)

    # 4-Point Tubular Steel Roll Cage Hoop behind driver head (Z = 0.88m)
    res_rh = make_cylinder(bm_cp, radius=0.024, depth=0.74, segments=12, matrix=make_transform(Vector((0.0, 0.48, 0.90)), rot_euler=Euler((0, math.radians(90), 0))))
    set_mat_for_verts(res_rh['verts'], 1) # SteelBullBar
    for sx in [-0.36, 0.36]:
        res_leg = make_cylinder(bm_cp, radius=0.024, depth=0.48, segments=12, matrix=make_transform(Vector((sx, 0.48, 0.68))))
        set_mat_for_verts(res_leg['verts'], 1)
        res_strut = make_cylinder(bm_cp, radius=0.020, depth=0.55, segments=12, matrix=make_transform(Vector((sx, 0.72, 0.72)), rot_euler=Euler((math.radians(45), 0, 0))))
        set_mat_for_verts(res_strut['verts'], 1)

    # Classic Deep-Dish 3-Spoke Muscle Steering Wheel
    res_sw_rim = make_cylinder(bm_cp, radius=0.17, depth=0.022, segments=20, matrix=make_transform(Vector((0.0, -0.04, 0.62)), rot_euler=Euler((math.radians(65), 0, 0))))
    set_mat_for_verts(res_sw_rim['verts'], 0)
    res_sw_hub = make_cylinder(bm_cp, radius=0.042, depth=0.035, segments=16, matrix=make_transform(Vector((0.0, -0.06, 0.60)), rot_euler=Euler((math.radians(65), 0, 0))))
    set_mat_for_verts(res_sw_hub['verts'], 2) # Chrome
    for a_deg in [0, 120, 240]:
        a_rad = math.radians(a_deg)
        sp_v = Vector((math.sin(a_rad) * 0.08, -0.05 + math.cos(a_rad) * 0.03, 0.61 + math.cos(a_rad) * 0.07))
        res_sp = bmesh.ops.create_cube(bm_cp, size=1.0, matrix=make_transform(sp_v, (0.022, 0.012, 0.14)))
        set_mat_for_verts(res_sp['verts'], 2)

    bm_cp.to_mesh(cockpit_mesh)
    bm_cp.free()
    cockpit_obj.data.materials.append(mats['DarkMetal'])
    cockpit_obj.data.materials.append(mats['SteelBullBar'])
    cockpit_obj.data.materials.append(mats['Chrome'])

    # 7. DIAMOND HANDS GORILLA DRIVER WITH RED HEADBAND (DRIVER NODE)
    driver_mesh = bpy.data.meshes.new("DriverMesh")
    driver_obj = bpy.data.objects.new("Driver", driver_mesh)
    bpy.context.collection.objects.link(driver_obj)
    driver_obj.parent = car_root
    bm_dr = bmesh.new()

    # Gorilla Head (dark charcoal fur)
    res_dhead = bmesh.ops.create_cube(bm_dr, size=1.0, matrix=make_transform(Vector((0.0, 0.22, 0.78)), (0.34, 0.32, 0.32)))
    set_mat_for_verts(res_dhead['verts'], 0) # ApeSkin

    # Prominent Muscular Brow Ridge
    res_brow = bmesh.ops.create_cube(bm_dr, size=1.0, matrix=make_transform(Vector((0.0, 0.10, 0.86)), (0.32, 0.12, 0.08)))
    set_mat_for_verts(res_brow['verts'], 0)

    # Wide Gorilla Snout & Grinning Muzzle
    res_snout = bmesh.ops.create_cube(bm_dr, size=1.0, matrix=make_transform(Vector((0.0, 0.08, 0.73)), (0.24, 0.18, 0.16)))
    set_mat_for_verts(res_snout['verts'], 1) # ApeSnout
    for nx in [-0.045, 0.045]:
        res_nostril = make_cylinder(bm_dr, radius=0.018, depth=0.025, segments=8, matrix=make_transform(Vector((nx, 0.01, 0.75)), rot_euler=Euler((math.radians(90), 0, 0))))
        set_mat_for_verts(res_nostril['verts'], 0)

    # Grinning Mouth with Diamond Teeth
    res_mouth = bmesh.ops.create_cube(bm_dr, size=1.0, matrix=make_transform(Vector((0.0, 0.01, 0.68)), (0.16, 0.03, 0.04)))
    set_mat_for_verts(res_mouth['verts'], 2) # NeonAccent (Diamond Teeth glow)

    # ICONIC ROARING KITTY / WSB RED HEADBAND
    res_hb = bmesh.ops.create_cube(bm_dr, size=1.0, matrix=make_transform(Vector((0.0, 0.22, 0.87)), (0.36, 0.34, 0.06)))
    set_mat_for_verts(res_hb['verts'], 3) # HeadbandRed
    res_knot = bmesh.ops.create_cube(bm_dr, size=1.0, matrix=make_transform(Vector((-0.16, 0.38, 0.87)), (0.07, 0.07, 0.06)))
    set_mat_for_verts(res_knot['verts'], 3)
    res_tail1 = bmesh.ops.create_cube(bm_dr, size=1.0, matrix=make_transform(Vector((-0.24, 0.52, 0.89)), (0.04, 0.22, 0.05), rot_euler=Euler((math.radians(-15), 0, math.radians(-25)))))
    set_mat_for_verts(res_tail1['verts'], 3)
    res_tail2 = bmesh.ops.create_cube(bm_dr, size=1.0, matrix=make_transform(Vector((-0.22, 0.56, 0.83)), (0.04, 0.24, 0.04), rot_euler=Euler((math.radians(-5), 0, math.radians(-35)))))
    set_mat_for_verts(res_tail2['verts'], 3)

    # Dark Aviator Sunglasses with Gold Frames
    res_sg_l = bmesh.ops.create_cube(bm_dr, size=1.0, matrix=make_transform(Vector((-0.075, 0.05, 0.82)), (0.09, 0.03, 0.065)))
    set_mat_for_verts(res_sg_l['verts'], 4) # Sunglasses
    res_sg_r = bmesh.ops.create_cube(bm_dr, size=1.0, matrix=make_transform(Vector(( 0.075, 0.05, 0.82)), (0.09, 0.03, 0.065)))
    set_mat_for_verts(res_sg_r['verts'], 4)
    res_bridge = bmesh.ops.create_cube(bm_dr, size=1.0, matrix=make_transform(Vector((0.0, 0.048, 0.83)), (0.07, 0.015, 0.012)))
    set_mat_for_verts(res_bridge['verts'], 5) # GoldFrames

    # Muscular Gorilla Torso
    res_dtorso = bmesh.ops.create_cube(bm_dr, size=1.0, matrix=make_transform(Vector((0.0, 0.24, 0.52)), (0.48, 0.32, 0.32)))
    set_mat_for_verts(res_dtorso['verts'], 6) # RacingSuit

    # Muscular Gorilla Arms & Hands Gripping Steering Wheel
    for sign_x in [-1, 1]:
        res_arm = make_cylinder(bm_dr, radius=0.065, depth=0.34, segments=12, matrix=make_transform(Vector((sign_x * 0.22, 0.12, 0.56)), rot_euler=Euler((math.radians(-35), math.radians(sign_x * 18), 0))))
        set_mat_for_verts(res_arm['verts'], 0)
        res_hand = bmesh.ops.create_cube(bm_dr, size=1.0, matrix=make_transform(Vector((sign_x * 0.14, -0.02, 0.62)), (0.09, 0.09, 0.08)))
        set_mat_for_verts(res_hand['verts'], 0)
        res_ring = bmesh.ops.create_cube(bm_dr, size=1.0, matrix=make_transform(Vector((sign_x * 0.14, -0.02, 0.67)), (0.04, 0.04, 0.04)))
        set_mat_for_verts(res_ring['verts'], 2) # Diamond

    bm_dr.to_mesh(driver_mesh)
    bm_dr.free()
    driver_obj.data.materials.append(mats['ApeSkin'])      # 0
    driver_obj.data.materials.append(mats['ApeSnout'])     # 1
    driver_obj.data.materials.append(mats['NeonAccent'])   # 2
    driver_obj.data.materials.append(mats['HeadbandRed'])  # 3
    driver_obj.data.materials.append(mats['Sunglasses'])   # 4
    driver_obj.data.materials.append(mats['GoldFrames'])   # 5
    driver_obj.data.materials.append(mats['RacingSuit'])   # 6

    # 8. MONEY DISPLAYS (FRONT AND REAR $420)
    md_mesh = bpy.data.meshes.new("MoneyDisplayMesh")
    md_obj = bpy.data.objects.new("MoneyDisplay", md_mesh)
    bpy.context.collection.objects.link(md_obj)
    md_obj.parent = body_obj
    bm_md = bmesh.new()

    res_mdf = bmesh.ops.create_cube(bm_md, size=1.0, matrix=make_transform(Vector((0.0, -1.26, 0.32)), (0.42, 0.03, 0.14)))
    set_mat_for_verts(res_mdf['verts'], 0)
    res_mdr = bmesh.ops.create_cube(bm_md, size=1.0, matrix=make_transform(Vector((0.0, 1.345, 0.44)), (0.42, 0.03, 0.14)))
    set_mat_for_verts(res_mdr['verts'], 0)

    uv_l = bm_md.loops.layers.uv.new("UVMap")
    uvs = [Vector((0, 0)), Vector((1, 0)), Vector((1, 1)), Vector((0, 1))]
    vf1 = bm_md.verts.new(Vector((-0.19, -1.278, 0.26)))
    vf2 = bm_md.verts.new(Vector(( 0.19, -1.278, 0.26)))
    vf3 = bm_md.verts.new(Vector(( 0.19, -1.278, 0.38)))
    vf4 = bm_md.verts.new(Vector((-0.19, -1.278, 0.38)))
    f_mdf = bm_md.faces.new([vf1, vf2, vf3, vf4])
    f_mdf.material_index = 1
    for loop, uv in zip(f_mdf.loops, uvs): loop[uv_l].uv = uv

    vr1 = bm_md.verts.new(Vector(( 0.19, 1.362, 0.38)))
    vr2 = bm_md.verts.new(Vector((-0.19, 1.362, 0.38)))
    vr3 = bm_md.verts.new(Vector((-0.19, 1.362, 0.50)))
    vr4 = bm_md.verts.new(Vector(( 0.19, 1.362, 0.50)))
    f_mdr = bm_md.faces.new([vr1, vr2, vr3, vr4])
    f_mdr.material_index = 1
    for loop, uv in zip(f_mdr.loops, uvs): loop[uv_l].uv = uv

    bm_md.to_mesh(md_mesh)
    bm_md.free()
    md_obj.data.materials.append(mats['DarkMetal'])
    md_obj.data.materials.append(mats['Screen'])

    # 9. HEAVY ANTENNA MAST & CONTACT HEAD (CALIBRATED TO Z = 1.42m)
    ant_mesh = bpy.data.meshes.new("AntennaMesh")
    ant_obj = bpy.data.objects.new("Antenna", ant_mesh)
    bpy.context.collection.objects.link(ant_obj)
    ant_obj.parent = car_root
    bm_ant = bmesh.new()

    res_am = make_cylinder(bm_ant, radius=0.018, depth=0.52, segments=12, matrix=make_transform(Vector((0.0, 0.56, 0.86))))
    set_mat_for_verts(res_am['verts'], 0)
    res_spcoil = make_cylinder(bm_ant, radius=0.042, depth=0.12, segments=16, matrix=make_transform(Vector((0.0, 0.56, 0.66))))
    set_mat_for_verts(res_spcoil['verts'], 1)
    bm_ant.to_mesh(ant_mesh)
    bm_ant.free()
    ant_obj.data.materials.append(mats['DarkMetal'])
    ant_obj.data.materials.append(mats['Chrome'])

    # ContactHead: Located at Z = 1.42m matching GME_APE_CONFIG.dimensions.antennaHeight: 1.42
    ch_mesh = bpy.data.meshes.new("ContactHeadMesh")
    ch_obj = bpy.data.objects.new("ContactHead", ch_mesh)
    ch_obj.location = Vector((0.0, 0.56, 1.42))
    bpy.context.collection.objects.link(ch_obj)
    ch_obj.parent = ant_obj
    bm_ch = bmesh.new()

    res_dia_top = bmesh.ops.create_cone(bm_ch, cap_ends=True, cap_tris=False, segments=8, radius1=0.082, radius2=0.015, depth=0.07, matrix=make_transform(Vector((0.0, 0.0, 0.035)), rot_euler=Euler((math.radians(180), 0, 0))))
    set_mat_for_verts(res_dia_top['verts'], 0) # NeonAccent (Diamond Cyan)
    res_dia_bot = bmesh.ops.create_cone(bm_ch, cap_ends=True, cap_tris=False, segments=8, radius1=0.082, radius2=0.005, depth=0.08, matrix=make_transform(Vector((0.0, 0.0, -0.040))))
    set_mat_for_verts(res_dia_bot['verts'], 0)
    res_girdle = make_cylinder(bm_ch, radius=0.12, depth=0.012, segments=20, matrix=make_transform(Vector((0.0, 0.0, 0.0)), rot_euler=Euler((math.radians(24), 0, 0))))
    set_mat_for_verts(res_girdle['verts'], 1) # Chrome
    bm_ch.to_mesh(ch_mesh)
    bm_ch.free()
    ch_obj.data.materials.append(mats['NeonAccent'])
    ch_obj.data.materials.append(mats['Chrome'])

    # 10. WHEELS & WELLS
    create_wheel_wells(car_root, mats, track, wheelbase)
    build_single_wheel("Wheel_FL", car_root, mats, 'gme_ape', Vector((-track, -wheelbase, 0.29)), True)
    build_single_wheel("Wheel_FR", car_root, mats, 'gme_ape', Vector(( track, -wheelbase, 0.29)), True)
    build_single_wheel("Wheel_RL", car_root, mats, 'gme_ape', Vector((-track,  wheelbase, 0.29)), False)
    build_single_wheel("Wheel_RR", car_root, mats, 'gme_ape', Vector(( track,  wheelbase, 0.29)), False)

    out_path = os.path.join(MODELS_OUT, "gme_ape.glb")
    print(f"Exporting GME APE to {out_path}...")
    bpy.ops.export_scene.gltf(filepath=out_path, export_format='GLB', use_selection=False, export_yup=True, export_apply=True)
    print("=== GME APE EXPORTED ===")


# =============================================================================
# 6. DOGE BARK (CYBER DUNE BUGGY / DRIFT KART)
# =============================================================================
def build_doge_kart_model():
    print("=== Building AAA DOGE BARK (Cyber Dune Buggy / Drift Kart) Model ===")
    clean_scene()

    mats = setup_materials_for_car('doge_kart', glow_color_rgb=(1.0, 0.67, 0.0))
    # Extra character materials
    mats['DogeFur'] = create_pbr_material('DogeFur', base_color=(0.92, 0.62, 0.22), default_roughness=0.75, default_metallic=0.02)
    mats['DogeMuzzle'] = create_pbr_material('DogeMuzzle', base_color=(0.98, 0.94, 0.82), default_roughness=0.65, default_metallic=0.02)
    mats['DogeNose'] = create_pbr_material('DogeNose', base_color=(0.06, 0.06, 0.06), default_roughness=0.20, default_metallic=0.0)
    mats['Sunglasses'] = create_pbr_material('Sunglasses', base_color=(0.04, 0.04, 0.04), default_roughness=0.04, default_metallic=0.95)
    mats['GoldAccent'] = create_pbr_material('GoldAccent', base_color=(1.0, 0.82, 0.08), default_roughness=0.12, default_metallic=0.98)
    mats['SpringYellow'] = create_pbr_material('SpringYellow', base_color=(1.0, 0.92, 0.0), default_roughness=0.25, default_metallic=0.35)

    car_root = bpy.data.objects.new("CarRoot", None)
    bpy.context.collection.objects.link(car_root)

    track = 0.92
    wheelbase = 0.74
    y_min, y_max = -1.24, 1.22

    # 1. PERIMETER RUBBER BUMPER COLLAR (Dune buggy perimeter with front brush guard)
    perimeter_pts = [
        Vector((0.0,   -1.24, 0.24)),  # Center front brush guard
        Vector((0.34,  -1.24, 0.24)),
        Vector((0.64,  -1.20, 0.24)),
        Vector((0.88,  -1.08, 0.24)),  # Front corner turn
        Vector((0.94,  -0.90, 0.24)),
        Vector((0.92,  -0.74, 0.24)),  # Front wheel center
        Vector((0.88,  -0.40, 0.24)),
        Vector((0.85,   0.00, 0.24)),  # Tightly tucked waist
        Vector((0.89,   0.40, 0.24)),
        Vector((0.96,   0.74, 0.24)),  # Rear wheel center
        Vector((0.98,   0.98, 0.24)),
        Vector((0.90,   1.16, 0.25)),  # Rear corner turn
        Vector((0.60,   1.22, 0.25)),
        Vector((0.30,   1.24, 0.25)),
        Vector((0.0,    1.24, 0.25)),
    ]
    bumper_obj = build_thick_bumper(car_root, mats, perimeter_pts, pw=0.082, ph=0.065, neon_slot='NeonAccent')

    # 2. 20-STATION OPEN DUNE BUGGY BODY SHELL
    bm_body = bmesh.new()
    body_sections = [
        {"y": -1.22, "hw": 0.55, "zt": 0.42, "zp": 0.36, "zw": 0.24, "zb": 0.18},  # Narrow high-clearance front prow
        {"y": -1.12, "hw": 0.65, "zt": 0.46, "zp": 0.40, "zw": 0.24, "zb": 0.18},  # Rally spotlight deck
        {"y": -1.00, "hw": 0.74, "zt": 0.50, "zp": 0.44, "zw": 0.25, "zb": 0.18},
        {"y": -0.86, "hw": 0.82, "zt": 0.52, "zp": 0.46, "zw": 0.25, "zb": 0.18},  # Wheel arch front
        {"y": -0.74, "hw": 0.84, "zt": 0.54, "zp": 0.47, "zw": 0.25, "zb": 0.18},  # Front axle
        {"y": -0.62, "hw": 0.82, "zt": 0.53, "zp": 0.46, "zw": 0.25, "zb": 0.18},
        {"y": -0.48, "hw": 0.80, "zt": 0.52, "zp": 0.45, "zw": 0.25, "zb": 0.18},  # Hood cowl
        {"y": -0.32, "hw": 0.78, "zt": 0.51, "zp": 0.45, "zw": 0.25, "zb": 0.18},
        {"y": -0.16, "hw": 0.76, "zt": 0.50, "zp": 0.44, "zw": 0.25, "zb": 0.18},  # Cockpit threshold
        {"y":  0.00, "hw": 0.78, "zt": 0.50, "zp": 0.44, "zw": 0.25, "zb": 0.18},  # Low waist
        {"y":  0.18, "hw": 0.82, "zt": 0.51, "zp": 0.45, "zw": 0.25, "zb": 0.18},
        {"y":  0.36, "hw": 0.86, "zt": 0.53, "zp": 0.47, "zw": 0.25, "zb": 0.18},  # Rear pod swell
        {"y":  0.54, "hw": 0.92, "zt": 0.55, "zp": 0.49, "zw": 0.25, "zb": 0.18},
        {"y":  0.74, "hw": 0.96, "zt": 0.57, "zp": 0.51, "zw": 0.25, "zb": 0.18},  # Rear axle (wide stance)
        {"y":  0.88, "hw": 0.95, "zt": 0.57, "zp": 0.51, "zw": 0.25, "zb": 0.18},
        {"y":  1.00, "hw": 0.92, "zt": 0.58, "zp": 0.50, "zw": 0.25, "zb": 0.18},  # Engine bay & radiator
        {"y":  1.10, "hw": 0.86, "zt": 0.58, "zp": 0.48, "zw": 0.25, "zb": 0.18},
        {"y":  1.16, "hw": 0.78, "zt": 0.59, "zp": 0.46, "zw": 0.25, "zb": 0.18},  # Rear ducktail lip
        {"y":  1.20, "hw": 0.70, "zt": 0.58, "zp": 0.44, "zw": 0.24, "zb": 0.18},
        {"y":  1.22, "hw": 0.60, "zt": 0.56, "zp": 0.40, "zw": 0.24, "zb": 0.18},  # Rear transom
    ]
    build_quad_body_shell(bm_body, body_sections, wheelbase, y_min, y_max, arch_rad=0.35)
    body_mesh = bpy.data.meshes.new("BodyMesh")
    bm_body.to_mesh(body_mesh)
    bm_body.free()
    body_obj = bpy.data.objects.new("Body", body_mesh)
    bpy.context.collection.objects.link(body_obj)
    body_obj.parent = car_root
    body_obj.data.materials.append(mats['BodyPaint'])
    body_obj.data.materials.append(mats['DarkMetal'])
    sub_b = body_obj.modifiers.new("Subdivision", 'SUBSURF')
    sub_b.levels = 1

    # 3. TUBULAR EXO-SKELETON ROLL CAGE & ROOF LIGHT BAR
    cage_mesh = bpy.data.meshes.new("RollCageMesh")
    cage_obj = bpy.data.objects.new("RollCage", cage_mesh)
    bpy.context.collection.objects.link(cage_obj)
    cage_obj.parent = body_obj
    bm_cg = bmesh.new()

    tube_rad = 0.024
    for sign_x in [-1, 1]:
        # Main A-pillar bar
        p1 = Vector((sign_x * 0.48, -0.32, 0.52))
        p2 = Vector((sign_x * 0.40,  0.02, 1.26))
        d_vec = p2 - p1
        mid = (p1 + p2) * 0.5
        rot_e = Euler((math.atan2(d_vec.y, d_vec.z), 0, -math.atan2(d_vec.x, d_vec.z)))
        res_ap = make_cylinder(bm_cg, radius=tube_rad, depth=d_vec.length, segments=12, matrix=make_transform(mid, rot_euler=rot_e))
        set_mat_for_verts(res_ap['verts'], 0) # GoldAccent

        # B-pillar vertical main roll bar
        p3 = Vector((sign_x * 0.44, 0.38, 0.54))
        p4 = Vector((sign_x * 0.40, 0.34, 1.28))
        d_b = p4 - p3
        mid_b = (p3 + p4) * 0.5
        rot_b = Euler((math.atan2(d_b.y, d_b.z), 0, -math.atan2(d_b.x, d_b.z)))
        res_bp = make_cylinder(bm_cg, radius=tube_rad, depth=d_b.length, segments=12, matrix=make_transform(mid_b, rot_euler=rot_b))
        set_mat_for_verts(res_bp['verts'], 0)

        # C-pillar rear brace down to engine shock towers
        p5 = Vector((sign_x * 0.48, 1.05, 0.58))
        d_c = p5 - p4
        mid_c = (p4 + p5) * 0.5
        rot_c = Euler((math.atan2(d_c.y, d_c.z), 0, -math.atan2(d_c.x, d_c.z)))
        res_cp = make_cylinder(bm_cg, radius=tube_rad, depth=d_c.length, segments=12, matrix=make_transform(mid_c, rot_euler=rot_c))
        set_mat_for_verts(res_cp['verts'], 0)

    # Lateral Roof Cross-Bars
    res_rf_f = make_cylinder(bm_cg, radius=tube_rad, depth=0.80, segments=12, matrix=make_transform(Vector((0.0, 0.02, 1.26)), rot_euler=Euler((0, math.radians(90), 0))))
    set_mat_for_verts(res_rf_f['verts'], 0)
    res_rf_r = make_cylinder(bm_cg, radius=tube_rad, depth=0.80, segments=12, matrix=make_transform(Vector((0.0, 0.34, 1.28)), rot_euler=Euler((0, math.radians(90), 0))))
    set_mat_for_verts(res_rf_r['verts'], 0)

    # Roof LED Light Bar: 4 Auxiliary Pods across front roof bar
    for pod_i, px in enumerate([-0.30, -0.10, 0.10, 0.30]):
        res_pod_b = bmesh.ops.create_cube(bm_cg, size=1.0, matrix=make_transform(Vector((px, 0.00, 1.34)), (0.08, 0.07, 0.06)))
        set_mat_for_verts(res_pod_b['verts'], 1) # DarkMetal
        res_pod_l = bmesh.ops.create_cube(bm_cg, size=1.0, matrix=make_transform(Vector((px, -0.04, 1.34)), (0.07, 0.015, 0.05)))
        set_mat_for_verts(res_pod_l['verts'], 2) # NeonAccent

    # Front Bull-Bar Brush Guard (mounted to nose)
    res_bg_top = make_cylinder(bm_cg, radius=tube_rad, depth=0.72, segments=12, matrix=make_transform(Vector((0.0, -1.22, 0.44)), rot_euler=Euler((0, math.radians(90), 0))))
    set_mat_for_verts(res_bg_top['verts'], 0) # GoldAccent
    for sign_x in [-1, 1]:
        res_bg_leg = make_cylinder(bm_cg, radius=tube_rad, depth=0.28, segments=12, matrix=make_transform(Vector((sign_x * 0.30, -1.20, 0.32)), rot_euler=Euler((math.radians(20), 0, 0))))
        set_mat_for_verts(res_bg_leg['verts'], 0)

    bm_cg.to_mesh(cage_mesh)
    bm_cg.free()
    cage_obj.data.materials.append(mats['GoldAccent'])
    cage_obj.data.materials.append(mats['DarkMetal'])
    cage_obj.data.materials.append(mats['NeonAccent'])

    # 4. EXPOSED LONG-TRAVEL COILOVER SUSPENSION STRUTS
    susp_mesh = bpy.data.meshes.new("SuspensionMesh")
    susp_obj = bpy.data.objects.new("Suspension", susp_mesh)
    bpy.context.collection.objects.link(susp_obj)
    susp_obj.parent = body_obj
    bm_sp = bmesh.new()

    for sign_x in [-1, 1]:
        # Front Coilovers
        s_p1 = Vector((sign_x * 0.32, -wheelbase, 0.48))
        s_p2 = Vector((sign_x * (track - 0.12), -wheelbase, 0.30))
        d_s = s_p2 - s_p1
        s_mid = (s_p1 + s_p2) * 0.5
        rot_s = Euler((0, math.atan2(d_s.z, d_s.x), math.atan2(d_s.y, d_s.x)))
        res_sh = make_cylinder(bm_sp, radius=0.024, depth=d_s.length, segments=12, matrix=make_transform(s_mid, rot_euler=rot_s))
        set_mat_for_verts(res_sh['verts'], 0) # Chrome
        res_spr = make_cylinder(bm_sp, radius=0.046, depth=d_s.length * 0.70, segments=16, matrix=make_transform(s_mid, rot_euler=rot_s))
        set_mat_for_verts(res_spr['verts'], 1) # SpringYellow

        # Rear Coilovers
        r_p1 = Vector((sign_x * 0.36, wheelbase, 0.54))
        r_p2 = Vector((sign_x * (track - 0.10), wheelbase, 0.32))
        d_r = r_p2 - r_p1
        r_mid = (r_p1 + r_p2) * 0.5
        rot_r = Euler((0, math.atan2(d_r.z, d_r.x), math.atan2(d_r.y, d_r.x)))
        res_rsh = make_cylinder(bm_sp, radius=0.028, depth=d_r.length, segments=12, matrix=make_transform(r_mid, rot_euler=rot_r))
        set_mat_for_verts(res_rsh['verts'], 0) # Chrome
        res_rspr = make_cylinder(bm_sp, radius=0.052, depth=d_r.length * 0.72, segments=16, matrix=make_transform(r_mid, rot_euler=rot_r))
        set_mat_for_verts(res_rspr['verts'], 1) # SpringYellow

    bm_sp.to_mesh(susp_mesh)
    bm_sp.free()
    susp_obj.data.materials.append(mats['Chrome'])
    susp_obj.data.materials.append(mats['SpringYellow'])

    # 5. TWIN ROUND RALLY SPOTLIGHT HEADLIGHTS (High-mounted on front brush bar)
    hl_l_mesh = bpy.data.meshes.new("HeadlightL_Mesh")
    hl_l_obj = bpy.data.objects.new("Headlight_L", hl_l_mesh)
    bpy.context.collection.objects.link(hl_l_obj)
    hl_l_obj.parent = body_obj
    bm_hll = bmesh.new()
    res_bkt_l = make_cylinder(bm_hll, radius=0.092, depth=0.090, segments=24, matrix=make_transform(Vector((-0.24, -1.24, 0.52)), rot_euler=Euler((math.radians(90), 0, 0))))
    set_mat_for_verts(res_bkt_l['verts'], 0) # DarkMetal
    res_lens_l = make_cylinder(bm_hll, radius=0.084, depth=0.015, segments=24, matrix=make_transform(Vector((-0.24, -1.29, 0.52)), rot_euler=Euler((math.radians(90), 0, 0))))
    set_mat_for_verts(res_lens_l['verts'], 1) # AmberFog
    bm_hll.to_mesh(hl_l_mesh)
    bm_hll.free()
    hl_l_obj.data.materials.append(mats['DarkMetal'])
    hl_l_obj.data.materials.append(mats['AmberFog'])

    hl_r_mesh = bpy.data.meshes.new("HeadlightR_Mesh")
    hl_r_obj = bpy.data.objects.new("Headlight_R", hl_r_mesh)
    bpy.context.collection.objects.link(hl_r_obj)
    hl_r_obj.parent = body_obj
    bm_hlr = bmesh.new()
    res_bkt_r = make_cylinder(bm_hlr, radius=0.092, depth=0.090, segments=24, matrix=make_transform(Vector((0.24, -1.24, 0.52)), rot_euler=Euler((math.radians(90), 0, 0))))
    set_mat_for_verts(res_bkt_r['verts'], 0)
    res_lens_r = make_cylinder(bm_hlr, radius=0.084, depth=0.015, segments=24, matrix=make_transform(Vector((0.24, -1.29, 0.52)), rot_euler=Euler((math.radians(90), 0, 0))))
    set_mat_for_verts(res_lens_r['verts'], 1)
    bm_hlr.to_mesh(hl_r_mesh)
    bm_hlr.free()
    hl_r_obj.data.materials.append(mats['DarkMetal'])
    hl_r_obj.data.materials.append(mats['AmberFog'])

    # 6. TAILLIGHTS
    tl_l_mesh = bpy.data.meshes.new("TailLightL_Mesh")
    tl_l_obj = bpy.data.objects.new("TailLight_L", tl_l_mesh)
    bpy.context.collection.objects.link(tl_l_obj)
    tl_l_obj.parent = body_obj
    bm_tll = bmesh.new()
    res_tl = bmesh.ops.create_cube(bm_tll, size=1.0, matrix=make_transform(Vector((-0.42, 1.20, 0.48)), (0.14, 0.04, 0.07)))
    set_mat_for_verts(res_tl['verts'], 0)
    bm_tll.to_mesh(tl_l_mesh)
    bm_tll.free()
    tl_l_obj.data.materials.append(mats['Taillight'])

    tl_r_mesh = bpy.data.meshes.new("TailLightR_Mesh")
    tl_r_obj = bpy.data.objects.new("TailLight_R", tl_r_mesh)
    bpy.context.collection.objects.link(tl_r_obj)
    tl_r_obj.parent = body_obj
    bm_tlr = bmesh.new()
    res_tr = bmesh.ops.create_cube(bm_tlr, size=1.0, matrix=make_transform(Vector((0.42, 1.20, 0.48)), (0.14, 0.04, 0.07)))
    set_mat_for_verts(res_tr['verts'], 0)
    bm_tlr.to_mesh(tl_r_mesh)
    bm_tlr.free()
    tl_r_obj.data.materials.append(mats['Taillight'])

    # 7. DUAL MEGAPHONE BLAST EXHAUSTS
    exh_mesh = bpy.data.meshes.new("ExhaustMesh")
    exh_obj = bpy.data.objects.new("ExhaustPipes", exh_mesh)
    bpy.context.collection.objects.link(exh_obj)
    exh_obj.parent = body_obj
    bm_ex = bmesh.new()
    for sign_x in [-1, 1]:
        res_ex = bmesh.ops.create_cone(
            bm_ex, cap_ends=True, cap_tris=False, segments=16,
            radius1=0.045, radius2=0.082, depth=0.28,
            matrix=make_transform(Vector((sign_x * 0.22, 1.18, 0.62)), rot_euler=Euler((math.radians(115), 0, sign_x * math.radians(10))))
        )
        set_mat_for_verts(res_ex['verts'], 0) # Chrome
    bm_ex.to_mesh(exh_mesh)
    bm_ex.free()
    exh_obj.data.materials.append(mats['Chrome'])

    # 8. MONEY DISPLAY ($69 Screen)
    md_mesh = bpy.data.meshes.new("MoneyDisplayMesh")
    md_obj = bpy.data.objects.new("MoneyDisplay", md_mesh)
    bpy.context.collection.objects.link(md_obj)
    md_obj.parent = body_obj
    bm_md = bmesh.new()
    res_mdf_h = bmesh.ops.create_cube(bm_md, size=1.0, matrix=make_transform(Vector((0.0, -0.92, 0.54)), (0.34, 0.18, 0.04), rot_euler=Euler((math.radians(-32), 0, 0))))
    set_mat_for_verts(res_mdf_h['verts'], 0)
    res_mdf_s = bmesh.ops.create_cube(bm_md, size=1.0, matrix=make_transform(Vector((0.0, -0.92, 0.55)), (0.32, 0.16, 0.02), rot_euler=Euler((math.radians(-32), 0, 0))))
    set_mat_for_verts(res_mdf_s['verts'], 1)
    bm_md.to_mesh(md_mesh)
    bm_md.free()
    md_obj.data.materials.append(mats['DarkMetal'])
    md_obj.data.materials.append(mats['Screen'])

    # 9. SHIBA INU MASCOT DRIVER (Perked Ears + 8-Bit Pixel Shades)
    driver_mesh = bpy.data.meshes.new("DriverMesh")
    driver_obj = bpy.data.objects.new("Driver", driver_mesh)
    bpy.context.collection.objects.link(driver_obj)
    driver_obj.parent = body_obj
    bm_dr = bmesh.new()

    head_pos = Vector((0.0, 0.12, 0.90))
    res_dh = bmesh.ops.create_cube(bm_dr, size=1.0, matrix=make_transform(head_pos, (0.30, 0.32, 0.28)))
    set_mat_for_verts(res_dh['verts'], 0) # DogeFur

    snout_pos = Vector((0.0, -0.10, 0.85))
    res_sn = bmesh.ops.create_cube(bm_dr, size=1.0, matrix=make_transform(snout_pos, (0.18, 0.16, 0.14)))
    set_mat_for_verts(res_sn['verts'], 1) # DogeMuzzle

    nose_pos = Vector((0.0, -0.19, 0.89))
    res_ns = bmesh.ops.create_cube(bm_dr, size=1.0, matrix=make_transform(nose_pos, (0.06, 0.04, 0.04)))
    set_mat_for_verts(res_ns['verts'], 2) # DogeNose

    for sign_x in [-1, 1]:
        ear_pos = Vector((sign_x * 0.12, 0.10, 1.10))
        ear_rot = Euler((math.radians(-15), sign_x * math.radians(20), 0))
        res_ear = bmesh.ops.create_cone(
            bm_dr, cap_ends=True, cap_tris=False, segments=3,
            radius1=0.085, radius2=0.010, depth=0.16,
            matrix=make_transform(ear_pos, rot_euler=ear_rot)
        )
        set_mat_for_verts(res_ear['verts'], 0) # DogeFur
        res_iear = bmesh.ops.create_cone(
            bm_dr, cap_ends=True, cap_tris=False, segments=3,
            radius1=0.055, radius2=0.008, depth=0.14,
            matrix=make_transform(Vector((sign_x * 0.12, 0.06, 1.10)), rot_euler=ear_rot)
        )
        set_mat_for_verts(res_iear['verts'], 1) # DogeMuzzle

    shades_pos = Vector((0.0, -0.16, 0.94))
    res_sh = bmesh.ops.create_cube(bm_dr, size=1.0, matrix=make_transform(shades_pos, (0.32, 0.04, 0.08)))
    set_mat_for_verts(res_sh['verts'], 3) # Sunglasses
    for sign_x in [-1, 1]:
        res_step = bmesh.ops.create_cube(bm_dr, size=1.0, matrix=make_transform(Vector((sign_x * 0.08, -0.16, 0.89)), (0.09, 0.04, 0.035)))
        set_mat_for_verts(res_step['verts'], 3)

    res_tor = bmesh.ops.create_cube(bm_dr, size=1.0, matrix=make_transform(Vector((0.0, 0.18, 0.64)), (0.34, 0.28, 0.30)))
    set_mat_for_verts(res_tor['verts'], 4) # DarkMetal

    bm_dr.to_mesh(driver_mesh)
    bm_dr.free()
    driver_obj.data.materials.append(mats['DogeFur'])     # 0
    driver_obj.data.materials.append(mats['DogeMuzzle'])  # 1
    driver_obj.data.materials.append(mats['DogeNose'])    # 2
    driver_obj.data.materials.append(mats['Sunglasses'])  # 3
    driver_obj.data.materials.append(mats['DarkMetal'])   # 4

    # 10. ANTENNA & GOLDEN DOGECOIN ('Ð') MEDALLION CONTACT HEAD
    ant_mesh = bpy.data.meshes.new("AntennaMesh")
    ant_obj = bpy.data.objects.new("Antenna", ant_mesh)
    bpy.context.collection.objects.link(ant_obj)
    ant_obj.parent = car_root
    bm_ant = bmesh.new()

    res_pole = make_cylinder(bm_ant, radius=0.010, depth=0.58, segments=12, matrix=make_transform(Vector((0.0, 0.72, 1.14))))
    set_mat_for_verts(res_pole['verts'], 0) # DarkMetal
    res_sp_base = make_cylinder(bm_ant, radius=0.024, depth=0.08, segments=16, matrix=make_transform(Vector((0.0, 0.72, 0.88))))
    set_mat_for_verts(res_sp_base['verts'], 1) # Chrome
    bm_ant.to_mesh(ant_mesh)
    bm_ant.free()
    ant_obj.data.materials.append(mats['DarkMetal'])
    ant_obj.data.materials.append(mats['Chrome'])

    ch_mesh = bpy.data.meshes.new("ContactHeadMesh")
    ch_obj = bpy.data.objects.new("ContactHead", ch_mesh)
    bpy.context.collection.objects.link(ch_obj)
    ch_obj.parent = ant_obj
    bm_ch = bmesh.new()

    res_coin = make_cylinder(bm_ch, radius=0.12, depth=0.024, segments=24, matrix=make_transform(Vector((0.0, 0.0, 0.0)), rot_euler=Euler((math.radians(90), 0, 0))))
    set_mat_for_verts(res_coin['verts'], 0) # GoldAccent
    res_ring = make_cylinder(bm_ch, radius=0.135, depth=0.016, segments=24, matrix=make_transform(Vector((0.0, 0.0, 0.0)), rot_euler=Euler((math.radians(90), 0, 0))))
    set_mat_for_verts(res_ring['verts'], 1) # NeonAccent
    res_d_arc = make_cylinder(bm_ch, radius=0.065, depth=0.032, segments=16, matrix=make_transform(Vector((0.015, 0.0, 0.0)), rot_euler=Euler((math.radians(90), 0, 0))))
    set_mat_for_verts(res_d_arc['verts'], 0)
    res_d_bar = bmesh.ops.create_cube(bm_ch, size=1.0, matrix=make_transform(Vector((0.0, 0.0, 0.0)), (0.11, 0.036, 0.020)))
    set_mat_for_verts(res_d_bar['verts'], 0)

    bm_ch.to_mesh(ch_mesh)
    bm_ch.free()
    ch_obj.data.materials.append(mats['GoldAccent'])
    ch_obj.data.materials.append(mats['NeonAccent'])

    # 11. WHEELS & WELLS
    create_wheel_wells(car_root, mats, track, wheelbase)
    build_single_wheel("Wheel_FL", car_root, mats, 'doge_kart', Vector((-track, -wheelbase, 0.30)), True)
    build_single_wheel("Wheel_FR", car_root, mats, 'doge_kart', Vector(( track, -wheelbase, 0.30)), True)
    build_single_wheel("Wheel_RL", car_root, mats, 'doge_kart', Vector((-track,  wheelbase, 0.34)), False)
    build_single_wheel("Wheel_RR", car_root, mats, 'doge_kart', Vector(( track,  wheelbase, 0.34)), False)

    out_path = os.path.join(MODELS_OUT, "doge_kart.glb")
    print(f"Exporting DOGE BARK to {out_path}...")
    bpy.ops.export_scene.gltf(filepath=out_path, export_format='GLB', use_selection=False, export_yup=True, export_apply=True)
    print("=== DOGE BARK EXPORTED ===")


def main():
    print("=== STARTING PRODUCTION AAA DISTINCT 3D FLEET GENERATION ===")
    target = os.environ.get("BUILD_CAR", "all").lower()
    if target in ["all", "hood_bull"]:
        build_hood_bull_model()
    if target in ["all", "hood_bear"]:
        build_hood_bear_model()
    if target in ["all", "tsla_racer"]:
        build_tsla_racer_model()
    if target in ["all", "nvda_ai"]:
        build_nvda_ai_model()
    if target in ["all", "gold_whale"]:
        build_gold_whale_model()
    if target in ["all", "gme_ape"]:
        build_gme_ape_model()
    if target in ["all", "doge_kart"]:
        build_doge_kart_model()
    print("=== 3D FLEET BUILD COMPLETE ===")


if __name__ == '__main__':
    main()


