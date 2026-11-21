(function () {
  var b = [].slice.call(document.querySelectorAll('[role=dialog] button, [class*=dialog] button')).filter(function (x) { return /^\s*CONFIRM\s*$/i.test(x.innerText || ''); })[0];
  if (!b) return 'no confirm';
  b.click(); return 'confirmed';
})()
