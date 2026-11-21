(function () {
  var b = document.querySelector('button[title="Save"]') || document.querySelector('button[title="Simpan"]');
  if (!b) return "no save button";
  b.click();
  return {clicked: true, disabled: b.disabled, txt: (b.innerText || '').trim()};
})()
