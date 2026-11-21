// src/render.js — escaping, formatter, ikon SVG, dan layout halaman (SSR)
import { statSync } from 'node:fs';

// Versi aset dari mtime + ukuran logo/css/js: URL berubah tiap aset diganti,
// supaya browser cukup pakai cache dan tidak perlu minta ulang tiap halaman.
const ASSET_V = (() => {
  const files = ['../public/img/logo.png', '../public/css/style.css', '../public/js/app.js'];
  const parts = files.map(f => {
    try { const st = statSync(new URL(f, import.meta.url)); return st.mtimeMs.toString(36) + st.size.toString(36); }
    catch { return '-'; }
  });
  return parts.join('-');
})();
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const attr = esc;

export const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
export const fmtDateTime = (d) => d ? new Date(d).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

// ── Ikon garis (SVG inline, gaya stroke) ──
const ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
  box: '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/>',
  layers: '<path d="M12 3 3 8l9 5 9-5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><polyline points="3 3 3 8 8 8"/><polyline points="12 7 12 12 15 14"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><line x1="14" y1="21" x2="21" y2="21"/><line x1="14" y1="14" x2="17" y2="14"/><line x1="21" y1="14" x2="21" y2="17"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  clock: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  search: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  arrowRight: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
};

export function icon(name, size = 18) {
  return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

// ── Logo ──
export function logoMark(size = 24, cls = 'logo-img') {
  return `<img class="${cls}" src="/img/logo.png?v=${ASSET_V}" width="${size}" height="${size}" alt="" decoding="async">`;
}

const themeToggleIcons = () =>
  `<span class="ic-sun">${icon('sun', 16)}</span><span class="ic-moon">${icon('moon', 16)}</span>`;

const FAVICON = `<link rel="icon" href="/favicon.ico?v=${ASSET_V}" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/img/favicon-32.png?v=${ASSET_V}">
<link rel="apple-touch-icon" href="/img/logo-192.png?v=${ASSET_V}">`;

const NAV = [
  ['/dashboard', 'dashboard', 'Dashboard'],
  ['/inventaris/sarana', 'box', 'Inventaris Sarana'],
  ['/inventaris/prasarana', 'layers', 'Inventaris Prasarana'],
  ['/peminjaman', 'list', 'Peminjaman'],
  ['/riwayat', 'history', 'Riwayat'],
  ['/pengaturan', 'settings', 'Pengaturan'],
];

export function layout({ title, active = '', body, user, settings, csrf = '', flash = null }) {
  const nav = NAV.map(([href, ic, label]) =>
    `<a class="nav-link${active === href ? ' active' : ''}" href="${href}">${icon(ic, 17)}<span>${label}</span></a>`).join('');

  return `<!DOCTYPE html>
<html lang="id" data-theme="${attr(settings.theme || 'dark')}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)} · ${esc(settings.orgName)}</title>
${FAVICON}
<link rel="stylesheet" href="/css/style.css?v=${ASSET_V}">
</head>
<body>
<div class="app">
  <aside class="sidebar" id="sidebar">
    <a class="brand" href="/dashboard">
      <span class="brand-mark">${logoMark(24)}</span>
      <span class="brand-name">${esc(settings.orgName)}</span>
    </a>
    <nav class="nav">${nav}</nav>
    <div class="sidebar-foot">
      <div class="user-chip">
        <span class="avatar">${esc((user?.username || '?')[0].toUpperCase())}</span>
        <div class="upt">
          <span class="u-name">${esc(user?.username || '-')}</span>
          <span class="u-role">${esc(user?.role || '')}</span>
        </div>
      </div>
      <form method="post" action="/logout">
        <input type="hidden" name="_csrf" value="${attr(csrf)}">
        <button class="btn btn-ghost btn-block" type="submit">${icon('logout', 15)} Keluar</button>
      </form>
    </div>
  </aside>
  <div class="nav-backdrop" id="navBackdrop" hidden></div>
  <main class="main">
    <header class="topbar">
      <button class="menu-btn" id="menuBtn" type="button" aria-label="Buka menu" aria-expanded="false">${icon('list', 18)}</button>
      <h1>${esc(title)}</h1>
      <span id="clock" class="clock">--:--</span>
      <button class="theme-btn" data-theme-toggle type="button" aria-label="Ganti tema terang/gelap" title="Ganti tema">${themeToggleIcons()}</button>
    </header>
    ${flash ? `<div class="flash flash-${attr(flash.type)}">${esc(flash.msg)}</div>` : ''}
    <div class="content">${body}</div>
  </main>
</div>
<script src="/js/app.js?v=${ASSET_V}" defer></script>
</body>
</html>`;
}

const FEATURES = [
  ['box', 'Inventaris Sarana & Prasarana', 'Dua bagian terpisah: sarana dengan jumlah stok, dan prasarana tanpa stok.'],
  ['list', 'Peminjaman', 'Catat pinjam dan kembali. Satu barang tidak bisa dipinjam dua kali.'],
  ['clock', 'Keterlambatan', 'Penanda otomatis untuk peminjaman lewat tenggat, beserta denda.'],
  ['qr', 'QR per barang', 'Tiap barang punya QR menuju halaman detailnya.'],
  ['bell', 'Notifikasi', 'Pemberitahuan dikirim ke WhatsApp atau email lewat webhook.'],
  ['download', 'Laporan', 'Unduh data inventaris dan peminjaman dalam format CSV, plus backup JSON.'],
];

export function landingLayout({ orgName }) {
  const feats = FEATURES.map(([ic, t, d]) =>
    `<div class="feat reveal"><span class="feat-ico">${icon(ic, 20)}</span><h3>${esc(t)}</h3><p>${esc(d)}</p></div>`).join('');
  const steps = [
    ['Daftarkan barang', 'Masukkan barang ke inventaris, atur kategori dan statusnya.'],
    ['Catat peminjaman', 'Pilih barang, isi peminjam dan tenggat, sistem menandai terpinjam.'],
    ['Kembalikan & pantau', 'Tandai kembali, keterlambatan dan denda dihitung otomatis.'],
  ].map(([t, d], i) => `<li class="reveal"><span class="step-num">${i + 1}</span><div><h3>${esc(t)}</h3><p>${esc(d)}</p></div></li>`).join('');

  return `<!DOCTYPE html>
<html lang="id" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(orgName)} · Sistem Informasi Sarana Prasarana</title>
${FAVICON}
<link rel="stylesheet" href="/css/style.css?v=${ASSET_V}">
</head>
<body class="landing-body">
<header class="lnav">
  <a class="brand" href="/"><span class="brand-mark">${logoMark(24)}</span><span class="brand-name">${esc(orgName)}</span></a>
  <nav class="lnav-links">
    <a href="#fitur">Fitur</a>
    <a href="#cara">Cara kerja</a>
    <a class="btn btn-outline" href="/login">Masuk</a>
    <a class="btn btn-primary" href="/dashboard">Buka aplikasi</a>
    <button class="theme-btn" data-theme-toggle type="button" aria-label="Ganti tema terang/gelap" title="Ganti tema">${themeToggleIcons()}</button>
  </nav>
</header>

<section class="hero">
  <span class="hero-logo">${logoMark(84)}</span>
  <h1>Catat dan kelola peminjaman barang.</h1>
  <p class="hero-sub">Inventaris, peminjaman, pengembalian, denda, dan laporan — dalam satu dasbor.</p>
  <div class="hero-cta">
    <a class="btn btn-primary btn-lg" href="/dashboard">Buka aplikasi</a>
    <a class="btn btn-outline btn-lg" href="#fitur">Lihat fitur</a>
  </div>
</section>

<section class="section" id="fitur">
  <h2 class="section-title">Fitur</h2>
  <div class="feats">${feats}</div>
</section>

<section class="section" id="cara">
  <h2 class="section-title">Cara kerja</h2>
  <ol class="steps">${steps}</ol>
</section>

<section class="section">
  <div class="cta-band reveal">
    <h2>Mulai kelola peminjaman</h2>
    <p>Masuk ke dasbor untuk menambah barang dan mencatat peminjaman pertama.</p>
    <a class="btn btn-primary" href="/login">Masuk ke dasbor</a>
  </div>
</section>

<footer class="lfoot">${esc(orgName)} · Sistem Informasi Sarana Prasarana</footer>
<script src="/js/app.js?v=${ASSET_V}" defer></script>
</body>
</html>`;
}

export function authLayout({ title, body }) {
  return `<!DOCTYPE html>
<html lang="id" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
${FAVICON}
<link rel="stylesheet" href="/css/style.css?v=${ASSET_V}">
</head>
<body class="auth-body">${body}</body>
</html>`;
}
