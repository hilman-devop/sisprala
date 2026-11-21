(() => {
  const f = document.querySelector('iframe');
  const d = f.contentDocument;
  const rows = [...d.querySelectorAll('tr')].map(r => r.textContent.replace(/\s+/g,' ').trim().slice(0,130)).filter(s=>/started|stopped|v22/i.test(s));
  const dlgs = [...d.querySelectorAll('.dialog, .modal, [role=dialog]')].filter(x=>x.offsetParent).map(x=>x.textContent.replace(/\s+/g,' ').trim().slice(0,120));
  const alerts = [...d.querySelectorAll('.alert, .msg, .notice')].map(x=>x.textContent.replace(/\s+/g,' ').trim().slice(0,120));
  return {rows, dlgs, alerts};
})()
