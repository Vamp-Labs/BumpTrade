#!/usr/bin/env python3
"""
Blender 5.1 — Hood Bull V8 (Bumper-Car Silhouette)

Shape target from:
- docs/Bump.Trade Hood Bull Texture PRD.png
- docs/car/69d916c8-53f2-47f2-bc6b-22fd294cdbc1.png

NOT a long sports car. Compact amusement bumper-car:
- Oval footprint ~ L 2.55 × W 1.85
- Thick wrap-around rubber bumper collar
- Rounded green body nestled inside bumper
- Short hood with $85 MoneyDisplay
- Open cockpit + bull driver
- Neon-ring antenna
"""

from __future__ import annotations

import math
import os

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

TEXTURES_DIR = "/home/cn/Projects/Personal/3d/public/models/textures/hood_bull"
OUT_GLB = "/home/cn/Projects/Personal/3d/public/models/hood_bull.glb"
OUT_BLEND = "/home/cn/Projects/Personal/3d/public/models/hood_bull.blend"

# Match src/vehicles/HoodBullModelBuilder.ts + CAR_CONFIG dims
# Blender: Z-up, +Y forward  |  Three.js builder: Y-up, +Z forward
LENGTH = 2.60
WIDTH = 1.90
WHEEL_R = 0.28
WHEEL_W = 0.22
AXLE_Z = WHEEL_R
WHEEL_Z = LENGTH * 0.32  # along forward (±Y in Blender)
WHEEL_X = WIDTH * 0.42
BUMPER_Y = 0.22  # height of bumper center (Three.js Y)


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


def smooth_object(obj) -> None:
    for poly in obj.data.polygons:
        poly.use_smooth = True


def add_subsurf(obj, levels: int = 2) -> None:
    mod = obj.modifiers.new(name="Subdivision", type="SUBSURF")
    mod.levels = levels
    mod.render_levels = levels


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
        key = "Transmission Weight" if "Transmission Weight" in bsdf.inputs else "Transmission"
        if key in bsdf.inputs:
            bsdf.inputs[key].default_value = transmission

    tex_coord = None
    if any([albedo_path, roughness_path, metallic_path, normal_path, emissive_path]):
        tex_coord = nodes.new(type="ShaderNodeTexCoord")

    def load_tex(path, colorspace, input_name):
        nonlocal tex_coord
        if not path or not os.path.exists(path):
            return
        img_node = nodes.new(type="ShaderNodeTexImage")
        img_node.image = bpy.data.images.load(path)
        img_node.image.colorspace_settings.name = colorspace
        links.new(tex_coord.outputs["UV"], img_node.inputs["Vector"])
        if input_name == "Normal":
            nmap = nodes.new(type="ShaderNodeNormalMap")
            links.new(img_node.outputs["Color"], nmap.inputs["Color"])
            links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])
        elif input_name.startswith("Emission"):
            emis_key = "Emission Color" if "Emission Color" in bsdf.inputs else "Emission"
            links.new(img_node.outputs["Color"], bsdf.inputs[emis_key])
            bsdf.inputs["Emission Strength"].default_value = emissive_strength
        else:
            links.new(img_node.outputs["Color"], bsdf.inputs[input_name])

    load_tex(albedo_path, "sRGB", "Base Color")
    load_tex(roughness_path, "Non-Color", "Roughness")
    load_tex(metallic_path, "Non-Color", "Metallic")
    load_tex(normal_path, "Non-Color", "Normal")
    load_tex(emissive_path, "sRGB", "Emission Color")

    if emissive_color and not (emissive_path and os.path.exists(emissive_path)):
        emis_key = "Emission Color" if "Emission Color" in bsdf.inputs else "Emission"
        bsdf.inputs[emis_key].default_value = (*emissive_color, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emissive_strength

    return mat


def setup_materials():
    mats = {}
    mats["BodyPaint"] = create_pbr_material(
        "BodyPaint",
        albedo_path=os.path.join(TEXTURES_DIR, "body_albedo.png"),
        roughness_path=os.path.join(TEXTURES_DIR, "body_roughness.png"),
        metallic_path=os.path.join(TEXTURES_DIR, "body_metallic.png"),
        normal_path=os.path.join(TEXTURES_DIR, "body_normal.png"),
        emissive_path=os.path.join(TEXTURES_DIR, "body_emissive.png"),
        base_color=(0.0, 0.72, 0.415),
        default_roughness=0.16,
        default_metallic=0.88,
        emissive_strength=5.5,
    )
    mats["SolidPaint"] = create_pbr_material(
        "SolidPaint",
        # Strong green (avoid cyan metal reflections): #00C853 family
        base_color=(0.0, 0.72, 0.18),
        default_roughness=0.28,
        default_metallic=0.55,
    )
    mats["Rubber"] = create_pbr_material(
        "Rubber",
        # Skip washed bumper albedo — PRD wants matte rubber black #1A1A1A
        base_color=(0.06, 0.06, 0.065),
        default_roughness=0.94,
        default_metallic=0.0,
    )
    mats["TireRubber"] = create_pbr_material(
        "TireRubber",
        base_color=(0.02, 0.02, 0.022),
        default_roughness=0.95,
        default_metallic=0.0,
    )
    mats["Wheel"] = create_pbr_material(
        "Wheel",
        albedo_path=os.path.join(TEXTURES_DIR, "wheel_albedo.png"),
        emissive_path=os.path.join(TEXTURES_DIR, "wheel_emissive.png"),
        base_color=(0.12, 0.13, 0.15),
        default_roughness=0.22,
        default_metallic=0.85,
        emissive_strength=5.0,
    )
    mats["Gold"] = create_pbr_material("Gold", base_color=(1.0, 0.78, 0.14), default_roughness=0.14, default_metallic=0.98)
    mats["NeonGreen"] = create_pbr_material(
        "NeonGreen",
        base_color=(0.0, 1.0, 0.415),
        emissive_color=(0.0, 1.0, 0.415),
        emissive_strength=8.0,
        default_roughness=0.12,
    )
    mats["Carbon"] = create_pbr_material("Carbon", base_color=(0.03, 0.03, 0.04), default_roughness=0.35, default_metallic=0.25)
    mats["DarkMetal"] = create_pbr_material("DarkMetal", base_color=(0.06, 0.07, 0.08), default_roughness=0.55, default_metallic=0.75)
    mats["Chrome"] = create_pbr_material("Chrome", base_color=(0.78, 0.82, 0.88), default_roughness=0.08, default_metallic=0.98)
    mats["Glass"] = create_pbr_material(
        "Glass",
        base_color=(0.04, 0.08, 0.10),
        default_roughness=0.08,
        default_metallic=0.15,
        transmission=0.35,
        alpha=0.55,
    )
    mats["Headlight"] = create_pbr_material(
        "Headlight",
        base_color=(1.0, 0.96, 0.85),
        emissive_color=(1.0, 0.95, 0.8),
        emissive_strength=6.0,
        default_roughness=0.1,
    )
    mats["AmberDRL"] = create_pbr_material(
        "AmberDRL",
        base_color=(1.0, 0.84, 0.0),
        emissive_color=(1.0, 0.84, 0.0),
        emissive_strength=5.0,
        default_roughness=0.1,
    )
    mats["Taillight"] = create_pbr_material(
        "Taillight",
        base_color=(1.0, 0.12, 0.14),
        emissive_color=(1.0, 0.12, 0.14),
        emissive_strength=5.5,
        default_roughness=0.1,
    )
    mats["BullSkin"] = create_pbr_material("BullSkin", base_color=(0.45, 0.28, 0.14), default_roughness=0.55, default_metallic=0.05)
    mats["Sunglasses"] = create_pbr_material("Sunglasses", base_color=(0.02, 0.02, 0.02), default_roughness=0.06, default_metallic=0.9)
    mats["RedHorn"] = create_pbr_material(
        "RedHorn",
        base_color=(0.95, 0.08, 0.12),
        emissive_color=(0.95, 0.08, 0.12),
        emissive_strength=3.5,
        default_roughness=0.25,
    )
    mats["BrakeDisc"] = create_pbr_material("BrakeDisc", base_color=(0.35, 0.36, 0.38), default_roughness=0.35, default_metallic=0.85)
    mats["Screen"] = create_pbr_material(
        "Screen",
        albedo_path=os.path.join(TEXTURES_DIR, "screen_albedo.png"),
        emissive_path=os.path.join(TEXTURES_DIR, "screen_emissive.png"),
        base_color=(0.02, 0.04, 0.03),
        emissive_strength=7.0,
        default_roughness=0.12,
    )
    return mats


def oval_point(t: float, rx: float, ry: float) -> Vector:
    """Unit oval point, t in [0,1), X=right, Y=forward."""
    a = t * math.tau
    # Squircle-ish oval (rounder than pure ellipse at corners)
    n = 2.4
    c = math.cos(a)
    s = math.sin(a)
    x = rx * math.copysign(abs(c) ** (2 / n), c)
    y = ry * math.copysign(abs(s) ** (2 / n), s)
    return Vector((x, y, 0.0))


def _add_oval_torus(bm, major_x: float, major_y: float, minor: float, z: float, major_seg: int, minor_seg: int, mat_idx: int) -> None:
    """Manual torus because bmesh.ops has no create_torus."""
    rings = []
    for i in range(major_seg):
        a = i / major_seg * math.tau
        cx = math.cos(a) * major_x
        cy = math.sin(a) * major_y
        # Local frame
        tangent = Vector((-math.sin(a) * major_x, math.cos(a) * major_y, 0)).normalized()
        normal = Vector((math.cos(a), math.sin(a), 0)).normalized()
        binormal = Vector((0, 0, 1))
        loop = []
        for j in range(minor_seg):
            b = j / minor_seg * math.tau
            offset = normal * (math.cos(b) * minor) + binormal * (math.sin(b) * minor)
            loop.append(bm.verts.new(Vector((cx, cy, z)) + offset))
        rings.append(loop)
    for i in range(major_seg):
        r1 = rings[i]
        r2 = rings[(i + 1) % major_seg]
        for j in range(minor_seg):
            jn = (j + 1) % minor_seg
            f = bm.faces.new([r1[j], r1[jn], r2[jn], r2[j]])
            f.material_index = mat_idx


def build_bumper_system(mats):
    """True tube bumper collar — PRD wrap-around rubber, not a solid puck."""
    mesh = bpy.data.meshes.new("BumperMesh")
    obj = bpy.data.objects.new("Bumper", mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()

    _add_oval_torus(bm, WIDTH * 0.52, LENGTH * 0.52, 0.11, BUMPER_Y, 48, 12, 0)
    _add_oval_torus(bm, WIDTH * 0.51, LENGTH * 0.51, 0.03, BUMPER_Y - 0.08, 48, 8, 1)

    for pos, scale in (
        (Vector((0.0, LENGTH * 0.42, 0.22)), (0.28, 0.18, 0.10)),
        (Vector((0.0, -LENGTH * 0.42, 0.22)), (0.28, 0.18, 0.10)),
        (Vector((-WIDTH * 0.40, 0.0, 0.22)), (0.16, 0.22, 0.08)),
        (Vector((WIDTH * 0.40, 0.0, 0.22)), (0.16, 0.22, 0.08)),
    ):
        res = bmesh.ops.create_cube(bm, size=1.0, matrix=make_transform(pos, scale))
        set_mat_for_verts(res["verts"], 2)

    bm.to_mesh(mesh)
    bm.free()
    obj.data.materials.append(mats["Rubber"])
    obj.data.materials.append(mats["NeonGreen"])
    obj.data.materials.append(mats["DarkMetal"])
    smooth_object(obj)
    return obj


def _add_bevel(obj, width: float = 0.035, segments: int = 3) -> None:
    bevel = obj.modifiers.new(name="Bevel", type="BEVEL")
    bevel.width = width
    bevel.segments = segments
    bevel.limit_method = "ANGLE"
    bevel.angle_limit = math.radians(30)


def build_body_shell(mats):
    """
    Port of HoodBullModelBuilder.ts body volumes into Blender space.
    Three.js (x,y,z) with +Z forward → Blender (x, z_fwd→y, y_up→z).
    """
    mesh = bpy.data.meshes.new("BodyMesh")
    obj = bpy.data.objects.new("Body", mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()

    def box(pos, scale, rot=None, mat_idx=0):
        res = bmesh.ops.create_cube(bm, size=1.0, matrix=make_transform(pos, scale, rot))
        set_mat_for_verts(res["verts"], mat_idx)

    # Continuous lower hull (one long volume — less "two bricks")
    box(Vector((0.0, 0.0, 0.34)), (WIDTH * 0.72, LENGTH * 0.78, 0.26))
    # Upper belt connecting hood ↔ rear (fills mid gap)
    box(Vector((0.0, 0.0, 0.52)), (WIDTH * 0.66, LENGTH * 0.62, 0.16))
    # Hood volume (raked)
    box(
        Vector((0.0, LENGTH * 0.20, 0.56)),
        (WIDTH * 0.62, LENGTH * 0.36, 0.20),
        Euler((math.radians(8), 0, 0)),
    )
    # Front fascia step (keeps nose readable without stuck-on ball)
    box(Vector((0.0, LENGTH * 0.36, 0.44)), (WIDTH * 0.58, 0.22, 0.18))
    # Rear deck
    box(Vector((0.0, -LENGTH * 0.22, 0.54)), (WIDTH * 0.62, LENGTH * 0.32, 0.22))
    # Side skirts
    for sign in (-1, 1):
        box(Vector((sign * WIDTH * 0.42, 0.0, 0.22)), (0.10, LENGTH * 0.55, 0.06), mat_idx=1)
    # Fender crowns
    for sign_x, sign_y, is_front in (
        (-1, 1, True),
        (1, 1, True),
        (-1, -1, False),
        (1, -1, False),
    ):
        crown_w = 0.16 * (1.0 if is_front else 1.25)
        box(
            Vector((sign_x * WHEEL_X, sign_y * WHEEL_Z, WHEEL_R + 0.24)),
            (crown_w, WHEEL_R * 1.55, 0.16),
            Euler((0, 0, math.radians(sign_x * -10))),
        )
    # Speedster fairings
    for sign in (-1, 1):
        res = bmesh.ops.create_uvsphere(
            bm,
            u_segments=14,
            v_segments=10,
            radius=0.17,
            matrix=make_transform(Vector((sign * 0.22, -LENGTH * 0.18, 0.66)), (1.05, 2.0, 0.85)),
        )
        set_mat_for_verts(res["verts"], 0)

    bm.to_mesh(mesh)
    bm.free()
    obj.data.materials.append(mats["SolidPaint"])
    obj.data.materials.append(mats["Carbon"])
    _add_bevel(obj, width=0.055, segments=4)
    smooth_object(obj)
    return obj


def build_hood_decal(mats):
    """Hood livery card on top of hood volume (stripes + bull from PBR atlas)."""
    mesh = bpy.data.meshes.new("HoodDecalMesh")
    obj = bpy.data.objects.new("HoodDecal", mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    hw = WIDTH * 0.28
    y0, y1 = LENGTH * 0.05, LENGTH * 0.34
    z0, z1 = 0.60, 0.62
    v1 = bm.verts.new(Vector((-hw, y0, z0)))
    v2 = bm.verts.new(Vector((hw, y0, z0)))
    v3 = bm.verts.new(Vector((hw, y1, z1)))
    v4 = bm.verts.new(Vector((-hw, y1, z1)))
    face = bm.faces.new([v1, v2, v3, v4])
    face.material_index = 0
    uv = bm.loops.layers.uv.new("UVMap")
    coords = [Vector((0.32, 0.20)), Vector((0.68, 0.20)), Vector((0.68, 0.85)), Vector((0.32, 0.85))]
    for loop, c in zip(face.loops, coords):
        loop[uv].uv = c
    bm.to_mesh(mesh)
    bm.free()
    obj.data.materials.append(mats["BodyPaint"])
    return obj


def build_front_fascia_and_lights(mats):
    items = []

    # Headlights on nose corners (Three.js +Z front → Blender +Y)
    for sign, side in [(-1, "L"), (1, "R")]:
        hl_mesh = bpy.data.meshes.new(f"Headlight_{side}_Mesh")
        hl_obj = bpy.data.objects.new(f"Headlight_{side}", hl_mesh)
        hl_obj.location = Vector((sign * WIDTH * 0.28, LENGTH * 0.42, 0.48))
        bpy.context.collection.objects.link(hl_obj)
        bm = bmesh.new()
        housing = bmesh.ops.create_cube(bm, size=1.0, matrix=make_transform(Vector((0, 0, 0)), (0.14, 0.06, 0.08)))
        set_mat_for_verts(housing["verts"], 0)
        bulb = bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=0.04, matrix=make_transform(Vector((0, 0.03, 0))))
        set_mat_for_verts(bulb["verts"], 1)
        drl = bmesh.ops.create_cube(bm, size=1.0, matrix=make_transform(Vector((0, 0.02, 0.05)), (0.12, 0.02, 0.015)))
        set_mat_for_verts(drl["verts"], 3)
        bm.to_mesh(hl_mesh)
        bm.free()
        hl_obj.data.materials.append(mats["DarkMetal"])
        hl_obj.data.materials.append(mats["Headlight"])
        hl_obj.data.materials.append(mats["Glass"])
        hl_obj.data.materials.append(mats["AmberDRL"])
        smooth_object(hl_obj)
        items.append(hl_obj)

    # Hood money display ($85) — hero PRD feature on forward hood
    f_mesh = bpy.data.meshes.new("FrontMoneyDisplayMesh")
    f_obj = bpy.data.objects.new("FrontMoneyDisplay", f_mesh)
    bpy.context.collection.objects.link(f_obj)
    bm = bmesh.new()
    bezel = bmesh.ops.create_cube(
        bm,
        size=1.0,
        matrix=make_transform(Vector((0.0, LENGTH * 0.30, 0.62)), (0.42, 0.05, 0.14), Euler((math.radians(8), 0, 0))),
    )
    set_mat_for_verts(bezel["verts"], 0)
    v1 = bm.verts.new(Vector((-0.17, LENGTH * 0.325, 0.56)))
    v2 = bm.verts.new(Vector((0.17, LENGTH * 0.325, 0.56)))
    v3 = bm.verts.new(Vector((0.17, LENGTH * 0.305, 0.68)))
    v4 = bm.verts.new(Vector((-0.17, LENGTH * 0.305, 0.68)))
    face = bm.faces.new([v1, v2, v3, v4])
    face.material_index = 1
    uv_layer = bm.loops.layers.uv.new("UVMap")
    for loop, uv in zip(face.loops, [Vector((0, 0)), Vector((1, 0)), Vector((1, 1)), Vector((0, 1))]):
        loop[uv_layer].uv = uv
    frame = bmesh.ops.create_cube(
        bm,
        size=1.0,
        matrix=make_transform(Vector((0.0, LENGTH * 0.318, 0.62)), (0.40, 0.02, 0.12), Euler((math.radians(8), 0, 0))),
    )
    set_mat_for_verts(frame["verts"], 2)
    bm.to_mesh(f_mesh)
    bm.free()
    f_obj.data.materials.append(mats["DarkMetal"])
    f_obj.data.materials.append(mats["Screen"])
    f_obj.data.materials.append(mats["NeonGreen"])
    items.append(f_obj)

    for sign, side in [(-1, "L"), (1, "R")]:
        tl_mesh = bpy.data.meshes.new(f"TailLight_{side}_Mesh")
        tl_obj = bpy.data.objects.new(f"TailLight_{side}", tl_mesh)
        tl_obj.location = Vector((sign * WIDTH * 0.28, -LENGTH * 0.40, 0.52))
        bpy.context.collection.objects.link(tl_obj)
        bm = bmesh.new()
        bar = bmesh.ops.create_cube(bm, size=1.0, matrix=make_transform(Vector((0, 0, 0)), (0.16, 0.04, 0.06)))
        set_mat_for_verts(bar["verts"], 0)
        bm.to_mesh(tl_mesh)
        bm.free()
        tl_obj.data.materials.append(mats["Taillight"])
        items.append(tl_obj)

    return items


def build_cockpit(mats):
    cockpit_mesh = bpy.data.meshes.new("CockpitMesh")
    cockpit_obj = bpy.data.objects.new("Cockpit", cockpit_mesh)
    bpy.context.collection.objects.link(cockpit_obj)
    bm = bmesh.new()

    # Cockpit floor / seat (TS positions: z_fwd→-Y slightly for seat)
    tub = bmesh.ops.create_cube(bm, size=1.0, matrix=make_transform(Vector((0.0, -0.06, 0.38)), (WIDTH * 0.48, 0.82, 0.12)))
    set_mat_for_verts(tub["verts"], 0)
    cushion = bmesh.ops.create_cube(bm, size=1.0, matrix=make_transform(Vector((0.0, -0.12, 0.44)), (0.56, 0.44, 0.14)))
    set_mat_for_verts(cushion["verts"], 0)
    back = bmesh.ops.create_cube(
        bm, size=1.0, matrix=make_transform(Vector((0.0, -0.32, 0.68)), (0.52, 0.12, 0.48), Euler((math.radians(-12), 0, 0)))
    )
    set_mat_for_verts(back["verts"], 0)
    headrest = bmesh.ops.create_cube(bm, size=1.0, matrix=make_transform(Vector((0.0, -0.39, 0.94)), (0.30, 0.10, 0.18)))
    set_mat_for_verts(headrest["verts"], 0)
    for sign in (-1, 1):
        hoop = bmesh.ops.create_cone(
            bm,
            cap_ends=True,
            segments=12,
            radius1=0.022,
            radius2=0.022,
            depth=0.28,
            matrix=make_transform(Vector((sign * 0.16, -0.44, 0.96))),
        )
        set_mat_for_verts(hoop["verts"], 1)
    dash = bmesh.ops.create_cube(bm, size=1.0, matrix=make_transform(Vector((0.0, 0.16, 0.58)), (WIDTH * 0.46, 0.22, 0.16)))
    set_mat_for_verts(dash["verts"], 0)
    yoke = bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        segments=16,
        radius1=0.11,
        radius2=0.11,
        depth=0.02,
        matrix=make_transform(Vector((0.0, 0.0, 0.62)), rot_euler=Euler((math.radians(45), 0, 0))),
    )
    set_mat_for_verts(yoke["verts"], 1)

    bm.to_mesh(cockpit_mesh)
    bm.free()
    cockpit_obj.data.materials.append(mats["DarkMetal"])
    cockpit_obj.data.materials.append(mats["Chrome"])
    cockpit_obj.data.materials.append(mats["NeonGreen"])

    ws_mesh = bpy.data.meshes.new("WindscreenMesh")
    ws_obj = bpy.data.objects.new("Windscreen", ws_mesh)
    bpy.context.collection.objects.link(ws_obj)
    bm = bmesh.new()
    # Raked glass brow
    ws = bmesh.ops.create_cube(
        bm, size=1.0, matrix=make_transform(Vector((0.0, 0.16, 0.72)), (WIDTH * 0.55, 0.04, 0.22), Euler((math.radians(28), 0, 0)))
    )
    set_mat_for_verts(ws["verts"], 0)
    bm.to_mesh(ws_mesh)
    bm.free()
    ws_obj.data.materials.append(mats["Glass"])
    smooth_object(ws_obj)
    return cockpit_obj, ws_obj


def build_mascot_driver(mats):
    driver_mesh = bpy.data.meshes.new("BullDriverMesh")
    driver_obj = bpy.data.objects.new("Driver", driver_mesh)
    bpy.context.collection.objects.link(driver_obj)
    bm = bmesh.new()

    torso = bmesh.ops.create_cube(bm, size=1.0, matrix=make_transform(Vector((0.0, -0.10, 0.58)), (0.34, 0.22, 0.28)))
    set_mat_for_verts(torso["verts"], 0)
    head = bmesh.ops.create_uvsphere(bm, u_segments=14, v_segments=10, radius=0.15, matrix=make_transform(Vector((0.0, -0.10, 0.86))))
    set_mat_for_verts(head["verts"], 1)
    snout = bmesh.ops.create_cube(bm, size=1.0, matrix=make_transform(Vector((0.0, 0.02, 0.80)), (0.16, 0.12, 0.09)))
    set_mat_for_verts(snout["verts"], 1)
    for sign in (-1, 1):
        ear = bmesh.ops.create_cube(
            bm, size=1.0, matrix=make_transform(Vector((sign * 0.16, -0.08, 0.88)), (0.07, 0.03, 0.05), Euler((0, math.radians(sign * -20), 0)))
        )
        set_mat_for_verts(ear["verts"], 1)
        horn = bmesh.ops.create_cone(
            bm,
            cap_ends=True,
            segments=10,
            radius1=0.035,
            radius2=0.008,
            depth=0.18,
            matrix=make_transform(
                Vector((sign * 0.14, -0.08, 0.98)),
                rot_euler=Euler((math.radians(-25), math.radians(sign * 40), math.radians(sign * -25))),
            ),
        )
        set_mat_for_verts(horn["verts"], 2)
        tip = bmesh.ops.create_cone(
            bm,
            cap_ends=True,
            segments=8,
            radius1=0.012,
            radius2=0.004,
            depth=0.07,
            matrix=make_transform(
                Vector((sign * 0.24, 0.0, 1.08)),
                rot_euler=Euler((math.radians(-30), math.radians(sign * 50), 0)),
            ),
        )
        set_mat_for_verts(tip["verts"], 4)
    shades = bmesh.ops.create_cube(bm, size=1.0, matrix=make_transform(Vector((0.0, 0.02, 0.89)), (0.22, 0.03, 0.06)))
    set_mat_for_verts(shades["verts"], 3)
    ring = bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        segments=12,
        radius1=0.035,
        radius2=0.028,
        depth=0.015,
        matrix=make_transform(Vector((0.0, 0.08, 0.76)), rot_euler=Euler((math.radians(90), 0, 0))),
    )
    set_mat_for_verts(ring["verts"], 2)

    bm.to_mesh(driver_mesh)
    bm.free()
    driver_obj.data.materials.append(mats["DarkMetal"])
    driver_obj.data.materials.append(mats["BullSkin"])
    driver_obj.data.materials.append(mats["Gold"])
    driver_obj.data.materials.append(mats["Sunglasses"])
    driver_obj.data.materials.append(mats["RedHorn"])
    smooth_object(driver_obj)
    return driver_obj


def build_rear_transom_and_exhausts(mats):
    # Secondary rear money readout (gameplay MoneyDisplay node)
    md_mesh = bpy.data.meshes.new("MoneyDisplayMesh")
    md_obj = bpy.data.objects.new("MoneyDisplay", md_mesh)
    bpy.context.collection.objects.link(md_obj)
    bm = bmesh.new()
    frame = bmesh.ops.create_cube(bm, size=1.0, matrix=make_transform(Vector((0.0, -LENGTH * 0.40, 0.48)), (0.50, 0.04, 0.16)))
    set_mat_for_verts(frame["verts"], 0)
    y = -LENGTH * 0.42
    v1 = bm.verts.new(Vector((-0.22, y, 0.42)))
    v2 = bm.verts.new(Vector((0.22, y, 0.42)))
    v3 = bm.verts.new(Vector((0.22, y, 0.54)))
    v4 = bm.verts.new(Vector((-0.22, y, 0.54)))
    face = bm.faces.new([v1, v2, v3, v4])
    face.material_index = 1
    uv_layer = bm.loops.layers.uv.new("UVMap")
    for loop, uv in zip(face.loops, [Vector((0, 0)), Vector((1, 0)), Vector((1, 1)), Vector((0, 1))]):
        loop[uv_layer].uv = uv
    bm.to_mesh(md_mesh)
    bm.free()
    md_obj.data.materials.append(mats["DarkMetal"])
    md_obj.data.materials.append(mats["Screen"])

    diff_mesh = bpy.data.meshes.new("DiffuserMesh")
    diff_obj = bpy.data.objects.new("RearDiffuser", diff_mesh)
    bpy.context.collection.objects.link(diff_obj)
    bm = bmesh.new()
    diff = bmesh.ops.create_cube(bm, size=1.0, matrix=make_transform(Vector((0.0, -LENGTH * 0.42, 0.14)), (WIDTH * 0.74, 0.42, 0.08)))
    set_mat_for_verts(diff["verts"], 0)
    for sign in (-1, 1):
        ex = bmesh.ops.create_cone(
            bm,
            cap_ends=True,
            segments=14,
            radius1=0.04,
            radius2=0.035,
            depth=0.08,
            matrix=make_transform(Vector((sign * 0.18, -LENGTH * 0.45, 0.16)), rot_euler=Euler((math.radians(90), 0, 0))),
        )
        set_mat_for_verts(ex["verts"], 1)
    bm.to_mesh(diff_mesh)
    bm.free()
    diff_obj.data.materials.append(mats["Carbon"])
    diff_obj.data.materials.append(mats["Chrome"])
    return md_obj, diff_obj


def build_antenna(mats):
    ant_mesh = bpy.data.meshes.new("AntennaMesh")
    ant_obj = bpy.data.objects.new("Antenna", ant_mesh)
    bpy.context.collection.objects.link(ant_obj)
    bm = bmesh.new()
    base = bmesh.ops.create_cone(
        bm, cap_ends=True, segments=12, radius1=0.045, radius2=0.038, depth=0.10, matrix=make_transform(Vector((0.0, -LENGTH * 0.18, 0.74)))
    )
    set_mat_for_verts(base["verts"], 0)
    mast = bmesh.ops.create_cone(
        bm, cap_ends=True, segments=12, radius1=0.012, radius2=0.008, depth=1.05, matrix=make_transform(Vector((0.0, -LENGTH * 0.18, 1.30)))
    )
    set_mat_for_verts(mast["verts"], 0)
    bm.to_mesh(ant_mesh)
    bm.free()
    ant_obj.data.materials.append(mats["Chrome"])

    ch_mesh = bpy.data.meshes.new("ContactHeadMesh")
    ch_obj = bpy.data.objects.new("ContactHead", ch_mesh)
    ch_obj.location = Vector((0.0, -LENGTH * 0.18, 1.88))
    ch_obj.parent = ant_obj
    bpy.context.collection.objects.link(ch_obj)
    bm = bmesh.new()
    core = bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=0.045)
    set_mat_for_verts(core["verts"], 0)
    ring = bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        segments=20,
        radius1=0.12,
        radius2=0.10,
        depth=0.025,
        matrix=make_transform(Vector((0, 0, 0)), rot_euler=Euler((math.radians(90), 0, 0))),
    )
    set_mat_for_verts(ring["verts"], 0)
    bm.to_mesh(ch_mesh)
    bm.free()
    ch_obj.data.materials.append(mats["NeonGreen"])
    smooth_object(ch_obj)
    return ant_obj, ch_obj


def build_wheel(name: str, center_pos: Vector, mats):
    """Chunky bumper-car wheel: black tire + dark rim + neon lip. Axis = local X."""
    wheel_obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(wheel_obj)
    wheel_obj.location = center_pos

    rot_x = Euler((0, math.radians(90), 0))

    tire_mesh = bpy.data.meshes.new(f"{name}_TireMesh")
    tire_obj = bpy.data.objects.new(f"{name}_Tire", tire_mesh)
    bpy.context.collection.objects.link(tire_obj)
    tire_obj.parent = wheel_obj
    bm = bmesh.new()
    # Outer tire barrel
    bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        segments=28,
        radius1=WHEEL_R,
        radius2=WHEEL_R,
        depth=WHEEL_W,
        matrix=make_transform(Vector((0, 0, 0)), rot_euler=rot_x),
    )
    # Sidewall lips (thicker look)
    for side in (-1, 1):
        bmesh.ops.create_cone(
            bm,
            cap_ends=True,
            segments=24,
            radius1=WHEEL_R * 0.98,
            radius2=WHEEL_R * 0.82,
            depth=0.04,
            matrix=make_transform(Vector((side * WHEEL_W * 0.42, 0, 0)), rot_euler=rot_x),
        )
    bm.to_mesh(tire_mesh)
    bm.free()
    tire_obj.data.materials.append(mats["TireRubber"])
    smooth_object(tire_obj)

    rim_mesh = bpy.data.meshes.new(f"{name}_RimMesh")
    rim_obj = bpy.data.objects.new(f"{name}_Rim", rim_mesh)
    bpy.context.collection.objects.link(rim_obj)
    rim_obj.parent = wheel_obj
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        segments=20,
        radius1=WHEEL_R * 0.62,
        radius2=WHEEL_R * 0.40,
        depth=WHEEL_W * 0.45,
        matrix=make_transform(Vector((0, 0, 0)), rot_euler=rot_x),
    )
    # 5 spokes
    for i in range(5):
        ang = i / 5 * math.tau
        spoke = bmesh.ops.create_cube(
            bm,
            size=1.0,
            matrix=make_transform(
                Vector((0.02, math.cos(ang) * WHEEL_R * 0.28, math.sin(ang) * WHEEL_R * 0.28)),
                (0.04, 0.06, WHEEL_R * 0.45),
                Euler((ang, 0, 0)),
            ),
        )
        set_mat_for_verts(spoke["verts"], 0)
    bm.to_mesh(rim_mesh)
    bm.free()
    rim_obj.data.materials.append(mats["Chrome"])
    smooth_object(rim_obj)

    neon_mesh = bpy.data.meshes.new(f"{name}_NeonMesh")
    neon_obj = bpy.data.objects.new(f"{name}_Neon", neon_mesh)
    bpy.context.collection.objects.link(neon_obj)
    neon_obj.parent = wheel_obj
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        segments=24,
        radius1=WHEEL_R * 0.70,
        radius2=WHEEL_R * 0.66,
        depth=0.025,
        matrix=make_transform(Vector((WHEEL_W * 0.28, 0, 0)), rot_euler=rot_x),
    )
    bm.to_mesh(neon_mesh)
    bm.free()
    neon_obj.data.materials.append(mats["NeonGreen"])

    disc_mesh = bpy.data.meshes.new(f"{name}_BrakeDiscMesh")
    disc_obj = bpy.data.objects.new(f"{name}_BrakeDisc", disc_mesh)
    bpy.context.collection.objects.link(disc_obj)
    disc_obj.parent = wheel_obj
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        segments=16,
        radius1=WHEEL_R * 0.38,
        radius2=WHEEL_R * 0.38,
        depth=0.025,
        matrix=make_transform(Vector((-WHEEL_W * 0.12, 0, 0)), rot_euler=rot_x),
    )
    bm.to_mesh(disc_mesh)
    bm.free()
    disc_obj.data.materials.append(mats["BrakeDisc"])
    return wheel_obj


def main() -> None:
    print("=== HOOD BULL V8.1 — BUMPER-CAR SILHOUETTE ===")
    clean_scene()
    mats = setup_materials()

    car_root = bpy.data.objects.new("CarRoot", None)
    bpy.context.collection.objects.link(car_root)
    chassis = bpy.data.objects.new("Chassis", None)
    bpy.context.collection.objects.link(chassis)
    chassis.parent = car_root

    body = build_body_shell(mats)
    body.parent = chassis

    hood_decal = build_hood_decal(mats)
    hood_decal.parent = chassis

    bumper = build_bumper_system(mats)
    bumper.parent = chassis

    for item in build_front_fascia_and_lights(mats):
        item.parent = chassis

    cockpit, windscreen = build_cockpit(mats)
    cockpit.parent = chassis
    windscreen.parent = chassis

    driver = build_mascot_driver(mats)
    driver.parent = chassis

    money, diffuser = build_rear_transom_and_exhausts(mats)
    money.parent = chassis
    diffuser.parent = chassis

    antenna, _contact = build_antenna(mats)
    antenna.parent = chassis

    for vfx in ("VFX_Impact", "VFX_Boost", "VFX_Antenna", "VFX_Coin", "VFX_Skid"):
        empty = bpy.data.objects.new(vfx, None)
        bpy.context.collection.objects.link(empty)
        empty.parent = chassis

    for name, pos in (
        ("Wheel_FL", Vector((-WHEEL_X, WHEEL_Z, AXLE_Z))),
        ("Wheel_FR", Vector((WHEEL_X, WHEEL_Z, AXLE_Z))),
        ("Wheel_RL", Vector((-WHEEL_X, -WHEEL_Z, AXLE_Z))),
        ("Wheel_RR", Vector((WHEEL_X, -WHEEL_Z, AXLE_Z))),
    ):
        w = build_wheel(name, pos, mats)
        w.parent = chassis

    print(f"Saving {OUT_BLEND}")
    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
    print(f"Exporting {OUT_GLB}")
    bpy.ops.export_scene.gltf(
        filepath=OUT_GLB,
        export_format="GLB",
        use_selection=False,
        export_yup=True,
        export_apply=True,
    )
    print("=== HOOD BULL V8 EXPORT OK ===")


if __name__ == "__main__":
    main()
