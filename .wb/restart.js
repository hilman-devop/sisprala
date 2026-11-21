(async () => {
  const v = window.__cmView;
  const out = {hadView: !!v};
  // sentuh file: tulis 1 spasi lalu kosongkan lagi → mtime berubah, isi tetap 0 B
  if (v) { v.dispatch({changes:{from:0,to:v.state.doc.length,insert:' '}}); }
  const btn = document.querySelector('button[title="Save"], button[title="Simpan"]');
  if (btn) { btn.click(); out.clicked = true; out.txt = btn.textContent.trim(); }
  return out;
})()
