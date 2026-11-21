"""Baca dokumen CodeMirror bertahap: python chunk_read.py <outfile>"""
import json, sys, urllib.request

OUT = sys.argv[1]
TAB = 2049527597
code_tpl = ("(() => { const v = window.__cmView; const t = v.state.doc.toString();"
            " return {len: t.length, s: t.slice(%d, %d)}; })()")

def ev(code):
    body = json.dumps({"action": "evaluate", "session": "da-setup",
                       "args": {"tabId": TAB, "code": code}}).encode()
    req = urllib.request.Request("http://127.0.0.1:10086/command", data=body,
                                 headers={"Content-Type": "application/json"})
    raw = json.loads(urllib.request.urlopen(req, timeout=300).read().decode("utf-8", "replace"))
    return raw["data"]["value"]

first = ev("(() => { const v = window.__cmView; return {len: v.state.doc.toString().length}; })()")
total = first["len"]
parts, off, step = [], 0, 4000
while off < total:
    r = ev(code_tpl % (off, min(off + step, total)))
    parts.append(r["s"]); off += step
doc = "".join(parts)
open(OUT, "w", encoding="utf-8", newline="").write(doc)
print("panjang:", len(doc), "dari", total)
