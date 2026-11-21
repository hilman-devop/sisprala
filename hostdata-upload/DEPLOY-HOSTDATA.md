# Deploy SISPRALA ke HostData.id (paket Starter, DirectAdmin + CloudLinux)

Paket **Starter** sudah cukup: 5 GB SSD, RAM 2 GB, **Node.js**, **SSH/Terminal**, DirectAdmin, LiteSpeed.
Yang di-upload **bukan** folder proyek penuh — cukup isi folder **`hostdata-upload/`** (atau file `sisprala-hostdata.zip`).

## Isi folder yang di-upload

```
server.js            ← entrypoint (startup file)
package.json         ← daftar dependency
package-lock.json    ← versi terkunci (wajib, dipakai `npm ci`)
src/                 ← db.js, auth.js, routes.js, render.js, csv.js
public/              ← css, js, img, favicon.ico, uploads/
```

**Jangan** upload: `node_modules/`, `data/`, `test/`, `vercel-drop/`, `.git/`, `.vercel/`.
`node_modules` harus di-`npm install` **di server** karena `better-sqlite3` berisi binary native Linux
(binary Windows tidak bisa dipakai di hosting).

---

## Langkah 1 — Buat aplikasi Node.js di DirectAdmin

1. Login DirectAdmin → menu **Node.js Selector** (atau **Setup Node.js App**).
2. **Create Application**:
   - Node.js version: **22** (atau 20/24 — jangan di bawah 20)
   - Application mode: **Production**
   - Application root: `domains/namadomain.com/sisprala`
   - Application URL: `/`  (isi domain utama; kalau mau di subfolder, mis. `/app`)
   - Application startup file: **`server.js`**
3. Klik **Create**. Panel membuat virtualenv + folder aplikasi.

## Langkah 2 — Upload file

**Cara A (paling mudah, File Manager):**
1. DirectAdmin → **File Manager** → masuk ke `domains/namadomain.com/public_html`
   (kalau Application root yang dipilih di Langkah 1 adalah `.../sisprala`, pakai folder itu)
2. Upload `sisprala-hostdata.zip` → klik kanan → **Extract**
3. Hapus file zip setelah diekstrak
4. **Cek struktur**: di File Manager harus terlihat **baris folder** `public` dan `src`
   (ikon folder biru). Kalau yang muncul malah *file* bernama `public/css/style.css`
   atau `src/db.js` (satu baris panjang berisi tanda `/`), berarti ekstraksi tidak membuat
   folder → hapus semua hasil ekstrak, lalu extract ulang, atau pakai Cara B.

**Cara B (SSH, paling andal):**
```bash
cd ~/domains/namadomain.com/public_html
unzip sisprala-hostdata.zip && rm sisprala-hostdata.zip
ls   # harus ada: server.js  src  public  package.json
```

## Langkah 3 — Install dependency

**Cara A (tanpa SSH, paling mudah):** DirectAdmin → **Node.js Selector** → tombol **Run NPM Install**
on aplikasi tadi. Panel menjalankannya di dalam virtualenv Node, jadi `better-sqlite3` langsung
terbangun sebagai binary Linux. Tunggu sampai muncul *"NPM Install completed successfully"*.

**Cara B (SSH / Terminal):**

DirectAdmin → **SSH / Terminal** (Starter sudah termasuk):

```bash
cd ~/domains/namadomain.com/sisprala
source /home/USERNAME/nodevenv/domains/namadomain.com/sisprala/22/bin/activate
npm ci --omit=dev
```

> Ganti `USERNAME` dengan user hosting Anda, dan `22` dengan versi Node yang dipilih di Langkah 1.
> Perintah `source .../activate` penting: tanpa itu `npm` memakai Node sistem yang versinya beda.

Kalau muncul error `node-gyp` / `gcc: not found`, pakai:
```bash
npm ci --omit=dev --build-from-source
```
Kalau tetap gagal, buka tiket HostData minta `build-essential` + `python3` untuk akun Anda
(atau minta versi Node yang punya prebuilt binary `better-sqlite3`).

## Langkah 4 — Restart & cek

1. DirectAdmin → **Node.js Selector** → tombol **Restart** pada aplikasi tadi.
2. Buka `https://namadomain.com` → harus muncul landing page SISPRALA.
3. Login **`admin`** dengan sandi **`admin123`** (kecuali Anda men-set env `ADMIN_PASSWORD` di panel **sebelum** aplikasi pertama kali jalan — akun hanya dibuat sekali saat tabel user kosong), lalu ganti sandi di **Pengaturan → Keamanan**.

## Langkah 4b — Kunci file internal di `.htaccess` (JANGAN DILEWATI)

Node.js Selector menulis blok Passenger ke `<Application root>/.htaccess`. Blok itu hanya
mengatur *routing*: file yang bukan milik Passenger tetap dilayani Apache langsung, jadi
`https://namadomain.com/server.js`, `/src/db.js`, `/package.json`, dan **`/data/pinzup.db`**
bisa diunduh siapa saja. Tambahkan dua blok berikut ke `.htaccess` yang sama (File Manager →
klik kanan `.htaccess` → **Edit**), lalu **Save**:

```apache
# SISPRALA: deny direct web access to non-public files
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteRule ^(server[.]js|package(-lock)?[.]json|[.]env|README[.]md|DEPLOY.*[.]md)$ - [F,L,NC]
RewriteRule ^(src|data|test|node_modules|vercel-drop|hostdata-upload)(/|$) - [F,L,NC]
</IfModule>

# SISPRALA: force HTTPS
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteCond %{HTTPS} !=on
RewriteCond %{HTTP:X-Forwarded-Proto} !=https
RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [R=301,L]
</IfModule>
```

Letakkan **setelah** blok Passenger (jangan hapus blok `CLOUDLINUX PASSENGER CONFIGURATION`).
Cek dari terminal mana pun — semua harus `403`, kecuali `/login` yang `200`:

```bash
for p in /login /server.js /src/db.js /package.json /data/pinzup.db /.env /README.md; do
  printf '%-20s %s\n' "$p" "$(curl -s -o /dev/null -w '%{http_code}' https://namadomain.com$p)"
done
```

## Langkah 5 — SSL & HTTPS

1. DirectAdmin → **SSL Certificates** → **Free & automatic certificate from Let's Encrypt** → Save.
2. Aktifkan **Force SSL / Redirect HTTP to HTTPS**.
3. Cek `https://namadomain.com/login` → gembok hijau, tidak ada warning.

## Langkah 6 — Izin folder (kalau ada error 500 / "readonly database")

```bash
cd ~/domains/namadomain.com/sisprala
mkdir -p data public/uploads
chmod 755 data public/uploads
```
Database otomatis dibuat di `data/pinzup.db` saat pertama dijalankan.

---

## Hal yang perlu diketahui

| Hal | Keterangan |
|---|---|
| **Database** | SQLite satu file: `data/pinzup.db`. Ikut ter-backup kalau folder aplikasi di-backup (HostData backup mingguan 2×/minggu, bisa restore sendiri dari panel). |
| **Backup aplikasi** | Menu **Pengaturan → Backup JSON** (unduh) dan **Restore** (upload). Lakukan rutin sebelum update. |
| **Upload gambar** | Tersimpan di `public/uploads/`. Ikut backup folder aplikasi. |
| **Update kode** | Timpa `server.js`/`src/`/`public/` lewat File Manager, lalu **Restart** di Node.js Selector. Jangan hapus `data/` dan `public/uploads/`. |
| **`.htaccess`** | Aturan keamanan + Force HTTPS (Langkah 4b) hanya ada di server, **bukan** di dalam bundel. Kalau Node.js Selector diperbaiki/dibuat ulang (atau `.htaccess` tertimpa), ulangi Langkah 4b dan cek ulang status 403-nya. |
| **Sandi admin awal** | Dibuat sekali saat tabel `users` kosong: `admin` + env `ADMIN_PASSWORD` (fallback `admin123`). Mengubah env belakangan tidak mereset sandi — ganti lewat **Pengaturan → Keamanan**. Halaman login tidak menampilkan sandi default. |
| **Env opsional** | `DB_PATH`, `UPLOAD_DIR`, `PORT`, `ADMIN_PASSWORD` — tidak perlu diisi; default sudah benar untuk shared hosting. |
| **Tanpa cron** | Denda & status terlambat dihitung saat halaman dibuka (`loanStatus()`), jadi tidak butuh cron job. |
| **Cold start (terasa "lemot")** | Proses Node dimatikan host lalu lahir lagi. Bukti: header `X-App-Uptime` = **0** pada setiap request lambat (7,8–53 detik), request hangat 0,08–0,17 detik; `data/boot.log` mencatat 4 pid dalam 9 menit **tanpa** baris `SIGTERM` → dibunuh paksa (SIGKILL/LVE), bukan idle-timeout biasa. Self-ping 1 menit di `server.js` sudah dicoba dan **tidak cukup**. Perbaikan harus dari sisi hosting (batas LVE/RAM atau setelan Passenger); dari sisi aplikasi hanya biaya spawn yang bisa ditekan. |
| **Monitor uptime** | Pakai monitor eksternal gratis (mis. UptimeRobot, interval 5 menit) ke `https://namadomain.com/login`. Ini satu-satunya cara dapat **notifikasi kalau situs mati**; self-ping di dalam app tidak bisa melaporkan app yang sudah mati. **Cron DirectAdmin akun ini tidak dieksekusi** (diuji: job `* * * * *` selama 5 menit tidak menghasilkan file apa pun, walau crontab-nya tersimpan). Kalau butuh cron, minta HostData mengaktifkan shell/cron untuk akun ini. |

## Troubleshooting cepat

- **403 Forbidden atau 404 di semua halaman** → aplikasi Node belum dibuat/di-attach ke domain; server masih melayani folder `public_html` biasa. Buka **Node.js Selector** → pastikan ada aplikasi dengan Application URL = domain Anda, startup file `server.js`, lalu **Restart**.
- **500 saat buka domain** → cek `stderr.log` di folder aplikasi, atau DirectAdmin → Node.js Selector → **Log**. Penyebab umum: `npm ci` belum dijalankan, versi Node di virtualenv beda, atau struktur folder salah (lihat Langkah 2 poin 4 — `src/` dan `public/` harus berupa folder).
- **`Cannot find module 'better-sqlite3'`** → `npm ci` dijalankan di luar virtualenv (Langkah 3). Ulangi dengan `source .../activate`.
- **Login berhasil tapi balik ke halaman login** → SSL belum aktif/Force SSL; pastikan akses lewat `https://`.
- **Database hilang setelah update** → folder `data/` terhapus saat menimpa file. Restore dari backup JSON atau backup panel.
