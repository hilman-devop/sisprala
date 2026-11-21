(function () {
  var names = [];
  document.querySelectorAll('a,span,td,div').forEach(function (el) {
    var t = (el.innerText || '').trim();
    if (t === 'uptime.log') names.push({tag: el.tagName, cls: String(el.className).slice(0,50), href: el.getAttribute && el.getAttribute('href')});
  });
  var main = document.querySelector('main, #main, .content, article') || document.body;
  return {found: names.slice(0,5), main: (main.innerText || '').replace(/\s+/g,' ').slice(0, 400)};
})()
