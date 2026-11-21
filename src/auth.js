// src/auth.js — hashing password (scrypt), sesi, CSRF, middleware
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { db, now } from './db.js';

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 hari

// ── Password ──
export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// ── Sesi ──
export function createSession(userId) {
  const token = randomBytes(32).toString('hex');
  const csrf = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, csrf, expires_at) VALUES (?,?,?,?)')
    .run(token, userId, csrf, expires);
  return { token, csrf };
}

export function destroySession(token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map(c => {
    const i = c.indexOf('=');
    return i < 0 ? [c.trim(), ''] : [c.slice(0, i).trim(), decodeURIComponent(c.slice(i + 1).trim())];
  }).filter(([k]) => k));
}

// ── Middleware: panggil di awal setiap request ──
export function attachAuth(req, res, next) {
  const token = parseCookies(req.headers.cookie).sid;
  req.sessionToken = token || null;
  req.user = null;
  req.csrf = null;
  if (token) {
    const row = db.prepare(`
      SELECT s.token, s.csrf, s.expires_at, u.id, u.username, u.role
      FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`).get(token);
    if (row && new Date(row.expires_at) > new Date()) {
      req.user = { id: row.id, username: row.username, role: row.role };
      req.csrf = row.csrf;
    } else {
      destroySession(token);
    }
  }
  next();
}

export function requireAuth(req, res, next) {
  if (req.user) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'unauthorized' });
  return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
}

// ── CSRF (double submit: token sesi harus cocok dengan body._csrf) ──
export function checkCsrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const token = req.body?._csrf || req.headers['x-csrf-token'];
  if (!req.csrf || token !== req.csrf) return res.status(403).send('CSRF token tidak valid');
  next();
}

export function setSessionCookie(res, token, secure) {
  res.cookie('sid', token, {
    httpOnly: true, sameSite: 'lax', secure, path: '/',
    maxAge: SESSION_TTL_MS,
  });
}
