(function () {
  var rows = [].slice.call(document.querySelectorAll('tr')).map(function (r) { return (r.innerText || '').replace(/\s+/g,' ').trim().slice(0, 140); }).filter(function (t) { return t && !/Minute Hour/.test(t); });
  return rows.slice(0, 10);
})()
