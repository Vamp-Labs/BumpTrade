import bpy


def _start():
    try:
        bpy.ops.preferences.addon_enable(module="blender_mcp")
    except Exception as exc:
        print("ADDON_ENABLE_ERR", exc)

    scene = bpy.context.scene
    scene.blendermcp_port = 9876
    scene.blendermcp_auto_start_server = True

    started = False
    for op_id in ("blendermcp.start_server", "blender_mcp.start_server"):
        try:
            op = bpy.ops
            for part in op_id.split("."):
                op = getattr(op, part)
            result = op()
            print("STARTED_VIA", op_id, result)
            started = True
            break
        except Exception as exc:
            print("OP_FAIL", op_id, exc)

    if not started:
        try:
            import blender_mcp as m

            server = m.BlenderMCPServer(port=9876)
            bpy.types.blendermcp_server = server
            server.start()
            scene.blendermcp_server_running = True
            print("STARTED_DIRECT", getattr(server, "running", None))
        except Exception as exc:
            print("DIRECT_FAIL", exc)

    print("MCP_BOOT_DONE")
    return None


bpy.app.timers.register(_start, first_interval=1.0)
print("MCP_TIMER_REGISTERED")
