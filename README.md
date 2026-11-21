# SISPRALA — Sistem Peminjaman Sarana Prasarana

> Sistem informasi peminjaman barang milik instansi dengan autentikasi scrypt, proteksi CSRF, QR per barang, dan denda keterlambatan otomatis.

## ✨ Fitur

- Autentikasi scrypt + proteksi CSRF
- QR Code untuk setiap barang
- Denda keterlambatan dihitung otomatis
- Notifikasi webhook (WA / email)
- Backup dan restore CSV / JSON
- 21 test end-to-end + audit keamanan tertulis

## 🛠 Tech Stack

"Node.js 22" "Express" "better-sqlite3" "Vanilla JS" "QRCode"

## 🚀 Menjalankan

```
npm install
npm test        # 21 test end-to-end
npm start
```

## 📌 Catatan

Proyek ini merupakan bagian dari portofolio pribadi. Kode disusun untuk kebutuhan nyata,
bukan sekadar demo, sehingga sebagian konfigurasi spesifik lingkungan mungkin perlu
disesuaikan sebelum dijalankan.
