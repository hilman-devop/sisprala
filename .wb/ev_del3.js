(function () {
  var rows = [].slice.call(document.querySelectorAll('tr'));
  var t = rows.filter(function (r) { return /HB \$\(date/.test(r.innerText || ''); })[0];
  if (!t) return 'no HB row';
  var b = t.querySelector('button');
  if (b) b.click();
  return 'selected';
})()
