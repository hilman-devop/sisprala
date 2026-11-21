(() => {
  const el = document.querySelector('.cm-content');
  const v = el && el.cmView && el.cmView.rootView && el.cmView.rootView.view;
  const body = document.body ? document.body.innerText.slice(0, 500) : '(no body)';
  return {url: location.href, hasCm: !!el, hasView: !!v, text: body,
          ta: [...document.querySelectorAll('textarea')].map(t => (t.value||'').length)};
})()
