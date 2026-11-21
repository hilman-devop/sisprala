(function () {
  var out = [];
  document.querySelectorAll('a[href]').forEach(function (a) {
    var h = a.getAttribute('href');
    if (h && /summary|log|ssh|shell|mail/i.test(h)) out.push({h: h, t: (a.innerText||'').replace(/\s+/g,' ').trim().slice(0,30)});
  });
  var uniq = {}; out.forEach(function (o) { uniq[o.h] = o.t; });
  return uniq;
})()
