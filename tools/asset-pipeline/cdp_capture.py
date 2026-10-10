import asyncio
import websockets
import json
import base64
import sys
import os
import urllib.request

async def capture(output_path):
    # Query DevTools targets
    req = urllib.request.urlopen("http://127.0.0.1:9222/json")
    targets = json.loads(req.read().decode())
    ws_url = None
    for t in targets:
        if "5173" in t.get("url", ""):
            ws_url = t.get("webSocketDebuggerUrl")
            break
    
    if not ws_url and targets:
        for t in targets:
            if t.get("type") == "page":
                ws_url = t.get("webSocketDebuggerUrl")
                break
                
    if not ws_url:
        raise RuntimeError("No suitable DevTools page target found")

    async with websockets.connect(ws_url, max_size=50_000_000) as ws:
        await ws.send(json.dumps({
            'id': 1,
            'method': 'Page.captureScreenshot',
            'params': {
                'format': 'jpeg',
                'quality': 95
            }
        }))
        resp = json.loads(await ws.recv())
        data = resp['result']['data']
        img_bytes = base64.b64decode(data)
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        with open(output_path, 'wb') as f:
            f.write(img_bytes)
        print(f"Captured {output_path} ({len(img_bytes)} bytes)")

if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else '/tmp/snap.jpg'
    asyncio.run(capture(target))
