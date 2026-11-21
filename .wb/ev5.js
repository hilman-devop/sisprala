(function () {
  var x = new XMLHttpRequest();
  x.open('GET', '/evo/chunks/filemanager.Cml0-F2j.js', false);
  x.send();
  var t = x.responseText || '';
  var out = {len: t.length, hits: []};
  var i = -1;
  while ((i = t.indexOf('filemanager-actions/upload', i + 1)) !== -1) {
    out.hits.push(t.slice(Math.max(0, i - 600), i + 700));
    if (out.hits.length >= 2) break;
  }
  var app = [];
  var j = -1;
  while ((j = t.indexOf('.append(', j + 1)) !== -1 && app.length < 12) {
    app.push(t.slice(Math.max(0, j - 90), j + 90));
  }
  out.appends = app;
  return out;
})()
