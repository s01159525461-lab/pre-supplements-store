'use strict';
// الاستخدام: node scripts/set-admin.js الايميل كلمة-السر
// بيعمل حساب أدمن أو بيغيّر كلمة سر الأدمن الموجود - من غير ما يمسح أي بيانات.
const path = require('node:path');
try { process.loadEnvFile?.(path.join(__dirname, '..', '.env')); } catch {}
const { q } = require('../lib/db');
const { hashPassword } = require('../lib/auth');

const [emailArg, password] = process.argv.slice(2);
if (!emailArg || !password) { console.log('الاستخدام: node scripts/set-admin.js you@example.com كلمة-السر'); process.exit(1); }
if (password.length < 8) { console.log('كلمة السر لازم 8 حروف على الأقل'); process.exit(1); }
const email = emailArg.toLowerCase();
const hash = hashPassword(password);
const admin = q.get(`SELECT id FROM users WHERE role='admin' ORDER BY id LIMIT 1`);
if (admin) q.run('UPDATE users SET email=?, password_hash=? WHERE id=?', email, hash, admin.id);
else q.run(`INSERT INTO users(name,email,password_hash,role) VALUES ('Admin',?,?,'admin')`, email, hash);
console.log('تم ✅  الإيميل:', email, ' - ادخل على /admin بكلمة السر اللي كتبتها.');
