(function () {
  var inputs = [].slice.call(document.querySelectorAll('input')).map(function (x) {
    return {type: x.type, name: x.name, accept: (x.accept || '').slice(0, 40), multiple: x.multiple};
  });
  var t = (document.body.innerText || '').replace(/\s+/g, ' ');
  var fixed = [].slice.call(document.querySelectorAll('div,section')).filter(function (e) {
    var cs = getComputedStyle(e);
    return (cs.position === 'fixed' || cs.position === 'absolute') && e.offsetHeight > 120 && e.offsetWidth > 250
      && cs.display !== 'none' && e.offsetParent !== null;
  }).map(function (e) { return (e.innerText || '').replace(/\s+/g, ' ').slice(0, 120); });
  return {inputs: inputs, tail: t.slice(-320), overlays: fixed.slice(0, 5)};
})()
