(() => {
  const out = {url: location.href, texts: []};
  const scan = (d, label) => {
    const t = d.body ? d.body.innerText : '';
    const hits = t.split('\n').map(s => s.trim()).filter(s =>
      /memory|ram|cpu|limit|lve|process|idle|passenger|pool|entry/i.test(s) && s.length < 160);
    out.texts.push({label, hits: [...new Set(hits)].slice(0, 60)});
  };
  scan(document, 'top');
  [...document.querySelectorAll('iframe')].forEach((f, i) => {
    try { scan(f.contentDocument, 'iframe' + i); } catch (e) { out.texts.push({label:'iframe'+i, err:'x'}); }
  });
  return out;
})()
