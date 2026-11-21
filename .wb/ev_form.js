(function () {
  var out = {inputs: [], selects: [], labels: [], texts: []};
  document.querySelectorAll('[role=dialog] input, [role=dialog] select, [role=dialog] textarea').forEach(function (i) {
    out.inputs.push({tag: i.tagName, type: i.type, name: i.name, ph: i.placeholder, id: i.id, val: i.value});
  });
  document.querySelectorAll('[role=dialog] label').forEach(function (l) { out.labels.push((l.innerText||'').replace(/\s+/g,' ').trim().slice(0,40)); });
  var dlg = document.querySelector('[class*=dialog-host] [class*=dialog]');
  out.text = dlg ? (dlg.innerText || '').replace(/\s+/g,' ').slice(0, 500) : null;
  return out;
})()
