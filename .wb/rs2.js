(() => {
  const out = {url: location.href, frames: []};
  const walk = (doc, label) => {
    try {
      const rows = [...doc.querySelectorAll('tr, .row, li')].filter(r => /sisprala|server\.js|started/i.test(r.textContent));
      out.frames.push({label, rows: rows.slice(0,4).map(r => r.textContent.replace(/\s+/g,' ').trim().slice(0,120))});
    } catch (e) { out.frames.push({label, err: String(e)}); }
  };
  walk(document, 'top');
  [...document.querySelectorAll('iframe')].forEach((f, i) => {
    try { walk(f.contentDocument, 'iframe' + i + ':' + f.src.slice(0,80)); } catch (e) { out.frames.push({label:'iframe'+i, err:'cross-origin'}); }
  });
  return out;
})()
