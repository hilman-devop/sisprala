(function () {
  var d = null;
  document.querySelectorAll('iframe').forEach(function (f) { try { if (f.contentDocument) d = f.contentDocument; } catch (e) {} });
  var out = [];
  d.querySelectorAll('[role=dialog], .modal, .lvemanager-modal, mat-dialog-container, .dialog').forEach(function (m) {
    out.push((m.innerText || '').replace(/\s+/g, ' ').slice(0, 200));
  });
  var btns = [];
  d.querySelectorAll('button').forEach(function (b) {
    var t = (b.innerText || '').trim();
    if (t) btns.push(t.slice(0, 40));
  });
  return {modals: out, buttons: btns.slice(0, 20)};
})()
