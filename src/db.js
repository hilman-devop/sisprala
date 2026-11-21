// src/db.js — koneksi SQLite, migrasi, seed
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPassword } from './auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// ponytail: dir DB ikut DB_PATH, karena FS hosting serverless read-only kecuali /tmp
export const dbPath = process.env.DB_PATH || join(__dirname, '..', 'data', 'pinzup.db');
mkdirSync(dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'petugas',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    csrf TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama TEXT NOT NULL,
    kategori TEXT NOT NULL DEFAULT 'Lainnya',
    status TEXT NOT NULL DEFAULT 'ready',
    keterangan TEXT,
    gambar TEXT,
    jenis TEXT NOT NULL DEFAULT 'sarana',
    stok INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS loans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER REFERENCES items(id) ON DELETE SET NULL,
    item_nama TEXT,
    peminjam TEXT NOT NULL,
    kontak TEXT,
    tgl_pinjam TEXT NOT NULL,
    tgl_kembali TEXT NOT NULL,
    tgl_dikembalikan TEXT,
    status TEXT NOT NULL DEFAULT 'aktif',
    catatan TEXT,
    denda INTEGER NOT NULL DEFAULT 0,
    late_notified_at TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipe TEXT NOT NULL,
    teks TEXT NOT NULL,
    meta TEXT,
    user_id INTEGER,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipe TEXT NOT NULL,
    target TEXT,
    pesan TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'logged',
    created_at TEXT NOT NULL
  );
`);

// Migrasi kolom tambahan (idempotent)
function ensureColumn(table, col, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}
ensureColumn('loans', 'denda', 'denda INTEGER NOT NULL DEFAULT 0');
ensureColumn('loans', 'late_notified_at', 'late_notified_at TEXT');
// pemisahan Inventaris: jenis = sarana | prasarana, stok hanya bermakna untuk sarana
ensureColumn('items', 'jenis', "jenis TEXT NOT NULL DEFAULT 'sarana'");
ensureColumn('items', 'stok', 'stok INTEGER NOT NULL DEFAULT 1');

// ── Migrasi riwayat pinjaman ──
// Dulu loans.item_id ON DELETE CASCADE: menghapus barang ikut menghapus SELURUH riwayat
// pinjamannya. Sekarang item_id ON DELETE SET NULL + nama barang disalin ke item_nama,
// jadi barang boleh dihapus dan riwayatnya tetap utuh.
const loanCols = db.prepare('PRAGMA table_info(loans)').all().map(c => c.name);
if (!loanCols.includes('item_nama')) {
  db.pragma('foreign_keys = OFF');
  try {
    db.transaction(() => {
      db.exec(`CREATE TABLE loans_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER REFERENCES items(id) ON DELETE SET NULL,
        item_nama TEXT,
        peminjam TEXT NOT NULL,
        kontak TEXT,
        tgl_pinjam TEXT NOT NULL,
        tgl_kembali TEXT NOT NULL,
        tgl_dikembalikan TEXT,
        status TEXT NOT NULL DEFAULT 'aktif',
        catatan TEXT,
        denda INTEGER NOT NULL DEFAULT 0,
        late_notified_at TEXT,
        created_at TEXT NOT NULL
      )`);
      db.exec(`INSERT INTO loans_new (id, item_id, item_nama, peminjam, kontak, tgl_pinjam,
                 tgl_kembali, tgl_dikembalikan, status, catatan, denda, late_notified_at, created_at)
               SELECT l.id, l.item_id, i.nama, l.peminjam, l.kontak, l.tgl_pinjam,
                 l.tgl_kembali, l.tgl_dikembalikan, l.status, l.catatan, l.denda, l.late_notified_at, l.created_at
               FROM loans l LEFT JOIN items i ON i.id = l.item_id`);
      db.exec('DROP TABLE loans');
      db.exec('ALTER TABLE loans_new RENAME TO loans');
    })();
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

// ── Seed default ──
const now = () => new Date().toISOString();
// Sandi awal hanya dipakai saat tabel users masih kosong (instalasi baru).
// Set ADMIN_PASSWORD di hosting supaya tidak pernah jatuh ke nilai default.
const seedPassword = process.env.ADMIN_PASSWORD || 'admin123';
if (!db.prepare('SELECT 1 FROM users LIMIT 1').get()) {
  db.prepare('INSERT INTO users (username, password_hash, role, created_at) VALUES (?,?,?,?)')
    .run('admin', hashPassword(seedPassword), 'admin', now());
}
const defaults = { orgName: 'SISPRALA', theme: 'dark', dendaPerHari: '1000',
  notifyEnabled: '0', notifyWebhook: '' };
const insSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?,?)');
for (const [k, v] of Object.entries(defaults)) insSetting.run(k, v);

// ── Helpers ──
export function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

export function setSetting(key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .run(key, value);
}

export function logActivity(tipe, teks, meta = null, userId = null) {
  db.prepare('INSERT INTO activity (tipe, teks, meta, user_id, created_at) VALUES (?,?,?,?,?)')
    .run(tipe, teks, meta ? JSON.stringify(meta) : null, userId, now());
}

// Status pinjaman dihitung dari tanggal (server-side = sumber kebenaran)
export function loanStatus(loan) {
  if (loan.tgl_dikembalikan) return 'selesai';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return new Date(loan.tgl_kembali) < today ? 'terlambat' : 'aktif';
}

// ── Denda & notifikasi ──
export function lateDays(loan) {
  if (loan.tgl_dikembalikan) {
    const end = new Date(loan.tgl_kembali), done = new Date(loan.tgl_dikembalikan);
    return Math.max(0, Math.ceil((done - end) / 86400000));
  }
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((today - new Date(loan.tgl_kembali)) / 86400000));
}

export function fine(loan, rate = 1000) {
  return lateDays(loan) * Number(rate || 0);
}

// Kirim notifikasi: selalu dicatat; dikirim ke webhook bila diaktifkan.
export function notify(tipe, target, pesan) {
  const st = getSettings();
  let status = 'logged';
  if (st.notifyEnabled === '1' && st.notifyWebhook) {
    status = 'queued';
    // fire-and-forget; kegagalan tidak boleh mengganggu request utama
    fetch(st.notifyWebhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tipe, target, pesan, org: st.orgName, waktu: now() }),
    }).then(r => markNotification(id, r.ok ? 'sent' : 'failed'))
      .catch(() => markNotification(id, 'failed'));
  }
  const id = db.prepare('INSERT INTO notifications (tipe, target, pesan, status, created_at) VALUES (?,?,?,?,?)')
    .run(tipe, target || null, pesan, status, now()).lastInsertRowid;
  return id;
}

function markNotification(id, status) {
  try { db.prepare('UPDATE notifications SET status = ? WHERE id = ?').run(status, id); } catch {}
}

export { now };
