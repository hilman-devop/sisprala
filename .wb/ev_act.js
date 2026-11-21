(function () {
  var d = null;
  document.querySelectorAll('iframe').forEach(function (f) { try { if (f.contentDocument) d = f.contentDocument; } catch (e) {} });
  var cell = d.querySelector('td.lvemanager-grid_td_actions');
  if (!cell) return 'no cell';
  var btns = [];
  cell.querySelectorAll('button, [dropdown], [dropdowntoggle]').forEach(function (b) {
    btns.push({tag: b.tagName, cls: String(b.className).slice(0,80), disabled: b.getAttribute('disabled'), title: b.getAttribute('title'), aria: b.getAttribute('aria-describedby'), txt: (b.innerText||'').trim().slice(0,30)});
  });
  return {html: cell.innerHTML.replace(/\s+/g,' ').slice(0, 3000), btns: btns};
})()
