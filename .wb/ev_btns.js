(function () {
  var out = [];
  document.querySelectorAll('button,a,input[type=submit]').forEach(function (el) {
    var t = (el.innerText || el.value || '').trim();
    if (t) out.push(t);
  });
  var ifr = document.querySelectorAll('iframe');
  return {buttons: out.slice(0, 60), iframes: ifr.length};
})()
