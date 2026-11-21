(function () {
  function set(el, v) {
    el.focus();
    var proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    var d = Object.getOwnPropertyDescriptor(proto, 'value');
    d.set.call(el, v);
    el.dispatchEvent(new Event('input', {bubbles: true}));
    el.dispatchEvent(new Event('change', {bubbles: true}));
    el.dispatchEvent(new Event('blur', {bubbles: true}));
  }
  var inputs = [].slice.call(document.querySelectorAll('input[type=text]')).filter(function (i) { return i.offsetParent !== null && !/search/i.test(i.placeholder || ''); });
  var ta = [].slice.call(document.querySelectorAll('textarea')).filter(function (t) { return t.offsetParent !== null; })[0];
  if (inputs.length < 5 || !ta) return {err: 'missing fields', n: inputs.length, hasTa: !!ta};
  set(inputs[0], '*/5');
  set(inputs[1], '*');
  set(inputs[2], '*');
  set(inputs[3], '*');
  set(inputs[4], '*');
  set(ta, 'curl -fsS -o /dev/null -m 45 https://sisprala.my.id/login || echo "$(date \'+%Y-%m-%d %H:%M:%S\') DOWN" >> /home/sisprala/uptime.log');
  return {ok: true, vals: inputs.map(function (i) { return i.value; }), cmd: ta.value};
})()
