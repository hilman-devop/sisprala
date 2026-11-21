(function () {
  var out = [];
  document.querySelectorAll('[role=dialog], [class*=dialog]').forEach(function (m) {
    var s = (m.innerText || '').replace(/\s+/g,' ').trim();
    if (s) out.push(s.slice(0, 200));
  });
  var btns = [].slice.call(document.querySelectorAll('[role=dialog] button')).map(function (b) { return (b.innerText||'').trim().slice(0,20); });
  return {dialogs: out.slice(0,4), btns: btns};
})()
