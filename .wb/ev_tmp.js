(function () {
  var main = document.querySelector('main, #main, .content, article') || document.body;
  return {main: (main.innerText || '').replace(/\s+/g,' ').slice(0, 500)};
})()
