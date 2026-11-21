(function () {
  var b = [].slice.call(document.querySelectorAll('button')).filter(function (x) { return /^\s*Delete\s*$/i.test(x.innerText || ''); })[0];
  if (!b) return 'no delete';
  b.click(); return 'clicked delete';
})()
