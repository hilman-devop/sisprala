(function () {
  var c = document.querySelector('.cm-content');
  var dv = c && c.cmView;
  var view = dv && dv.rootView && dv.rootView.view;
  if (!view) {
    return {
      ok: false,
      hasContent: !!c,
      cmKeys: c ? Object.keys(c).filter(function (k) { return /cm|view/i.test(k); }) : null,
      childrenCls: c ? (c.firstElementChild ? c.firstElementChild.className : '') : ''
    };
  }
  window.__cmView = view;
  var doc = view.state.doc.toString();
  return {ok: true, chars: doc.length, lines: doc.lines, head: doc.slice(0, 60)};
})()
