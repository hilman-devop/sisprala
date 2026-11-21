(async () => {
  const t = window.__dump || '';
  return await new Promise(res => {
    try {
      const x = new XMLHttpRequest();
      x.open('POST', '/__dump', false);
      x.send(t);
      res({ posted: t.length, status: x.status });
    } catch (e) { res({ posted: 0, err: String(e) }); }
  });
})()
