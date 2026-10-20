'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { DATA_DIR, REMOTE } = require('./db');

// ---- secret (env, else generated once and persisted) ----
function loadSecret() {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 24) return process.env.JWT_SECRET;
  if (REMOTE) { // سيرفر بدون ملفات دائمة: نشتق السر من توكن Turso (يفضّل تحط JWT_SECRET بنفسك)
    return crypto.createHash('sha256').update('ironfuel-jwt:' + (process.env.TURSO_AUTH_TOKEN || process.env.TURSO_DATABASE_URL)).digest('hex');
  }
  const f = path.join(DATA_DIR, '.jwt_secret');
  try { return fs.readFileSync(f, 'utf8').trim(); } catch {}
  const s = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(f, s, { mode: 0o600 });
  return s;
}
const SECRET = loadSecret();

// ---- passwords (scrypt) ----
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `s1$${salt.toString('hex')}$${hash.toString('hex')}`;
}
function verifyPassword(pw, stored) {
  try {
    const [v, saltHex, hashHex] = String(stored).split('$');
    if (v !== 's1') return false;
    const expected = Buffer.from(hashHex, 'hex');
    const got = crypto.scryptSync(pw, Buffer.from(saltHex, 'hex'), expected.length, { N: 16384, r: 8, p: 1 });
    return crypto.timingSafeEqual(expected, got);
  } catch { return false; }
}

// ---- JWT HS256 ----
const b64u = (b) => Buffer.from(b).toString('base64url');
function signToken(payload, ttlSec = 60 * 60 * 24 * 7) {
  const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + ttlSec }));
  const sig = crypto.createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}
function verifyToken(tok) {
  try {
    const [h, b, s] = String(tok).split('.');
    if (!h || !b || !s) return null;
    const exp = crypto.createHmac('sha256', SECRET).update(`${h}.${b}`).digest();
    const got = Buffer.from(s, 'base64url');
    if (exp.length !== got.length || !crypto.timingSafeEqual(exp, got)) return null;
    const p = JSON.parse(Buffer.from(b, 'base64url').toString());
    if (!p.exp || p.exp < Date.now() / 1000) return null;
    return p;
  } catch { return null; }
}

// ---- cookies ----
function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function setAuthCookie(res, token, secure) {
  const parts = [`session=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${60 * 60 * 24 * 7}`];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}
function clearAuthCookie(res) {
  res.setHeader('Set-Cookie', 'session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
}

// ---- tiny in-memory rate limiter ----
const buckets = new Map();
function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) { buckets.set(key, { n: 1, reset: now + windowMs }); return true; }
  b.n++;
  return b.n <= max;
}
setInterval(() => { const n = Date.now(); for (const [k, v] of buckets) if (v.reset < n) buckets.delete(k); }, 60_000).unref();

module.exports = { hashPassword, verifyPassword, signToken, verifyToken, parseCookies, setAuthCookie, clearAuthCookie, rateLimit, SECRET };
