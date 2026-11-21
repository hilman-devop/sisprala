(function () {
  var btns = [].slice.call(document.querySelectorAll('button,a')).filter(function (b) { return /SEND ALL CRON OUTPUT/i.test(b.innerText || ''); });
  if (!btns.length) return 'not found';
  var b = btns[0];
  var info = {tag: b.tagName, cls: b.className, html: b.outerHTML.slice(0, 400)};
  b.click();
  return info;
})()
