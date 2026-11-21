(function () {
  var d = null;
  document.querySelectorAll('iframe').forEach(function (f) { try { if (f.contentDocument) d = f.contentDocument; } catch (e) {} });
  var b = d.querySelector('button.lvemanager-icon-restart');
  if (!b) return 'no restart button';
  b.click();
  return 'clicked';
})()
