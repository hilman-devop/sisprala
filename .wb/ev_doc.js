(function () {
  var c = document.querySelector('.cm-content');
  var dv = c && c.cmView;
  var v = (dv && dv.rootView && dv.rootView.view) || window.__cmView;
  if (!v) return {err: 'no view'};
  window.__cmView = v;
  return {text: v.state.doc.toString()};
})()
