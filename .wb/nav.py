import json, sys, urllib.request

url = sys.argv[1]
body = json.dumps({"action": "navigate", "session": "da-setup",
                   "args": {"tabId": 2049527225, "url": url}}).encode()
req = urllib.request.Request("http://127.0.0.1:10086/command", data=body,
                             headers={"Content-Type": "application/json"})
print(urllib.request.urlopen(req, timeout=300).read().decode("utf-8", "replace")[:500])
