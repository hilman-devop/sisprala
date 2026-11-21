(async function () {
  var u = 'https://82.25.62.13:2222/evo/chunks/filemanager.Cml0-F2j.js';
  var t = await (await fetch(u)).text();
  var i = t.indexOf('filemanager-actions/upload');
  var out = {ctx: t.slice(Math.max(0, i - 700), i + 500)};
  var j = t.indexOf('FormData');
  out.formdata = j >= 0 ? t.slice(Math.max(0, j - 500), j + 700) : null;
  return out;
})()
