"""Ringkas snapshot WebBridge jadi daftar role/name/ref."""
import json, sys

d = json.load(open(sys.argv[1], encoding="utf-8"))


def walk(n, depth=0):
    if isinstance(n, dict):
        if n.get("role") in ("button", "cell", "StaticText", "link", "checkbox") and n.get("name"):
            print(n["role"], repr(n["name"][:45]), n.get("ref") or "")
        for c in n.get("children") or []:
            walk(c, depth + 1)
    elif isinstance(n, list):
        for c in n:
            walk(c, depth)


walk(d["data"]["tree"])
print("url:", d["data"].get("url"))
