'use strict';
// بيضيف المنتجات التجريبية (لو المتجر فاضي بس) على قاعدة Turso من جهازك.  التشغيل: npm run seed:demo
// محتاج ملف .env فيه TURSO_DATABASE_URL و TURSO_AUTH_TOKEN
const path = require('node:path');
try { process.loadEnvFile?.(path.join(__dirname, '..', '.env')); } catch {}
if (!process.env.TURSO_DATABASE_URL) { console.log('✗ مفيش TURSO_DATABASE_URL. اعمل ملف .env جوه مجلد المشروع وحط فيه السطرين (شوف .env.example).'); process.exit(1); }
const { q } = require('../lib/db');
if (q.get('SELECT id FROM products LIMIT 1')) { console.log('المتجر فيه منتجات بالفعل، مفيش حاجة اتضافت.'); process.exit(0); }
console.log('بضيف المنتجات... ممكن تاخد دقيقة أو اتنين، استنى.');
require('../lib/seed').seedDemo();
console.log('تم ✅ افتح الموقع وحدّث الصفحة.');
