'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { q, tx, DATA_DIR, REMOTE } = require('./db');
const { hashPassword } = require('./auth');

function ensureAdmin() {
  if (q.get(`SELECT id FROM users WHERE role='admin' LIMIT 1`)) return;
  const email = (process.env.ADMIN_EMAIL || 'admin@ironfuel.local').toLowerCase();
  const generated = !process.env.ADMIN_PASSWORD;
  const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
  q.run(`INSERT INTO users(name,email,password_hash,role) VALUES (?,?,?,'admin')`, 'Admin', email, hashPassword(password));
  console.log('\n==================== حساب الأدمن ====================');
  console.log(' البريد   :', email);
  console.log(' كلمة السر:', generated ? password : '(من ADMIN_PASSWORD)');
  if (generated && !REMOTE) {
    const f = path.join(DATA_DIR, 'ADMIN_CREDENTIALS.txt');
    fs.writeFileSync(f, `email: ${email}\npassword: ${password}\n\nغيّر كلمة السر واحذف الملف ده.\n`, { mode: 0o600 });
    console.log(' (اتحفظت كمان في', f, '- احذفها بعد ما تسجّل دخول)');
  }
  console.log(' لوحة التحكم: /admin');
  console.log('=====================================================\n');
}

const CATS = [
  ['protein', 'Protein', 'بروتين', '💪'], ['creatine', 'Creatine', 'كرياتين', '⚡'], ['fat-burners', 'Fat Burners', 'حرق الدهون', '🔥'],
  ['pre-workout', 'Pre-Workout', 'بري ورك أوت', '🚀'], ['vitamins', 'Vitamins & Health', 'فيتامينات وصحة', '🌿'],
  ['weight-gainers', 'Weight Gainers', 'زيادة الوزن', '🏋️'], ['protein-bars', 'Protein Bars', 'بروتين بار', '🍫'], ['accessories', 'Accessories', 'إكسسوارات', '🧴'],
];
const BRANDS = ['Titan Labs', 'Apex Nutrition', 'Forge Sports', 'Nova Pharma', 'Vanguard', 'PureCore'];

// [name_en, name_ar, cat, brand, price, sale, featured, cashback%, variants[[label,price,sale,stock]] | stock]
const P = [
  ['Titan Whey Isolate', 'تيتان واي أيزوليت', 'protein', 'Titan Labs', 2199, 1999, 1, 1, [['1.3 Lbs', 2199, 1999, 30], ['3 Lbs', 4100, 3790, 22], ['5 Lbs', 6150, 5650, 15]]],
  ['Apex Gold Whey 100%', 'أبكس جولد واي 100%', 'protein', 'Apex Nutrition', 3500, 3350, 1, 1, [['2 Lbs', 3500, 3350, 25], ['5 Lbs', 6699, 6399, 12]]],
  ['Forge Mass Whey Blend', 'فورج واي بلند', 'protein', 'Forge Sports', 2800, null, 0, 1, [['2 Lbs', 2800, null, 20], ['5 Lbs', 5900, 5490, 10]]],
  ['PureCore Plant Protein', 'بيور كور بروتين نباتي', 'protein', 'PureCore', 2600, 2350, 0, 1.5, [['1 kg', 2600, 2350, 14], ['2 kg', 4800, null, 8]]],
  ['Titan Creatine Monohydrate', 'تيتان كرياتين مونوهيدرات', 'creatine', 'Titan Labs', 1200, 1050, 1, 1, [['300 gm', 1200, 1050, 40], ['500 gm', 1850, null, 25]]],
  ['Apex Micronized Creatine', 'أبكس كرياتين مايكرونايزد', 'creatine', 'Apex Nutrition', 2400, 2199, 0, 1, [['400 gm', 2400, 2199, 18]]],
  ['Forge Creatine HCL', 'فورج كرياتين HCL', 'creatine', 'Forge Sports', 1500, null, 0, 1, [['120 Capsules', 1500, null, 20]]],
  ['Nova Lipo Burn', 'نوفا ليبو بيرن', 'fat-burners', 'Nova Pharma', 1400, 1099, 1, 1, [['60 Capsules', 1400, 1099, 35]]],
  ['Vanguard Thermo Cut', 'فانجارد ثيرمو كت', 'fat-burners', 'Vanguard', 1500, 1350, 0, 1, [['100 Capsules', 1500, 1350, 28]]],
  ['Apex Cuts Pack', 'أبكس كتس باك', 'fat-burners', 'Apex Nutrition', 3800, 3499, 0, 1, [['42 Packs', 3800, 3499, 9]]],
  ['Forge Caffeine 200mg', 'فورج كافيين 200 مجم', 'pre-workout', 'Forge Sports', 1000, 650, 1, 1, [['100 Tablets', 1000, 650, 50]]],
  ['Vanguard Surge Pre-Workout', 'فانجارد سيرج بري ورك أوت', 'pre-workout', 'Vanguard', 1800, 1590, 1, 1.5, [['30 Servings', 1800, 1590, 24], ['60 Servings', 3100, 2790, 12]]],
  ['Titan Energy Drink RTD', 'تيتان مشروب طاقة جاهز', 'pre-workout', 'Titan Labs', 200, 150, 0, 1, [['Cherry', 200, 150, 120], ['Orange', 200, 150, 90], ['Watermelon', 200, 150, 75]]],
  ['PureCore Daily Multivitamin', 'بيور كور مالتي فيتامين يومي', 'vitamins', 'PureCore', 1400, 1250, 1, 1, [['90 Tablets', 1400, 1250, 40]]],
  ['Nova Omega-3 Fish Oil', 'نوفا أوميجا 3', 'vitamins', 'Nova Pharma', 950, null, 0, 1, [['90 Softgels', 950, null, 33], ['180 Softgels', 1700, 1550, 18]]],
  ['PureCore Vitamin D3 + K2', 'بيور كور فيتامين د3 + ك2', 'vitamins', 'PureCore', 650, 590, 0, 1, [['60 Capsules', 650, 590, 45]]],
  ['Titan Men’s Test Support', 'تيتان دعم الرجال', 'vitamins', 'Titan Labs', 1150, null, 0, 1, [['60 Tablets', 1150, null, 20], ['90 Tablets', 1650, 1490, 14]]],
  ['Apex Serious Mass', 'أبكس سيريوس ماس', 'weight-gainers', 'Apex Nutrition', 2700, 2450, 1, 1, [['6 Lbs', 2700, 2450, 15], ['12 Lbs', 4900, 4500, 8]]],
  ['Forge Mass Gainer 3kg', 'فورج ماس جينر 3 كجم', 'weight-gainers', 'Forge Sports', 2200, null, 0, 1, [['3 kg', 2200, null, 12]]],
  ['Titan Protein Bar Box', 'تيتان بروتين بار علبة', 'protein-bars', 'Titan Labs', 650, 580, 1, 1, [['Box of 12 - Choco', 650, 580, 40], ['Box of 12 - Caramel', 650, 580, 35]]],
  ['Vanguard Crunch Bar', 'فانجارد كرانش بار', 'protein-bars', 'Vanguard', 60, null, 0, 1, [['Single - Cookies', 60, null, 200], ['Single - Peanut', 60, null, 160]]],
  ['Pre Supplements Shaker 700ml', 'شيكر بري سابلمنتس 700 مل', 'accessories', 'Forge Sports', 180, 150, 0, 2, 100],
  ['Pre Supplements Gym Bottle 1L', 'زجاجة جيم بري سابلمنتس 1 لتر', 'accessories', 'Forge Sports', 220, null, 0, 2, 80],
];

const descs = {
  protein: ['High-quality protein for muscle recovery and growth. Mixes easily, great taste.', 'بروتين عالي الجودة لدعم بناء العضلات والاستشفاء. سهل الخلط وطعمه ممتاز.'],
  creatine: ['Pure creatine to support strength, power and training performance.', 'كرياتين نقي لدعم القوة والأداء أثناء التمرين.'],
  'fat-burners': ['Thermogenic support to complement a calorie-controlled diet and training.', 'مكمل ثيرموجينيك يدعم نظامك الغذائي والتمرين.'],
  'pre-workout': ['Energy and focus before training. Start with a half serving to assess tolerance.', 'طاقة وتركيز قبل التمرين. ابدأ بنص جرعة لتقييم التحمل.'],
  vitamins: ['Daily essentials to support overall health and wellbeing.', 'أساسيات يومية لدعم الصحة العامة.'],
  'weight-gainers': ['Calorie-dense formula to help you reach your mass goals.', 'تركيبة عالية السعرات لمساعدتك على زيادة الوزن.'],
  'protein-bars': ['A convenient high-protein snack, anywhere, anytime.', 'سناك غني بالبروتين في أي وقت وأي مكان.'],
  accessories: ['Durable gym essentials built for daily use.', 'إكسسوارات جيم متينة للاستخدام اليومي.'],
};

function seedDemo() {
  if (q.get('SELECT id FROM products LIMIT 1') || process.env.SEED_DEMO === '0' || (process.env.VERCEL && process.env.SEED_DEMO !== 'force')) return;
  tx(() => {
    const cat = {}, brand = {};
    CATS.forEach(([slug, en, ar, icon], i) => { cat[slug] = Number(q.run('INSERT INTO categories(slug,name_en,name_ar,icon,sort) VALUES (?,?,?,?,?)', slug, en, ar, icon, i).lastInsertRowid); });
    BRANDS.forEach((b) => { brand[b] = Number(q.run('INSERT INTO brands(slug,name) VALUES (?,?)', b.toLowerCase().replace(/[^a-z0-9]+/g, '-'), b).lastInsertRowid); });
    for (const [en, ar, c, b, price, sale, feat, cb, vars] of P) {
      const [de, da] = descs[c];
      const slug = en.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const stock = Array.isArray(vars) ? vars.reduce((s, v) => s + v[3], 0) : vars;
      const pid = Number(q.run(
        `INSERT INTO products(slug,name_en,name_ar,desc_en,desc_ar,category_id,brand_id,price,sale_price,stock,featured,cashback_pct,sold) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        slug, en, ar, de, da, cat[c], brand[b], price, sale, stock, feat, cb, Math.floor(Math.random() * 80)).lastInsertRowid);
      if (Array.isArray(vars)) for (const [label, p, s, st] of vars) q.run('INSERT INTO variants(product_id,label,price,sale_price,stock) VALUES (?,?,?,?,?)', pid, label, p, s, st);
    }
    q.run(`INSERT INTO coupons(code,type,value,min_order,max_uses) VALUES ('WELCOME10','percent',10,500,0)`);
    q.run(`INSERT INTO coupons(code,type,value,min_order,max_uses) VALUES ('SAVE100','fixed',100,1500,100)`);
  });
  console.log('تم إضافة بيانات تجريبية (منتجات/أقسام/كوبونات). لإيقافها ضع SEED_DEMO=0');
}

module.exports = { ensureAdmin, seedDemo };
