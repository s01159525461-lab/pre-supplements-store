'use strict';
// يمسح بيانات المنتجات والطلبات ويرجّع البيانات التجريبية. الحسابات بتفضل زي ما هي.
// تحذير: عملية مدمّرة. شغّلها بس في بيئة التجربة.
const { q } = require('../lib/db');
if (process.env.CONFIRM !== 'yes') { console.log('لتأكيد المسح: CONFIRM=yes npm run seed'); process.exit(1); }
for (const t of ['order_items', 'orders', 'reviews', 'wishlist', 'variants', 'products', 'coupons', 'brands', 'categories']) q.run(`DELETE FROM ${t}`);
q.run(`DELETE FROM sqlite_sequence WHERE name IN ('products','variants','categories','brands','coupons','orders')`);
require('../lib/seed').seedDemo();
console.log('تم.');
