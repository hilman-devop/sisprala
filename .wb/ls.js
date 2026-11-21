(() => {
  const rows = [...document.querySelectorAll('tr')].map(tr => {
    const cells = [...tr.querySelectorAll('td, .cell')].map(td => td.innerText.replace(/\s+/g,' ').trim());
    return cells.length ? cells.slice(0,5) : null;
  }).filter(Boolean);
  return {rows: rows.slice(0, 40)};
})()
