(() => {
  const el = document.querySelector('.cm-content');
  if (!el) return {ok:false, reason:'no .cm-content', title: document.title, url: location.href};
  const v = el.cmView && el.cmView.rootView && el.cmView.rootView.view;
  if (!v) return {ok:false, reason:'no view', hasContent:true};
  window.__cmView = v;
  return {ok:true, chars: v.state.doc.toString().length, head: v.state.doc.toString().slice(0,60)};
})()
