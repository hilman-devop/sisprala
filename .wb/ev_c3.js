(function () {
  var main = document.querySelector('main, #main, .content, article') || document.body;
  var toasts = [];
  document.querySelectorAll('[class*=toast],[class*=notification],[role=alert]').forEach(function (t) {
    var s = (t.innerText || '').trim(); if (s) toasts.push(s.slice(0, 120));
  });
  return {main: (main.innerText || '').replace(/\s+/g,' ').slice(0, 700), toasts: toasts.slice(0,5)};
})()
