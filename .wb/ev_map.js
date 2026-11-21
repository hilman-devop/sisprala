(function () {
  var out = [];
  document.querySelectorAll('input[type=text], textarea').forEach(function (i) {
    if (i.offsetParent === null) return;
    if (/search/i.test(i.placeholder || '')) return;
    var lab = '';
    var p = i.closest('label, div, td, tr');
    if (p) lab = (p.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    out.push({tag: i.tagName, val: i.value, readOnly: i.readOnly, disabled: i.disabled, id: i.id, name: i.name, lab: lab});
  });
  return out;
})()
