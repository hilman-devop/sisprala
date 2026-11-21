(function () {
  var rows = [].slice.call(document.querySelectorAll('tr'));
  var target = rows.filter(function (r) { return /HB \$\(date/.test(r.innerText || ''); })[0];
  if (!target) return 'no HB row';
  var btn = target.querySelector('button, a');
  var all = [].slice.call(target.querySelectorAll('button,a')).map(function (b) { return {tag: b.tagName, txt: (b.innerText||'').trim().slice(0,20), cls: String(b.className).slice(0,60)}; });
  if (btn) btn.click();
  return {clicked: all};
})()
