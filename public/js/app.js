// public/js/app.js — interaksi klien (vanilla, tanpa inline script)
(function () {
  'use strict';

  // ── Jam live ──
  const clock = document.getElementById('clock');
  if (clock) {
    const tick = () => { clock.textContent = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }); };
    tick(); setInterval(tick, 1000);
  }

  // ── Donut chart ──
  const cv = document.getElementById('donut');
  if (cv && cv.getContext) {
    const ready = +cv.dataset.ready, dipinjam = +cv.dataset.dipinjam, nonready = +cv.dataset.nonready;
    const total = ready + dipinjam + nonready;
    const ctx = cv.getContext('2d');
    const cx = 75, cy = 75, r = 56, thick = 20;
    if (total === 0) {
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--border-2').trim() || '#24272e';
      ctx.lineWidth = thick; ctx.stroke();
    } else {
      let start = -Math.PI / 2;
      [[ready, '#3fb950'], [dipinjam, '#d29922'], [nonready, '#6e7681']]
        .filter(([v]) => v > 0).forEach(([val, color]) => {
          const ang = (val / total) * Math.PI * 2;
          ctx.beginPath(); ctx.arc(cx, cy, r, start, start + ang);
          ctx.strokeStyle = color; ctx.lineWidth = thick; ctx.stroke();
          start += ang + 0.05;
        });
    }
  }

  // ── Filter tabel inventaris ──
  const filter = document.getElementById('filterInv');
  const tbl = document.getElementById('tblInv');
  if (filter && tbl) {
    filter.addEventListener('input', () => {
      const q = filter.value.toLowerCase();
      tbl.querySelectorAll('tbody tr').forEach(tr => {
        tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });
  }

  // ── Sidebar drawer (mobile) ──
  const sidebar = document.getElementById('sidebar');
  const menuBtn = document.getElementById('menuBtn');
  const backdrop = document.getElementById('navBackdrop');
  if (sidebar && menuBtn) {
    const setOpen = (open) => {
      sidebar.classList.toggle('open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
      if (backdrop) backdrop.hidden = !open;
    };
    menuBtn.addEventListener('click', () => setOpen(!sidebar.classList.contains('open')));
    if (backdrop) backdrop.addEventListener('click', () => setOpen(false));
    sidebar.querySelectorAll('.nav-link').forEach(a => a.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });
  }

  // ── Modal edit barang (diisi dari data-* tombol, CSP-safe) ──
  const editModal = document.getElementById('editModal');
  if (editModal) {
    const form = document.getElementById('editForm');
    const fields = {
      nama: document.getElementById('edNama'),
      kategori: document.getElementById('edKat'),
      status: document.getElementById('edStatus'),
      keterangan: document.getElementById('edKet'),
      stok: document.getElementById('edStok'),
    };
    document.querySelectorAll('.js-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const d = btn.dataset;
        form.setAttribute('action', '/inventaris/' + d.id);
        fields.nama.value = d.nama || '';
        fields.kategori.value = d.kategori || 'Lainnya';
        fields.status.value = d.status === 'nonready' ? 'nonready' : 'ready';
        fields.keterangan.value = d.keterangan || '';
        if (fields.stok) fields.stok.value = d.stok || 1;
        // status tidak bisa diubah saat barang sedang dipinjam
        const borrowed = d.borrowed === '1';
        fields.status.disabled = borrowed;
        const img = document.getElementById('edCurrent');
        const wrap = document.getElementById('edImgWrap');
        if (d.gambar) { img.src = '/uploads/' + d.gambar; wrap.hidden = false; }
        else { img.removeAttribute('src'); wrap.hidden = true; }
        editModal.classList.add('show');
        fields.nama.focus();
      });
    });
    const close = () => editModal.classList.remove('show');
    editModal.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
    editModal.addEventListener('click', e => { if (e.target === editModal) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  }

  // ── Reveal on scroll (landing) ──
  const reveals = document.querySelectorAll('.reveal');
  if (reveals.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e, i) => {
        if (e.isIntersecting) {
          setTimeout(() => e.target.classList.add('in'), i * 70);
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });
    reveals.forEach(el => io.observe(el));
  } else {
    reveals.forEach(el => el.classList.add('in'));
  }

  // ── Konfirmasi hapus (tanpa inline handler, kompatibel CSP ketat) ──
  document.querySelectorAll('form.js-confirm').forEach(f => {
    f.addEventListener('submit', e => {
      if (!window.confirm(f.dataset.confirm || 'Yakin?')) e.preventDefault();
    });
  });
})();

// ── Tema gelap / terang ──
(() => {
  const KEY = 'pinjamz-theme';
  const root = document.documentElement;
  const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const write = (v) => { try { localStorage.setItem(KEY, v); } catch { /* mode privat */ } };
  const saved = read();
  if (saved === 'light' || saved === 'dark') root.dataset.theme = saved;
  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = root.dataset.theme === 'light' ? 'dark' : 'light';
      root.dataset.theme = next;
      write(next);
    });
  });
})();
