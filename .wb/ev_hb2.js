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
  set(f[0], '*'); set(f[1], '*'); set(f[2], '*'); set(f[3], '*'); set(f[4], '*');
  set(ta, 'echo "HB $(date \'+%H:%M:%S\')" >> /home/sisprala/domains/sisprala.my.id/public_html/tmp/hb.log');
  var btn = [].slice.call(document.querySelectorAll('button')).filter(function (b) { return /^\s*CREATE\s*$/i.test(b.innerText || ''); })[0];
  btn.click();
  return {ok: true, cmd: ta.value};
})()
