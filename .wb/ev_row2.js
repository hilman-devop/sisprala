(function () {
  var d = null;
  document.querySelectorAll('iframe').forEach(function (f) { try { if (f.contentDocument) d = f.contentDocument; } catch (e) {} });
  if (!d) return 'no iframe';
  var rows = [].slice.call(d.querySelectorAll('tr')).filter(function (r) { return /sisprala\.my\.id/.test(r.innerText || ''); });
  if (!rows.length) return 'no row';
  var r = rows[0];
  return {text: r.innerText.replace(/\s+/g,' '), html: r.innerHTML.replace(/\s+/g,' ').slice(0, 1800)};
})()
