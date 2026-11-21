import json, sys, urllib.request, base64

action = "screenshot"
args = {"tabId": 2049527225}
body = json.dumps({"action": action, "session": "da-setup", "args": args}).encode()
req = urllib.request.Request("http://127.0.0.1:10086/command", data=body,
                             headers={"Content-Type": "application/json"})
raw = urllib.request.urlopen(req, timeout=120).read().decode("utf-8", "replace")
d = json.loads(raw)
if d.get("ok") and d["data"].get("data"):
    open(sys.argv[1], "wb").write(base64.b64decode(d["data"]["data"]))
    print("saved", sys.argv[1], d["data"].get("mimeType", ""))
else:
    print(raw[:500])
