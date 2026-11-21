(function () {
  var main = document.querySelector('main, #main, .content, article') || document.body;
  var vis = [];
  document.querySelectorAll('input,select').forEach(function (i) {
    if (i.offsetParent !== null && i.type !== 'hidden') vis.push({tag: i.tagName, type: i.type, name: i.name, val: (i.value || '').slice(0, 40), checked: i.checked, disabled: i.disabled});
  });
  return {url: location.href, main: (main.innerText || '').replace(/\s+/g,' ').slice(0, 700), vis: vis.slice(0, 25)};
})()
