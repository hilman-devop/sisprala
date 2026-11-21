(function () {
  var c = document.querySelector('.cm-content');
  var dv = c && c.cmView;
  var v = (dv && dv.rootView && dv.rootView.view) || window.__cmView;
  if (!v) return "no view";
  window.__cmView = v;
  var d = v.state.doc.toString();
  return {chars: d.length, hasAdmin123: d.indexOf('admin123') !== -1, hasSeedEnv: d.indexOf('ADMIN_PASSWORD') !== -1};
})()
