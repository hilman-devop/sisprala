# SISPRALA — Asset Lending System

![Node.js 22](https://img.shields.io/badge/Node.js_22-2f81f7?style=flat) ![Express](https://img.shields.io/badge/Express-2f81f7?style=flat) ![SQLite](https://img.shields.io/badge/SQLite-2f81f7?style=flat) ![Vanilla JS](https://img.shields.io/badge/Vanilla_JS-2f81f7?style=flat) ![QRCode](https://img.shields.io/badge/QRCode-2f81f7?style=flat)

> Aplikasi inventaris dan peminjaman barang untuk instansi dengan alur pengajuan, persetujuan, pengembalian, dan denda.

## Tentang proyek

Aplikasi inventaris dan peminjaman barang untuk instansi dengan alur pengajuan, persetujuan, pengembalian, dan denda. Dokumentasi ini dibuat sebagai panduan singkat untuk memahami ruang lingkup proyek, menjalankannya secara lokal, dan membaca batasan penggunaannya.

## Fitur utama

- Autentikasi password hashing scrypt
- QR code untuk setiap barang
- Denda keterlambatan otomatis
- Notifikasi webhook
- Backup/restore CSV dan JSON
- 21 test end-to-end

## Teknologi

- Node.js 22
- Express
- SQLite
- Vanilla JS
- QRCode

## Menjalankan secara lokal

Prasyarat dan konfigurasi dapat berbeda menurut sistem operasi. Contoh langkah utama:

```bash
npm install
npm test
npm start
```

## Struktur dan pengembangan

Mulai dari entry point dan folder konfigurasi proyek. Pisahkan credential lokal dari source code, tambahkan test untuk perubahan penting, dan gunakan environment variable untuk konfigurasi deployment.

## Keamanan

- Jangan commit API key, password, token, session ID, atau data pribadi.
- Gunakan file environment lokal dan contoh konfigurasi tanpa nilai rahasia.
- Uji perubahan pada environment development sebelum deployment.

## Status

Proyek ini merupakan bagian dari portofolio **Hilman Arifin Ilham** dan dapat dikembangkan sesuai kebutuhan penggunaan.

> **Catatan:** Gunakan `.env` lokal untuk secret, webhook, dan konfigurasi deployment. Jangan mengaktifkan mode debug di production.

## Lisensi

Belum ada lisensi open-source yang dinyatakan di repository ini. Hubungi pemilik repository sebelum menggunakan ulang atau mendistribusikan kode.

---

Dibuat oleh [Hilman Arifin Ilham](https://github.com/hilman-devop).
