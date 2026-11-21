"""Bikin .wb/ev_set.js dari file lokal: dispatch isi file ke EditorView CM6 di halaman DA.

Pakai: python mkset.py <path-lokal-absolut> [outfile]
"""
import json, sys

src, out = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else "ev_set.js")
text = open(src, encoding="utf-8").read()
# json.dumps(ensure_ascii=True) -> escape semua non-ASCII, aman sebagai literal JS
js = """(function () {
  var view = window.__cmView;
  if (!view) return "no view";
  var text = %s;
  view.dispatch({changes: {from: 0, to: view.state.doc.length, insert: text}});
  var now = view.state.doc.toString();
  return {chars: now.length, expected: text.length, head: now.slice(0, 50), tail: now.slice(-40)};
})()
""" % json.dumps(text)
open(out, "w", encoding="utf-8").write(js)
print("wrote", out, "for", src, "| chars:", len(text))
