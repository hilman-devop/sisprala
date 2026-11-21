(function () {
  var d = null;
  document.querySelectorAll('iframe').forEach(function (f) { try { if (f.contentDocument) d = f.contentDocument; } catch (e) {} });
  if (!d) return 'no iframe doc';
  var out = [];
  d.querySelectorAll('a,tr,[role=row],button').forEach(function (el) {
    var t = (el.innerText || '').replace(/\s+/g, ' ').trim();
    if (t) out.push({tag: el.tagName, cls: String(el.className).slice(0, 40), href: el.getAttribute && el.getAttribute('href'), t: t.slice(0, 90)});
  });
  return {count: out.length, rows: out.slice(0, 40)};
})()
