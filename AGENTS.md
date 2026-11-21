# AGENTS.md

## Project
SISPRALA — Sistem Informasi Sarana Prasarana. Node + Express + SQLite, server-side rendered, vanilla JS frontend.

## Commands
- Install: `npm install`
- Run: `npm start` (port 3000, override `PORT`)
- Dev (watch): `npm run dev`
- Test: `npm test` (`node --test`, tests in `test/`)
- DB override for tests: env `DB_PATH`

## Conventions
- ESM (`"type": "module"`), Node >= 22.
- Keep dependencies minimal: only `express`, `better-sqlite3`, `multer`, `qrcode` are intended runtime deps. Use Node stdlib (`node:crypto`, `node:test`, global `fetch`) instead of adding packages.
- SQL: always prepared statements. Never string-concatenate SQL.
- Output: ALWAYS escape with `esc()` / `attr()` from `src/render.js` before embedding user data in HTML. Never interpolate raw user data into HTML.
- Client JS lives in `public/js/*.js` only. **No inline `<script>` or inline event handlers** (`onclick=`) — the CSP (`script-src 'self'`) blocks them. Use `data-*` attributes + listeners (see `public/js/app.js`).
- Auth: sessions stored in DB (`sessions` table). Every state-changing POST must have `requireAuth` + `checkCsrf` and include a hidden `_csrf` field.
- Uploads: MIME whitelist + 2 MB limit (`multer` config in `src/routes.js`); dir from env `UPLOAD_DIR`, default `public/uploads` (created on boot via `mkdirSync`).
- Activity log: call `logActivity(tipe, teks, meta, userId)` from `src/db.js` on mutations.
- Notifications: call `notify(tipe, target, pesan)` from `src/db.js`. It always logs to the `notifications` table; if `notifyEnabled=1` + `notifyWebhook` set, it POSTs JSON fire-and-forget.
- Fines: use `lateDays(loan)` / `fine(loan, rate)` from `src/db.js`. Rate comes from setting `dendaPerHari`. Store computed `denda` on the loan when returned.
- Schema changes: add via `CREATE TABLE IF NOT EXISTS` or `ensureColumn(table, col, ddl)` in `src/db.js` (idempotent migrations).
- CSV export: always go through `src/csv.js` (`toCsv`) to neutralise formula injection.
- Restore: `POST /pengaturan/import` (`uploadJson.single('backup')`, JSON only, ≤8 MB) is **destructive** — it wipes `items`/`loans`/`activity` inside one transaction, then re-inserts. Only `orgName`/`theme`/`dendaPerHari` are read from `settings` in the file; users are never touched.
- Edit form: server-rendered modal `#editModal` + `#editForm` is populated client-side from the button's `data-*` attrs (CSP-safe — no inline handlers).

## Layout
- `server.js` — app bootstrap + security headers middleware. Exports `app` (tests import it). `app.listen()` dipanggil kecuali `NO_LISTEN=1` (dipakai test) atau `VERCEL` (import saja).
- `api/index.js` — Vercel entrypoint only (`export default app`). Not used when running `npm start`.
- `src/db.js` — schema/migrations (idempotent `CREATE TABLE IF NOT EXISTS`), seed, `getSettings`/`setSetting`/`logActivity`/`loanStatus`.
- `src/routes.js` — all routes; `registerRoutes(app)` is called from `server.js`.
- `src/render.js` — `esc`, `attr`, `fmtDate`/`fmtDateTime`, `icon(name)` (inline stroke-SVG icons, termasuk `sun`/`moon`) + `logoMark`, `themeToggleIcons()`, `layout()`, `authLayout()`, `landingLayout()`. **No emoji as icons** — always use `icon()`; UI style is neutral/restrained (see `public/css/style.css`).
- Brand: logo biru di `public/img/logo.png` (+ `logo-192`, `logo-64`, `favicon-32`). Emblem sekolah di `public/img/sekolah.png` dipakai sebagai watermark `body::before` (opacity 5% dark / 7% light). Palet `--accent` biru logo, `--navy`/`--gold` dari emblem.
- Tema: `data-theme` pada `<html>` dari `settings.theme`; tombol `[data-theme-toggle]` (topbar + nav landing) menimpanya dan menyimpan pilihan di `localStorage` key `pinjamz-theme` (`public/js/app.js`).
- `src/auth.js` — scrypt hashing, sessions, CSRF, `attachAuth`/`requireAuth`/`checkCsrf`.
- Deploy: `render.yaml` (Render blueprint), `vercel.json` + `api/index.js` (Vercel, demo-only) + `DEPLOY.md`. SQLite lives in `./data` (env `DB_PATH`).
- Deploy shared hosting (DirectAdmin/CloudLinux, mis. HostData.id paket Starter): bundel siap-upload **`hostdata-upload/`** (+ `sisprala-hostdata.zip`); `node_modules` **tidak** di-upload (binary `better-sqlite3` native Linux harus di-install di server via Node.js Selector → **Run NPM Install**, atau `npm ci` di virtualenv). Panduan: `hostdata-upload/DEPLOY-HOSTDATA.md`. `hostdata-upload/` wajib disinkronkan ulang setiap kali `server.js`/`src/`/`public/` berubah (zip ikut dibangun ulang).
- **Live: <https://sisprala.my.id>** — HostData, DirectAdmin + CloudLinux + LiteSpeed + Passenger 6, Node 22.23.4 (Production), app root `domains/sisprala.my.id/public_html`, startup `server.js`, SSL auto-renew, HTTP→HTTPS 301.
- **Keamanan wajib di server (tidak ada di repo):** `public_html/.htaccess` berisi blok Passenger + deny `server.js|package*.json|.env|README.md|DEPLOY*.md|src|data|test|node_modules|vercel-drop|hostdata-upload` (403) + force HTTPS. Tanpa `data|src` deny, **`/data/pinzup.db` bisa diunduh publik** — kalau app dibuat ulang di panel, `.htaccess` Passenger ditulis ulang, jadi aturan ini harus ditempel ulang lalu diverifikasi (`/data/pinzup.db` → 403).

## Notes
- Business rule: a single item may have only ONE active loan; enforced server-side in `src/routes.js` (`SELECT 1 FROM loans WHERE item_id = ? AND tgl_dikembalikan IS NULL`).
- Business rule: **riwayat peminjaman tidak boleh hilang saat barang dihapus.** `loans.item_id` is `ON DELETE SET NULL` and `loans.item_nama` stores a copy of the item name at borrow time, so deleting an item detaches its history instead of destroying it. The only delete guard left: an item that is **currently on loan** (`tgl_dikembalikan IS NULL`) cannot be deleted, and its Hapus button is not rendered. If you ever change the FK back to `ON DELETE CASCADE` you must first restore a refuse-to-delete guard — otherwise every past loan of that item vanishes with no undo. Tests: "barang yang sedang dipinjam tidak bisa dihapus" + "hapus barang beriwayat: riwayat pinjaman tetap utuh" + "barang tanpa riwayat tetap bisa dihapus" in `test/app.test.js`.
- Riwayat tampil dengan `loans.item_nama`; jangan ganti ke join `items.nama` saja, karena `item_id` jadi `NULL` setelah barang dihapus.
- Inventaris dibagi dua bagian lewat kolom `items.jenis` (`sarana`/`prasarana`): satu handler `inventarisPage(jenis)` melayani `/inventaris/sarana` & `/inventaris/prasarana` (dan `/inventaris` sebagai alias Sarana). `items.stok` (integer, clamp 1–9999) hanya bermakna untuk sarana dan **tidak** memengaruhi aturan 1 pinjaman aktif — murni data kuantitas.
- Loan status (`aktif`/`terlambat`/`selesai`) is derived server-side via `loanStatus()` — never trust client-side status.
- Default seed user: `admin` dengan sandi dari env `ADMIN_PASSWORD` (fallback `admin123`), dan **hanya** dibuat saat tabel `users` kosong — instalasi yang sudah jalan tidak pernah ditimpa. Halaman `/login` sengaja tidak menampilkan sandi default lagi.
- Layout is responsive: below 800px the sidebar is off-canvas; `#menuBtn` toggles `.open` on the sidebar and `#navBackdrop` (wired in `public/js/app.js`).
- Context for this codebase's security decisions: `audit-pinzup.asia.md` (audit of the original reference site).
