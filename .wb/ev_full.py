"""WebBridge evaluate -> simpan seluruh respons ke file. usage: python ev_full.py <js-file> <out-file>"""
import json, sys, urllib.request

code = open(sys.argv[1], encoding="utf-8").read()
body = json.dumps({"action": "evaluate", "session": "da-setup",
                   "args": {"tabId": 2049527225, "code": code}}).encode()
req = urllib.request.Request("http://127.0.0.1:10086/command", data=body,
                             headers={"Content-Type": "application/json"})
resp = urllib.request.urlopen(req, timeout=300).read().decode("utf-8", "replace")
open(sys.argv[2], "w", encoding="utf-8").write(resp)
print("saved", len(resp), "chars ->", sys.argv[2])
