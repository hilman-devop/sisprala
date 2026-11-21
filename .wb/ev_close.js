(function () {
  var d = document.querySelector('[class*=dialog-host] [class*=dialog]');
  var btn = null;
  document.querySelectorAll('button').forEach(function (b) { if (/^\s*Close\s*$/i.test(b.innerText || '')) btn = b; });
  if (btn) { btn.click(); return 'closed'; }
  return 'no close btn';
})()
