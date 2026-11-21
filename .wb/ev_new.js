(function () {
  var b = [].slice.call(document.querySelectorAll('button')).filter(function (x) { return /CREATE CRON JOB/i.test(x.innerText || ''); })[0];
  if (!b) return 'no create btn';
  b.click(); return 'clicked create';
})()
