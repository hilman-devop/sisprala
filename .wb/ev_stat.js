(function () {
  var d = null;
  document.querySelectorAll('iframe').forEach(function (f) { try { if (f.contentDocument) d = f.contentDocument; } catch (e) {} });
  var rows = [].slice.call(d.querySelectorAll('tr')).filter(function (r) { return /sisprala\.my\.id/.test(r.innerText || ''); });
  var s = d.querySelector('td.lvemanager-grid_td_status');
  var dlgs = [];
  document.querySelectorAll('iframe').forEach(function (f) {
    try {
      var dd = f.contentDocument;
      dd.querySelectorAll('div').forEach(function (x) {
        if (/restart|confirm|yakin|sure|are you/i.test(x.innerText || '') && (x.innerText || '').length < 300 && x.children.length < 6) dlgs.push((x.innerText||'').replace(/\s+/g,' ').slice(0,150));
      });
    } catch (e) {}
  });
  return {status: s ? s.innerText.replace(/\s+/g,' ').trim() : null, rows: rows.length, dlgs: dlgs.slice(0,5)};
})()
