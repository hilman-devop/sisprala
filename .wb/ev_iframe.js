(function () {
  function scan(doc, depth, acc) {
    try {
      doc.querySelectorAll('button,a,input[type=submit]').forEach(function (el) {
        var t = (el.innerText || el.value || '').trim();
        if (t) acc.push(depth + ':' + t.replace(/\s+/g, ' ').slice(0, 60));
      });
      doc.querySelectorAll('iframe').forEach(function (f) {
        var d = null; try { d = f.contentDocument; } catch (e) {}
        if (d) scan(d, depth + 1, acc); else acc.push(depth + '1:CROSSORIGIN');
      });
    } catch (e) { acc.push('ERR:' + e.message); }
  }
  var acc = [];
  scan(document, 0, acc);
  return acc.slice(0, 80);
})()
