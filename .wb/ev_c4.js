(function () {
  var out = [];
  document.querySelectorAll('[role=dialog], [class*=modal], [class*=dialog], [class*=popover], [class*=overlay]').forEach(function (m) {
    var s = (m.innerText || '').replace(/\s+/g,' ').trim();
    if (s) out.push({cls: String(m.className).slice(0,50), t: s.slice(0, 300)});
  });
  var inputs = [];
  document.querySelectorAll('input').forEach(function (i) {
    if (i.offsetParent !== null) inputs.push({name: i.name, type: i.type, ph: i.placeholder, val: i.value, id: i.id});
  });
  return {dialogs: out.slice(0,6), visibleInputs: inputs.slice(0,15)};
})()
