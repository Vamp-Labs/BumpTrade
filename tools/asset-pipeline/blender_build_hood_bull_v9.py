#!/usr/bin/env python3
"""
Blender 5.1 — Hood Bull V10 (Faithful PRD Remodel)

Faithfully sculpted to match:
- docs/Bump.Trade Hood Bull Texture PRD.png (Hero Car PBR & Geometry Sheet)
- docs/car/69d916c8-53f2-47f2-bc6b-22fd294cdbc1.png
- docs/car/prd.md (L 2.6m × W 1.9m × H 1.35m, emerald green, bull type)

Key Features:
- 20-station quad-loft body shell sitting inside/above bumper collar
- Heavy-duty wrap-around rubber bumper collar (pw=0.095, ph=0.075) with continuous neon green lip
- Flush deep-dish 5-spoke chrome rims with glowing neon green lip (no protruding spikes!)
- Charismatic Bull mascot driver:
  * Organic 3D curved bull horns sweeping outward, forward, and hooking upward with dark tips
  * Aviator sunglasses with dark mirror lenses and gold wire frame
  * Rounded snout with gold septum nose ring
  * Drooping lateral bull ears
  * Graphite racing suit with shoulder accents
- Sculpted front fascia:
  * Angled dual-projector headlights with amber DRL brow and glass covers
  * Centered framed digital display showing "$85" (MoneyDisplay)
  * Recessed lower intake grille
- Deep cockpit tub with sport bucket seat, headrest rollover nacelle, bull-horn steering wheel
- Sculpted rear C-shaped ruby red taillights
- Antenna with glowing neon green circular contact ring head
- 100% CarNodeBindings compliant (Body, Bumper, MoneyDisplay, Cockpit, Driver,
  Headlight_L/R, TailLight_L/R, Antenna, ContactHead, Wheel_FL/FR/RL/RR, WheelWells)
"""

from __future__ import annotations

import math
import os

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

# ─────────────────────────────────────────────────────────────────────────────
# Paths
# ─────────────────────────────────────────────────────────────────────────────
TEXTURES_DIR = "/home/cn/Projects/Personal/3d/public/models/textures/hood_bull"
OUT_GLB   = "/home/cn/Projects/Personal/3d/public/models/hood_bull.glb"
OUT_BLEND = "/home/cn/Projects/Personal/3d/public/models/hood_bull.blend"

# ─────────────────────────────────────────────────────────────────────────────
# Dimensions (Blender: Z-up, +Y = forward)
# ─────────────────────────────────────────────────────────────────────────────
TRACK     = 0.84   # half track width (wheel X)
WHEELBASE = 0.76   # half wheelbase (wheel |Y|)
WHEEL_R   = 0.29
WHEEL_W   = 0.22


# ─────────────────────────────────────────────────────────────────────────────
# Scene helpers
# ─────────────────────────────────────────────────────────────────────────────
def clean_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for col in list(bpy.data.collections):
        if col != bpy.context.scene.collection:
            bpy.data.collections.remove(col)


def make_transform(pos, scale=None, rot_euler=None) -> Matrix:
    mat = Matrix.Translation(pos)
    if rot_euler:
        mat = mat @ rot_euler.to_matrix().to_4x4()
    if scale:
        mat = mat @ Matrix.Diagonal((*scale, 1.0))
    return mat


def set_mat_for_verts(verts, mat_idx: int) -> None:
    faces = {f for v in verts for f in v.link_faces}
    for f in faces:
        f.material_index = mat_idx


def smooth_obj(obj) -> None:
    for poly in obj.data.polygons:
        poly.use_smooth = True


def make_cylinder(bm, radius=0.2, depth=0.2, segments=16,
                  matrix=None, cap_ends=True):
    if matrix is None:
        matrix = Matrix()
    return bmesh.ops.create_cone(
        bm,
        cap_ends=cap_ends,
        cap_tris=False,
        segments=segments,
        radius1=radius,
        radius2=radius,
        depth=depth,
        matrix=matrix,
    )


def link_obj(obj, parent):
    bpy.context.collection.objects.link(obj)
    obj.parent = parent


# ─────────────────────────────────────────────────────────────────────────────
# PBR Material factory
# ─────────────────────────────────────────────────────────────────────────────
def create_pbr_material(
    name,
    albedo_path=None,
    roughness_path=None,
    metallic_path=None,
    normal_path=None,
    emissive_path=None,
    base_color=(1, 1, 1),
    default_roughness=0.3,
    default_metallic=0.0,
    emissive_color=None,
    emissive_strength=1.0,
    alpha=1.0,
    transmission=0.0,
):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    output_node = nodes.new(type="ShaderNodeOutputMaterial")
    bsdf = nodes.new(type="ShaderNodeBsdfPrincipled")
    links.new(bsdf.outputs["BSDF"], output_node.inputs["Surface"])

    bsdf.inputs["Base Color"].default_value = (*base_color, alpha)
    bsdf.inputs["Roughness"].default_value = default_roughness
    bsdf.inputs["Metallic"].default_value = default_metallic

    if transmission > 0:
        for slot in ("Transmission Weight", "Transmission"):
            if slot in bsdf.inputs:
                bsdf.inputs[slot].default_value = transmission
                break
        mat.blend_method = "BLEND"

    tex_coord = nodes.new(type="ShaderNodeTexCoord")

    def load_tex(path, colorspace="Non-Color"):
        if not (path and os.path.exists(path)):
            return None
        n = nodes.new(type="ShaderNodeTexImage")
        n.image = bpy.data.images.load(path)
        n.image.colorspace_settings.name = colorspace
        links.new(tex_coord.outputs["UV"], n.inputs["Vector"])
        return n

    if albedo_path:
        n = load_tex(albedo_path, "sRGB")
        if n:
            links.new(n.outputs["Color"], bsdf.inputs["Base Color"])

    if roughness_path:
        n = load_tex(roughness_path)
        if n:
            links.new(n.outputs["Color"], bsdf.inputs["Roughness"])

    if metallic_path:
        n = load_tex(metallic_path)
        if n:
            links.new(n.outputs["Color"], bsdf.inputs["Metallic"])

    if normal_path:
        n = load_tex(normal_path)
        if n:
            nm = nodes.new(type="ShaderNodeNormalMap")
            nm.inputs["Strength"].default_value = 1.0
            links.new(n.outputs["Color"], nm.inputs["Color"])
            links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])

    if emissive_path:
        n = load_tex(emissive_path, "sRGB")
        if n:
            for slot in ("Emission Color", "Emission"):
                if slot in bsdf.inputs:
                    links.new(n.outputs["Color"], bsdf.inputs[slot])
                    bsdf.inputs["Emission Strength"].default_value = emissive_strength
                    break
    elif emissive_color:
        for slot in ("Emission Color", "Emission"):
            if slot in bsdf.inputs:
                bsdf.inputs[slot].default_value = (*emissive_color, 1.0)
                bsdf.inputs["Emission Strength"].default_value = emissive_strength
                break

    return mat


# ─────────────────────────────────────────────────────────────────────────────
# Material palette
# ─────────────────────────────────────────────────────────────────────────────
def setup_materials():
    td = TEXTURES_DIR
    mats = {}

    mats["BodyPaint"] = create_pbr_material(
        "BodyPaint",
        albedo_path=os.path.join(td, "body_albedo.png"),
        roughness_path=os.path.join(td, "body_roughness.png"),
        metallic_path=os.path.join(td, "body_metallic.png"),
        normal_path=os.path.join(td, "body_normal.png"),
        emissive_path=os.path.join(td, "body_emissive.png"),
        base_color=(0.0, 0.72, 0.29),
        default_roughness=0.16,
        default_metallic=0.88,
        emissive_strength=5.0,
    )
    mats["Carbon"]       = create_pbr_material("Carbon", base_color=(0.03, 0.04, 0.04), default_roughness=0.32, default_metallic=0.22)
    mats["Rubber"]       = create_pbr_material("Rubber",
                            albedo_path=os.path.join(td, "bumper_albedo.png"),
                            base_color=(0.06, 0.07, 0.08), default_roughness=0.88, default_metallic=0.02)
    mats["NeonAccent"]   = create_pbr_material("NeonAccent", base_color=(0.0, 1.0, 0.42),
                            emissive_color=(0.0, 1.0, 0.42), emissive_strength=6.0, default_roughness=0.10)
    mats["Chrome"]       = create_pbr_material("Chrome", base_color=(0.95, 0.97, 1.0), default_roughness=0.04, default_metallic=0.98)
    mats["TireRubber"]   = create_pbr_material("TireRubber", base_color=(0.04, 0.05, 0.06), default_roughness=0.92, default_metallic=0.02)
    mats["BrakeDisc"]    = create_pbr_material("BrakeDisc", base_color=(0.46, 0.48, 0.52), default_roughness=0.26, default_metallic=0.90)
    mats["GreenCaliper"] = create_pbr_material("GreenCaliper", base_color=(0.0, 0.82, 0.35),
                            emissive_color=(0.0, 0.82, 0.35), emissive_strength=2.0, default_roughness=0.20, default_metallic=0.60)
    mats["Wheel"]        = create_pbr_material("Wheel",
                            albedo_path=os.path.join(td, "wheel_albedo.png"),
                            base_color=(0.12, 0.14, 0.16), default_roughness=0.12, default_metallic=0.88)
    mats["DarkMetal"]    = create_pbr_material("DarkMetal", base_color=(0.08, 0.10, 0.12), default_roughness=0.46, default_metallic=0.86)
    mats["Headlight"]    = create_pbr_material("Headlight", base_color=(1.0, 0.97, 0.86),
                            emissive_color=(1.0, 0.97, 0.86), emissive_strength=5.5, default_roughness=0.08)
    mats["AmberDRL"]     = create_pbr_material("AmberDRL", base_color=(1.0, 0.62, 0.0),
                            emissive_color=(1.0, 0.62, 0.0), emissive_strength=4.5, default_roughness=0.10)
    mats["Taillight"]    = create_pbr_material("Taillight", base_color=(1.0, 0.07, 0.15),
                            emissive_color=(1.0, 0.07, 0.15), emissive_strength=5.5, default_roughness=0.08)
    mats["Glass"]        = create_pbr_material("Glass", base_color=(0.08, 0.24, 0.30),
                            default_roughness=0.05, default_metallic=0.10, transmission=0.85, alpha=0.50)
    mats["Screen"]       = create_pbr_material("Screen",
                            albedo_path=os.path.join(td, "screen_emissive.png"),
                            emissive_path=os.path.join(td, "screen_emissive.png"),
                            base_color=(0.02, 0.03, 0.04), emissive_strength=5.5, default_roughness=0.10)
    # Bull mascot materials
    mats["BullSkin"]     = create_pbr_material("BullSkin", base_color=(0.52, 0.32, 0.18), default_roughness=0.55, default_metallic=0.04)
    mats["BullHorn"]     = create_pbr_material("BullHorn", base_color=(0.92, 0.88, 0.76), default_roughness=0.38, default_metallic=0.08)
    mats["BullHornTip"]  = create_pbr_material("BullHornTip", base_color=(0.10, 0.08, 0.07), default_roughness=0.32, default_metallic=0.18)
    mats["BullSnout"]    = create_pbr_material("BullSnout", base_color=(0.66, 0.46, 0.32), default_roughness=0.50, default_metallic=0.04)
    mats["NoseRing"]     = create_pbr_material("NoseRing", base_color=(1.0, 0.82, 0.14),
                            emissive_color=(1.0, 0.82, 0.14), emissive_strength=3.0, default_roughness=0.08, default_metallic=0.98)
    mats["Sunglasses"]   = create_pbr_material("Sunglasses", base_color=(0.01, 0.01, 0.01), default_roughness=0.04, default_metallic=0.95)
    mats["RacingSuit"]   = create_pbr_material("RacingSuit", base_color=(0.05, 0.06, 0.07), default_roughness=0.50, default_metallic=0.12)
    mats["Gold"]         = create_pbr_material("Gold", base_color=(1.0, 0.80, 0.14), default_roughness=0.10, default_metallic=0.98)

    return mats


# ─────────────────────────────────────────────────────────────────────────────
# Core body shell: 16-vert ring cross-section loft
# ─────────────────────────────────────────────────────────────────────────────
def build_quad_body_shell(bm, sections, wheelbase, y_min, y_max):
    arch_rad = 0.36

    u_weights = [
        0.50, 0.56, 0.62, 0.68, 0.74, 0.80, 0.86, 0.92,
        1.00, 0.92, 0.86, 0.80, 0.74, 0.68, 0.62, 0.56,
    ]

    ring_verts = []
    ring_uvs   = []

    for s in sections:
        y   = s["y"]
        hw  = s["hw"]
        zt  = s["zt"]
        zp  = s["zp"]
        zw  = s["zw"]
        zb  = s["zb"]

        dy_f = abs(y - (-wheelbase))
        dy_r = abs(y -   wheelbase)
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

        v0  = bm.verts.new(Vector(( 0.00,           y, zt)))
        v1  = bm.verts.new(Vector(( hw * 0.36,      y, zt * 0.70 + zp * 0.30)))
        v2  = bm.verts.new(Vector(( hw * 0.62,      y, zt * 0.32 + zp * 0.68)))
        v3  = bm.verts.new(Vector(( hw * 0.82,      y, zp)))
        v4  = bm.verts.new(Vector(( hw * 0.94,      y, zp * 0.50 + zw * 0.50)))
        v5  = bm.verts.new(Vector(( hw * 1.00,      y, zw)))

        if is_arch:
            v6 = bm.verts.new(Vector(( hw * 0.96,  y, za)))
            v7 = bm.verts.new(Vector(( hw * 0.84,  y, za - 0.03)))
        else:
            v6 = bm.verts.new(Vector(( hw * 0.94,  y, zw * 0.48 + zb * 0.52)))
            v7 = bm.verts.new(Vector(( hw * 0.74,  y, zb)))

        v8  = bm.verts.new(Vector(( 0.00,           y, zb)))

        if is_arch:
            v9  = bm.verts.new(Vector((-hw * 0.84,  y, za - 0.03)))
            v10 = bm.verts.new(Vector((-hw * 0.96,  y, za)))
        else:
            v9  = bm.verts.new(Vector((-hw * 0.74,  y, zb)))
            v10 = bm.verts.new(Vector((-hw * 0.94,  y, zw * 0.48 + zb * 0.52)))

        v11 = bm.verts.new(Vector((-hw * 1.00,      y, zw)))
        v12 = bm.verts.new(Vector((-hw * 0.94,      y, zp * 0.50 + zw * 0.50)))
        v13 = bm.verts.new(Vector((-hw * 0.82,      y, zp)))
        v14 = bm.verts.new(Vector((-hw * 0.62,      y, zt * 0.32 + zp * 0.68)))
        v15 = bm.verts.new(Vector((-hw * 0.36,      y, zt * 0.70 + zp * 0.30)))

        loop = [v0, v1, v2, v3, v4, v5, v6, v7, v8, v9, v10, v11, v12, v13, v14, v15]
        uvs  = [Vector((u_weights[i], v_coord)) for i in range(16)]
        ring_verts.append(loop)
        ring_uvs.append(uvs)

    uv_layer = bm.loops.layers.uv.new("UVMap")

    # Bridge rings
    for i in range(len(ring_verts) - 1):
        r1, r2 = ring_verts[i], ring_verts[i + 1]
        u1, u2 = ring_uvs[i],   ring_uvs[i + 1]
        for j in range(16):
            jn = (j + 1) % 16
            f = bm.faces.new([r1[j], r1[jn], r2[jn], r2[j]])
            f.material_index = 0
            f.loops[0][uv_layer].uv = u1[j]
            f.loops[1][uv_layer].uv = u1[jn]
            f.loops[2][uv_layer].uv = u2[jn]
            f.loops[3][uv_layer].uv = u2[j]

    # Front cap
    fc = ring_verts[0]
    fu = ring_uvs[0]
    fc_ctr = bm.verts.new(Vector((0.0, sections[0]["y"] - 0.05,
                                   (sections[0]["zb"] + sections[0]["zt"]) * 0.50)))
    for j in range(16):
        jn = (j + 1) % 16
        f = bm.faces.new([fc[jn], fc[j], fc_ctr])
        f.material_index = 0
        f.loops[0][uv_layer].uv = fu[jn]
        f.loops[1][uv_layer].uv = fu[j]
        f.loops[2][uv_layer].uv = Vector((0.50, 1.00))

    # Rear cap
    rc = ring_verts[-1]
    ru = ring_uvs[-1]
    rc_ctr = bm.verts.new(Vector((0.0, sections[-1]["y"] + 0.05,
                                   (sections[-1]["zb"] + sections[-1]["zt"]) * 0.50)))
    for j in range(16):
        jn = (j + 1) % 16
        f = bm.faces.new([rc[j], rc[jn], rc_ctr])
        f.material_index = 0
        f.loops[0][uv_layer].uv = ru[j]
        f.loops[1][uv_layer].uv = ru[jn]
        f.loops[2][uv_layer].uv = Vector((0.50, 0.00))


# ─────────────────────────────────────────────────────────────────────────────
# Bumper: continuous wrap-around rubber collar with neon lip
# ─────────────────────────────────────────────────────────────────────────────
def build_thick_bumper(car_root, mats, perimeter_pts, pw=0.095, ph=0.075):
    mesh = bpy.data.meshes.new("BumperMesh")
    obj  = bpy.data.objects.new("Bumper", mesh)
    link_obj(obj, car_root)
    bm = bmesh.new()

    left_pts = [Vector((-p.x, p.y, p.z)) for p in reversed(perimeter_pts[1:-1])]
    all_pts  = perimeter_pts + left_pts
    n_pts    = len(all_pts)

    ring_loops = []
    prof_angles = list(range(0, 360, 30))

    for idx, pt in enumerate(all_pts):
        prev_pt = all_pts[(idx - 1) % n_pts]
        next_pt = all_pts[(idx + 1) % n_pts]
        tangent = (next_pt - prev_pt).normalized()
        up      = Vector((0.0, 0.0, 1.0))
        normal  = tangent.cross(up).normalized()

        loop = []
        for a in prof_angles:
            rad = math.radians(a)
            offset = normal * (math.cos(rad) * pw) + up * (math.sin(rad) * ph)
            loop.append(bm.verts.new(pt + offset))
        ring_loops.append(loop)

    uv_layer = bm.loops.layers.uv.new("UVMap")
    n_prof = len(prof_angles)

    for i in range(n_pts):
        r1 = ring_loops[i]
        r2 = ring_loops[(i + 1) % n_pts]
        u1 = i / n_pts
        u2 = (i + 1) / n_pts
        for j in range(n_prof):
            jn = (j + 1) % n_prof
            v1t = j / n_prof
            v2t = (j + 1) / n_prof
            f = bm.faces.new([r1[j], r1[jn], r2[jn], r2[j]])
            f.material_index = 0
            f.loops[0][uv_layer].uv = Vector((u1, v1t))
            f.loops[1][uv_layer].uv = Vector((u1, v2t))
            f.loops[2][uv_layer].uv = Vector((u2, v2t))
            f.loops[3][uv_layer].uv = Vector((u2, v1t))

    # Continuous neon green accent strip embedded along the lower outer lip
    neon_pw, neon_ph = 0.024, 0.020
    neon_loops = []
    for idx, pt in enumerate(all_pts):
        prev_pt = all_pts[(idx - 1) % n_pts]
        next_pt = all_pts[(idx + 1) % n_pts]
        tangent = (next_pt - prev_pt).normalized()
        up      = Vector((0.0, 0.0, 1.0))
        normal  = tangent.cross(up).normalized()
        center  = pt + normal * pw + up * (-ph * 0.55)
        loop = []
        for a in prof_angles:
            rad = math.radians(a)
            offset = normal * (math.cos(rad) * neon_pw) + up * (math.sin(rad) * neon_ph)
            loop.append(bm.verts.new(center + offset))
        neon_loops.append(loop)

    for i in range(n_pts):
        r1 = neon_loops[i]
        r2 = neon_loops[(i + 1) % n_pts]
        for j in range(n_prof):
            jn = (j + 1) % n_prof
            f = bm.faces.new([r1[j], r1[jn], r2[jn], r2[j]])
            f.material_index = 1  # NeonAccent

    bm.to_mesh(mesh)
    bm.free()
    obj.data.materials.append(mats["Rubber"])      # 0
    obj.data.materials.append(mats["NeonAccent"])  # 1
    smooth_obj(obj)
    return obj


# ─────────────────────────────────────────────────────────────────────────────
# Wheel: flush deep-dish 5-spoke chrome rim + neon lip
# ─────────────────────────────────────────────────────────────────────────────
def build_wheel(name, car_root, mats, pos):
    sign_x = -1 if pos.x < 0 else 1
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    obj  = bpy.data.objects.new(name, mesh)
    obj.location = pos
    link_obj(obj, car_root)

    bm  = bmesh.new()
    rot = Euler((0, math.radians(90), 0))

    # 0: Tire rubber with tread
    res_t = make_cylinder(bm, radius=WHEEL_R, depth=WHEEL_W, segments=24,
                          matrix=make_transform(Vector((0, 0, 0)), rot_euler=rot))
    set_mat_for_verts(res_t["verts"], 0)

    # 1: Deep-dish rim body
    rim_r = WHEEL_R * 0.72
    res_r = make_cylinder(bm, radius=rim_r, depth=WHEEL_W * 0.88, segments=24,
                          matrix=make_transform(Vector((sign_x * 0.012, 0, 0)), rot_euler=rot))
    set_mat_for_verts(res_r["verts"], 1)

    # 2: Brake rotor disc
    res_d = make_cylinder(bm, radius=WHEEL_R * 0.52, depth=0.030, segments=16,
                          matrix=make_transform(Vector((-sign_x * 0.020, 0, 0)), rot_euler=rot))
    set_mat_for_verts(res_d["verts"], 2)

    # 3: Green brake caliper
    res_cal = bmesh.ops.create_cube(bm, size=1.0,
                                    matrix=make_transform(
                                        Vector((-sign_x * 0.014, 0.0, WHEEL_R * 0.38)),
                                        (0.04, 0.10, 0.08)))
    set_mat_for_verts(res_cal["verts"], 3)

    # 4: 5 Chrome Spokes radiating inside the Y-Z plane (FLUSH, NO SPIKES!)
    sp_len = rim_r * 0.76
    r_mid  = sp_len * 0.52
    for sp_i in range(5):
        a_deg = sp_i * 72
        rad   = math.radians(a_deg)
        sp_pos = Vector((
            sign_x * (WHEEL_W * 0.42),
            math.sin(rad) * r_mid,
            math.cos(rad) * r_mid,
        ))
        sp_rot = Euler((-rad, 0, 0))
        res_sp = bmesh.ops.create_cube(
            bm,
            size=1.0,
            matrix=make_transform(
                sp_pos,
                (0.018, 0.028, sp_len),
                rot_euler=sp_rot,
            ),
        )
        set_mat_for_verts(res_sp["verts"], 4)

    # Center Chrome Hub Cap
    res_hub = make_cylinder(bm, radius=rim_r * 0.28, depth=0.022, segments=16,
                            matrix=make_transform(Vector((sign_x * (WHEEL_W * 0.44), 0, 0)), rot_euler=rot))
    set_mat_for_verts(res_hub["verts"], 4)

    # 5: Neon green glowing outer rim lip
    res_lip = make_cylinder(bm, radius=rim_r * 0.94, depth=0.016, segments=24,
                            matrix=make_transform(Vector((sign_x * (WHEEL_W * 0.46), 0, 0)), rot_euler=rot))
    set_mat_for_verts(res_lip["verts"], 5)

    bm.to_mesh(mesh)
    bm.free()
    obj.data.materials.append(mats["TireRubber"])    # 0
    obj.data.materials.append(mats["Wheel"])         # 1
    obj.data.materials.append(mats["BrakeDisc"])     # 2
    obj.data.materials.append(mats["GreenCaliper"]) # 3
    obj.data.materials.append(mats["Chrome"])        # 4
    obj.data.materials.append(mats["NeonAccent"])    # 5
    smooth_obj(obj)
    return obj


# ─────────────────────────────────────────────────────────────────────────────
# Wheel wells liner
# ─────────────────────────────────────────────────────────────────────────────
def build_wheel_wells(car_root, mats, track, wheelbase, well_rad=0.36, well_w=0.26):
    mesh = bpy.data.meshes.new("WheelWellsMesh")
    obj  = bpy.data.objects.new("WheelWells", mesh)
    link_obj(obj, car_root)
    bm = bmesh.new()

    for sx in [-1, 1]:
        for sy in [-1, 1]:
            wx = sx * track
            wy = sy * wheelbase
            pts = [Vector((0.0,
                            math.cos(math.radians(a)) * well_rad,
                            math.sin(math.radians(a)) * well_rad))
                   for a in range(0, 181, 15)]
            w_in = -sx * well_w
            for i in range(len(pts) - 1):
                p1, p2 = pts[i], pts[i + 1]
                zoff = 0.28
                v1 = bm.verts.new(Vector((wx,       wy + p1.y, zoff + p1.z)))
                v2 = bm.verts.new(Vector((wx,       wy + p2.y, zoff + p2.z)))
                v3 = bm.verts.new(Vector((wx + w_in, wy + p2.y, zoff + p2.z)))
                v4 = bm.verts.new(Vector((wx + w_in, wy + p1.y, zoff + p1.z)))
                bm.faces.new([v1, v2, v3, v4])

    bm.to_mesh(mesh)
    bm.free()
    obj.data.materials.append(mats["DarkMetal"])
    return obj


# ─────────────────────────────────────────────────────────────────────────────
# Charismatic Bull Mascot Driver
# ─────────────────────────────────────────────────────────────────────────────
def build_bull_driver(car_root, mats):
    d_mesh = bpy.data.meshes.new("Driver_Mesh")
    d_obj  = bpy.data.objects.new("Driver", d_mesh)
    link_obj(d_obj, car_root)
    bm = bmesh.new()

    # 1. Torso in graphite racing suit
    res_torso = bmesh.ops.create_uvsphere(
        bm, u_segments=16, v_segments=12, radius=0.22,
        matrix=make_transform(Vector((0.0, 0.08, 0.60)), (1.05, 0.80, 0.85))
    )
    set_mat_for_verts(res_torso["verts"], 0)  # RacingSuit

    # Racing suit white shoulder stripes
    for sign in [-1, 1]:
        res_strap = bmesh.ops.create_cube(
            bm, size=1.0,
            matrix=make_transform(Vector((sign * 0.12, 0.06, 0.68)), (0.04, 0.22, 0.024))
        )
        set_mat_for_verts(res_strap["verts"], 1)  # Chrome/White

    # 2. Bull Head Sphere
    res_head = bmesh.ops.create_uvsphere(
        bm, u_segments=18, v_segments=14, radius=0.175,
        matrix=make_transform(Vector((0.0, 0.02, 0.90)))
    )
    set_mat_for_verts(res_head["verts"], 2)  # BullSkin

    # 3. Rounded Bull Snout (muzzle)
    res_snout = bmesh.ops.create_uvsphere(
        bm, u_segments=14, v_segments=10, radius=0.11,
        matrix=make_transform(Vector((0.0, -0.12, 0.86)), (1.05, 0.85, 0.75))
    )
    set_mat_for_verts(res_snout["verts"], 3)  # BullSnout

    # Nostrils
    for sign in [-1, 1]:
        res_nos = bmesh.ops.create_cube(
            bm, size=1.0,
            matrix=make_transform(Vector((sign * 0.045, -0.185, 0.86)), (0.025, 0.02, 0.035))
        )
        set_mat_for_verts(res_nos["verts"], 0)  # Dark

    # 4. Glowing Gold Septum Nose Ring
    nr_rot = Euler((math.radians(90), 0, 0))
    res_nr = make_cylinder(
        bm, radius=0.038, depth=0.012, segments=16,
        matrix=make_transform(Vector((0.0, -0.19, 0.82)), rot_euler=nr_rot)
    )
    set_mat_for_verts(res_nr["verts"], 4)  # NoseRing (Gold)

    # 5. Drooping Bull Ears below the horns
    for sign in [-1, 1]:
        ear_rot = Euler((math.radians(-10), math.radians(sign * 25), math.radians(sign * -15)))
        res_ear = bmesh.ops.create_uvsphere(
            bm, u_segments=12, v_segments=8, radius=0.075,
            matrix=make_transform(Vector((sign * 0.17, 0.04, 0.96)), (1.1, 0.6, 0.5), rot_euler=ear_rot)
        )
        set_mat_for_verts(res_ear["verts"], 2)  # BullSkin

    # 6. Smooth 3D Curved Bull Horns (Sweeping Outward, Forward, then Hooking Upward!)
    # Built from 5 smooth lofted rings
    horn_pts_right = [
        # (pos, radius, mat_idx)
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
                loop.append(bm.verts.new(Vector((vx, cy, vz))))
            rings.append((loop, m_idx))

        # Bridge horn rings
        for r_i in range(len(rings) - 1):
            r1, m_i = rings[r_i]
            r2, _   = rings[r_i + 1]
            for j in range(8):
                jn = (j + 1) % 8
                f = bm.faces.new([r1[j], r1[jn], r2[jn], r2[j]])
                f.material_index = m_i

        # Horn tip cap
        tip_r, tip_m = rings[-1]
        tip_v = bm.verts.new(Vector((sign * 0.16, 0.02, 1.27)))
        for j in range(8):
            jn = (j + 1) % 8
            f = bm.faces.new([tip_r[jn], tip_r[j], tip_v])
            f.material_index = tip_m

    # 7. Cool Aviator Sunglasses with Dark Mirror Lenses & Gold Wire Frame
    for sign in [-1, 1]:
        # Teardrop lens
        lens_rot = Euler((math.radians(10), math.radians(sign * 6), 0))
        res_lens = bmesh.ops.create_uvsphere(
            bm, u_segments=14, v_segments=10, radius=0.048,
            matrix=make_transform(Vector((sign * 0.066, -0.155, 0.94)), (1.0, 0.20, 0.85), rot_euler=lens_rot)
        )
        set_mat_for_verts(res_lens["verts"], 7)  # Sunglasses (black mirror)

        # Wire frame ring
        res_frm = make_cylinder(
            bm, radius=0.052, depth=0.012, segments=16,
            matrix=make_transform(Vector((sign * 0.066, -0.154, 0.94)), rot_euler=Euler((math.radians(80), 0, 0)))
        )
        set_mat_for_verts(res_frm["verts"], 4)  # Gold wire frame

    # Sunglasses double bridge over snout
    res_br1 = make_cylinder(
        bm, radius=0.005, depth=0.065, segments=8,
        matrix=make_transform(Vector((0.0, -0.158, 0.965)), rot_euler=Euler((0, math.radians(90), 0)))
    )
    res_br2 = make_cylinder(
        bm, radius=0.005, depth=0.065, segments=8,
        matrix=make_transform(Vector((0.0, -0.158, 0.945)), rot_euler=Euler((0, math.radians(90), 0)))
    )
    set_mat_for_verts(res_br1["verts"] + res_br2["verts"], 4)  # Gold

    # Sunglasses side temple arms
    for sign in [-1, 1]:
        res_tarm = make_cylinder(
            bm, radius=0.005, depth=0.18, segments=8,
            matrix=make_transform(Vector((sign * 0.12, -0.06, 0.95)), rot_euler=Euler((math.radians(90), math.radians(sign * 18), 0)))
        )
        set_mat_for_verts(res_tarm["verts"], 4)  # Gold

    bm.to_mesh(d_mesh)
    bm.free()
    d_obj.data.materials.append(mats["RacingSuit"])   # 0
    d_obj.data.materials.append(mats["Chrome"])       # 1
    d_obj.data.materials.append(mats["BullSkin"])     # 2
    d_obj.data.materials.append(mats["BullSnout"])    # 3
    d_obj.data.materials.append(mats["Gold"])         # 4
    d_obj.data.materials.append(mats["BullHorn"])     # 5
    d_obj.data.materials.append(mats["BullHornTip"])  # 6
    d_obj.data.materials.append(mats["Sunglasses"])   # 7
    smooth_obj(d_obj)
    return d_obj


# ─────────────────────────────────────────────────────────────────────────────
# MAIN BUILD
# ─────────────────────────────────────────────────────────────────────────────
def build_hood_bull():
    print("=== Hood Bull V10 — Faithful PRD Remodel ===")
    clean_scene()

    mats = setup_materials()

    car_root = bpy.data.objects.new("CarRoot", None)
    bpy.context.collection.objects.link(car_root)

    # ─────────────────────────────────────────────────────────────────────────
    # 1. BODY SHELL — 20-station quad-loft resting comfortably inside/above bumper
    # ─────────────────────────────────────────────────────────────────────────
    body_mesh = bpy.data.meshes.new("BodyMesh")
    body_obj  = bpy.data.objects.new("Body", body_mesh)
    link_obj(body_obj, car_root)
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

    build_quad_body_shell(bm, sections, WHEELBASE, -1.24, 1.24)

    # Hood center carbon intake accent strip
    res_ridge = bmesh.ops.create_cube(
        bm, size=1.0,
        matrix=make_transform(
            Vector((0.0, -0.78, 0.795)),
            (0.18, 0.52, 0.028),
            Euler((math.radians(-6), 0, 0))
        )
    )
    set_mat_for_verts(res_ridge["verts"], 1)  # Carbon

    # Rear ducktail lip
    res_duck = bmesh.ops.create_cube(
        bm, size=1.0,
        matrix=make_transform(
            Vector((0.0, 1.20, 0.68)),
            (0.80, 0.08, 0.038),
            Euler((math.radians(24), 0, 0))
        )
    )
    set_mat_for_verts(res_duck["verts"], 0)

    bm.to_mesh(body_mesh)
    bm.free()
    body_obj.data.materials.append(mats["BodyPaint"])  # 0
    body_obj.data.materials.append(mats["Carbon"])     # 1

    sub = body_obj.modifiers.new(name="Subdivision", type="SUBSURF")
    sub.levels = 2
    sub.render_levels = 2
    smooth_obj(body_obj)

    # ─────────────────────────────────────────────────────────────────────────
    # 2. BUMPER — Heavy-duty wrap-around rubber collar that frames the vehicle
    # ─────────────────────────────────────────────────────────────────────────
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
    build_thick_bumper(car_root, mats, bumper_pts, pw=0.095, ph=0.075)

    # ─────────────────────────────────────────────────────────────────────────
    # 3. FRONT FASCIA & $85 MONEY DISPLAY
    # ─────────────────────────────────────────────────────────────────────────
    md_mesh = bpy.data.meshes.new("MoneyDisplayMesh")
    md_obj  = bpy.data.objects.new("MoneyDisplay", md_mesh)
    link_obj(md_obj, car_root)
    bm_md = bmesh.new()

    # Framed display box on the front nose
    res_mh = bmesh.ops.create_cube(
        bm_md, size=1.0,
        matrix=make_transform(
            Vector((0.0, -1.06, 0.46)),
            (0.46, 0.06, 0.16),
            Euler((math.radians(-14), 0, 0))
        )
    )
    set_mat_for_verts(res_mh["verts"], 0)

    # Screen face with UV mapping for "$85"
    v1 = bm_md.verts.new(Vector((-0.20, -1.095, 0.39)))
    v2 = bm_md.verts.new(Vector(( 0.20, -1.095, 0.39)))
    v3 = bm_md.verts.new(Vector(( 0.20, -1.080, 0.53)))
    v4 = bm_md.verts.new(Vector((-0.20, -1.080, 0.53)))
    f_sc = bm_md.faces.new([v1, v2, v3, v4])
    f_sc.material_index = 1
    uv_lmd = bm_md.loops.layers.uv.new("UVMap")
    for loop, uv in zip(f_sc.loops, [Vector((0, 0)), Vector((1, 0)), Vector((1, 1)), Vector((0, 1))]):
        loop[uv_lmd].uv = uv

    bm_md.to_mesh(md_mesh)
    bm_md.free()
    md_obj.data.materials.append(mats["DarkMetal"])  # 0
    md_obj.data.materials.append(mats["Screen"])     # 1

    # Recessed lower intake grille below the screen
    f_gr_mesh = bpy.data.meshes.new("LowerGrilleMesh")
    f_gr_obj  = bpy.data.objects.new("LowerGrille", f_gr_mesh)
    link_obj(f_gr_obj, car_root)
    bm_gr = bmesh.new()
    res_gr = bmesh.ops.create_cube(
        bm_gr, size=1.0,
        matrix=make_transform(Vector((0.0, -1.20, 0.30)), (0.54, 0.05, 0.08))
    )
    set_mat_for_verts(res_gr["verts"], 0)
    bm_gr.to_mesh(f_gr_mesh)
    bm_gr.free()
    f_gr_obj.data.materials.append(mats["DarkMetal"])

    # ─────────────────────────────────────────────────────────────────────────
    # 4. HEADLIGHTS (L + R) — angled dual-projector buckets + amber DRL brows
    # ─────────────────────────────────────────────────────────────────────────
    for sign, side in [(-1, "L"), (1, "R")]:
        hl_mesh = bpy.data.meshes.new(f"Headlight_{side}_Mesh")
        hl_obj  = bpy.data.objects.new(f"Headlight_{side}", hl_mesh)
        hl_obj.location = Vector((sign * 0.38, -1.16, 0.48))
        link_obj(hl_obj, car_root)
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

    # ─────────────────────────────────────────────────────────────────────────
    # 5. TAILLIGHTS (L + R) — C-shaped ruby red blocks
    # ─────────────────────────────────────────────────────────────────────────
    for sign, side in [(-1, "L"), (1, "R")]:
        tl_mesh = bpy.data.meshes.new(f"TailLight_{side}_Mesh")
        tl_obj  = bpy.data.objects.new(f"TailLight_{side}", tl_mesh)
        tl_obj.location = Vector((sign * 0.42, 1.18, 0.58))
        link_obj(tl_obj, car_root)
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

    # ─────────────────────────────────────────────────────────────────────────
    # 6. COCKPIT — open tub with sport seat, headrest nacelle, bull-horn steering wheel
    # ─────────────────────────────────────────────────────────────────────────
    cp_mesh = bpy.data.meshes.new("CockpitMesh")
    cp_obj  = bpy.data.objects.new("Cockpit", cp_mesh)
    link_obj(cp_obj, car_root)
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

    # ─────────────────────────────────────────────────────────────────────────
    # 7. DRIVER — Charismatic Bull Mascot (Curved Horns, Sunglasses, Gold Ring)
    # ─────────────────────────────────────────────────────────────────────────
    build_bull_driver(car_root, mats)

    # ─────────────────────────────────────────────────────────────────────────
    # 8. ANTENNA & CONTACT HEAD
    # ─────────────────────────────────────────────────────────────────────────
    ant_mesh = bpy.data.meshes.new("AntennaMesh")
    ant_obj  = bpy.data.objects.new("Antenna", ant_mesh)
    link_obj(ant_obj, car_root)
    bm_ant = bmesh.new()

    res_mast = make_cylinder(
        bm_ant, radius=0.011, depth=0.58, segments=10,
        matrix=make_transform(Vector((0.0, 0.62, 0.98)))
    )
    set_mat_for_verts(res_mast["verts"], 0)

    bm_ant.to_mesh(ant_mesh)
    bm_ant.free()
    ant_obj.data.materials.append(mats["Carbon"])

    # ContactHead — glowing neon green halo ring
    ch_mesh = bpy.data.meshes.new("ContactHeadMesh")
    ch_obj  = bpy.data.objects.new("ContactHead", ch_mesh)
    ch_obj.location = Vector((0.0, 0.62, 1.29))
    link_obj(ch_obj, car_root)
    bm_ch = bmesh.new()

    res_ring = make_cylinder(
        bm_ch, radius=0.070, depth=0.016, segments=20,
        matrix=make_transform(Vector((0, 0, 0)), rot_euler=Euler((0, math.radians(90), 0)))
    )
    set_mat_for_verts(res_ring["verts"], 0)

    res_gd = make_cylinder(
        bm_ch, radius=0.042, depth=0.010, segments=16,
        matrix=make_transform(Vector((0, 0, 0)), rot_euler=Euler((0, math.radians(90), 0)))
    )
    set_mat_for_verts(res_gd["verts"], 1)

    bm_ch.to_mesh(ch_mesh)
    bm_ch.free()
    ch_obj.data.materials.append(mats["DarkMetal"])   # 0
    ch_obj.data.materials.append(mats["NeonAccent"])  # 1

    # ─────────────────────────────────────────────────────────────────────────
    # 9. WHEELS (4 corners)
    # ─────────────────────────────────────────────────────────────────────────
    wheel_positions = {
        "Wheel_FL": Vector((-TRACK, -WHEELBASE, WHEEL_R)),
        "Wheel_FR": Vector(( TRACK, -WHEELBASE, WHEEL_R)),
        "Wheel_RL": Vector((-TRACK,  WHEELBASE, WHEEL_R)),
        "Wheel_RR": Vector(( TRACK,  WHEELBASE, WHEEL_R)),
    }
    for name, pos in wheel_positions.items():
        build_wheel(name, car_root, mats, pos)

    # ─────────────────────────────────────────────────────────────────────────
    # 10. WHEEL WELLS LINER
    # ─────────────────────────────────────────────────────────────────────────
    build_wheel_wells(car_root, mats, TRACK, WHEELBASE)

    # ─────────────────────────────────────────────────────────────────────────
    # EXPORT GLB & BLEND
    # ─────────────────────────────────────────────────────────────────────────
    print(f"Saving .blend → {OUT_BLEND}")
    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)

    print(f"Exporting GLB  → {OUT_GLB}")
    bpy.ops.export_scene.gltf(
        filepath=OUT_GLB,
        export_format="GLB",
        export_apply=True,
        export_yup=True,
        use_selection=False,
        export_materials="EXPORT",
        export_animations=False,
    )

    print("=== Hood Bull V10 export complete ===")
    print(f"GLB size: {os.path.getsize(OUT_GLB) / 1024:.1f} KB")


if __name__ == "__main__":
    build_hood_bull()
