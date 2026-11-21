(() => {
  const v = window.__cmView || document.querySelector('.cm-content')?.cmView?.rootView?.view;
  if (!v) return {ok:false};
  const t = v.state.doc.toString();
  window.__dump = t;
  return {ok:true, chars: t.length};
})()
