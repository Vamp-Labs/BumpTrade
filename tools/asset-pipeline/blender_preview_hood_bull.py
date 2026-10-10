#!/usr/bin/env python3
"""Open the remade Hood Bull, frame it, and write a preview PNG."""

import math
from pathlib import Path

import bpy
from mathutils import Euler, Vector

ROOT = Path("/home/cn/Projects/Personal/3d")
BLEND = ROOT / "public/models/hood_bull.blend"
OUT = ROOT / "docs/car/hood_bull_preview.png"


def main() -> None:
    bpy.ops.wm.open_mainfile(filepath=str(BLEND))

    # Clear default lights/cameras that may exist after open, keep car
    for obj in list(bpy.data.objects):
        if obj.type in {"LIGHT", "CAMERA"}:
            bpy.data.objects.remove(obj, do_unlink=True)

    # Studio lighting
    key = bpy.data.objects.new("KeyLight", bpy.data.lights.new("KeyLightData", "AREA"))
    key.data.energy = 1200
    key.data.size = 3.0
    key.location = (3.5, -3.0, 3.2)
    key.rotation_euler = Euler((math.radians(55), 0, math.radians(40)))
    bpy.context.collection.objects.link(key)

    fill = bpy.data.objects.new("FillLight", bpy.data.lights.new("FillLightData", "AREA"))
    fill.data.energy = 400
    fill.data.size = 4.0
    fill.location = (-3.0, -1.5, 2.2)
    fill.rotation_euler = Euler((math.radians(65), 0, math.radians(-50)))
    bpy.context.collection.objects.link(fill)

    rim = bpy.data.objects.new("RimLight", bpy.data.lights.new("RimLightData", "AREA"))
    rim.data.energy = 700
    rim.data.size = 2.5
    rim.data.color = (0.55, 1.0, 0.75)
    rim.location = (0.5, 3.5, 2.4)
    rim.rotation_euler = Euler((math.radians(70), 0, math.radians(180)))
    bpy.context.collection.objects.link(rim)

    cam_data = bpy.data.cameras.new("PreviewCam")
    cam_data.lens = 50
    cam = bpy.data.objects.new("PreviewCam", cam_data)
    # 3/4 FRONT: stand on +Y (nose) looking back at car
    cam.location = (2.4, 3.4, 1.55)
    bpy.context.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    target = Vector((0.0, 0.15, 0.45))
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()

    world = bpy.data.worlds.new("PreviewWorld")
    bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.03, 0.035, 0.04, 1.0)
    bg.inputs[1].default_value = 0.6

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 1000
    scene.render.filepath = str(OUT)
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.view_transform = "Standard"

    bpy.ops.render.render(write_still=True)
    print("PREVIEW_WRITTEN", OUT)


if __name__ == "__main__":
    main()
