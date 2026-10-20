'use strict';
// بيقارن ملفات مشروعك بالنسخة الأصلية ويقولك أي ملف ناقص أو قديم. التشغيل: npm run verify
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
const norm = (b) => Buffer.from(b.toString('utf8').replace(/\r\n/g, '\n'));
let bad = 0;
for (const [file, info] of Object.entries(manifest)) {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) { console.log('✗ ناقص   ', file); bad++; continue; }
  const buf = norm(fs.readFileSync(p));
  const h = crypto.createHash('sha256').update(buf).digest('hex');
  if (h !== info.sha) { console.log(`✗ مختلف  ${file}  (عندك ${buf.length} بايت، الأصلي ${info.size})`); bad++; }
}
const [maj, min] = process.versions.node.split('.').map(Number);
if (maj < 22 || (maj === 22 && min < 5)) { console.log('✗ نسخة Node', process.versions.node, '- لازم 22.5 أو أحدث'); bad++; }
console.log(bad ? `\nفي ${bad} مشكلة. فك الزيب الأصلي في مجلد جديد وانسخ منه الملفات المذكورة.` : '\nكل الملفات سليمة ✅ (مطابقة للنسخة الأصلية)');
process.exit(bad ? 1 : 0);
