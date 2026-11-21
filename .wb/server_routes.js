// src/routes.js — semua route halaman & aksi
import { randomBytes, randomUUID } from 'node:crypto';
import { join, dirname } from 'node:path';
import { unlinkSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import QRCode from 'qrcode';
import { db, getSettings, setSetting, logActivity, loanStatus, lateDays, fine, notify, now } from './db.js';
import { hashPassword, verifyPassword, createSession, destroySession, setSessionCookie,
         requireAuth, checkCsrf, parseCookies } from './auth.js';
import { layout, authLayout, landingLayout, esc, attr, fmtDate, fmtDateTime, icon, logoMark } from './render.js';
import { toCsv } from './csv.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// ponytail: UPLOAD_DIR env supaya bisa diarahkan ke volume/tmp di hosting read-only
const UPLOAD_DIR = process.env.UPLOAD_DIR || join(__dirname, '..', 'public', 'uploads');
mkdirSync(UPLOAD_DIR, { recursive: true });

const MIME_EXT = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif' };
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => cb(null, randomBytes(8).toString('hex') + (MIME_EXT[file.mimetype] || '')),
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = !!MIME_EXT[file.mimetype];
    cb(ok ? null : new Error('Tipe file tidak diizinkan'), ok);
  },
});

const uploadJson = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

// Hapus file gambar (hindari path traversal)
function removeUpload(name) {
  if (!name || name.includes('/') || name.includes('\\') || name.includes('..')) return;
  try { unlinkSync(join(UPLOAD_DIR, name)); } catch { /* sudah tidak ada */ }
}
const flashOf = (req) => {
  if (req.query.ok) return { type: 'ok', msg: req.query.ok };
  if (req.query.err) return { type: 'err', msg: req.query.err };
  return null;
};
const page = (req, title, active, body) => layout({
  title, active, body, user: req.user, settings: getSettings(), csrf: req.csrf, flash: flashOf(req),
});
const s = (v) => String(v ?? '').trim();
// Dua bagian inventaris: sarana (punya stok/jumlah unit) & prasarana
const SECTIONS = {
  sarana:    { sub: 'Sarana',    label: 'Inventaris Sarana',    active: '/inventaris/sarana' },
  prasarana: { sub: 'Prasarana', label: 'Inventaris Prasarana', active: '/inventaris/prasarana' },
};
const invPath = (jenis) => (SECTIONS[jenis] || SECTIONS.sarana).active;
const stokOf = (v) => Math.min(9999, Math.max(1, parseInt(v, 10) || 1));
const todayISO = () => new Date().toISOString().slice(0, 10);
const plusDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

export function registerRoutes(app) {
  // ── Landing ──
  app.get('/', (req, res) => {
    if (req.user) return res.redirect('/dashboard');
    res.send(landingLayout({ orgName: getSettings().orgName }));
  });

  // ── Login ──
  const attempts = new Map(); // ip -> {count, until}
  const tooMany = (ip) => { const a = attempts.get(ip); return a && a.count >= 5 && Date.now() < a.until; };
  const bump = (ip) => { const a = attempts.get(ip) || { count: 0, until: 0 };
    a.count += 1; a.until = Date.now() + 5 * 60 * 1000; attempts.set(ip, a); };
  const clear = (ip) => attempts.delete(ip);

  app.get('/login', (req, res) => {
    if (req.user) return res.redirect('/dashboard');
    let csrf = parseCookies(req.headers.cookie).csrf;
    if (!csrf) { csrf = randomBytes(32).toString('hex');
      res.cookie('csrf', csrf, { httpOnly: false, sameSite: 'lax', path: '/' }); }
    res.send(authLayout({ title: 'Masuk', body: `
      <form class="auth-card" method="post" action="/login">
        <span class="auth-mark">${logoMark(56)}</span>
        <h2>Masuk ke ${esc(getSettings().orgName)}</h2>
        ${req.query.next ? `<input type="hidden" name="next" value="${attr(req.query.next)}">` : ''}
        <input type="hidden" name="_csrf" value="${attr(csrf)}">
        <label>Nama pengguna<input name="username" required autofocus autocomplete="username"></label>
        <label>Kata sandi<input name="password" type="password" required autocomplete="current-password"></label>
        <button class="btn btn-primary" type="submit">Masuk</button>
      </form>` }));
  });

  app.post('/login', (req, res) => {
    const ip = req.ip || 'unknown';
    const back = (m) => res.redirect('/login?err=' + encodeURIComponent(m));
    if (parseCookies(req.headers.cookie).csrf !== req.body._csrf) return back('CSRF token tidak valid');
    if (tooMany(ip)) return back('Terlalu banyak percobaan, coba lagi nanti');
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(s(req.body.username));
    if (!user || !verifyPassword(s(req.body.password), user.password_hash)) {
      bump(ip); return back('Nama pengguna atau kata sandi salah');
    }
    clear(ip);
    const { token } = createSession(user.id);
    setSessionCookie(res, token, req.secure);
    logActivity('login', `${user.username} masuk`, null, user.id);
    const next = s(req.body.next);
    res.redirect(next.startsWith('/') ? next : '/dashboard');
  });

  app.post('/logout', requireAuth, checkCsrf, (req, res) => {
    destroySession(req.sessionToken);
    res.clearCookie('sid', { path: '/' });
    res.redirect('/login');
  });

  // ── Dashboard ──
  app.get('/dashboard', requireAuth, (req, res) => {
    const items = db.prepare('SELECT * FROM items').all();
    const loans = db.prepare('SELECT * FROM loans').all();
    const inv = getInvStatus(items, loans);
    const stats = { total: items.length, ...countBy(inv) };
    const lateLoans = loans.filter(l => loanStatus(l) === 'terlambat');
    const terlambat = lateLoans.length;
    const st = getSettings();
    const rate = Number(st.dendaPerHari || 0);
    const totalDenda = lateLoans.reduce((a, l) => a + fine(l, rate), 0);
    // Notifikasi keterlambatan: sekali per hari per pinjaman
    for (const l of lateLoans) {
      if ((l.late_notified_at || '').slice(0, 10) !== todayISO()) {
        notify('terlambat', l.kontak, `Peminjaman ${l.peminjam} terlambat ${lateDays(l)} hari. Denda Rp ${fine(l, rate).toLocaleString('id-ID')}.`);
        db.prepare('UPDATE loans SET late_notified_at = ? WHERE id = ?').run(now(), l.id);
      }
    }
    const recent = db.prepare('SELECT * FROM activity ORDER BY id DESC LIMIT 6').all();

    const card = (cls, ic, label, val) =>
      `<div class="stat ${cls}"><div class="stat-icon">${icon(ic, 18)}</div>
        <div><div class="stat-val">${val}</div><div class="stat-label">${label}</div></div></div>`;

    const body = `
      ${terlambat ? `<div class="flash flash-err">${icon('alert', 16)} <span>${terlambat} peminjaman terlambat (denda Rp ${totalDenda.toLocaleString('id-ID')}) — <a href="/peminjaman">lihat detail</a></span></div>` : ''}
      <div class="stats">
        ${card('', 'box', 'Total Barang', stats.total)}
        ${card('green', 'check', 'Tersedia', stats.ready || 0)}
        ${card('orange', 'clock', 'Dipinjam', stats.dipinjam || 0)}
        ${card('gray', 'alert', 'Non-Ready', stats.nonready || 0)}
      </div>
      <div class="grid-2">
        <div class="card">
          <h3>Ringkasan Status</h3>
          <div class="donut-wrap">
            <canvas id="donut" width="150" height="150"
              data-ready="${stats.ready || 0}" data-dipinjam="${stats.dipinjam || 0}"
              data-nonready="${stats.nonready || 0}"></canvas>
            <ul class="legend">
              <li><i class="ldot lgreen"></i>Tersedia <b>${stats.ready || 0}</b></li>
              <li><i class="ldot lam"></i>Dipinjam <b>${stats.dipinjam || 0}</b></li>
              <li><i class="ldot lgray"></i>Non-Ready <b>${stats.nonready || 0}</b></li>
            </ul>
          </div>
        </div>
        <div class="card">
          <h3>Aktivitas Terbaru</h3>
          <ul class="timeline">
            ${recent.length ? recent.map(r => `<li><span class="tl-dot"></span>
              <div><div>${esc(r.teks)}</div><div class="tl-time">${fmtDateTime(r.created_at)}</div></div></li>`).join('')
              : '<li class="muted">Belum ada aktivitas</li>'}
          </ul>
        </div>
      </div>`;
    res.send(page(req, 'Dashboard', '/dashboard', body));
  });

  // ── Inventaris (Sarana & Prasarana) ──
  function inventarisPage(jenis) {
    return (req, res) => {
    const sec = SECTIONS[jenis];
    const items = db.prepare('SELECT * FROM items WHERE jenis = ? ORDER BY id DESC').all(jenis);
    const loans = db.prepare('SELECT * FROM loans').all();
    const inv = getInvStatus(items, loans);

    const rows = inv.map(b => {
      const pill = b.status === 'ready' ? 'pill-green' : b.status === 'dipinjam' ? 'pill-orange' : 'pill-gray';
      const label = b.status === 'ready' ? 'Ready' : b.status === 'dipinjam' ? 'Dipinjam' : 'Non-Ready';
      const img = b.gambar ? `<img class="thumb" src="/uploads/${attr(b.gambar)}" alt="${attr(b.nama)}">`
                           : `<div class="thumb ph">${icon('box', 18)}</div>`;
      return `<tr>
        <td>${img}</td>
        <td><b>${esc(b.nama)}</b><div class="muted">${esc(b.kategori)}${b.keterangan ? ' · ' + esc(b.keterangan) : ''}</div></td>
        ${jenis === 'sarana' ? `<td><b>${b.stok ?? 1}</b> <span class="muted">unit</span></td>` : ''}
        <td><span class="pill ${pill}">${label}</span></td>
        <td class="actions">
          <button type="button" class="btn btn-mini js-edit" data-id="${b.id}" data-nama="${attr(b.nama)}" data-kategori="${attr(b.kategori)}" data-status="${attr(b.status)}" data-keterangan="${attr(b.keterangan || '')}" data-gambar="${attr(b.gambar || '')}" data-stok="${b.stok ?? 1}" data-borrowed="${b.status === 'dipinjam' ? '1' : '0'}">${icon('edit', 14)} Edit</button>
          <a class="btn btn-mini" href="/barang/${b.id}">${icon('qr', 14)} QR</a>
          ${b.status !== 'dipinjam' ? `<form method="post" action="/inventaris/${b.id}/status"><input type="hidden" name="_csrf" value="${attr(req.csrf)}"><button class="btn btn-mini">${b.status === 'ready' ? 'Set Non-Ready' : 'Set Ready'}</button></form>` : ''}
          <form method="post" action="/inventaris/${b.id}/hapus" class="js-confirm" data-confirm="Hapus barang ini?"><input type="hidden" name="_csrf" value="${attr(req.csrf)}"><button class="btn btn-mini btn-danger">${icon('trash', 14)} Hapus</button></form>
        </td>
      </tr>`;
    }).join('');

    const body = `
      <div class="card">
        <h3>Tambah ${esc(sec.sub)}</h3>
        <form class="form-inline" method="post" action="/inventaris" enctype="multipart/form-data">
          <input type="hidden" name="_csrf" value="${attr(req.csrf)}">
          <input type="hidden" name="jenis" value="${jenis}">
          <input name="nama" placeholder="Nama ${attr(sec.sub.toLowerCase())}" required>
          <select name="kategori">${CATEGORIES.map(c => `<option>${c}</option>`).join('')}</select>
          <select name="status"><option value="ready">Ready</option><option value="nonready">Non-Ready</option></select>
          ${jenis === 'sarana' ? '<input type="number" name="stok" min="1" max="9999" value="1" title="Stok (jumlah unit)" aria-label="Stok">' : ''}
          <input name="keterangan" placeholder="Keterangan (opsional)">
          <input type="file" name="gambar" accept="image/png,image/jpeg,image/webp,image/gif">
          <button class="btn btn-primary" type="submit">${icon('plus', 15)} Tambah</button>
        </form>
      </div>
      <div class="card">
        <h3>Daftar Inventaris ${esc(sec.sub)} <span class="muted">(${inv.length})</span></h3>
        <input id="filterInv" class="search" placeholder="Cari barang…">
        <table class="table" id="tblInv">
          <thead><tr><th></th><th>Barang</th>${jenis === 'sarana' ? '<th>Stok</th>' : ''}<th>Status</th><th>Aksi</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="${jenis === 'sarana' ? 5 : 4}" class="muted">Belum ada barang</td></tr>`}</tbody>
        </table>
      </div>
      <div class="modal" id="editModal">
        <div class="modal-card">
          <h3>Edit Barang ${esc(sec.sub)}</h3>
          <form method="post" id="editForm" enctype="multipart/form-data">
            <input type="hidden" name="_csrf" value="${attr(req.csrf)}">
            <input type="hidden" name="jenis" value="${jenis}">
            <label>Nama barang<input name="nama" id="edNama" required></label>
            ${jenis === 'sarana' ? '<label>Stok (jumlah unit)<input type="number" name="stok" id="edStok" min="1" max="9999" value="1"></label>' : ''}
            <label>Kategori<select name="kategori" id="edKat">${CATEGORIES.map(c => `<option>${c}</option>`).join('')}</select></label>
            <label>Status<select name="status" id="edStatus"><option value="ready">Ready</option><option value="nonready">Non-Ready</option></select></label>
            <label>Keterangan<input name="keterangan" id="edKet" placeholder="Opsional"></label>
            <div id="edImgWrap" hidden>
              <img class="current-img" id="edCurrent" alt="Gambar saat ini">
              <label class="check"><input type="checkbox" name="hapusGambar" value="1"> Hapus gambar ini</label>
            </div>
            <label>Ganti gambar (opsional)<input type="file" name="gambar" accept="image/png,image/jpeg,image/webp,image/gif"></label>
            <p class="muted">Status barang yang sedang dipinjam tidak dapat diubah.</p>
            <div class="btn-row">
              <button class="btn btn-primary" type="submit">Simpan</button>
              <button class="btn" type="button" data-close="editModal">Batal</button>
            </div>
          </form>
        </div>
      </div>`;
    res.send(page(req, `${sec.label}`, sec.active, body));
    };
  }
  app.get('/inventaris', requireAuth, inventarisPage('sarana'));
  app.get('/inventaris/sarana', requireAuth, inventarisPage('sarana'));
  app.get('/inventaris/prasarana', requireAuth, inventarisPage('prasarana'));

  app.post('/inventaris', requireAuth, upload.single('gambar'), checkCsrf, (req, res) => {
    const nama = s(req.body.nama);
    const jenis = SECTIONS[req.body.jenis] ? req.body.jenis : 'sarana';
    if (!nama) return res.redirect(invPath(jenis) + '?err=' + encodeURIComponent('Nama barang wajib diisi'));
    const status = req.body.status === 'nonready' ? 'nonready' : 'ready';
    db.prepare('INSERT INTO items (nama, kategori, status, keterangan, gambar, jenis, stok, created_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(nama, s(req.body.kategori) || 'Lainnya', status, s(req.body.keterangan) || null,
           req.file?.filename || null, jenis, jenis === 'sarana' ? stokOf(req.body.stok) : 1, now());
    logActivity('tambah', `Menambah barang: ${nama}`, null, req.user.id);
    res.redirect(invPath(jenis) + '?ok=' + encodeURIComponent('Barang ditambahkan'));
  });

  app.post('/inventaris/:id', requireAuth, upload.single('gambar'), checkCsrf, (req, res) => {
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(+req.params.id);
    if (!item) return res.redirect('/inventaris?err=' + encodeURIComponent('Barang tidak ditemukan'));
    const back = invPath(item.jenis);
    const fail = (m) => res.redirect(back + '?err=' + encodeURIComponent(m));
    const nama = s(req.body.nama);
    if (!nama) return fail('Nama barang wajib diisi');

    let gambar = item.gambar;
    if (req.file) { removeUpload(item.gambar); gambar = req.file.filename; }
    else if (req.body.hapusGambar === '1') { removeUpload(item.gambar); gambar = null; }

    // Status barang yang sedang dipinjam tidak boleh diubah manual
    const dipinjam = db.prepare('SELECT 1 FROM loans WHERE item_id = ? AND tgl_dikembalikan IS NULL').get(item.id);
    const status = dipinjam ? item.status : (req.body.status === 'nonready' ? 'nonready' : 'ready');

    const jenis = SECTIONS[req.body.jenis] ? req.body.jenis : item.jenis;
    const stok = jenis === 'sarana' ? stokOf(req.body.stok ?? item.stok) : 1;
    db.prepare('UPDATE items SET nama = ?, kategori = ?, status = ?, keterangan = ?, gambar = ?, jenis = ?, stok = ? WHERE id = ?')
      .run(nama, s(req.body.kategori) || 'Lainnya', status, s(req.body.keterangan) || null, gambar, jenis, stok, item.id);
    logActivity('update', `Mengubah barang: ${nama}`, null, req.user.id);
    res.redirect(invPath(jenis) + '?ok=' + encodeURIComponent('Barang diperbarui'));
  });

  app.post('/inventaris/:id/status', requireAuth, checkCsrf, (req, res) => {
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(+req.params.id);
    if (!item) return res.redirect('/inventaris?err=' + encodeURIComponent('Barang tidak ditemukan'));
    const aktif = db.prepare('SELECT 1 FROM loans WHERE item_id = ? AND tgl_dikembalikan IS NULL').get(item.id);
    if (aktif) return res.redirect('/inventaris?err=' + encodeURIComponent('Barang sedang dipinjam'));
    const next = item.status === 'ready' ? 'nonready' : 'ready';
    db.prepare('UPDATE items SET status = ? WHERE id = ?').run(next, item.id);
    logActivity('update', `Status ${item.nama} → ${next}`, null, req.user.id);
    res.redirect(invPath(item.jenis) + '?ok=' + encodeURIComponent('Status diperbarui'));
  });

  app.post('/inventaris/:id/hapus', requireAuth, checkCsrf, (req, res) => {
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(+req.params.id);
    if (item) {
      removeUpload(item.gambar);
      db.prepare('DELETE FROM items WHERE id = ?').run(item.id);
      logActivity('hapus', `Menghapus barang: ${item.nama}`, null, req.user.id);
    }
    res.redirect(invPath(item?.jenis) + '?ok=' + encodeURIComponent('Barang dihapus'));
  });

  // ── Detail barang + QR ──
  app.get('/barang/:id', requireAuth, (req, res) => {
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(+req.params.id);
    if (!item) return res.status(404).send('Barang tidak ditemukan');
    const loans = db.prepare('SELECT * FROM loans WHERE item_id = ? ORDER BY id DESC').all(item.id);
    const active = loans.find(l => !l.tgl_dikembalikan);
    const status = active ? 'dipinjam' : item.status;
    const pill = status === 'ready' ? 'pill-green' : status === 'dipinjam' ? 'pill-orange' : 'pill-gray';
    const rate = Number(getSettings().dendaPerHari || 0);
    const hist = loans.map(l => {
      const st = loanStatus(l);
      const pc = st === 'selesai' ? 'pill-gray' : st === 'terlambat' ? 'pill-red' : 'pill-orange';
      return `<tr><td>${esc(l.peminjam)}</td><td>${fmtDate(l.tgl_pinjam)} → ${fmtDate(l.tgl_kembali)}</td>
        <td><span class="pill ${pc}">${st}</span></td>
        <td>${(l.denda || 0) > 0 ? `Rp ${l.denda.toLocaleString('id-ID')}` : '—'}</td></tr>`;
    }).join('');
    const body = `
      <div class="grid-2">
        <div class="card qr-card">
          <h3>${esc(item.nama)}</h3>
          <div class="muted">${esc(item.kategori)}</div>
          <img class="qrimg" src="/inventaris/${item.id}/qr.svg" alt="QR ${attr(item.nama)}">
          <p class="muted">Scan untuk membuka halaman ini.</p>
          <a class="btn btn-outline" href="/inventaris/${item.id}/qr.svg" download="qr-${item.id}.svg">${icon('download', 15)} Unduh QR</a>
        </div>
        <div class="card">
          <h3>Informasi</h3>
          <p>Status: <span class="pill ${pill}">${status}</span></p>
          <p>Jenis: <b>${esc(SECTIONS[item.jenis]?.sub || 'Sarana')}</b>${item.jenis === 'sarana' ? ` · Stok: <b>${item.stok ?? 1}</b> unit` : ''}</p>
          ${active ? `<p>Dipinjam oleh <b>${esc(active.peminjam)}</b> hingga ${fmtDate(active.tgl_kembali)}${lateDays(active) > 0 ? ` · <span class="text-red">terlambat ${lateDays(active)} hari (Rp ${fine(active, rate).toLocaleString('id-ID')})</span>` : ''}</p>` : ''}
          <p class="muted">${esc(item.keterangan || 'Tanpa keterangan')}</p>
          <a class="btn" href="${invPath(item.jenis)}">← Kembali ke Inventaris ${esc(SECTIONS[item.jenis]?.sub || 'Sarana')}</a>
        </div>
      </div>
      <div class="card"><h3>Riwayat Peminjaman</h3>
        <table class="table"><thead><tr><th>Peminjam</th><th>Periode</th><th>Status</th><th>Denda</th></tr></thead>
        <tbody>${hist || `<tr><td colspan="4" class="muted">Belum ada riwayat</td></tr>`}</tbody></table>
      </div>`;
    res.send(page(req, 'Barang', invPath(item.jenis), body));
  });

  app.get('/inventaris/:id/qr.svg', requireAuth, async (req, res) => {
    const item = db.prepare('SELECT id FROM items WHERE id = ?').get(+req.params.id);
    if (!item) return res.status(404).end();
    const base = `${req.protocol}://${req.get('host')}`;
    const svg = await QRCode.toString(`${base}/barang/${item.id}`, { type: 'svg', margin: 1, width: 240 });
    res.type('image/svg+xml').send(svg);
  });

  // ── Peminjaman ──
  app.get('/peminjaman', requireAuth, (req, res) => {
    const items = db.prepare('SELECT * FROM items').all();
    const loans = db.prepare('SELECT * FROM loans ORDER BY id DESC').all();
    const byId = Object.fromEntries(items.map(i => [i.id, i]));
    const available = getInvStatus(items, loans).filter(i => i.status !== 'dipinjam');

    const rate = Number(getSettings().dendaPerHari || 0);
    const rows = loans.map(p => {
      const st = loanStatus(p);
      const pill = st === 'selesai' ? 'pill-gray' : st === 'terlambat' ? 'pill-red' : 'pill-orange';
      const b = byId[p.item_id];
      const denda = p.tgl_dikembalikan ? (p.denda || 0) : fine(p, rate);
      const dendaCell = denda > 0 ? `<span class="text-red">Rp ${denda.toLocaleString('id-ID')}</span>${lateDays(p) ? `<div class="muted">${lateDays(p)} hari</div>` : ''}` : '<span class="muted">—</span>';
      return `<tr>
        <td><b>${esc(p.peminjam)}</b><div class="muted">${esc(p.kontak || '—')}</div></td>
        <td>${b ? esc(b.nama) : '(dihapus)'}</td>
        <td>${fmtDate(p.tgl_pinjam)} → ${fmtDate(p.tgl_kembali)}</td>
        <td><span class="pill ${pill}">${st}</span></td>
        <td>${dendaCell}</td>
        <td class="actions">${st !== 'selesai'
          ? `<form method="post" action="/peminjaman/${p.id}/kembali"><input type="hidden" name="_csrf" value="${attr(req.csrf)}"><button class="btn btn-mini btn-primary">Kembalikan</button></form>`
          : `<span class="muted">${fmtDate(p.tgl_dikembalikan)}</span>`}</td>
      </tr>`;
    }).join('');

    const body = `
      <div class="card">
        <h3>Buat Peminjaman</h3>
        <form class="form-inline" method="post" action="/peminjaman">
          <input type="hidden" name="_csrf" value="${attr(req.csrf)}">
          <select name="item_id" required><option value="">— Pilih barang —</option>
            ${available.map(i => `<option value="${i.id}">${esc(i.nama)} (${esc(i.kategori)})</option>`).join('')}
          </select>
          <input name="peminjam" placeholder="Nama peminjam" required>
          <input name="kontak" placeholder="Kontak (opsional)">
          <label class="inline-label">Pinjam<input type="date" name="tgl_pinjam" value="${todayISO()}" required></label>
          <label class="inline-label">Kembali<input type="date" name="tgl_kembali" value="${plusDays(7)}" required></label>
          <input name="catatan" placeholder="Catatan (opsional)">
          <button class="btn btn-primary" type="submit">Simpan</button>
        </form>
      </div>
      <div class="card">
        <h3>Daftar Peminjaman <span class="muted">(${loans.length})</span></h3>
        <table class="table">
          <thead><tr><th>Peminjam</th><th>Barang</th><th>Periode</th><th>Status</th><th>Denda</th><th>Aksi</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="6" class="muted">Belum ada peminjaman</td></tr>`}</tbody>
        </table>
      </div>`;
    res.send(page(req, 'Peminjaman', '/peminjaman', body));
  });

  app.post('/peminjaman', requireAuth, checkCsrf, (req, res) => {
    const itemId = +req.body.item_id;
    const peminjam = s(req.body.peminjam);
    const tglP = s(req.body.tgl_pinjam);
    const tglK = s(req.body.tgl_kembali);
    const fail = (m) => res.redirect('/peminjaman?err=' + encodeURIComponent(m));
    if (!peminjam) return fail('Nama peminjam wajib diisi');
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(itemId);
    if (!item) return fail('Barang tidak ditemukan');
    if (!tglP || !tglK || tglK < tglP) return fail('Tanggal tidak valid');
    // Sumber kebenaran: cek pinjaman aktif di server (bukan hanya UI)
    const aktif = db.prepare('SELECT 1 FROM loans WHERE item_id = ? AND tgl_dikembalikan IS NULL').get(itemId);
    if (aktif) return fail('Barang sedang dipinjam');
    if (item.status === 'nonready') return fail('Barang non-ready tidak bisa dipinjam');
    db.prepare('INSERT INTO loans (item_id, peminjam, kontak, tgl_pinjam, tgl_kembali, catatan, created_at) VALUES (?,?,?,?,?,?,?)')
      .run(itemId, peminjam, s(req.body.kontak) || null, tglP, tglK, s(req.body.catatan) || null, now());
    db.prepare("UPDATE items SET status = 'dipinjam' WHERE id = ?").run(itemId);
    logActivity('pinjam', `${peminjam} meminjam ${item.nama}`, null, req.user.id);
    notify('pinjam', s(req.body.kontak), `Peminjaman dicatat: ${peminjam} meminjam ${item.nama} hingga ${tglK}.`);
    res.redirect('/peminjaman?ok=' + encodeURIComponent('Peminjaman dicatat'));
  });

  app.post('/peminjaman/:id/kembali', requireAuth, checkCsrf, (req, res) => {
    const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(+req.params.id);
    if (!loan || loan.tgl_dikembalikan) return res.redirect('/peminjaman?err=' + encodeURIComponent('Data tidak ditemukan'));
    const denda = fine(loan, Number(getSettings().dendaPerHari || 0));
    db.prepare('UPDATE loans SET tgl_dikembalikan = ?, denda = ? WHERE id = ?').run(todayISO(), denda, loan.id);
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(loan.item_id);
    if (item && item.status === 'dipinjam') db.prepare("UPDATE items SET status = 'ready' WHERE id = ?").run(item.id);
    logActivity('kembali', `${loan.peminjam} mengembalikan ${item ? item.nama : ''}`, null, req.user.id);
    notify('kembali', loan.kontak, denda > 0
      ? `${loan.peminjam} mengembalikan ${item ? item.nama : ''} dengan denda Rp ${denda.toLocaleString('id-ID')}.`
      : `${loan.peminjam} mengembalikan ${item ? item.nama : ''} tepat waktu.`);
    res.redirect('/peminjaman?ok=' + encodeURIComponent(denda > 0 ? `Barang dikembalikan (denda Rp ${denda.toLocaleString('id-ID')})` : 'Barang dikembalikan'));
  });

  app.get('/peminjaman/:id', requireAuth, (req, res) => {
    const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(+req.params.id);
    if (!loan) return res.status(404).json({ error: 'not found' });
    res.json({ ...loan, status: loanStatus(loan) });
  });

  // ── Riwayat ──
  app.get('/riwayat', requireAuth, (req, res) => {
    const rows = db.prepare('SELECT * FROM activity ORDER BY id DESC LIMIT 200').all();
    const icons = { pinjam: 'list', kembali: 'check', tambah: 'plus', hapus: 'trash', update: 'settings', login: 'shield' };
    const body = `
      <div class="card">
        <h3>Riwayat Aktivitas</h3>
        <ul class="timeline">
          ${rows.length ? rows.map(r => `<li><span class="tl-icon">${icon(icons[r.tipe] || 'clock', 15)}</span>
            <div><div>${esc(r.teks)}</div><div class="tl-time">${fmtDateTime(r.created_at)}</div></div></li>`).join('')
            : '<li class="muted">Belum ada aktivitas</li>'}
        </ul>
      </div>`;
    const notifs = db.prepare('SELECT * FROM notifications ORDER BY id DESC LIMIT 50').all();
    const notifCard = `
      <div class="card">
        <h3>Log Notifikasi</h3>
        <table class="table">
          <thead><tr><th>Waktu</th><th>Tipe</th><th>Pesan</th><th>Status</th></tr></thead>
          <tbody>${notifs.length ? notifs.map(n => `<tr><td class="muted">${fmtDateTime(n.created_at)}</td><td><span class="pill pill-gray">${esc(n.tipe)}</span></td><td>${esc(n.pesan)}</td><td>${esc(n.status)}</td></tr>`).join('') : `<tr><td colspan="4" class="muted">Belum ada notifikasi</td></tr>`}</tbody>
        </table>
      </div>`;
    res.send(page(req, 'Riwayat', '/riwayat', body + notifCard));
  });

  // ── Pengaturan ──
  app.get('/pengaturan', requireAuth, (req, res) => {
    const st = getSettings();
    const body = `
      <div class="grid-2">
        <div class="card">
          <h3>Umum & Denda</h3>
          <form method="post" action="/pengaturan" class="form-stack">
            <input type="hidden" name="_csrf" value="${attr(req.csrf)}">
            <label>Nama Organisasi<input name="orgName" value="${attr(st.orgName)}" required></label>
            <label>Tema<select name="theme"><option value="dark"${st.theme === 'dark' ? ' selected' : ''}>Dark</option><option value="light"${st.theme === 'light' ? ' selected' : ''}>Light</option></select></label>
            <label>Denda per hari (Rp)<input name="dendaPerHari" type="number" min="0" value="${attr(st.dendaPerHari || '0')}"></label>
            <button class="btn btn-primary" type="submit">Simpan</button>
          </form>
        </div>
        <div class="card">
          <h3>Keamanan</h3>
          <form method="post" action="/pengaturan/password" class="form-stack">
            <input type="hidden" name="_csrf" value="${attr(req.csrf)}">
            <label>Kata sandi lama<input type="password" name="old" required></label>
            <label>Kata sandi baru (min 6)<input type="password" name="baru" required minlength="6"></label>
            <button class="btn btn-primary" type="submit">Ubah Sandi</button>
          </form>
        </div>
      </div>
      <div class="card">
        <h3>Export &amp; Restore</h3>
        <div class="btn-row export-row">
          <a class="btn btn-outline" href="/export/inventaris.csv">${icon('download', 15)} Inventaris (CSV)</a>
          <a class="btn btn-outline" href="/export/peminjaman.csv">${icon('download', 15)} Peminjaman (CSV)</a>
          <a class="btn btn-outline" href="/export/backup.json">${icon('download', 15)} Backup (JSON)</a>
        </div>
        <form method="post" action="/pengaturan/import" enctype="multipart/form-data" class="form-stack js-confirm" data-confirm="Pulihkan backup? SEMUA data inventaris, peminjaman, dan riwayat saat ini akan DIGANTI.">
          <input type="hidden" name="_csrf" value="${attr(req.csrf)}">
          <label>Pulihkan dari file backup (JSON)<input type="file" name="backup" accept="application/json,.json" required></label>
          <div class="warn-box">Restore <b>mengganti seluruh data</b> inventaris, peminjaman, dan riwayat dengan isi file. Akun pengguna tidak diubah.</div>
          <button class="btn btn-danger" type="submit">${icon('upload', 15)} Pulihkan Backup</button>
        </form>
      </div>
      <div class="card">
        <h3>Notifikasi</h3>
        <form method="post" action="/pengaturan/notifikasi" class="form-stack">
          <input type="hidden" name="_csrf" value="${attr(req.csrf)}">
          <label>Status<select name="notifyEnabled"><option value="0"${st.notifyEnabled !== '1' ? ' selected' : ''}>Nonaktif (hanya catat log)</option><option value="1"${st.notifyEnabled === '1' ? ' selected' : ''}>Aktif (kirim ke webhook)</option></select></label>
          <label>Webhook URL (gateway WhatsApp/email)<input name="notifyWebhook" value="${attr(st.notifyWebhook || '')}" placeholder="https://gateway.example/send"></label>
          <p class="muted">Sistem mengirim POST JSON <code>{tipe,target,pesan}</code> ke URL ini — mis. Fonnte/WABLAS untuk WhatsApp, atau gateway email.</p>
          <button class="btn btn-primary" type="submit">Simpan</button>
        </form>
      </div>`;
    res.send(page(req, 'Pengaturan', '/pengaturan', body));
  });

  app.post('/pengaturan', requireAuth, checkCsrf, (req, res) => {
    setSetting('orgName', s(req.body.orgName) || 'SISPRALA');
    setSetting('theme', req.body.theme === 'light' ? 'light' : 'dark');
    setSetting('dendaPerHari', String(Math.max(0, parseInt(req.body.dendaPerHari, 10) || 0)));
    res.redirect('/pengaturan?ok=' + encodeURIComponent('Pengaturan disimpan'));
  });

  app.post('/pengaturan/notifikasi', requireAuth, checkCsrf, (req, res) => {
    const url = s(req.body.notifyWebhook);
    if (url && !/^https?:\/\//i.test(url))
      return res.redirect('/pengaturan?err=' + encodeURIComponent('URL webhook harus http(s)://'));
    setSetting('notifyEnabled', req.body.notifyEnabled === '1' ? '1' : '0');
    setSetting('notifyWebhook', url);
    res.redirect('/pengaturan?ok=' + encodeURIComponent('Pengaturan notifikasi disimpan'));
  });

  // ── Restore backup (mengganti seluruh data) ──
  app.post('/pengaturan/import', requireAuth, uploadJson.single('backup'), checkCsrf, (req, res) => {
    const fail = (m) => res.redirect('/pengaturan?err=' + encodeURIComponent(m));
    if (!req.file) return fail('File backup tidak ditemukan');
    let data;
    try { data = JSON.parse(req.file.buffer.toString('utf8')); }
    catch { return fail('File bukan JSON yang valid'); }
    const items = Array.isArray(data.items) ? data.items : null;
    const loans = Array.isArray(data.loans) ? data.loans : null;
    if (!items || !loans) return fail('Struktur backup tidak dikenali (butuh items & loans)');
    const okSet = (data.settings && typeof data.settings === 'object') ? data.settings : {};

    try {
      db.transaction(() => {
        db.prepare('DELETE FROM activity').run();
        db.prepare('DELETE FROM loans').run();
        db.prepare('DELETE FROM items').run();

        const insItem = db.prepare('INSERT INTO items (id, nama, kategori, status, keterangan, gambar, jenis, stok, created_at) VALUES (?,?,?,?,?,?,?,?,?)');
        for (const it of items) insItem.run(+it.id, s(it.nama) || 'Tanpa nama', s(it.kategori) || 'Lainnya',
          ['ready', 'dipinjam', 'nonready'].includes(it.status) ? it.status : 'ready',
          it.keterangan ?? null, it.gambar ?? null,
          it.jenis === 'prasarana' ? 'prasarana' : 'sarana', stokOf(it.stok), it.created_at || now());

        const insLoan = db.prepare('INSERT INTO loans (id, item_id, peminjam, kontak, tgl_pinjam, tgl_kembali, tgl_dikembalikan, status, catatan, created_at, denda, late_notified_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
        for (const l of loans) insLoan.run(+l.id, +l.item_id, s(l.peminjam) || '-', l.kontak ?? null,
          l.tgl_pinjam, l.tgl_kembali, l.tgl_dikembalikan ?? null, l.status || 'aktif', l.catatan ?? null,
          l.created_at || now(), +(l.denda || 0), l.late_notified_at ?? null);

        const insAct = db.prepare('INSERT INTO activity (tipe, teks, meta, user_id, created_at) VALUES (?,?,?,?,?)');
        if (Array.isArray(data.activity)) for (const a of data.activity.slice(0, 500))
          insAct.run(s(a.tipe) || 'info', s(a.teks) || '-', a.meta ?? null, a.user_id ?? null, a.created_at || now());

        for (const k of ['orgName', 'theme', 'dendaPerHari'])
          if (k in okSet && okSet[k] != null) setSetting(k, String(okSet[k]));
      })();
    } catch (e) {
      return fail('Gagal memulihkan: ' + e.message);
    }

    logActivity('restore', `Memulihkan backup (${items.length} barang, ${loans.length} peminjaman)`, null, req.user.id);
    res.redirect('/pengaturan?ok=' + encodeURIComponent('Backup dipulihkan'));
  });

  app.post('/pengaturan/password', requireAuth, checkCsrf, (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!verifyPassword(s(req.body.old), user.password_hash))
      return res.redirect('/pengaturan?err=' + encodeURIComponent('Kata sandi lama salah'));
    if (s(req.body.baru).length < 6)
      return res.redirect('/pengaturan?err=' + encodeURIComponent('Kata sandi minimal 6 karakter'));
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(s(req.body.baru)), user.id);
    logActivity('update', `${user.username} mengubah kata sandi`, null, user.id);
    res.redirect('/pengaturan?ok=' + encodeURIComponent('Kata sandi diubah'));
  });

  // ── Export ──
  const sendCsv = (res, name, csv) => {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.send(csv);
  };
  app.get('/export/inventaris.csv', requireAuth, (req, res) => {
    const items = getInvStatus(db.prepare('SELECT * FROM items').all(), db.prepare('SELECT * FROM loans').all());
    sendCsv(res, 'inventaris.csv', toCsv(['ID', 'Nama', 'Jenis', 'Kategori', 'Stok', 'Status', 'Keterangan'],
      items.map(b => [b.id, b.nama, SECTIONS[b.jenis]?.sub || 'Sarana', b.kategori, b.jenis === 'sarana' ? (b.stok ?? 1) : '', b.status, b.keterangan || ''])));
  });
  app.get('/export/peminjaman.csv', requireAuth, (req, res) => {
    const byId = Object.fromEntries(db.prepare('SELECT * FROM items').all().map(i => [i.id, i]));
    const loans = db.prepare('SELECT * FROM loans ORDER BY id').all();
    sendCsv(res, 'peminjaman.csv', toCsv(['ID', 'Peminjam', 'Kontak', 'Barang', 'Tgl Pinjam', 'Batas Kembali', 'Tgl Dikembalikan', 'Status', 'Catatan'],
      loans.map(p => [p.id, p.peminjam, p.kontak || '', byId[p.item_id]?.nama || '(dihapus)', p.tgl_pinjam, p.tgl_kembali, p.tgl_dikembalikan || '', loanStatus(p), p.catatan || ''])));
  });
  app.get('/export/backup.json', requireAuth, (req, res) => {
    res.setHeader('Content-Disposition', 'attachment; filename="pinjamz-backup.json"');
    res.json({
      items: db.prepare('SELECT * FROM items').all(),
      loans: db.prepare('SELECT * FROM loans').all(),
      activity: db.prepare('SELECT * FROM activity ORDER BY id').all(),
      settings: getSettings(),
    });
  });

  // ── API ──
  app.get('/api/stats', requireAuth, (req, res) => {
    const items = db.prepare('SELECT * FROM items').all();
    const loans = db.prepare('SELECT * FROM loans').all();
    res.json({ total: items.length, ...countBy(getInvStatus(items, loans)) });
  });
}

const CATEGORIES = ['Kamera', 'Audio', 'Lighting', 'Komputer', 'Elektronik', 'Peralatan',
  'Buku', 'Alat Tulis', 'Furnitur', 'Olahraga', 'Pakaian', 'Lainnya'];

// Hitung status efektif tiap barang berdasarkan pinjaman aktif
function getInvStatus(items, loans) {
  const aktifItems = new Set(loans.filter(l => l.tgl_dikembalikan === null).map(l => l.item_id));
  return items.map(b => ({ ...b, status: aktifItems.has(b.id) ? 'dipinjam' : b.status }));
}
function countBy(inv) {
  const c = { ready: 0, dipinjam: 0, nonready: 0 };
  for (const b of inv) c[b.status] = (c[b.status] || 0) + 1;
  return c;
}
