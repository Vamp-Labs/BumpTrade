#!/usr/bin/env python3
"""
Blender 5.1 Python Script: Production 3D Fleet Generator for BUMP.TRADE (Automotive Master Architecture).
Builds authentic, production-grade 3D GLB models for all remaining roster vehicles:
1. HOOD BEAR (L 2.7m x W 2.0m x H 1.40m, Brawler, Crimson & Charcoal, Bear Crest, '$120' Screen, Red Glow)
2. TSLA RACER (L 2.5m x W 1.8m x H 1.30m, Speedster, Pearl White & Crimson, Tech Crest, '$200' Screen, Cyan Glow)
3. NVDA AI (L 2.6m x W 1.9m x H 1.35m, Cyber Stealth, Obsidian Black & Lime, AI Eye Crest, '$150' Screen, Purple Glow)
4. GOLD WHALE (L 2.7m x W 2.0m x H 1.40m, Luxury GT, Mirror 24K Gold, Diamond Crest, '$500' Screen, Gold Glow)
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

def set_mat_for_verts(verts, mat_idx):
    faces = {f for v in verts for f in v.link_faces}
    for f in faces:
        f.material_index = mat_idx

def create_pbr_material(name, albedo_path=None, roughness_path=None, metallic_path=None, normal_path=None, emissive_path=None, base_color=(1, 1, 1), default_roughness=0.3, default_metallic=0.0, emissive_color=None, emissive_strength=1.0, alpha=1.0, transmission=0.0):
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

    mats['BodyPaint'] = create_pbr_material(
        'BodyPaint',
        albedo_path=os.path.join(tex_dir, "body_albedo.png"),
        roughness_path=os.path.join(tex_dir, "body_roughness.png"),
        metallic_path=os.path.join(tex_dir, "body_metallic.png"),
        normal_path=os.path.join(tex_dir, "body_normal.png"),
        emissive_path=os.path.join(tex_dir, "body_emissive.png"),
        base_color=(0.5, 0.5, 0.5),
        default_roughness=0.18,
        default_metallic=0.88,
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

    mats['TireRubber'] = create_pbr_material('TireRubber', base_color=(0.05, 0.06, 0.07), default_roughness=0.88, default_metallic=0.02)
    mats['Gold'] = create_pbr_material('Gold', base_color=(1.0, 0.78, 0.14), default_roughness=0.12, default_metallic=0.98)
    mats['NeonAccent'] = create_pbr_material('NeonAccent', base_color=glow_color_rgb, emissive_color=glow_color_rgb, emissive_strength=6.0, default_roughness=0.1)
    mats['Carbon'] = create_pbr_material('Carbon', base_color=(0.03, 0.03, 0.04), default_roughness=0.32, default_metallic=0.25)
    mats['DarkMetal'] = create_pbr_material('DarkMetal', base_color=(0.08, 0.10, 0.12), default_roughness=0.48, default_metallic=0.85)
    mats['Chrome'] = create_pbr_material('Chrome', base_color=(0.95, 0.97, 1.0), default_roughness=0.04, default_metallic=0.98)
    mats['Glass'] = create_pbr_material('Glass', base_color=(0.08, 0.22, 0.28), default_roughness=0.05, default_metallic=0.1, transmission=0.82, alpha=0.55)
    mats['Headlight'] = create_pbr_material('Headlight', base_color=(1.0, 0.98, 0.88), emissive_color=(1.0, 0.98, 0.88), emissive_strength=5.0, default_roughness=0.08)
    mats['AmberDRL'] = create_pbr_material('AmberDRL', base_color=(1.0, 0.58, 0.0), emissive_color=(1.0, 0.58, 0.0), emissive_strength=4.5, default_roughness=0.08)
    mats['Taillight'] = create_pbr_material('Taillight', base_color=(1.0, 0.07, 0.15), emissive_color=(1.0, 0.07, 0.15), emissive_strength=5.0, default_roughness=0.08)
    mats['BrakeDisc'] = create_pbr_material('BrakeDisc', base_color=(0.45, 0.48, 0.52), default_roughness=0.25, default_metallic=0.9)
    mats['DriverSkin'] = create_pbr_material('DriverSkin', base_color=(0.48, 0.28, 0.16) if car_type == 'hood_bear' else (0.85, 0.88, 0.92), default_roughness=0.45, default_metallic=0.1)
    mats['Sunglasses'] = create_pbr_material('Sunglasses', base_color=(0.01, 0.01, 0.01), default_roughness=0.04, default_metallic=0.95)

    mats['Screen'] = create_pbr_material(
        'Screen',
        albedo_path=os.path.join(tex_dir, "screen_albedo.png"),
        emissive_path=os.path.join(tex_dir, "screen_emissive.png"),
        base_color=(0.02, 0.03, 0.04),
        emissive_strength=4.5,
        default_roughness=0.1
    )

    return mats

def build_vehicle_model(car_type, specs):
    """
    Builds a complete automotive supercar model for any of the fleet archetypes.
    specs:
      hw_front, hw_waist, hw_rear, scale_z, glow_rgb, mascot_type, antenna_type
    """
    clean_scene()
    mats = setup_materials_for_car(car_type, specs['glow_rgb'])

    car_root = bpy.data.objects.new("CarRoot", None)
    bpy.context.collection.objects.link(car_root)

    # 1. BODY SHELL WITH CIRCULAR WHEEL ARCHES
    body_mesh = bpy.data.meshes.new("BodyMesh")
    body_obj = bpy.data.objects.new("Body", body_mesh)
    bpy.context.collection.objects.link(body_obj)
    body_obj.parent = car_root

    bm = bmesh.new()

    def get_arch_cutout(y_val):
        for y_c in [-0.78, 0.78]:
            dy = abs(y_val - y_c)
            if dy <= 0.32:
                return 0.28 + math.sqrt(max(0.0, 0.32**2 - dy**2)), True
        return 0.22, False

    hw_f = specs['hw_front']
    hw_w = specs['hw_waist']
    hw_r = specs['hw_rear']
    sz = specs['scale_z']

    sections = [
        {"y": -1.26, "hw": hw_f * 0.64, "z_top": 0.44 * sz, "z_peak": 0.46 * sz, "z_waist": 0.35 * sz, "z_bot": 0.18},
        {"y": -1.16, "hw": hw_f * 0.78, "z_top": 0.49 * sz, "z_peak": 0.55 * sz, "z_waist": 0.40 * sz, "z_bot": 0.18},
        {"y": -1.06, "hw": hw_f * 0.88, "z_top": 0.52 * sz, "z_peak": 0.61 * sz, "z_waist": 0.45 * sz, "z_bot": 0.20},
        {"y": -0.94, "hw": hw_f * 0.95, "z_top": 0.53 * sz, "z_peak": 0.64 * sz, "z_waist": 0.54 * sz, "z_bot": 0.20},
        {"y": -0.78, "hw": hw_f * 1.00, "z_top": 0.54 * sz, "z_peak": 0.67 * sz, "z_waist": 0.62 * sz, "z_bot": 0.20},
        {"y": -0.62, "hw": hw_f * 0.95, "z_top": 0.56 * sz, "z_peak": 0.66 * sz, "z_waist": 0.54 * sz, "z_bot": 0.20},
        {"y": -0.48, "hw": hw_f * 0.88, "z_top": 0.60 * sz, "z_peak": 0.68 * sz, "z_waist": 0.48 * sz, "z_bot": 0.20},
        {"y": -0.32, "hw": hw_w * 1.05, "z_top": 0.66 * sz, "z_peak": 0.69 * sz, "z_waist": 0.52 * sz, "z_bot": 0.20},
        {"y": -0.12, "hw": hw_w * 1.00, "z_top": 0.42 * sz, "z_peak": 0.68 * sz, "z_waist": 0.48 * sz, "z_bot": 0.20},
        {"y":  0.12, "hw": hw_w * 1.00, "z_top": 0.42 * sz, "z_peak": 0.69 * sz, "z_waist": 0.48 * sz, "z_bot": 0.20},
        {"y":  0.34, "hw": hw_r * 0.82, "z_top": 0.72 * sz, "z_peak": 0.76 * sz, "z_waist": 0.54 * sz, "z_bot": 0.20},
        {"y":  0.48, "hw": hw_r * 0.90, "z_top": 0.73 * sz, "z_peak": 0.79 * sz, "z_waist": 0.50 * sz, "z_bot": 0.20},
        {"y":  0.62, "hw": hw_r * 0.96, "z_top": 0.75 * sz, "z_peak": 0.81 * sz, "z_waist": 0.56 * sz, "z_bot": 0.20},
        {"y":  0.78, "hw": hw_r * 1.00, "z_top": 0.76 * sz, "z_peak": 0.82 * sz, "z_waist": 0.63 * sz, "z_bot": 0.20},
        {"y":  0.94, "hw": hw_r * 0.96, "z_top": 0.77 * sz, "z_peak": 0.81 * sz, "z_waist": 0.56 * sz, "z_bot": 0.20},
        {"y":  1.06, "hw": hw_r * 0.88, "z_top": 0.78 * sz, "z_peak": 0.80 * sz, "z_waist": 0.52 * sz, "z_bot": 0.20},
        {"y":  1.18, "hw": hw_r * 0.80, "z_top": 0.81 * sz, "z_peak": 0.78 * sz, "z_waist": 0.50 * sz, "z_bot": 0.20},
        {"y":  1.26, "hw": hw_r * 0.70, "z_top": 0.84 * sz, "z_peak": 0.76 * sz, "z_waist": 0.46 * sz, "z_bot": 0.20},
    ]

    u_weights = [0.50, 0.58, 0.66, 0.76, 0.84, 0.88, 0.94, 0.98, 0.50, 0.02, 0.06, 0.12, 0.16, 0.24, 0.34, 0.42]

    ring_verts = []
    ring_uvs = []

    for s in sections:
        loop = []
        uv_loop = []
        y = s["y"]
        hw = s["hw"]
        zt = s["z_top"]
        zp = s["z_peak"]
        zw = s["z_waist"]
        zb = s["z_bot"]
        za, is_arch = get_arch_cutout(y)
        v_coord = 1.0 - ((y - (-1.26)) / 2.52)

        v0 = bm.verts.new(Vector((0.0, y, zt)))
        v1 = bm.verts.new(Vector((hw * 0.35, y, zt * 0.70 + zp * 0.30)))
        v2 = bm.verts.new(Vector((hw * 0.60, y, zt * 0.30 + zp * 0.70)))
        v3 = bm.verts.new(Vector((hw * 0.82, y, zp)))
        v4 = bm.verts.new(Vector((hw * 0.96, y, zp * 0.50 + zw * 0.50)))
        v5 = bm.verts.new(Vector((hw * 1.00, y, zw)))

        if is_arch:
            v6 = bm.verts.new(Vector((hw * 0.95, y, za)))
            v7 = bm.verts.new(Vector((hw * 0.84, y, za - 0.03)))
        else:
            v6 = bm.verts.new(Vector((hw * 0.92, y, zw * 0.50 + za * 0.50)))
            v7 = bm.verts.new(Vector((hw * 0.68, y, za)))

        v8 = bm.verts.new(Vector((0.0, y, zb)))

        if is_arch:
            v9 = bm.verts.new(Vector((-hw * 0.84, y, za - 0.03)))
            v10 = bm.verts.new(Vector((-hw * 0.95, y, za)))
        else:
            v9 = bm.verts.new(Vector((-hw * 0.68, y, za)))
            v10 = bm.verts.new(Vector((-hw * 0.92, y, zw * 0.50 + za * 0.50)))

        v11 = bm.verts.new(Vector((-hw * 1.00, y, zw)))
        v12 = bm.verts.new(Vector((-hw * 0.96, y, zp * 0.50 + zw * 0.50)))
        v13 = bm.verts.new(Vector((-hw * 0.82, y, zp)))
        v14 = bm.verts.new(Vector((-hw * 0.60, y, zt * 0.30 + zp * 0.70)))
        v15 = bm.verts.new(Vector((-hw * 0.35, y, zt * 0.70 + zp * 0.30)))

        verts_16 = [v0, v1, v2, v3, v4, v5, v6, v7, v8, v9, v10, v11, v12, v13, v14, v15]
        loop.extend(verts_16)
        for w_idx in range(16):
            uv_loop.append(Vector((u_weights[w_idx], v_coord)))

        ring_verts.append(loop)
        ring_uvs.append(uv_loop)

    uv_layer = bm.loops.layers.uv.new("UVMap")

    for i in range(len(ring_verts) - 1):
        r1, r2 = ring_verts[i], ring_verts[i+1]
        uv1, uv2 = ring_uvs[i], ring_uvs[i+1]
        n = len(r1)
        for j in range(n):
            j_next = (j + 1) % n
            f = bm.faces.new([r1[j], r1[j_next], r2[j_next], r2[j]])
            f.material_index = 0
            f.loops[0][uv_layer].uv = uv1[j]
            f.loops[1][uv_layer].uv = uv1[j_next]
            f.loops[2][uv_layer].uv = uv2[j_next]
            f.loops[3][uv_layer].uv = uv2[j]

    # Front cap
    f_cap, f_uvs = ring_verts[0], ring_uvs[0]
    f_center = bm.verts.new(Vector((0.0, sections[0]["y"] - 0.04, (sections[0]["z_bot"] + sections[0]["z_top"]) * 0.5)))
    for j in range(len(f_cap)):
        j_next = (j + 1) % len(f_cap)
        f = bm.faces.new([f_cap[j_next], f_cap[j], f_center])
        f.material_index = 0
        f.loops[0][uv_layer].uv = f_uvs[j_next]
        f.loops[1][uv_layer].uv = f_uvs[j]
        f.loops[2][uv_layer].uv = Vector((0.50, 1.00))

    # Rear cap
    r_cap, r_uvs = ring_verts[-1], ring_uvs[-1]
    r_center = bm.verts.new(Vector((0.0, sections[-1]["y"] + 0.04, (sections[-1]["z_bot"] + sections[-1]["z_top"]) * 0.5)))
    for j in range(len(r_cap)):
        j_next = (j + 1) % len(r_cap)
        f = bm.faces.new([r_cap[j], r_cap[j_next], r_center])
        f.material_index = 0
        f.loops[0][uv_layer].uv = r_uvs[j]
        f.loops[1][uv_layer].uv = r_uvs[j_next]
        f.loops[2][uv_layer].uv = Vector((0.50, 0.00))

    # Ducktail Rear Spoiler
    res_duck = bmesh.ops.create_cube(bm, size=1.0, matrix=make_transform(Vector((0.0, 1.22, 0.84 * sz)), (hw_r * 0.90, 0.12, 0.05), Euler((math.radians(22), 0, 0))))
    set_mat_for_verts(res_duck['verts'], 0)

    # Front Splitter Lip
    res_split = bmesh.ops.create_cube(bm, size=1.0, matrix=make_transform(Vector((0.0, -1.28, 0.14)), (hw_f * 1.15, 0.12, 0.035)))
    set_mat_for_verts(res_split['verts'], 1)

    bm.to_mesh(body_mesh)
    bm.free()
    body_obj.data.materials.append(mats['BodyPaint']) # 0
    body_obj.data.materials.append(mats['Carbon'])    # 1

    subsurf = body_obj.modifiers.new(name="Subdivision", type='SUBSURF')
    subsurf.levels = 2
    for poly in body_obj.data.polygons:
        poly.use_smooth = True

    # 2. INNER WHEEL WELL LINERS
    ww_mesh = bpy.data.meshes.new("WheelWellsMesh")
    ww_obj = bpy.data.objects.new("WheelWells", ww_mesh)
    bpy.context.collection.objects.link(ww_obj)
    ww_obj.parent = car_root
    bm_ww = bmesh.new()
    for wx, wy, wz in [(-0.76, -0.78, 0.28), (0.76, -0.78, 0.28), (-0.76, 0.78, 0.28), (0.76, 0.78, 0.28)]:
        loops = []
        for xi in [-0.09, 0.09]:
            ring = [bm_ww.verts.new(Vector((wx + xi, wy + math.cos(math.pi * i / 12) * 0.32, wz + math.sin(math.pi * i / 12) * 0.32))) for i in range(13)]
            loops.append(ring)
        for i in range(12):
            bm_ww.faces.new([loops[0][i], loops[0][i+1], loops[1][i+1], loops[1][i]])
    bm_ww.to_mesh(ww_mesh)
    bm_ww.free()
    ww_obj.data.materials.append(mats['DarkMetal'])

    # 3. LOW PROFILE BUMPER SKIRT
    b_mesh = bpy.data.meshes.new("BumperMesh")
    b_obj = bpy.data.objects.new("Bumper", b_mesh)
    bpy.context.collection.objects.link(b_obj)
    b_obj.parent = car_root
    bm_b = bmesh.new()
    b_pts = [
        Vector((0.00, -1.30, 0.11)),
        Vector((hw_f * 0.45, -1.26, 0.11)),
        Vector((hw_f * 0.74, -1.16, 0.11)),
        Vector((hw_f * 0.90, -0.96, 0.11)),
        Vector((hw_f * 0.92, -0.78, 0.11)),
        Vector((hw_f * 0.88, -0.52, 0.11)),
        Vector((hw_w * 0.98, -0.24, 0.11)),
        Vector((hw_w * 0.95,  0.00, 0.11)),
        Vector((hw_w * 0.98,  0.24, 0.11)),
        Vector((hw_r * 0.88,  0.52, 0.11)),
        Vector((hw_r * 0.94,  0.78, 0.11)),
        Vector((hw_r * 0.90,  1.02, 0.11)),
        Vector((hw_r * 0.80,  1.20, 0.11)),
        Vector((hw_r * 0.46,  1.28, 0.11)),
        Vector((0.00,  1.30, 0.11)),
    ]
    all_b_pts = b_pts + [Vector((-p.x, p.y, p.z)) for p in reversed(b_pts[1:-1])]
    num_b = len(all_b_pts)
    ring_loops = []
    for idx, pt in enumerate(all_b_pts):
        tang = (all_b_pts[(idx + 1) % num_b] - all_b_pts[(idx - 1) % num_b]).normalized()
        up = Vector((0.0, 0.0, 1.0))
        norm = tang.cross(up).normalized()
        loop = [bm_b.verts.new(pt + norm * (math.cos(math.radians(a)) * 0.075) + up * (math.sin(math.radians(a)) * 0.055)) for a in [0, 60, 120, 180, 240, 300]]
        ring_loops.append(loop)
    for i in range(num_b):
        r1, r2 = ring_loops[i], ring_loops[(i + 1) % num_b]
        for j in range(6):
            f = bm_b.faces.new([r1[j], r1[(j+1)%6], r2[(j+1)%6], r2[j]])
            f.material_index = 0
    # Neon skirt ring
    neon_loops = []
    for idx, pt in enumerate(all_b_pts):
        tang = (all_b_pts[(idx + 1) % num_b] - all_b_pts[(idx - 1) % num_b]).normalized()
        up = Vector((0.0, 0.0, 1.0))
        norm = tang.cross(up).normalized()
        nc = pt + up * -0.05 + norm * 0.015
        v1 = bm_b.verts.new(nc + norm * -0.025)
        v2 = bm_b.verts.new(nc + norm *  0.025)
        v3 = bm_b.verts.new(nc + norm *  0.025 + up * 0.02)
        v4 = bm_b.verts.new(nc + norm * -0.025 + up * 0.02)
        neon_loops.append([v1, v2, v3, v4])
    for i in range(num_b):
        nl1, nl2 = neon_loops[i], neon_loops[(i + 1) % num_b]
        for j in range(4):
            f = bm_b.faces.new([nl1[j], nl1[(j+1)%4], nl2[(j+1)%4], nl2[j]])
            f.material_index = 1
    bm_b.to_mesh(b_mesh)
    bm_b.free()
    b_obj.data.materials.append(mats['Rubber'])
    b_obj.data.materials.append(mats['NeonAccent'])
    for poly in b_obj.data.polygons:
        poly.use_smooth = True

    # 4. FRONT FASCIA & LIGHTS
    for sign, side in [(-1, 'L'), (1, 'R')]:
        hl_mesh = bpy.data.meshes.new(f"Headlight_{side}_Mesh")
        hl_obj = bpy.data.objects.new(f"Headlight_{side}", hl_mesh)
        hl_obj.location = Vector((sign * hw_f * 0.45, -1.16, 0.46 * sz))
        bpy.context.collection.objects.link(hl_obj)
        hl_obj.parent = car_root
        bm_hl = bmesh.new()
        rot = Euler((math.radians(-90), math.radians(sign * 14), math.radians(sign * -10)))
        # Bucket
        res_bk = bmesh.ops.create_cube(bm_hl, size=1.0, matrix=make_transform(Vector((sign * 0.02, 0.02, 0.0)), (0.24, 0.05, 0.16), rot_euler=rot))
        set_mat_for_verts(res_bk['verts'], 0)
        # Projectors
        res_p = bmesh.ops.create_cone(bm_hl, cap_ends=True, cap_tris=False, segments=16, radius1=0.046, radius2=0.034, depth=0.07, matrix=make_transform(Vector((-sign * 0.04, -0.015, 0.0)), rot_euler=rot))
        set_mat_for_verts(res_p['verts'], 1)
        # DRL
        for seg_i in range(3):
            res_drl = bmesh.ops.create_cube(bm_hl, size=1.0, matrix=make_transform(Vector(((sign * 0.04) + (seg_i - 1) * 0.060, -0.030, 0.055)), (0.050, 0.03, 0.022), rot_euler=rot))
            set_mat_for_verts(res_drl['verts'], 2)
        # Lens
        res_ln = bmesh.ops.create_cube(bm_hl, size=1.0, matrix=make_transform(Vector((sign * 0.02, -0.050, 0.0)), (0.23, 0.012, 0.15), rot_euler=rot))
        set_mat_for_verts(res_ln['verts'], 3)
        bm_hl.to_mesh(hl_mesh)
        bm_hl.free()
        hl_obj.data.materials.append(mats['DarkMetal'])  # 0
        hl_obj.data.materials.append(mats['Headlight'])  # 1
        hl_obj.data.materials.append(mats['AmberDRL'])   # 2
        hl_obj.data.materials.append(mats['Glass'])      # 3

    # Front Money Display
    f_sc_mesh = bpy.data.meshes.new("FrontMoneyDisplayMesh")
    f_sc_obj = bpy.data.objects.new("FrontMoneyDisplay", f_sc_mesh)
    bpy.context.collection.objects.link(f_sc_obj)
    f_sc_obj.parent = car_root
    bm_sc = bmesh.new()
    res_fm = bmesh.ops.create_cube(bm_sc, size=1.0, matrix=make_transform(Vector((0.0, -1.22, 0.38 * sz)), (0.52, 0.04, 0.18), Euler((math.radians(-12), 0, 0))))
    set_mat_for_verts(res_fm['verts'], 0)
    res_ff = bmesh.ops.create_cube(bm_sc, size=1.0, matrix=make_transform(Vector((0.0, -1.24, 0.38 * sz)), (0.48, 0.02, 0.16), Euler((math.radians(-12), 0, 0))))
    set_mat_for_verts(res_ff['verts'], 2)
    v1 = bm_sc.verts.new(Vector((-0.21, -1.265, 0.315 * sz)))
    v2 = bm_sc.verts.new(Vector(( 0.21, -1.265, 0.315 * sz)))
    v3 = bm_sc.verts.new(Vector(( 0.21, -1.238, 0.445 * sz)))
    v4 = bm_sc.verts.new(Vector((-0.21, -1.238, 0.445 * sz)))
    face = bm_sc.faces.new([v1, v2, v3, v4])
    face.material_index = 1
    uv_layer = bm_sc.loops.layers.uv.new("UVMap")
    uvs = [Vector((0, 0)), Vector((1, 0)), Vector((1, 1)), Vector((0, 1))]
    for loop, uv in zip(face.loops, uvs):
        loop[uv_layer].uv = uv
    bm_sc.to_mesh(f_sc_mesh)
    bm_sc.free()
    f_sc_obj.data.materials.append(mats['DarkMetal'])   # 0
    f_sc_obj.data.materials.append(mats['Screen'])      # 1
    f_sc_obj.data.materials.append(mats['NeonAccent'])  # 2

    # Rear Taillights
    for sign, side in [(-1, 'L'), (1, 'R')]:
        tl_mesh = bpy.data.meshes.new(f"TailLight_{side}_Mesh")
        tl_obj = bpy.data.objects.new(f"TailLight_{side}", tl_mesh)
        tl_obj.location = Vector((sign * hw_r * 0.48, 1.25, 0.62 * sz))
        bpy.context.collection.objects.link(tl_obj)
        tl_obj.parent = car_root
        bm_tl = bmesh.new()
        res_t = bmesh.ops.create_cube(bm_tl, size=1.0, matrix=make_transform(Vector((0.0, 0.0, 0.05)), (0.19, 0.035, 0.028)))
        res_b = bmesh.ops.create_cube(bm_tl, size=1.0, matrix=make_transform(Vector((0.0, 0.0, -0.05)), (0.19, 0.035, 0.028)))
        res_s = bmesh.ops.create_cube(bm_tl, size=1.0, matrix=make_transform(Vector((sign * 0.085, 0.0, 0.0)), (0.028, 0.035, 0.11)))
        set_mat_for_verts(res_t['verts'] + res_b['verts'] + res_s['verts'], 0)
        bm_tl.to_mesh(tl_mesh)
        bm_tl.free()
        tl_obj.data.materials.append(mats['Taillight'])

    # 5. COCKPIT & MASCOT DRIVER
    cp_mesh = bpy.data.meshes.new("CockpitMesh")
    cp_obj = bpy.data.objects.new("Cockpit", cp_mesh)
    bpy.context.collection.objects.link(cp_obj)
    cp_obj.parent = car_root
    bm_cp = bmesh.new()
    res_tub = bmesh.ops.create_cube(bm_cp, size=1.0, matrix=make_transform(Vector((0.0, 0.04, 0.40)), (0.68, 0.66, 0.16)))
    res_bk = bmesh.ops.create_cube(bm_cp, size=1.0, matrix=make_transform(Vector((0.0, 0.28, 0.72)), (0.50, 0.12, 0.48), Euler((math.radians(14), 0, 0))))
    set_mat_for_verts(res_tub['verts'] + res_bk['verts'], 0)
    # Roll hoops
    for s_hoop in [-1, 1]:
        res_h = bmesh.ops.create_cone(bm_cp, cap_ends=True, cap_tris=False, segments=16, radius1=0.030, radius2=0.030, depth=0.34, matrix=make_transform(Vector((s_hoop * 0.17, 0.40, 1.04))))
        set_mat_for_verts(res_h['verts'], 1)
    # Steering
    res_st = bmesh.ops.create_cone(bm_cp, cap_ends=True, cap_tris=False, segments=18, radius1=0.12, radius2=0.10, depth=0.025, matrix=make_transform(Vector((0.0, -0.16, 0.66)), rot_euler=Euler((math.radians(35), 0, 0))))
    set_mat_for_verts(res_st['verts'], 2)
    bm_cp.to_mesh(cp_mesh)
    bm_cp.free()
    cp_obj.data.materials.append(mats['DarkMetal'])
    cp_obj.data.materials.append(mats['Chrome'])
    cp_obj.data.materials.append(mats['NeonAccent'])

    # Windscreen
    ws_mesh = bpy.data.meshes.new("WindscreenMesh")
    ws_obj = bpy.data.objects.new("Windscreen", ws_mesh)
    bpy.context.collection.objects.link(ws_obj)
    ws_obj.parent = car_root
    bm_ws = bmesh.new()
    ws_secs = [{"y": -0.38, "hw": 0.52, "z": 0.70}, {"y": -0.28, "hw": 0.46, "z": 0.80}, {"y": -0.16, "hw": 0.40, "z": 0.84}]
    ws_loops = []
    for s in ws_secs:
        loop = [
            bm_ws.verts.new(Vector((-s["hw"], s["y"], s["z"] - 0.06))),
            bm_ws.verts.new(Vector((-s["hw"] * 0.5, s["y"], s["z"]))),
            bm_ws.verts.new(Vector((0.0, s["y"], s["z"] + 0.03))),
            bm_ws.verts.new(Vector((s["hw"] * 0.5, s["y"], s["z"]))),
            bm_ws.verts.new(Vector((s["hw"], s["y"], s["z"] - 0.06))),
        ]
        ws_loops.append(loop)
    for i in range(len(ws_loops) - 1):
        for j in range(4):
            bm_ws.faces.new([ws_loops[i][j], ws_loops[i][j+1], ws_loops[i+1][j+1], ws_loops[i+1][j]])
    bm_ws.to_mesh(ws_mesh)
    bm_ws.free()
    ws_obj.data.materials.append(mats['Glass'])
    for poly in ws_obj.data.polygons:
        poly.use_smooth = True

    # Archetype Mascot Driver
    d_mesh = bpy.data.meshes.new(f"{car_type}_DriverMesh")
    d_obj = bpy.data.objects.new(f"{car_type}_Driver", d_mesh)
    bpy.context.collection.objects.link(d_obj)
    d_obj.parent = car_root
    bm_d = bmesh.new()
    # Torso
    res_dt = bmesh.ops.create_cube(bm_d, size=1.0, matrix=make_transform(Vector((0.0, 0.08, 0.68)), (0.38, 0.26, 0.32)))
    set_mat_for_verts(res_dt['verts'], 0)
    # Arms
    res_al = bmesh.ops.create_cube(bm_d, size=1.0, matrix=make_transform(Vector((-0.15, -0.05, 0.67)), (0.10, 0.24, 0.10), Euler((math.radians(22), 0, math.radians(16)))))
    res_ar = bmesh.ops.create_cube(bm_d, size=1.0, matrix=make_transform(Vector(( 0.15, -0.05, 0.67)), (0.10, 0.24, 0.10), Euler((math.radians(22), 0, math.radians(-16)))))
    set_mat_for_verts(res_al['verts'] + res_ar['verts'], 0)
    # Head
    res_dh = bmesh.ops.create_uvsphere(bm_d, u_segments=16, v_segments=12, radius=0.16, matrix=make_transform(Vector((0.0, 0.05, 0.98))))
    set_mat_for_verts(res_dh['verts'], 1)

    m_type = specs['mascot_type']
    if m_type == 'bear':
        # Bear Snout
        res_sn = bmesh.ops.create_cube(bm_d, size=1.0, matrix=make_transform(Vector((0.0, -0.10, 0.92)), (0.20, 0.14, 0.12)))
        # Bear round ears
        res_el = bmesh.ops.create_uvsphere(bm_d, u_segments=12, v_segments=10, radius=0.065, matrix=make_transform(Vector((-0.15, 0.06, 1.10))))
        res_er = bmesh.ops.create_uvsphere(bm_d, u_segments=12, v_segments=10, radius=0.065, matrix=make_transform(Vector(( 0.15, 0.06, 1.10))))
        set_mat_for_verts(res_sn['verts'] + res_el['verts'] + res_er['verts'], 1)
    elif m_type == 'cyber':
        # Cyber Visor (Neon accent)
        res_vis = bmesh.ops.create_cube(bm_d, size=1.0, matrix=make_transform(Vector((0.0, -0.10, 1.00)), (0.26, 0.04, 0.07)))
        set_mat_for_verts(res_vis['verts'], 3) # Neon accent
    elif m_type == 'whale':
        # Gold Crown on head
        res_cr = bmesh.ops.create_cone(bm_d, cap_ends=True, cap_tris=False, segments=14, radius1=0.12, radius2=0.08, depth=0.12, matrix=make_transform(Vector((0.0, 0.04, 1.15))))
        set_mat_for_verts(res_cr['verts'], 3) # Gold

    # Aviator shades
    res_sh = bmesh.ops.create_cube(bm_d, size=1.0, matrix=make_transform(Vector((0.0, -0.10, 1.01)), (0.24, 0.03, 0.075)))
    set_mat_for_verts(res_sh['verts'], 2)

    bm_d.to_mesh(d_mesh)
    bm_d.free()
    d_obj.data.materials.append(mats['DarkMetal'])
    d_obj.data.materials.append(mats['DriverSkin'])
    d_obj.data.materials.append(mats['Sunglasses'])
    d_obj.data.materials.append(mats['NeonAccent'] if m_type == 'cyber' else mats['Gold'])
    for poly in d_obj.data.polygons:
        poly.use_smooth = True

    # 6. REAR TRANSOM, MONEY DISPLAY & DIFFUSER
    md_mesh = bpy.data.meshes.new("MoneyDisplayMesh")
    md_obj = bpy.data.objects.new("MoneyDisplay", md_mesh)
    bpy.context.collection.objects.link(md_obj)
    md_obj.parent = car_root
    bm_md = bmesh.new()
    res_rf = bmesh.ops.create_cube(bm_md, size=1.0, matrix=make_transform(Vector((0.0, 1.25, 0.58)), (0.64, 0.04, 0.22)))
    set_mat_for_verts(res_rf['verts'], 0)
    v1 = bm_md.verts.new(Vector((-0.28, 1.268, 0.49)))
    v2 = bm_md.verts.new(Vector(( 0.28, 1.268, 0.49)))
    v3 = bm_md.verts.new(Vector(( 0.28, 1.268, 0.67)))
    v4 = bm_md.verts.new(Vector((-0.28, 1.268, 0.67)))
    f_md = bm_md.faces.new([v1, v2, v3, v4])
    f_md.material_index = 1
    uv_l = bm_md.loops.layers.uv.new("UVMap")
    for loop, uv in zip(f_md.loops, [Vector((0, 0)), Vector((1, 0)), Vector((1, 1)), Vector((0, 1))]):
        loop[uv_l].uv = uv
    bm_md.to_mesh(md_mesh)
    bm_md.free()
    md_obj.data.materials.append(mats['DarkMetal'])
    md_obj.data.materials.append(mats['Screen'])

    # Diffuser & exhausts
    df_mesh = bpy.data.meshes.new("DiffuserMesh")
    df_obj = bpy.data.objects.new("RearDiffuser", df_mesh)
    bpy.context.collection.objects.link(df_obj)
    df_obj.parent = car_root
    bm_df = bmesh.new()
    res_df = bmesh.ops.create_cube(bm_df, size=1.0, matrix=make_transform(Vector((0.0, 1.27, 0.18)), (hw_r * 0.82, 0.12, 0.07)))
    set_mat_for_verts(res_df['verts'], 0)
    for sign in [-1, 1]:
        res_ex = bmesh.ops.create_cone(bm_df, cap_ends=True, cap_tris=False, segments=18, radius1=0.052, radius2=0.046, depth=0.10, matrix=make_transform(Vector((sign * 0.22, 1.29, 0.19)), rot_euler=Euler((math.radians(90), 0, 0))))
        set_mat_for_verts(res_ex['verts'], 1)
    bm_df.to_mesh(df_mesh)
    bm_df.free()
    df_obj.data.materials.append(mats['Carbon'])
    df_obj.data.materials.append(mats['Chrome'])

    # 7. ANTENNA & CONTACT HEAD
    ant_mesh = bpy.data.meshes.new("AntennaMesh")
    ant_obj = bpy.data.objects.new("Antenna", ant_mesh)
    bpy.context.collection.objects.link(ant_obj)
    ant_obj.parent = car_root
    bm_ant = bmesh.new()
    ant_t = specs['antenna_type']
    if ant_t == 'dual':
        # Dual gold masts for Gold Whale
        for s_ant in [-0.18, 0.18]:
            bmesh.ops.create_cone(bm_ant, cap_ends=True, cap_tris=False, segments=14, radius1=0.040, radius2=0.035, depth=0.10, matrix=make_transform(Vector((s_ant, 0.65, 0.82))))
            bmesh.ops.create_cone(bm_ant, cap_ends=True, cap_tris=False, segments=14, radius1=0.012, radius2=0.010, depth=1.35, matrix=make_transform(Vector((s_ant, 0.65, 1.50))))
    else:
        bmesh.ops.create_cone(bm_ant, cap_ends=True, cap_tris=False, segments=16, radius1=0.050, radius2=0.042, depth=0.12, matrix=make_transform(Vector((0.0, 0.65, 0.82))))
        bmesh.ops.create_cone(bm_ant, cap_ends=True, cap_tris=False, segments=16, radius1=0.012, radius2=0.010, depth=1.35, matrix=make_transform(Vector((0.0, 0.65, 1.50))))
    bm_ant.to_mesh(ant_mesh)
    bm_ant.free()
    ant_obj.data.materials.append(mats['Gold'] if ant_t == 'dual' else mats['Chrome'])

    ch_mesh = bpy.data.meshes.new("ContactHeadMesh")
    ch_obj = bpy.data.objects.new("ContactHead", ch_mesh)
    ch_obj.location = Vector((0.0, 0.65, 2.20))
    ch_obj.parent = ant_obj
    bpy.context.collection.objects.link(ch_obj)
    bm_ch = bmesh.new()
    if ant_t == 'dual':
        for s_ch in [-0.18, 0.18]:
            bmesh.ops.create_uvsphere(bm_ch, u_segments=16, v_segments=12, radius=0.08, matrix=make_transform(Vector((s_ch, 0, 0))))
    else:
        bmesh.ops.create_uvsphere(bm_ch, u_segments=16, v_segments=12, radius=0.09)
        bmesh.ops.create_cone(bm_ch, cap_ends=True, cap_tris=False, segments=16, radius1=0.14, radius2=0.12, depth=0.02, matrix=make_transform(Vector((0, 0, 0)), rot_euler=Euler((math.radians(90), 0, 0))))
    bm_ch.to_mesh(ch_mesh)
    bm_ch.free()
    ch_obj.data.materials.append(mats['NeonAccent'])

    # 8. FOUR INDEPENDENT WHEELS
    def make_wh(w_name, pos):
        w_root = bpy.data.objects.new(w_name, None)
        w_root.location = pos
        bpy.context.collection.objects.link(w_root)
        w_root.parent = car_root

        # Tire
        t_mesh = bpy.data.meshes.new(f"{w_name}_TireMesh")
        t_obj = bpy.data.objects.new(f"{w_name}_Tire", t_mesh)
        t_obj.parent = w_root
        bpy.context.collection.objects.link(t_obj)
        bm_t = bmesh.new()
        rings = []
        for xo, r in [(-0.11, 0.18), (-0.10, 0.27), (-0.08, 0.28), (0.08, 0.28), (0.10, 0.27), (0.11, 0.18)]:
            loop = [bm_t.verts.new(Vector((xo, math.sin(math.pi * 2 * i / 24) * r, math.cos(math.pi * 2 * i / 24) * r))) for i in range(24)]
            rings.append(loop)
        for i in range(len(rings) - 1):
            for j in range(24):
                bm_t.faces.new([rings[i][j], rings[i][(j+1)%24], rings[i+1][(j+1)%24], rings[i+1][j]])
        bm_t.to_mesh(t_mesh)
        bm_t.free()
        t_obj.data.materials.append(mats['TireRubber'])
        for poly in t_obj.data.polygons:
            poly.use_smooth = True

        # Rim
        r_mesh = bpy.data.meshes.new(f"{w_name}_RimMesh")
        r_obj = bpy.data.objects.new(f"{w_name}_Rim", r_mesh)
        r_obj.parent = w_root
        bpy.context.collection.objects.link(r_obj)
        bm_r = bmesh.new()
        ox = 0.10 if pos.x > 0 else -0.10
        hx = ox * 0.65
        # 5 aero spokes
        hc = bm_r.verts.new(Vector((hx, 0, 0)))
        for s in range(5):
            a1 = (s / 5) * math.pi * 2.0 - 0.16
            a2 = (s / 5) * math.pi * 2.0 + 0.16
            v1 = bm_r.verts.new(Vector((ox, math.sin(a1) * 0.17, math.cos(a1) * 0.17)))
            v2 = bm_r.verts.new(Vector((ox, math.sin(a2) * 0.17, math.cos(a2) * 0.17)))
            f = bm_r.faces.new([hc, v1, v2])
            f.material_index = 0
        # Lip
        lip_o, lip_i = [], []
        for i in range(24):
            ang = (i / 24) * math.pi * 2.0
            lip_o.append(bm_r.verts.new(Vector((ox * 1.01, math.sin(ang) * 0.18, math.cos(ang) * 0.18))))
            lip_i.append(bm_r.verts.new(Vector((ox * 1.01, math.sin(ang) * 0.155, math.cos(ang) * 0.155))))
        uv_l = bm_r.loops.layers.uv.new("UVMap")
        for i in range(24):
            i_next = (i + 1) % 24
            f = bm_r.faces.new([lip_o[i], lip_o[i_next], lip_i[i_next], lip_i[i]])
            f.material_index = 0
            for loop in f.loops:
                vp = loop.vert.co
                loop[uv_l].uv = Vector(((vp.y / 0.18) * 0.5 + 0.5, (vp.z / 0.18) * 0.5 + 0.5))
        # Center cap
        cc = [bm_r.verts.new(Vector((hx * 1.02, 0, 0)))]
        for i in range(12):
            ang = (i / 12) * math.pi * 2.0
            cc.append(bm_r.verts.new(Vector((hx * 1.02, math.sin(ang) * 0.05, math.cos(ang) * 0.05))))
        for i in range(12):
            f = bm_r.faces.new([cc[0], cc[i+1], cc[((i+1)%12)+1]])
            f.material_index = 0
            for loop in f.loops:
                vp = loop.vert.co
                loop[uv_l].uv = Vector(((vp.y / 0.18) * 0.5 + 0.5, (vp.z / 0.18) * 0.5 + 0.5))
        bm_r.to_mesh(r_mesh)
        bm_r.free()
        r_obj.data.materials.append(mats['Wheel'])

        # Brake disc
        bd_mesh = bpy.data.meshes.new(f"{w_name}_BrakeDiscMesh")
        bd_obj = bpy.data.objects.new(f"{w_name}_BrakeDisc", bd_mesh)
        bd_obj.parent = w_root
        bpy.context.collection.objects.link(bd_obj)
        bm_bd = bmesh.new()
        bdc = [bm_bd.verts.new(Vector((0, 0, 0)))]
        for i in range(16):
            a = (i / 16) * math.pi * 2.0
            bdc.append(bm_bd.verts.new(Vector((0, math.sin(a) * 0.145, math.cos(a) * 0.145))))
        for i in range(16):
            bm_bd.faces.new([bdc[0], bdc[i+1], bdc[((i+1)%16)+1]])
        bm_bd.to_mesh(bd_mesh)
        bm_bd.free()
        bd_obj.data.materials.append(mats['BrakeDisc'])
        return w_root

    make_wh("Wheel_FL", Vector((-0.80, -0.78, 0.28)))
    make_wh("Wheel_FR", Vector(( 0.80, -0.78, 0.28)))
    make_wh("Wheel_RL", Vector((-0.80,  0.78, 0.28)))
    make_wh("Wheel_RR", Vector(( 0.80,  0.78, 0.28)))

    # Export to GLB
    out_path = os.path.join(MODELS_OUT, f"{car_type}.glb")
    print(f"Exporting {car_type} to {out_path}...")
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format='GLB',
        use_selection=False,
        export_yup=True,
        export_apply=True
    )
    print(f"=== {car_type.upper()} EXPORT COMPLETED ===")

def main():
    print("=== STARTING FULL FLEET BLENDER GENERATION ===")

    # 1. HOOD BEAR (Brawler: wider, heavier, crimson red glow)
    build_vehicle_model('hood_bear', {
        'hw_front': 1.02,
        'hw_waist': 0.84,
        'hw_rear': 1.08,
        'scale_z': 1.04,
        'glow_rgb': (1.0, 0.08, 0.20),
        'mascot_type': 'bear',
        'antenna_type': 'single'
    })

    # 2. TSLA RACER (Speedster: sleek wedge, pearl white, electric cyan glow)
    build_vehicle_model('tsla_racer', {
        'hw_front': 0.92,
        'hw_waist': 0.76,
        'hw_rear': 0.98,
        'scale_z': 0.95,
        'glow_rgb': (0.0, 0.85, 1.0),
        'mascot_type': 'cyber',
        'antenna_type': 'single'
    })

    # 3. NVDA AI (Precision: stealth faceted, obsidian black, purple/lime glow)
    build_vehicle_model('nvda_ai', {
        'hw_front': 0.96,
        'hw_waist': 0.78,
        'hw_rear': 1.02,
        'scale_z': 0.98,
        'glow_rgb': (0.75, 0.33, 0.92),
        'mascot_type': 'cyber',
        'antenna_type': 'single'
    })

    # 4. GOLD WHALE (Luxury GT: widebody, mirror gold chrome, gold/amber glow)
    build_vehicle_model('gold_whale', {
        'hw_front': 1.04,
        'hw_waist': 0.86,
        'hw_rear': 1.10,
        'scale_z': 1.02,
        'glow_rgb': (1.0, 0.84, 0.0),
        'mascot_type': 'whale',
        'antenna_type': 'dual'
    })

    print("=== ALL 4 FLEET VEHICLES BUILT & EXPORTED SUCCESSFULLY ===")

if __name__ == '__main__':
    main()
