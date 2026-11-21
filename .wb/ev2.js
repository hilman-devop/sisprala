(function () {
  var out = [];
  [].slice.call(document.querySelectorAll('button, [role=button]')).forEach(function (b) {
    var t = (b.innerText || b.getAttribute('aria-label') || '').trim();
    if (t === 'Upload' || t === 'Remove') {
      var r = b.getBoundingClientRect();
      out.push({t: t, html: b.outerHTML.slice(0, 300), rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]});
    }
  });
  return out;
})()
