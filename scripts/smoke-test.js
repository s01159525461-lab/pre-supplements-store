'use strict';
// اختبار شامل للباك اند. بيشغّل سيرفر على قاعدة بيانات مؤقتة ويجرّب كل المسارات المهمة.
// التشغيل: npm test   (أو)   node --disable-warning=ExperimentalWarning scripts/smoke-test.js
const { spawn } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const PORT = 3200 + Math.floor(Math.random() * 500);
const BASE = `http://127.0.0.1:${PORT}`;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'if-test-'));
const ADMIN = { email: 'admin@test.local', password: 'Sup3r-Secret-1' };

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) { pass++; console.log('  ✓', msg); } else { fail++; console.log('  ✗ FAIL:', msg); } };

class Client {
  constructor() { this.cookie = ''; }
  async req(method, url, body, headers = {}) {
    const res = await fetch(BASE + url, {
      method, redirect: 'manual',
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(this.cookie ? { Cookie: this.cookie } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const sc = res.headers.get('set-cookie');
    if (sc) this.cookie = sc.split(';')[0];
    let data; const text = await res.text();
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data, headers: res.headers };
  }
}

(async () => {
  const srv = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(__dirname, '..', 'local-server.js')], {
    env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR: dir, ADMIN_EMAIL: ADMIN.email, ADMIN_PASSWORD: ADMIN.password },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((resolve) => { srv.stdout.on('data', (d) => { if (String(d).includes('يعمل على')) resolve(); }); });

  try {
    const anon = new Client(), user = new Client(), admin = new Client(), user2 = new Client();

    console.log('\n[الواجهة والأمان]');
    let r = await anon.req('GET', '/');
    ok(r.status === 200 && String(r.data).includes('<html'), 'الصفحة الرئيسية بتفتح');
    ok(/default-src 'self'/.test(r.headers.get('content-security-policy') || ''), 'CSP موجود');
    ok(r.headers.get('x-content-type-options') === 'nosniff', 'nosniff موجود');
    r = await anon.req('GET', '/..%2f..%2fetc/passwd'); ok(r.status === 404, 'منع directory traversal');
    r = await anon.req('GET', '/api/admin/stats'); ok(r.status === 401, 'الأدمن محمي بدون دخول');

    console.log('\n[المنتجات]');
    r = await anon.req('GET', '/api/config'); ok(r.data.categories.length === 8 && r.data.brands.length === 6, 'الأقسام والبراندات');
    r = await anon.req('GET', '/api/products?per=100'); const all = r.data; ok(all.total === 23, `23 منتج (${all.total})`);
    r = await anon.req('GET', '/api/products?deals=1&per=100'); ok(r.data.items.every((p) => p.discount_pct > 0), 'فلتر العروض');
    r = await anon.req('GET', '/api/products?cat=creatine'); ok(r.data.items.length === 3 && r.data.items.every((p) => p.category_slug === 'creatine'), 'فلتر القسم');
    r = await anon.req('GET', '/api/products?search=' + encodeURIComponent('كرياتين')); ok(r.data.total >= 3, 'بحث عربي');
    r = await anon.req('GET', "/api/products?search=' OR 1=1 --"); ok(r.status === 200 && r.data.total === 0, 'SQL injection في البحث بيرجع صفر');
    r = await anon.req('GET', '/api/products?sort=price_asc&per=100'); const ps = r.data.items.map((p) => p.min_price);
    ok(ps[0] <= ps[ps.length - 1], 'ترتيب بالسعر');
    r = await anon.req('GET', '/api/products/titan-whey-isolate'); const iso = r.data;
    ok(iso.variants.length === 3 && iso.related.length > 0, 'تفاصيل منتج + أحجام + منتجات مشابهة');

    console.log('\n[الحسابات]');
    r = await user.req('POST', '/api/auth/register', { name: 'أحمد', email: 'ahmed@test.local', password: 'short' }); ok(r.status === 400, 'رفض كلمة سر ضعيفة');
    r = await user.req('POST', '/api/auth/register', { name: 'أحمد', email: 'ahmed@test.local', password: 'password123', phone: '01012345678' }); ok(r.status === 200 && r.data.user.role === 'customer', 'تسجيل مستخدم');
    ok(/HttpOnly/i.test(r.headers.get('set-cookie')) && /SameSite=Strict/i.test(r.headers.get('set-cookie')), 'الكوكي HttpOnly + SameSite');
    r = await anon.req('POST', '/api/auth/register', { name: 'x2', email: 'ahmed@test.local', password: 'password123' }); ok(r.status === 409, 'منع تكرار الإيميل');
    r = await user.req('GET', '/api/me'); ok(r.data.user?.email === 'ahmed@test.local', '/api/me');
    r = await anon.req('POST', '/api/auth/login', { email: 'ahmed@test.local', password: 'wrongwrong' }); ok(r.status === 401, 'رفض كلمة سر غلط');
    r = await user.req('POST', '/api/auth/register', { name: 'x', email: 'e@test.local', password: 'password123' }, { Origin: 'http://evil.example' }); ok(r.status === 403, 'CSRF: رفض Origin غريب');
    r = await user.req('GET', '/api/admin/stats'); ok(r.status === 403, 'العميل مش أدمن (403)');
    r = await admin.req('POST', '/api/auth/login', ADMIN); ok(r.status === 200 && r.data.user.role === 'admin', 'دخول الأدمن');

    console.log('\n[الطلبات: التسعير والمخزون]');
    const v1 = iso.variants[0]; // 1.3 Lbs 1999
    r = await anon.req('POST', '/api/orders', { items: [{ product_id: iso.id, qty: 1 }], customer: {}, payment_method: 'cod' }); ok(r.status === 400, 'رفض بيانات ناقصة');
    const cust = { name: 'أحمد علي', phone: '01012345678', city: 'المنصورة', address: 'شارع الجمهورية 12' };
    r = await anon.req('POST', '/api/orders', { items: [{ product_id: iso.id, qty: 1 }], customer: cust, payment_method: 'cod' }); ok(r.status === 400, 'لازم تختار الحجم');
    r = await anon.req('POST', '/api/orders', { items: [{ product_id: iso.id, variant_id: v1.id, qty: 1, price: 1 }], customer: cust, payment_method: 'cod' });
    ok(r.status === 200 && r.data.subtotal === v1.sale_price, `السعر من السيرفر مش من العميل (${r.data.subtotal})`);
    ok(r.data.shipping === 60 && r.data.total === v1.sale_price + 60, 'مصاريف الشحن');
    const guestCode = r.data.code;
    r = await anon.req('POST', '/api/orders', { items: [{ product_id: iso.id, variant_id: v1.id, qty: 999 }], customer: cust, payment_method: 'cod' }); ok(r.status === 400 || r.status === 409, 'رفض كمية غير منطقية');
    r = await anon.req('POST', '/api/orders', { items: [{ product_id: iso.id, variant_id: v1.id, qty: 20 }], customer: cust, payment_method: 'cod' });
    r = await anon.req('POST', '/api/orders', { items: [{ product_id: iso.id, variant_id: v1.id, qty: 20 }], customer: cust, payment_method: 'cod' });
    ok(r.status === 409, 'منع البيع بأكتر من المخزون');
    r = await anon.req('GET', `/api/orders/track?code=${guestCode}&phone=01012345678`); ok(r.status === 200 && r.data.code === guestCode, 'تتبع الطلب بالكود + الموبايل');
    r = await anon.req('GET', `/api/orders/track?code=${guestCode}&phone=01099999999`); ok(r.status === 404, 'تتبع بموبايل غلط مرفوض');

    console.log('\n[كوبونات + كاش باك + دفع أونلاين]');
    const whey = (await anon.req('GET', '/api/products/apex-gold-whey-100')).data; const wv = whey.variants[1];
    r = await user.req('POST', '/api/cart/quote', { items: [{ product_id: whey.id, variant_id: wv.id, qty: 1 }], coupon: 'WELCOME10' });
    ok(r.data.discount === Math.round(wv.sale_price * 0.1 * 100) / 100, `كوبون 10% (${r.data.discount})`);
    r = await anon.req('POST', '/api/coupons/validate', { code: 'NOPE', subtotal: 5000 }); ok(r.status === 400, 'كوبون غلط');
    r = await user.req('POST', '/api/orders', { items: [{ product_id: whey.id, variant_id: wv.id, qty: 1 }], customer: cust, payment_method: 'online', coupon: 'welcome10' });
    ok(r.status === 200 && r.data.payment?.url?.startsWith('/pay/'), 'طلب أونلاين + رابط دفع');
    const onl = r.data; ok(onl.discount > 0 && onl.shipping === 60 - 60 + (onl.subtotal - onl.discount >= 2500 ? 0 : 60), 'خصم + شحن');
    const tok = new URL(onl.payment.url, BASE).searchParams.get('t');
    r = await anon.req('POST', `/api/payments/sandbox/${onl.code}`, { token: 'bad', success: true }); ok(r.status === 403, 'رفض رمز دفع مزيّف');
    r = await anon.req('POST', `/api/payments/sandbox/${onl.code}`, { token: tok, success: true }); ok(r.data.payment_status === 'paid', 'تأكيد الدفع');
    r = await user.req('GET', '/api/orders'); const mine = r.data.items.find((o) => o.code === onl.code); ok(mine.status === 'confirmed' && mine.payment_status === 'paid', 'الطلب اتأكد تلقائيًا بعد الدفع');
    r = await user.req('GET', '/api/me'); const balBefore = r.data.user.cashback_balance;

    console.log('\n[لوحة الأدمن]');
    r = await admin.req('GET', '/api/admin/stats'); ok(r.data.orders >= 2 && r.data.customers === 1, 'إحصائيات');
    r = await admin.req('PATCH', `/api/admin/orders/${onl.code}`, { status: 'shipped' }); ok(r.data.status === 'shipped', 'شحن الطلب');
    r = await admin.req('PATCH', `/api/admin/orders/${onl.code}`, { status: 'pending' }); ok(r.status === 400, 'منع الرجوع لحالة أقدم');
    r = await admin.req('PATCH', `/api/admin/orders/${onl.code}`, { status: 'delivered' }); ok(r.data.status === 'delivered' && r.data.cashback_credited === 1, 'تسليم + إضافة الكاش باك');
    r = await user.req('GET', '/api/me'); ok(r.data.user.cashback_balance > balBefore, `رصيد الكاش باك زاد (${r.data.user.cashback_balance})`);
    r = await admin.req('PATCH', `/api/admin/orders/${onl.code}`, { status: 'cancelled' }); ok(r.status === 400, 'مينفعش تلغي طلب مُسلَّم');
    // إلغاء يرجّع المخزون
    const before = (await anon.req('GET', '/api/products/' + iso.slug)).data.variants[0].stock;
    r = await admin.req('PATCH', `/api/admin/orders/${guestCode}`, { status: 'cancelled' }); ok(r.data.status === 'cancelled', 'إلغاء طلب');
    const after = (await anon.req('GET', '/api/products/' + iso.slug)).data.variants[0].stock; ok(after === before + 1, 'المخزون رجع بعد الإلغاء');
    // استخدام الكاش باك
    r = await user.req('POST', '/api/cart/quote', { items: [{ product_id: whey.id, variant_id: wv.id, qty: 1 }], use_cashback: true });
    ok(r.data.cashback_used > 0 && r.data.cashback_used <= Math.floor(r.data.subtotal * 0.2), `استخدام الكاش باك بحد أقصى 20% (${r.data.cashback_used})`);

    console.log('\n[CRUD للأدمن]');
    const newP = { name_en: 'Test Product', name_ar: 'منتج تجريبي', price: 500, sale_price: 400, stock: 10, category_id: 1, brand_id: 1, variants: [{ label: '1kg', price: 500, sale_price: 400, stock: 7 }, { label: '2kg', price: 900, stock: 3 }] };
    r = await admin.req('POST', '/api/admin/products', newP); ok(r.status === 200 && r.data.id, 'إضافة منتج'); const pid = r.data.id;
    r = await admin.req('GET', '/api/admin/products/' + pid); ok(r.data.variants.length === 2 && r.data.stock === 10, 'المخزون اتجمّع من الأحجام');
    r = await admin.req('PUT', '/api/admin/products/' + pid, { ...newP, images: ['/uploads/a.png', '/uploads/b.png', 'http://evil/x.png'], variants: r.data.variants }); ok(r.data.ok, 'حفظ صور متعددة');
    r = await admin.req('GET', '/api/admin/products/' + pid); ok(r.data.images.length === 2 && r.data.image === '/uploads/a.png', 'الصور المتعددة والرئيسية');
    r = await admin.req('PUT', '/api/admin/products/' + pid, { ...newP, name_ar: 'منتج معدّل', variants: [r.data.variants[0]] }); ok(r.data.ok, 'تعديل منتج');
    r = await anon.req('GET', '/api/products/test-product'); ok(r.data.name_ar === 'منتج معدّل' && r.data.variants.length === 1, 'التعديل ظهر للعملاء');
    r = await admin.req('POST', '/api/admin/coupons', { code: 'ramadan20', type: 'percent', value: 20, max_uses: 1 }); ok(r.status === 200, 'إضافة كوبون');
    r = await admin.req('POST', '/api/admin/coupons', { code: 'RAMADAN20', type: 'percent', value: 20 }); ok(r.status === 409, 'منع تكرار الكوبون');
    r = await admin.req('POST', '/api/admin/categories', { name_en: 'Snacks', name_ar: 'سناكس' }); ok(r.status === 200, 'إضافة قسم');
    r = await admin.req('POST', '/api/admin/brands', { name: 'NewBrand' }); ok(r.status === 200, 'إضافة براند');
    r = await admin.req('PUT', '/api/admin/settings', { shipping_fee: 75 }); ok(r.data.shipping_fee === '75', 'تعديل الإعدادات');
    r = await admin.req('PUT', '/api/admin/settings', { shipping_fee: 60 });
    r = await admin.req('GET', '/api/admin/orders.csv'); ok(String(r.data).includes('code,created_at'), 'تصدير CSV');
    r = await admin.req('GET', '/api/admin/orders?status=delivered'); ok(r.data.items.length === 1, 'فلتر الطلبات');
    r = await admin.req('PATCH', '/api/admin/users/1', { active: false }); ok(r.status === 400, 'الأدمن مينفعش يوقف نفسه');
    const png = 'data:image/png;base64,' + Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]).toString('base64');
    r = await admin.req('POST', '/api/admin/upload', { data: png }); ok(r.status === 200 && r.data.url.startsWith('/uploads/'), 'رفع صورة');
    const up = await anon.req('GET', r.data.url); ok(up.status === 200, 'الصورة المرفوعة بتتعرض');
    r = await admin.req('POST', '/api/admin/upload', { data: 'data:image/png;base64,' + Buffer.from('<script>alert(1)</script>').toString('base64') }); ok(r.status === 400, 'رفض ملف مش صورة حقيقية');

    console.log('\n[التقييمات]');
    r = await user.req('POST', `/api/products/${iso.id}/reviews`, { rating: 5, comment: 'ممتاز <b>جدًا</b>' }); ok(r.status === 200, 'إضافة تقييم');
    r = await anon.req('GET', '/api/products/' + iso.slug); ok(r.data.reviews.length === 0, 'التقييم مخفي لحد الموافقة');
    r = await admin.req('GET', '/api/admin/reviews'); const rv = r.data.items[0];
    r = await admin.req('PATCH', '/api/admin/reviews/' + rv.id, { approved: true }); ok(r.data.ok, 'موافقة الأدمن');
    r = await anon.req('GET', '/api/products/' + iso.slug); ok(r.data.reviews.length === 1 && r.data.rating === 5, 'التقييم ظهر وبيتحسب');

    console.log('\n[حماية]');
    let blocked = false;
    for (let i = 0; i < 12; i++) { r = await anon.req('POST', '/api/auth/login', { email: 'ahmed@test.local', password: 'bad-password-' + i }); if (r.status === 429) { blocked = true; break; } }
    ok(blocked, 'حد محاولات تسجيل الدخول (429)');
    r = await anon.req('POST', '/api/orders', 'x'); ok([400, 415].includes(r.status), 'رفض جسم طلب غير صالح');
  } catch (e) {
    fail++; console.error('\nاستثناء غير متوقع:', e);
  } finally {
    srv.kill();
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(`\nالنتيجة: ${pass} نجح، ${fail} فشل`);
  process.exit(fail ? 1 : 0);
})();
