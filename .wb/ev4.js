(function () {
  var ta = [].slice.call(document.querySelectorAll('textarea')).map(function (t) {
    return {cls: (t.className || '').toString().slice(0, 40), len: (t.value || '').length, id: t.id};
  });
  var cm = document.querySelector('.CodeMirror');
  var cm6 = document.querySelector('.cm-content');
  var btns = [].slice.call(document.querySelectorAll('button, input[type=submit], a')).map(function (b) {
    return {tag: b.tagName, txt: (b.innerText || b.value || '').trim().slice(0, 20), title: b.getAttribute('title') || '', href: (b.getAttribute('href') || '').slice(0, 60)};
  }).filter(function (x) { return x.txt || x.title; }).slice(0, 25);
  return {
    url: location.href,
    textareas: ta,
    codemirror5: cm ? 'yes' : 'no',
    codemirror6: cm6 ? 'yes' : 'no',
    saveButtons: btns.filter(function (b) { return /save|simpan/i.test(b.txt + b.title); }),
    buttons: btns.slice(0, 20)
  };
})()
