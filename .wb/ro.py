"""Baca file server lewat CodeMirror: python ro.py <file-rel> <out>"""
import json, sys, time, urllib.request

rel, OUT = sys.argv[1], sys.argv[2]
TAB = 2049527597

def cmd(action, args):
    body = json.dumps({"action": action, "session": "da-setup", "args": args}).encode()
    req = urllib.request.Request("http://127.0.0.1:10086/command", data=body,
                                 headers={"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req, timeout=300).read().decode("utf-8", "replace"))

def ev(code):
    r = cmd("evaluate", {"tabId": TAB, "code": code})
    return r["data"]["value"]

cmd("navigate", {"url": "https://82.25.62.13:2222/evo/filemanager/edit?path=" + rel})
view = None
for _ in range(25):
    time.sleep(1)
    try:
        view = ev("(() => { const el=document.querySelector('.cm-content');"
                  " const v=el&&el.cmView&&el.cmView.rootView&&el.cmView.rootView.view;"
                  " if(v) window.__cmView=v; return v ? 1 : 0; })()")
        if view == 1: break
    except Exception: pass
if view != 1:
    print("EDITOR TIDAK SIAP"); sys.exit(1)

total = ev("window.__cmView.state.doc.toString().length")
parts, off, step = [], 0, 4000
while off < total:
    parts.append(ev("window.__cmView.state.doc.toString().slice(%d,%d)" % (off, min(off+step, total))))
    off += step
doc = "".join(parts)
open(OUT, "w", encoding="utf-8", newline="").write(doc)
print("terbaca:", len(doc), "/", total)
