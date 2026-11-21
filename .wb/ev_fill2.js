(function () {
  function set(el, v) {
    el.focus();
    var proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', {bubbles: true}));
    el.dispatchEvent(new Event('change', {bubbles: true}));
    el.blur();
  }
  var f = [].slice.call(document.querySelectorAll('input[type=text]')).filter(function (i) {
    return i.offsetParent !== null && !i.disabled && !/search/i.test(i.placeholder || '');
  });
  var ta = [].slice.call(document.querySelectorAll('textarea')).filter(function (t) { return t.offsetParent !== null; })[0];
  if (f.length !== 5 || !ta) return {err: 'unexpected', n: f.length};
  set(f[0], '*/5'); set(f[1], '*'); set(f[2], '*'); set(f[3], '*'); set(f[4], '*');
  set(ta, 'curl -fsS -o /dev/null -m 45 https://sisprala.my.id/login || echo "$(date \'+%Y-%m-%d %H:%M:%S\') DOWN" >> /home/sisprala/uptime.log');
  return {vals: f.map(function (x) { return x.value; }), cmd: ta.value,
          summary: (document.body.innerText.match(/Cron job will run:[^\n]*/) || [''])[0]};
})()
