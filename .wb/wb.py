"""WebBridge client: python wb.py <action> '<json args>' [outfile]"""
import json, sys, urllib.request
action = sys.argv[1]
args = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
body = json.dumps({"action": action, "session": "da-setup", "args": args}).encode()
req = urllib.request.Request("http://127.0.0.1:10086/command", data=body, headers={"Content-Type": "application/json"})
raw = urllib.request.urlopen(req, timeout=300).read().decode("utf-8", "replace")
if len(sys.argv) > 3:
    open(sys.argv[3], "w", encoding="utf-8").write(raw); print("wrote", len(raw))
else:
    print(raw[:5000])
