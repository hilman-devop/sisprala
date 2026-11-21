(function () {
  var main = document.querySelector('main, #main, .content, article') || document.body;
  return {url: location.href, title: document.title, text: (main.innerText || '').replace(/\s+/g,' ').slice(0, 600)};
})()
