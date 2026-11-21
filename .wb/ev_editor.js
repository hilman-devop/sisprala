(function () {
  var c = document.querySelector('.cm-content');
  var dv = c && c.cmView;
  var v = (dv && dv.rootView && dv.rootView.view) || window.__cmView;
  if (!v) {
    var main = document.querySelector('main, #main, .content, article') || document.body;
    return {noEditor: true, text: (main.innerText || '').replace(/\s+/g,' ').slice(0, 300)};
  }
  window.__cmView = v;
  return {chars: v.state.doc.toString().length, body: v.state.doc.toString().slice(0, 400)};
})()
