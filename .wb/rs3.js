(() => {
  const f = document.querySelector('iframe');
  const d = f.contentDocument;
  const btns = [...d.querySelectorAll('button, a')].filter(b => /restart|mulai ulang/i.test((b.title||'') + ' ' + b.textContent + ' ' + (b.className||'')));
  const pub = btns.map(b => ({t: (b.title||'').slice(0,40), t2: b.textContent.trim().slice(0,20), c: (b.className||'').slice(0,60), tag: b.tagName}));
  if (btns[0]) { btns[0].click(); window.__clicked = true; }
  return {found: btns.length, pub, clicked: !!window.__clicked};
})()
