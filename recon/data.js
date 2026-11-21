// ══════════════════════════════════════════════════════
// data.js — Pinzup | shared state & utilities
// ══════════════════════════════════════════════════════

// ── Storage ──
function getInventaris()  { return JSON.parse(localStorage.getItem('pinzupInv')     || '[]'); }
function getPeminjaman()  { return JSON.parse(localStorage.getItem('pinzupPinj')    || '[]'); }
function getRiwayat()     { return JSON.parse(localStorage.getItem('pinzupRiwayat') || '[]'); }
function getSettings()    { return JSON.parse(localStorage.getItem('pinzupSettings')|| '{"theme":"dark","orgName":"Pinzup"}'); }

function saveInventaris(d)  { localStorage.setItem('pinzupInv',      JSON.stringify(d)); }
function savePeminjaman(d)  { localStorage.setItem('pinzupPinj',     JSON.stringify(d)); }
function saveRiwayat(d)     { localStorage.setItem('pinzupRiwayat',  JSON.stringify(d)); }
function saveSettings(d)    { localStorage.setItem('pinzupSettings', JSON.stringify(d)); }

function addRiwayat(tipe, teks, meta = {}) {
  const r = getRiwayat();
  r.unshift({ id: Date.now(), tipe, teks, meta, waktu: new Date().toISOString() });
  if (r.length > 200) r.pop();
  saveRiwayat(r);
}

// ── Status helpers ──
function getBarangStatus(b) {
  const p = getPeminjaman();
  const loan = p.find(x => x.barangId === b.id && !x.selesai);
  if (loan) return 'dipinjam';
  return b.status || 'ready';
}

function getSisaHari(tgl) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(tgl) - today) / 86400000);
}

function getStatusPinjam(p) {
  if (p.selesai) return 'selesai';
  return getSisaHari(p.tglKembali) < 0 ? 'terlambat' : 'aktif';
}

// ── Format ──
function fmtDate(d) {
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(d) {
  return new Date(d).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function fmtDateShort(d) {
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
}

function getEmoji(kat) {
  if (!kat) return '📦';
  const map = {
    'Kamera': '📷', 'Audio': '🎙️', 'Lighting': '💡', 'Komputer': '🖥️',
    'Peralatan': '🔧', 'Buku': '📚', 'Alat Tulis': '✏️', 'Lainnya': '📦',
    'Elektronik': '⚡', 'Furnitur': '🪑', 'Olahraga': '⚽', 'Pakaian': '👗'
  };
  for (const [key, emoji] of Object.entries(map)) {
    if (kat.includes(key)) return emoji;
  }
  return kat.split(' ')[0] || '📦';
}

// ── Stats ──
function getStats() {
  const inv  = getInventaris();
  const pinj = getPeminjaman();
  const ready     = inv.filter(b => getBarangStatus(b) === 'ready').length;
  const dipinjam  = inv.filter(b => getBarangStatus(b) === 'dipinjam').length;
  const nonready  = inv.filter(b => getBarangStatus(b) === 'nonready').length;
  const terlambat = pinj.filter(p => getStatusPinjam(p) === 'terlambat').length;
  const aktif     = pinj.filter(p => getStatusPinjam(p) === 'aktif').length;
  const selesai   = pinj.filter(p => getStatusPinjam(p) === 'selesai').length;
  return { total: inv.length, ready, dipinjam, nonready, terlambat, aktif, selesai, totalPinj: pinj.length };
}

// ── Export CSV ──
function exportCSV(type) {
  let csv = '', filename = '';
  if (type === 'inventaris') {
    csv = 'ID,Nama,Kategori,Status,Keterangan\n';
    getInventaris().forEach(b => {
      csv += `${b.id},"${b.nama}","${b.kat}","${getBarangStatus(b)}","${b.ket || ''}"\n`;
    });
    filename = 'pinzup-inventaris.csv';
  } else if (type === 'peminjaman') {
    csv = 'ID,Peminjam,Kontak,Barang,Tgl Pinjam,Batas Kembali,Status,Catatan\n';
    const inv = getInventaris();
    getPeminjaman().forEach(p => {
      const b = inv.find(x => x.id === p.barangId);
      csv += `${p.id},"${p.nama}","${p.kontak || ''}","${b ? b.nama : '(dihapus)'}","${p.tglPinjam}","${p.tglKembali}","${getStatusPinjam(p)}","${p.catatan || ''}"\n`;
    });
    filename = 'pinzup-peminjaman.csv';
  }
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  showToast('File CSV berhasil diunduh!', 'success');
}

// ── Theme ──
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const s = getSettings(); s.theme = theme; saveSettings(s);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = current === 'dark' ? '🌙' : '☀️';
}

// ── Toast ──
function showToast(msg, type = 'default') {
  let el = document.getElementById('_toast');
  if (!el) {
    el = document.createElement('div');
    el.id = '_toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  const icons = { success: '✓', error: '✕', warning: '⚠', default: 'i' };
  el.className = `toast toast-${type === 'default' ? 'info' : type} show`;
  el.innerHTML = `<span class="toast-icon">${icons[type] || 'i'}</span><span>${msg}</span>`;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 3200);
}

// ── Image helpers ──
function previewImg(input, previewId, wrapId) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    showToast('Ukuran gambar maksimal 2MB!', 'error');
    input.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    const img = document.getElementById(previewId);
    img.src = e.target.result;
    img.style.display = 'block';
    const wrap = document.getElementById(wrapId);
    wrap.querySelector('.upload-icon').style.display = 'none';
    wrap.querySelector('.upload-label').style.display = 'none';
  };
  reader.readAsDataURL(file);
}

function getImgData(previewId) {
  const img = document.getElementById(previewId);
  return img && img.style.display === 'block' ? img.src : null;
}

function resetImgUpload(previewId, wrapId) {
  const img = document.getElementById(previewId);
  if (!img) return;
  img.src = ''; img.style.display = 'none';
  const wrap = document.getElementById(wrapId);
  if (!wrap) return;
  const icon  = wrap.querySelector('.upload-icon');
  const label = wrap.querySelector('.upload-label');
  if (icon)  icon.style.display  = '';
  if (label) label.style.display = '';
}

function setImgPreview(previewId, wrapId, src) {
  const img = document.getElementById(previewId);
  const wrap = document.getElementById(wrapId);
  if (!img || !wrap) return;
  if (src) {
    img.src = src; img.style.display = 'block';
    const icon  = wrap.querySelector('.upload-icon');
    const label = wrap.querySelector('.upload-label');
    if (icon)  icon.style.display  = 'none';
    if (label) label.style.display = 'none';
  } else {
    resetImgUpload(previewId, wrapId);
  }
}

// ── Modal ──
function openModal(id)  { document.getElementById(id).classList.add('show');    }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }

document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-bg')) {
    e.target.classList.remove('show');
  }
});

// ── Clock ──
function startClock() {
  function tick() {
    const now = new Date();
    const el  = document.getElementById('clock');
    if (el) el.textContent = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const de = document.getElementById('dateBadge');
    if (de) de.textContent = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  tick();
  setInterval(tick, 1000);
}

// ── Active nav ──
document.addEventListener('DOMContentLoaded', () => {
  const path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach(a => {
    const href = a.getAttribute('href');
    a.classList.toggle('active', href === path || (path === '' && href === 'index.html'));
  });

  // Apply saved theme
  const s = getSettings();
  applyTheme(s.theme || 'dark');
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = (s.theme || 'dark') === 'dark' ? '☀️' : '🌙';

  // Update org name
  const orgEl = document.querySelectorAll('.org-name');
  orgEl.forEach(el => el.textContent = s.orgName || 'Pinzup');
});
