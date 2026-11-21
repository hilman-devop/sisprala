(function () {
  var main = document.querySelector('main, #main, .content, article') || document.body;
  var vis = [];
  document.querySelectorAll('input,select,textarea').forEach(function (i) {
    if (i.offsetParent !== null && i.type !== 'hidden') vis.push({tag: i.tagName, type: i.type, name: i.name, ph: i.placeholder, val: i.value, id: i.id});
  });
  return {url: location.href, title: document.title, main: (main.innerText||'').replace(/\s+/g,' ').slice(0,500), vis: vis.slice(0,20)};
})()
