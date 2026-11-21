# Deploy

Aplikasi ini Node.js biasa — bisa jalan di mana saja yang mendukung Node ≥ 22.
Database SQLite disimpan sebagai file di `./data/pinzup.db` (atau `DB_PATH`).

> **Live: <https://sisprala.my.id>** (HostData — DirectAdmin + CloudLinux + Passenger, Node 22).
> Panduan khusus hosting itu: `hostdata-upload/DEPLOY-HOSTDATA.md`. Demo Vercel: <https://pinjamz.vercel.app>
> (database `/tmp`, hanya contoh — bukan data produksi).

Sandi admin awal diambil dari env `ADMIN_PASSWORD`; kalau tidak diset, `admin123`. Akun hanya
dibuat saat tabel `users` kosong, jadi mengubah env belakangan **tidak** mereset sandi — ganti
lewat **Pengaturan → Keamanan**.

## 1. Render.com (paling mudah)
`render.yaml` sudah disiapkan.

1. Push proyek ke GitHub/GitLab.
2. Render → **New → Blueprint** → pilih repo.
3. Setelah jalan, ganti sandi admin di **Pengaturan → Keamanan** (atau set env `ADMIN_PASSWORD` sebelum start pertama).

⚠️ **Penting:** paket `free` Render tidak mendukung *persistent disk*, jadi file SQLite
akan **hilang setiap redeploy/restart**. Pakai `plan: starter` (yang sudah diset di
`render.yaml`) atau migrasikan ke Postgres bila ingin data permanen.

## 2. VPS (systemd) — kontrol penuh
```bash
# di server
git clone <repo> /opt/pinjamz && cd /opt/pinjamz
npm install --omit=dev
PORT=3000 node server.js     # uji manual dulu
```
`/etc/systemd/system/pinjamz.service`:
```ini
[Unit]
Description=Pinjamz
After=network.target
[Service]
WorkingDirectory=/opt/pinjamz
ExecStart=/usr/bin/node server.js
Environment=PORT=3000
Environment=DB_PATH=/var/lib/pinjamz/pinjamz.db
Restart=always
[Install]
WantedBy=multi-user.target
```
Lalu reverse proxy **Nginx/Caddy** untuk HTTPS (Caddy otomatis TLS):
```
pinjamz.example.com { reverse-proxy 127.0.0.1:3000 }
```

## 3. Catatan produksi
- **HTTPS wajib** — cookie sesi diset `Secure` otomatis saat `req.secure` (di belakang proxy, aktifkan `app.set('trust proxy', 1)`).
- **Backup** rutin: endpoint `/export/backup.json`, atau salin file `data/pinzup.db`.
- **Upload** gambar ada di `public/uploads/` — ikutkan dalam backup.
- Jangan ekspos file `data/*.db` ke publik (di luar `public/`, jadi aman).
- **Cold start (masalah utama di sisprala.my.id, belum tuntas).** Proses Node dimatikan host
  tanpa `SIGTERM` lalu lahir lagi. Bukti terukur: header `X-App-Uptime` **selalu 0** pada setiap
  request lambat (7,8 s / 15 s / 19 s / 31 s / 48 s / 53 s), sedangkan request hangat 0,08–0,17 s.
  `data/boot.log` mencatat 4 pid berbeda dalam 9 menit tanpa satu pun baris `SIGTERM` — jadi proses
  dibunuh paksa (SIGKILL: LVE/OOM atau kebijakan Passenger), **bukan** idle-timeout biasa.
  Self-ping `server.js` (1 request/menit ke `/login`) **tidak cukup** menahannya.
  Ini perilaku level hosting; yang bisa dilakukan dari sisi aplikasi hanya memperkecil biaya spawn.
  Diagnostik: header `X-App-Uptime` + `data/boot.log` + `data/slow.log` (matikan dengan `SLOW_LOG=0`).
  Langkah berikutnya ada di panel/dukungan HostData, bukan di kode.
- **Pantau uptime** dengan monitor eksternal gratis (mis. UptimeRobot, interval 5 menit) ke
  `https://<domain>/login`. Ini yang memberi tahu kalau situs benar-benar mati, dan sekaligus
  menjaga aplikasi tetap hangat. Jangan andalkan cron panel untuk ini — lihat catatan di
  `hostdata-upload/DEPLOY-HOSTDATA.md`.
- **Cache aset** — `?v=<mtime+size>` di CSS/JS/logo + `Cache-Control: immutable, 30d`.
  Setelah deploy, angka versi berubah sendiri; tidak perlu hard-refresh.
- Ganti sandi default (env `ADMIN_PASSWORD`) sebelum dipakai.

## 4. Vercel (demo saja — bukan untuk data nyata)

Vercel tidak menjalankan `server.js` sebagai server. Yang dieksekusi hanya folder `api/` sebagai
serverless function, dan filesystem-nya read-only kecuali `/tmp`. Karena itu:

- `api/index.js` — entrypoint yang Vercel kenali (export `app` dari `server.js`).
- `vercel.json` — rewrite semua request ke `/api/index`.
- Env var **wajib** di dashboard Vercel:
  - `DB_PATH=/tmp/pinzup.db` — tanpa ini `mkdirSync('data')` gagal (read-only) → function 500.
  - `UPLOAD_DIR=/tmp/uploads` — tanpa ini upload gambar error karena `public/uploads` read-only.
- Deploy: `npx vercel --prod`, atau import repo dari GitHub. Drag-and-drop dashboard tidak
  membangun function dengan andal.

Batasnya: `/tmp` ephemeral dan **per-instance**. Data hilang tiap cold start, dan dua user bisa
mendarat di instance berbeda sehingga melihat DB berbeda (sesi bisa mental). Cocok hanya untuk
demo satu orang. Untuk dipakai sungguhan pakai VPS + disk persisten.
