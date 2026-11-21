(function () {
  var ta = [].slice.call(document.querySelectorAll('textarea')).filter(function (t) { return t.offsetParent !== null; })[0];
  var cmd = 'curl -fsS -o /dev/null -m 45 https://sisprala.my.id/login 2>/dev/null || echo "$(date \'+%Y-%m-%d %H:%M:%S\') DOWN" >> /home/sisprala/uptime.log';
  ta.focus();
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(ta, cmd);
  ta.dispatchEvent(new Event('input', {bubbles: true}));
  ta.dispatchEvent(new Event('change', {bubbles: true}));
  ta.blur();
  var btn = [].slice.call(document.querySelectorAll('button')).filter(function (b) { return /^\s*CREATE\s*$/i.test(b.innerText || ''); })[0];
  if (!btn) return {err: 'no CREATE btn', cmd: ta.value};
  btn.click();
  return {cmd: ta.value, clicked: true};
})()
