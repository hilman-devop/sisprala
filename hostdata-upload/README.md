# SISPRALA — Sistem Informasi Sarana Prasarana

Aplikasi peminjaman barang bergaya [pinzup.asia](https://pinzup.asia) — tetapi dengan **data di server (SQLite), login, dan postur keamanan yang sudah diperbaiki** (lihat `audit-pinzup.asia.md`).

## Stack
- **Node.js ≥ 22** + **Express**
- **SQLite** via `better-sqlite3` (file `data/pinzup.db`, dibuat otomatis)
- Template server-side (tanpa framework view) + vanilla JS
- Auth: `node:crypto` scrypt + cookie sesi + CSRF token
- Upload gambar: `multer` (maks 2 MB, hanya png/jpg/webp/gif)

Total dependency runtime: `express`, `better-sqlite3`, `multer`, `qrcode`.

## Menjalankan
```bash
npm install
npm start          # http://localhost:3000
# atau
npm run dev        # auto-reload (node --watch)
```
Login bawaan: user **`admin`**, sandi **`admin123`** (atau nilai env `ADMIN_PASSWORD` kalau diisi sebelum start pertama) — segera ubah di menu **Pengaturan → Keamanan**.

## Test
```bash
npm test           # node:test, 21 test end-to-end
```

## Fitur
- **Landing page** — halaman publik dengan hero, fitur, cara kerja, CTA
- **Dashboard** — statistik, donut chart, alert keterlambatan + total denda, aktivitas terbaru
- **Inventaris Sarana** — barang dengan **stok (jumlah unit)**: tambah/edit/hapus, toggle ready/non-ready, upload & ganti gambar, pencarian. Hapus barang **tidak menghapus riwayat peminjamannya** — riwayat tetap utuh dan menampilkan nama barang terakhir (`loans.item_nama`). Barang yang **sedang dipinjam** tidak bisa dihapus (tombol Hapus disembunyikan sampai dikembalikan)
- **Inventaris Prasarana** — barang tanpa stok, terpisah dari Sarana (data & form masing-masing)
- **Responsif** — di layar < 800px sidebar berubah jadi menu hamburger (tombol + backdrop)
- **QR per barang** — tiap barang punya QR (SVG) menuju halaman detail `/barang/:id`
- **Peminjaman** — catat pinjam, kembalikan, deteksi terlambat, **denda otomatis**, aturan 1 pinjaman aktif per barang
- **Notifikasi** — log + kirim ke webhook (gateway WhatsApp/email) saat pinjam/kembali/terlambat
- **Riwayat** — log aktivitas + log notifikasi
- **Pengaturan** — nama organisasi, tema, tarif denda, webhook, ubah sandi, export CSV & backup JSON, **restore dari file backup** (mengganti seluruh data)
- **Deploy** — `render.yaml` + `DEPLOY.md`

## Keamanan (hasil perbaikan audit)
| Aspek | Implementasi |
|---|---|
| XSS | Semua output lewat `esc()`; CSP ketat tanpa `unsafe-inline` |
| CSV injection | `src/csv.js` menetralkan sel diawali `= + - @` |
| Auth | scrypt + sesi DB + cookie `HttpOnly`/`SameSite=Lax` |
| CSRF | Token sesi pada semua POST |
| Header | CSP, X-Frame-Options=DENY, nosniff, Referrer-Policy, Permissions-Policy, HSTS |
| SQLi | Semua query *prepared statement* |
| Rate limit | Login dibatasi 5 percobaan/5 menit per IP |
| Upload | Whitelist MIME + batas ukuran |
| Webhook | URL notifikasi divalidasi harus `http(s)://` |

## Struktur
```
server.js            # bootstrap Express + middleware keamanan
src/db.js            # SQLite, migrasi, seed, helper
src/auth.js          # scrypt, sesi, CSRF, middleware
src/render.js        # escaping + layout halaman (SSR)
src/routes.js        # semua route (halaman + aksi + API)
src/csv.js           # export CSV aman
public/css/style.css # UI
public/js/app.js     # clock, chart, filter, konfirmasi, modal edit, menu mobile
test/app.test.js     # 25 test end-to-end
render.yaml          # blueprint deploy Render
DEPLOY.md            # panduan deploy
data/, public/uploads/  # dibuat otomatis
```

## Belum termasuk (bisa ditambah)
Role granular (admin vs petugas), notifikasi email built-in (butuh SMTP), migrasi ke Postgres untuk multi-instance.

Diketahui belum ada dan **sengaja** ditunda:
- Pencarian + paginasi di halaman Peminjaman & Riwayat. `/riwayat` memotong diam-diam ke 200 aktivitas dan 50 notifikasi terakhir.
- Halaman error kustom (404/500).
- Monitor uptime: butuh layanan eksternal (mis. UptimeRobot). Cron DirectAdmin di hosting `sisprala.my.id` tidak dieksekusi, jadi jangan dipakai untuk ini — lihat `DEPLOY.md`.

## Masalah yang pernah dilaporkan

### 1. Barang tidak bisa dihapus padahal sudah di-set Non-Ready — SELESAI

**Gejala.** Tombol Hapus diklik, muncul error, barang tetap ada. Me-set Non-Ready tidak menolong.

**Sebab.** Versi pertama penjagaan hapus menolak **semua** barang yang punya baris di `loans` — termasuk pinjaman yang sudah selesai. Waktu itu `loans.item_id` memakai `ON DELETE CASCADE`, jadi menghapus barang akan ikut memusnahkan seluruh riwayat pinjamannya. Non-Ready tidak ada hubungannya dengan boleh-tidaknya hapus, dan pesan errornya berbunyi "Pakai Set Non-Ready dulu" sehingga terbaca seperti langkah prasyarat.

**Perbaikan.** Riwayat dipisahkan dari barangnya, bukan dilarang:
- `loans.item_id` → `ON DELETE SET NULL`, ditambah kolom `loans.item_nama` yang menyalin nama barang saat transaksi pinjam.
- Menghapus barang **melepas** riwayatnya (`item_id` jadi `NULL`), tidak menghapusnya. Riwayat tetap tampil lengkap dengan nama barang terakhir.
- Satu-satunya penjagaan yang tersisa: barang yang **sedang dipinjam** (`tgl_dikembalikan IS NULL`) tidak bisa dihapus, dan tombol Hapus tidak dirender untuk baris itu.
- Migrasi tabel berjalan otomatis saat aplikasi start (idempotent, dijaga `PRAGMA table_info`), jadi DB lama ikut tersalin tanpa langkah manual.

**Tes.** `barang yang sedang dipinjam tidak bisa dihapus`, `hapus barang beriwayat: riwayat pinjaman tetap utuh`, `barang tanpa riwayat tetap bisa dihapus` — total 25 tes. Negative control: migrasi dimatikan → seluruh suite gagal, jadi tes benar-benar menguji migrasinya.

### 2. Web terasa lemot saat mau masuk — TERIDENTIFIKASI, PERBAIKAN DI SISI HOSTING

**Gejala.** Permintaan pertama terasa menggantung beberapa detik sampai puluhan detik, sesudah itu normal.

**Pengukuran.** Ditambahkan header `X-App-Uptime` (umur proses dalam detik) plus `data/boot.log` dan `data/slow.log`:

| durasi request | `X-App-Uptime` |
| --- | --- |
| 0,08 – 0,17 s | 30 – 212 s (proses sudah hidup) |
| 7,8 / 15 / 19 / 31 / 48 / 53 s | **selalu 0** (proses baru lahir) |

Semua request lambat terjadi pada proses yang baru start. `data/boot.log` mencatat 4 PID berbeda dalam 9 menit **tanpa satu pun** baris `SIGTERM`.

**Kesimpulan.** Proses Node dibunuh paksa oleh host (SIGKILL: batas LVE/RAM atau kebijakan Passenger), **bukan** sekadar idle-timeout. Self-ping internal tiap 60 detik ke `/login` sudah dicoba dan tidak menahan. Ini batas level hosting, bukan bug aplikasi.

**Yang sudah dikerjakan di aplikasi.** Cache aset statis 30 hari (`Cache-Control: immutable`) dengan URL berversi `?v=<mtime+size>` — menghemat 3 request per halaman. Diagnostik tetap aktif (`SLOW_LOG=0` untuk mematikan).

**Yang masih perlu dilakukan.** Naikkan batas RAM/LVE atau setel `PassengerPoolIdleTime` lewat HostData, dan pasang monitor eksternal (UptimeRobot, 5 menit) ke `/login` supaya ketahuan kalau situs mati.
