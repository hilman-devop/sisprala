(function () {
  function findFrame(doc) {
    var r = null;
    doc.querySelectorAll('iframe').forEach(function (f) {
      var d = null; try { d = f.contentDocument; } catch (e) {}
      if (d && !r) r = d;
    });
    return r;
  }
  var doc = document;
  var f = findFrame(doc);
  if (f) doc = f;
  var out = [];
  doc.querySelectorAll('a,button,div,td,tr,span').forEach(function (el) {
    var t = (el.innerText || '').trim();
    if (t === 'sisprala.my.id' || /^sisprala/.test(t)) {
      out.push({tag: el.tagName, cls: el.className, href: el.getAttribute('href') || '', txt: t.slice(0, 40)});
    }
  });
  return out.slice(0, 20);
})()
