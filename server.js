// server.js — bootstrap Express + middleware keamanan
import express from 'express';
import { join, dirname } from 'node:path';
import { appendFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { attachAuth } from './src/auth.js';
import { registerRoutes } from './src/routes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const app = express();
export default app; // Vercel: entrypoint function wajib punya default export

// harus ada sebelum src/db.js diimpor
mkdirSync(join(__dirname, 'data'), { recursive: true });

app.disable('x-powered-by');
// Di shared hosting (LiteSpeed/Passenger) aplikasi berada di belakang reverse proxy
app.set('trust proxy', 1);
app.use(express.urlencoded({ extended: false, limit: '2mb' }));
app.use(express.json({ limit: '2mb' }));

// ── Security headers ──
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; " +
    "object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(), usb=()');
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  next();
});

// ── Diagnostik ──
// X-App-Uptime (detik) membuktikan apakah sebuah request lambat karena proses BARU lahir
// (Passenger spawn) atau proses lama yang tersendat. Data ini yang memutuskan
// apakah keep-alive perlu. Matikan dengan SLOW_LOG=0.
const BOOT_AT = Date.now();
const SLOW_LOG = process.env.SLOW_LOG !== '0';
app.use((req, res, next) => {
  const t0 = process.hrtime.bigint();
  res.setHeader('X-App-Uptime', Math.floor(process.uptime()));
  if (SLOW_LOG) res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    if (ms > 800) {
      try {
        appendFileSync(join(__dirname, 'data', 'slow.log'),
          `${new Date().toISOString()} ${Math.round(ms)}ms uptime=${Math.floor((Date.now() - BOOT_AT) / 1000)}s ${req.method} ${req.originalUrl}\n`);
      } catch { /* FS read-only: abaikan */ }
    }
  });
  next();
});

app.use(attachAuth);
// ?v=<mtime+size> di HTML → boleh di-cache lama oleh browser (hemat 3 request per halaman)
const assetCache = { maxAge: '30d', immutable: true };
app.use('/img', express.static(join(__dirname, 'public/img'), assetCache));
app.use('/css', express.static(join(__dirname, 'public/css'), assetCache));
app.use('/js', express.static(join(__dirname, 'public/js'), assetCache));
// nama file upload acak (randomBytes) → tidak akan tertimpa
app.use('/uploads', express.static(join(__dirname, 'public/uploads'), { maxAge: '7d' }));
app.use('/favicon.ico', express.static(join(__dirname, 'public/favicon.ico'), { maxAge: '7d' }));

// ── Tetap hidup ──
// Passenger menghentikan proses yang idle (~5 menit). Permintaan pertama sesudahnya
// menunggu spawn ulang: terukur 7,8 detik vs 0,1 detik saat hangat. Satu permintaan
// ringan tiap 60 detik mencegahnya. Matikan dengan KEEPALIVE=0.
if (!process.env.NO_LISTEN && !process.env.VERCEL && process.env.KEEPALIVE !== '0') {
  let timer;
  app.use((req, res, next) => {
    if (!timer) {
      // ponytail: host diambil dari request pertama; kalau di belakang proxy internal, set KEEPALIVE_URL.
      const url = process.env.KEEPALIVE_URL || `${req.protocol}://${req.get('host')}/login`;
      timer = setInterval(() => fetch(url).catch(() => {}), 60 * 1000);
      timer.unref();
    }
    next();
  });
}

registerRoutes(app);

app.use((req, res) => res.status(404).send('404 — Halaman tidak ditemukan'));

// Catat setiap proses lahir/mati, supaya bisa dipisahkan dari Passenger spawn.
function bootLog(line) {
  try {
    appendFileSync(join(__dirname, 'data', 'boot.log'),
      `${new Date().toISOString()} pid=${process.pid} ${line}\n`);
  } catch { /* FS read-only: abaikan */ }
}
bootLog('start');
process.on('uncaughtException', (e) => bootLog('uncaught: ' + ((e && e.stack) || e)));
process.on('unhandledRejection', (e) => bootLog('rejection: ' + ((e && e.stack) || e)));
process.on('SIGTERM', () => { bootLog('SIGTERM'); process.exit(0); });

const PORT = process.env.PORT || 3000;
// Passenger/CloudLinux (DirectAdmin) memuat file ini sebagai entrypoint, jadi default-nya listen.
// Vercel meng-import app dari api/index.js → jangan listen di sana. Test set NO_LISTEN=1.
if (!process.env.NO_LISTEN && !process.env.VERCEL) {
  app.listen(PORT, () => console.log(`SISPRALA jalan di ${String(PORT).startsWith('/') ? 'socket ' + PORT : 'http://localhost:' + PORT}`));
}
