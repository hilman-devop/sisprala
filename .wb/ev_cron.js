(function () {
  function scan(doc, depth, acc) {
    doc.querySelectorAll('input,select,button,textarea,label').forEach(function (el) {
      acc.push({d: depth, tag: el.tagName, type: el.type || '', name: el.name || '', id: el.id || '', ph: el.placeholder || '', txt: (el.innerText || '').trim().slice(0, 50), val: (el.value || '').slice(0, 40)});
    });
    doc.querySelectorAll('iframe').forEach(function (f) {
      try { if (f.contentDocument) scan(f.contentDocument, depth + 1, acc); } catch (e) {}
    });
  }
  var acc = [];
  scan(document, 0, acc);
  return {url: location.href, n: acc.length, els: acc.slice(0, 45)};
})()
