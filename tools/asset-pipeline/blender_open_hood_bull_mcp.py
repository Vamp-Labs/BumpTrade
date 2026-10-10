import bpy
from pathlib import Path

BLEND = "/home/cn/Projects/Personal/3d/public/models/hood_bull.blend"

def boot_mcp():
    try:
        bpy.ops.preferences.addon_enable(module="blender_mcp")
    except Exception as e:
        print("ADDON_ENABLE_ERR", e)
    scene = bpy.context.scene
    scene.blendermcp_port = 9876
    scene.blendermcp_auto_start_server = True
    print("MCP_BOOT_SCENE_READY", scene.blendermcp_server_running)
    return None

bpy.ops.wm.open_mainfile(filepath=BLEND)
bpy.app.timers.register(boot_mcp, first_interval=1.0)
print("OPENED", BLEND)
