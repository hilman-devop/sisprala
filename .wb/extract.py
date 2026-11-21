import json, sys
raw = json.load(open(sys.argv[1], encoding="utf-8"))
val = raw["data"]["value"]
text = val["text"] if isinstance(val, dict) else val
open(sys.argv[2], "w", encoding="utf-8", newline="").write(text)
print("wrote", len(text), "chars")
