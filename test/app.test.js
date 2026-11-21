// test/app.test.js — verifikasi end-to-end (node:test + fetch, tanpa dep tambahan)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlinkSync } from 'node:fs';

const dbPath = join(tmpdir(), `pinzup-test-${Date.now()}.db`);
process.env.DB_PATH = dbPath;
process.env.NO_LISTEN = '1'; // server.js tidak listen sendiri; test pakai port acak

const { app } = await import('../server.js');
const { toCsv } = await import('../src/csv.js');

let server, base;
const jar = {}; // name -> value
// tanggal relatif, biar test nggak jadi bom waktu saat lewat tengah malam
const dayOffset = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const cookieHeader = () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');

function remember(res) {
  const raw = res.headers.getSetCookie?.() || [];
  for (const c of raw) {
    const [pair] = c.split(';');
    const i = pair.indexOf('=');
    jar[pair.slice(0, i).trim()] = pair.slice(i + 1).trim();
  }
}
async function req(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (Object.keys(jar).length) headers.cookie = cookieHeader();
  const res = await fetch(base + path, { ...opts, headers, redirect: 'manual' });
  remember(res);
  return res;
}

before(async () => {
  server = app.listen(0);
  await new Promise(r => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  server.close();
  for (const ext of ['', '-wal', '-shm']) { try { unlinkSync(dbPath + ext); } catch {} }
});

test('redirect ke /login bila belum terautentikasi', async () => {
  const res = await req('/dashboard');
  assert.equal(res.status, 302);
  assert.match(res.headers.get('location'), /\/login/);
});

test('header keamanan terpasang', async () => {
  const res = await req('/login');
  assert.match(res.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.match(res.headers.get('strict-transport-security'), /includeSubDomains/);
});

test('login salah ditolak', async () => {
  const g = await req('/login');
  const csrf = jar.csrf;
  assert.ok(csrf && g.status === 200);
  const body = new URLSearchParams({ username: 'admin', password: 'salah', _csrf: csrf });
  const res = await req('/login', { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  assert.equal(res.status, 302);
  assert.match(decodeURIComponent(res.headers.get('location')), /salah/i);
});

test('halaman login tidak membocorkan sandi default', async () => {
  const res = await req('/login');
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /name="password"/, 'harus halaman form login, bukan redirect');
  assert.doesNotMatch(html, /admin123/);
});

test('login benar berhasil & dapat sesi', async () => {
  const csrf = jar.csrf;
  const body = new URLSearchParams({ username: 'admin', password: 'admin123', _csrf: csrf });
  const res = await req('/login', { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/dashboard');
  assert.ok(jar.sid, 'cookie sesi harus diset');
});

async function sessionCsrf() {
  const res = await req('/inventaris');
  const html = await res.text();
  return html.match(/name="_csrf" value="([a-f0-9]+)"/)[1];
}

test('dashboard bisa diakses setelah login', async () => {
  const res = await req('/dashboard');
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Total Barang/);
});

test('CSRF wajib pada POST', async () => {
  const res = await req('/inventaris', {
    method: 'POST',
    body: new URLSearchParams({ nama: 'Tanpa CSRF' }),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  });
  assert.equal(res.status, 403);
});

test('tambah barang + XSS ter-escape di output', async () => {
  const csrf = await sessionCsrf();
  const fd = new FormData();
  fd.set('_csrf', csrf);
  fd.set('nama', '<script>alert(1)</script> Alat');
  fd.set('kategori', 'Komputer');
  fd.set('status', 'ready');
  const res = await req('/inventaris', { method: 'POST', body: fd });
  assert.equal(res.status, 302);

  const html = await (await req('/inventaris')).text();
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'nama harus ter-escape');
  assert.ok(!html.includes('<script>alert(1)</script>'), 'tidak boleh ada tag script mentah');
});

test('alur peminjaman: pinjam lalu kembalikan', async () => {
  const csrf = await sessionCsrf();
  // ambil id barang pertama (tombol Edit selalu ada, Hapus tidak dirender saat dipinjam)
  const inv = await (await req('/inventaris')).text();
  const itemId = inv.match(/data-id="(\d+)"/)[1];

  const body = new URLSearchParams({ _csrf: csrf, item_id: itemId, peminjam: 'Budi',
    tgl_pinjam: dayOffset(0), tgl_kembali: dayOffset(7) });
  const r1 = await req('/peminjaman', { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  assert.equal(r1.status, 302);

  // barang harus berstatus dipinjam
  const detail = await (await req(`/peminjaman/1`)).json();
  assert.equal(detail.status, 'aktif');
  assert.equal(detail.peminjam, 'Budi');

  // tidak boleh meminjam barang yang sama dua kali
  const r2 = await req('/peminjaman', { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  assert.match(decodeURIComponent(r2.headers.get('location')), /sedang dipinjam/);

  // kembalikan
  const r3 = await req('/peminjaman/1/kembali', { method: 'POST',
    body: new URLSearchParams({ _csrf: csrf }), headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  assert.equal(r3.status, 302);
  const after = await (await req('/peminjaman/1')).json();
  assert.equal(after.status, 'selesai');
});

test('CSV export netralkan formula injection', async () => {
  const csrf = await sessionCsrf();
  const fd = new FormData();
  fd.set('_csrf', csrf);
  fd.set('nama', '=HYPERLINK("http://evil","x")');
  fd.set('kategori', 'Lainnya');
  fd.set('status', 'ready');
  await req('/inventaris', { method: 'POST', body: fd });

  const csv = await (await req('/export/inventaris.csv')).text();
  assert.ok(csv.includes(`"'=HYPERLINK`), 'sel berbahaya harus diawali apostrof');
  assert.ok(!/,=HYPERLINK/.test(csv), 'tidak boleh ada sel mulai dengan = mentah');
});

test('unit: toCsv mengutip & menetralkan', () => {
  const out = toCsv(['A', 'B'], [['+1', 'a"b']]);
  assert.ok(out.includes(`'+1`));
  assert.ok(out.includes(`"a""b"`));
});

test('QR barang menghasilkan SVG', async () => {
  const inv = await (await req('/inventaris')).text();
  const id = inv.match(/\/barang\/(\d+)/)[1];
  const res = await req(`/inventaris/${id}/qr.svg`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /image\/svg\+xml/);
  assert.match(await res.text(), /<svg/);
});

test('halaman detail barang + unduh QR tampil', async () => {
  const res = await req('/barang/1');
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /Riwayat Peminjaman/);
  assert.match(html, /qr\.svg/);
});

test('denda otomatis + notifikasi keterlambatan', async () => {
  const csrf = await sessionCsrf();
  const inv = await (await req('/inventaris')).text();
  const itemId = inv.match(/data-id="(\d+)"/)[1];
  const body = new URLSearchParams({ _csrf: csrf, item_id: itemId, peminjam: 'Budi',
    tgl_pinjam: '2026-01-01', tgl_kembali: '2026-01-10' }); // tenggat sudah lewat
  await req('/peminjaman', { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded' } });

  const html = await (await req('/peminjaman')).text();
  assert.match(html, /pill-red/);
  assert.match(html, /Rp /);

  await req('/dashboard'); // memicu notifikasi keterlambatan
  const riw = await (await req('/riwayat')).text();
  assert.match(riw, /Log Notifikasi/);
  assert.match(riw, /terlambat/);
});

test('pengaturan: simpan denda + tolak webhook URL tidak valid', async () => {
  const csrf = await sessionCsrf();
  const ok = await req('/pengaturan', { method: 'POST',
    body: new URLSearchParams({ _csrf: csrf, orgName: 'Perpus', theme: 'dark', dendaPerHari: '2000' }),
    headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  assert.equal(ok.status, 302);

  const bad = await req('/pengaturan/notifikasi', { method: 'POST',
    body: new URLSearchParams({ _csrf: csrf, notifyEnabled: '1', notifyWebhook: 'ftp://x' }),
    headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  assert.equal(bad.status, 302);
  assert.match(decodeURIComponent(bad.headers.get('location')), /http\(s\)/);
});

test('mobile nav: tombol menu & backdrop tersedia', async () => {
  const html = await (await req('/dashboard')).text();
  assert.match(html, /id="menuBtn"/);
  assert.match(html, /id="navBackdrop"/);
  assert.match(html, /id="sidebar"/);
});

test('edit barang memperbarui data (update)', async () => {
  const csrf = await sessionCsrf();
  const uniq = 'EditTarget' + Date.now();
  const mk = new FormData();
  mk.set('_csrf', csrf); mk.set('nama', uniq); mk.set('kategori', 'Kamera'); mk.set('status', 'ready');
  await req('/inventaris', { method: 'POST', body: mk });

  const html = await (await req('/inventaris')).text();
  const id = html.match(new RegExp('data-id="(\\d+)" data-nama="' + uniq + '"'))[1];

  const ed = new FormData();
  ed.set('_csrf', csrf); ed.set('nama', uniq + ' DIUBAH'); ed.set('kategori', 'Audio');
  ed.set('status', 'nonready'); ed.set('keterangan', 'keterangan baru');
  const res = await req('/inventaris/' + id, { method: 'POST', body: ed });
  assert.equal(res.status, 302);

  const after = await (await req('/inventaris')).text();
  assert.match(after, new RegExp(uniq + ' DIUBAH'));
  assert.match(after, /keterangan baru/);
  assert.match(after, /Non-Ready/);
});

test('restore backup mengganti seluruh data', async () => {
  const backup = await (await req('/export/backup.json')).json();
  assert.ok(Array.isArray(backup.items) && Array.isArray(backup.loans));

  const csrf = await sessionCsrf();
  const mk = new FormData();
  mk.set('_csrf', csrf); mk.set('nama', 'DataSampah'); mk.set('kategori', 'Lainnya'); mk.set('status', 'ready');
  await req('/inventaris', { method: 'POST', body: mk });
  assert.match(await (await req('/inventaris')).text(), /DataSampah/);

  const imp = new FormData();
  imp.set('_csrf', csrf);
  imp.set('backup', new Blob([JSON.stringify(backup)], { type: 'application/json' }), 'backup.json');
  const res = await req('/pengaturan/import', { method: 'POST', body: imp });
  assert.equal(res.status, 302);

  const after = await (await req('/inventaris')).text();
  assert.ok(!after.includes('DataSampah'), 'data setelah restore harus tergantikan');
});

test('restore menolak file yang bukan JSON valid', async () => {
  const csrf = await sessionCsrf();
  const imp = new FormData();
  imp.set('_csrf', csrf);
  imp.set('backup', new Blob(['bukan json'], { type: 'application/json' }), 'x.json');
  const res = await req('/pengaturan/import', { method: 'POST', body: imp });
  assert.equal(res.status, 302);
  assert.match(decodeURIComponent(res.headers.get('location')), /bukan JSON/i);
});

// ── Pemisahan Inventaris: Sarana (berstok) & Prasarana ──
test('navigasi punya dua bagian inventaris', async () => {
  const html = await (await req('/inventaris/sarana')).text();
  assert.ok(html.includes('href="/inventaris/sarana"'), 'link Sarana harus ada di nav');
  assert.ok(html.includes('href="/inventaris/prasarana"'), 'link Prasarana harus ada di nav');
  assert.equal((await req('/inventaris/prasarana')).status, 200);
});

test('sarana punya stok, prasarana tidak, tiap bagian tersaring', async () => {
  const csrf = await sessionCsrf();
  const mk = (nama, jenis, stok) => {
    const fd = new FormData();
    fd.set('_csrf', csrf); fd.set('nama', nama); fd.set('kategori', 'Lainnya');
    fd.set('status', 'ready'); fd.set('jenis', jenis);
    if (stok != null) fd.set('stok', String(stok));
    return req('/inventaris', { method: 'POST', body: fd });
  };
  assert.equal((await mk('Proyektor Uji', 'sarana', 7)).status, 302);
  assert.equal((await mk('Gedung Uji', 'prasarana')).status, 302);

  const sarana = await (await req('/inventaris/sarana')).text();
  const prasarana = await (await req('/inventaris/prasarana')).text();
  assert.match(sarana, /Proyektor Uji/);
  assert.ok(sarana.includes('<th>Stok</th>'), 'sarana harus punya kolom stok');
  assert.ok(sarana.includes('data-stok="7"'), 'stok 7 harus tersimpan');
  assert.ok(!sarana.includes('Gedung Uji'), 'prasarana tidak boleh tampil di sarana');
  assert.ok(prasarana.includes('Gedung Uji') && !prasarana.includes('Proyektor Uji'), 'sarana tidak boleh tampil di prasarana');
  assert.ok(!prasarana.includes('<th>Stok</th>'), 'prasarana tidak punya kolom stok');
});

test('edit stok sarana tersimpan', async () => {
  const csrf = await sessionCsrf();
  const html = await (await req('/inventaris/sarana')).text();
  const id = html.match(/data-id="(\d+)"[^>]*data-stok="7"/)[1];
  const fd = new FormData();
  fd.set('_csrf', csrf); fd.set('nama', 'Proyektor Uji'); fd.set('kategori', 'Lainnya');
  fd.set('status', 'ready'); fd.set('jenis', 'sarana'); fd.set('stok', '12');
  assert.equal((await req(`/inventaris/${id}`, { method: 'POST', body: fd })).status, 302);
  const after = await (await req('/inventaris/sarana')).text();
  assert.ok(after.includes('data-stok="12"'), 'stok harus terupdate jadi 12');
  assert.ok(after.includes('<b>12</b>'), 'stok baru tampil di tabel');
});

// ── Hapus barang: riwayat pinjaman tidak boleh ikut musnah (loans.item_id ON DELETE CASCADE) ──
async function buatBarang(csrf, nama) {
  const fd = new FormData();
  fd.set('_csrf', csrf); fd.set('nama', nama); fd.set('kategori', 'Lainnya');
  fd.set('status', 'ready'); fd.set('jenis', 'sarana'); fd.set('stok', '1');
  assert.equal((await req('/inventaris', { method: 'POST', body: fd })).status, 302);
  const html = await (await req('/inventaris/sarana')).text();
  return html.match(new RegExp(`data-id="(\\d+)" data-nama="${nama}"`))[1];
}

test('barang yang sedang dipinjam tidak bisa dihapus', async () => {
  const csrf = await sessionCsrf();
  const id = await buatBarang(csrf, 'Barang Sedang Dipinjam');

  const pinjam = new URLSearchParams({ _csrf: csrf, item_id: id, peminjam: 'Peminjam Uji',
    tgl_pinjam: dayOffset(0), tgl_kembali: dayOffset(3) });
  assert.equal((await req('/peminjaman', { method: 'POST', body: pinjam,
    headers: { 'content-type': 'application/x-www-form-urlencoded' } })).status, 302);

  // tombol Hapus tidak dirender untuk barang yang sedang dipinjam
  const inv = await (await req('/inventaris/sarana')).text();
  assert.ok(!inv.includes(`/inventaris/${id}/hapus`), 'tombol Hapus harus disembunyikan saat dipinjam');

  const del = await req(`/inventaris/${id}/hapus`, { method: 'POST',
    body: new URLSearchParams({ _csrf: csrf }), headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  assert.equal(del.status, 302);
  assert.match(decodeURIComponent(del.headers.get('location')), /sedang dipinjam/);
  assert.ok((await (await req('/inventaris/sarana')).text()).includes('Barang Sedang Dipinjam'),
    'barang tidak boleh terhapus selagi dipinjam');
});

test('hapus barang beriwayat: riwayat pinjaman tetap utuh', async () => {
  const csrf = await sessionCsrf();
  const id = await buatBarang(csrf, 'Barang Beriwayat');

  const pinjam = new URLSearchParams({ _csrf: csrf, item_id: id, peminjam: 'Peminjam Uji',
    tgl_pinjam: dayOffset(0), tgl_kembali: dayOffset(3) });
  assert.equal((await req('/peminjaman', { method: 'POST', body: pinjam,
    headers: { 'content-type': 'application/x-www-form-urlencoded' } })).status, 302);
  const loanId = (await (await req('/peminjaman')).text()).match(/\/peminjaman\/(\d+)\/kembali/)[1];
  assert.equal((await req(`/peminjaman/${loanId}/kembali`, { method: 'POST',
    body: new URLSearchParams({ _csrf: csrf }), headers: { 'content-type': 'application/x-www-form-urlencoded' } })).status, 302);

  const del = await req(`/inventaris/${id}/hapus`, { method: 'POST',
    body: new URLSearchParams({ _csrf: csrf }), headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  assert.equal(del.status, 302);
  assert.match(decodeURIComponent(del.headers.get('location')), /Barang dihapus/);

  // barang hilang dari inventaris…
  assert.ok(!(await (await req('/inventaris/sarana')).text()).includes('Barang Beriwayat'),
    'barang harus sudah tidak ada');
  // …tapi riwayatnya tetap ada, lengkap dengan nama barangnya
  const pem = await (await req('/peminjaman')).text();
  assert.ok(pem.includes('Peminjam Uji') && pem.includes('Barang Beriwayat'),
    'riwayat pinjaman harus tetap tampil dengan nama barang');
  const backup = await (await req('/export/backup.json')).json();
  const loan = backup.loans.find(l => l.peminjam === 'Peminjam Uji' && l.item_nama === 'Barang Beriwayat');
  assert.ok(loan, 'baris pinjaman harus bertahan setelah barang dihapus');
  assert.equal(loan.item_id, null, 'item_id jadi NULL, bukan ikut terhapus');
});

test('barang tanpa riwayat tetap bisa dihapus', async () => {
  const csrf = await sessionCsrf();
  const id = await buatBarang(csrf, 'Barang Tanpa Riwayat');

  const del = await req(`/inventaris/${id}/hapus`, { method: 'POST',
    body: new URLSearchParams({ _csrf: csrf }), headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  assert.equal(del.status, 302);
  assert.match(decodeURIComponent(del.headers.get('location')), /Barang dihapus/);
  assert.ok(!(await (await req('/inventaris/sarana')).text()).includes('Barang Tanpa Riwayat'),
    'barang harus sudah tidak ada');
});
