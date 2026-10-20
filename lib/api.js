'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { q, tx, getSettings, DATA_DIR, REMOTE } = require('./db');
const { Router, HttpError, readJson, readBody } = require('./http');
const A = require('./auth');
const { getProvider, checkPayToken } = require('./payments');
const wa = require('./whatsapp');

const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
if (!REMOTE) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const r = new Router();

/* ------------------------------ helpers ------------------------------ */
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const eff = (price, sale) => (sale != null && sale > 0 && sale < price ? sale : price);

function str(v, { min = 0, max = 500, field = 'field', required = false } = {}) {
  if (v == null || v === '') { if (required) throw new HttpError(400, `${field} مطلوب`); return ''; }
  if (typeof v !== 'string') throw new HttpError(400, `${field} غير صالح`);
  const s = v.trim();
  if (s.length < min || (required && !s.length)) throw new HttpError(400, `${field} قصير جدًا`);
  if (s.length > max) throw new HttpError(400, `${field} طويل جدًا`);
  return s;
}
function num(v, { min = 0, max = 1e9, field = 'field', allowNull = false } = {}) {
  if ((v == null || v === '') && allowNull) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw new HttpError(400, `${field} غير صالح`);
  return n;
}
const int = (v, o) => { const n = num(v, o); return n == null ? null : Math.trunc(n); };
const flag = (v) => (v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0);
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
function cleanPhone(p) {
  const s = String(p || '').replace(/[\s\-()]/g, '');
  if (!/^\+?\d{9,15}$/.test(s)) throw new HttpError(400, 'رقم الموبايل غير صالح');
  return s;
}
function slugify(s) {
  const base = String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70);
  return base || 'item-' + crypto.randomBytes(3).toString('hex');
}
function uniqueSlug(table, base, ignoreId = 0) {
  let slug = slugify(base), i = 1;
  while (q.get(`SELECT id FROM ${table} WHERE slug=? AND id<>?`, slug, ignoreId)) slug = `${slugify(base)}-${++i}`;
  return slug;
}
function audit(ctx, action, detail) {
  q.run('INSERT INTO audit_log(user_id,action,detail,ip) VALUES (?,?,?,?)', ctx.user?.id ?? null, action, String(detail ?? '').slice(0, 500), ctx.ip);
}
function pageParams(query, defPer = 12, maxPer = 60) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const per = Math.min(maxPer, Math.max(1, parseInt(query.per) || defPer));
  return { page, per, offset: (page - 1) * per };
}

/* ------------------------------ middleware ------------------------------ */
function loadUser(ctx) {
  const tok = A.parseCookies(ctx.req).session;
  const p = tok && A.verifyToken(tok);
  if (p) {
    const u = q.get('SELECT id,name,email,phone,role,cashback_balance,active FROM users WHERE id=?', p.uid);
    if (u && u.active) ctx.user = u;
  }
}
const requireUser = (ctx) => { if (!ctx.user) throw new HttpError(401, 'سجّل دخولك الأول'); };
const requireAdmin = (ctx) => { requireUser(ctx); if (ctx.user.role !== 'admin') throw new HttpError(403, 'غير مسموح'); };
const limit = (name, max, ms) => (ctx) => {
  if (!A.rateLimit(`${name}:${ctx.ip}`, max, ms)) throw new HttpError(429, 'محاولات كتير، حاول تاني بعد شوية');
};

/* ------------------------------ products ------------------------------ */
const PRODUCT_SELECT = `
  SELECT p.id,p.slug,p.name_en,p.name_ar,p.image,p.price,p.sale_price,p.stock,p.featured,p.active,p.cashback_pct,p.sold,p.created_at,
         p.category_id,p.brand_id,c.slug AS category_slug,c.name_en AS category_en,c.name_ar AS category_ar,
         b.slug AS brand_slug,b.name AS brand_name,
         (SELECT ROUND(AVG(rating),1) FROM reviews rv WHERE rv.product_id=p.id AND rv.approved=1) AS rating,
         (SELECT COUNT(*) FROM reviews rv WHERE rv.product_id=p.id AND rv.approved=1) AS rating_count,
         (SELECT COUNT(*) FROM variants v WHERE v.product_id=p.id) AS variant_count
  FROM products p
  LEFT JOIN categories c ON c.id=p.category_id
  LEFT JOIN brands b ON b.id=p.brand_id`;

function decorate(rows) {
  if (!rows.length) return rows;
  const ids = rows.map((x) => x.id);
  const vs = q.all(`SELECT * FROM variants WHERE product_id IN (${ids.map(() => '?').join(',')}) ORDER BY id`, ...ids);
  const by = {};
  for (const v of vs) (by[v.product_id] ||= []).push(v);
  for (const p of rows) {
    const list = by[p.id] || [];
    p.variants = list;
    const prices = list.length ? list.map((v) => eff(v.price, v.sale_price)) : [eff(p.price, p.sale_price)];
    p.min_price = Math.min(...prices);
    p.max_price = Math.max(...prices);
    const discs = (list.length ? list : [p]).map((v) => {
      const e = eff(v.price, v.sale_price);
      return e < v.price ? Math.round((1 - e / v.price) * 100) : 0;
    });
    p.discount_pct = Math.max(...discs);
    p.cashback = round2((p.min_price * p.cashback_pct) / 100);
  }
  return rows;
}

r.get('/api/config', (ctx) => {
  const s = getSettings();
  const pub = ['store_name', 'shipping_fee', 'free_shipping_over', 'cashback_enabled', 'currency', 'contact_phone', 'contact_email', 'announcement_ar', 'announcement_en', 'max_cashback_use_pct'];
  return {
    settings: Object.fromEntries(pub.map((k) => [k, s[k]])),
    categories: q.all(`SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id=c.id AND p.active=1) AS count FROM categories c ORDER BY sort,id`),
    brands: q.all(`SELECT b.*, (SELECT COUNT(*) FROM products p WHERE p.brand_id=b.id AND p.active=1) AS count FROM brands b ORDER BY name`),
    payment_provider: getProvider().name,
  };
});

r.get('/api/products', (ctx) => {
  const { cat, brand, search, sort, min, max, deals, featured, instock } = ctx.query;
  const where = ['p.active=1'], params = [];
  if (cat) { where.push('c.slug=?'); params.push(cat); }
  if (brand) { where.push('b.slug=?'); params.push(brand); }
  if (search) {
    const like = `%${String(search).slice(0, 60).replace(/[%_]/g, '')}%`;
    where.push('(p.name_en LIKE ? OR p.name_ar LIKE ? OR b.name LIKE ?)'); params.push(like, like, like);
  }
  if (min) { where.push('COALESCE(NULLIF(p.sale_price,0),p.price)>=?'); params.push(Number(min) || 0); }
  if (max) { where.push('COALESCE(NULLIF(p.sale_price,0),p.price)<=?'); params.push(Number(max) || 1e9); }
  if (deals === '1') where.push('(p.sale_price IS NOT NULL AND p.sale_price>0 AND p.sale_price<p.price)');
  if (featured === '1') where.push('p.featured=1');
  if (instock === '1') where.push('p.stock>0');
  const orderBy = {
    popular: 'p.sold DESC, p.id DESC', latest: 'p.id DESC',
    price_asc: 'COALESCE(NULLIF(p.sale_price,0),p.price) ASC', price_desc: 'COALESCE(NULLIF(p.sale_price,0),p.price) DESC',
    discount: '(CASE WHEN p.sale_price>0 AND p.sale_price<p.price THEN 1-p.sale_price/p.price ELSE 0 END) DESC',
  }[sort] || 'p.featured DESC, p.sold DESC, p.id DESC';
  const { page, per, offset } = pageParams(ctx.query);
  const base = `FROM products p LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN brands b ON b.id=p.brand_id WHERE ${where.join(' AND ')}`;
  const total = q.get(`SELECT COUNT(*) n ${base}`, ...params).n;
  const ids = q.all(`SELECT p.id ${base} ORDER BY ${orderBy} LIMIT ? OFFSET ?`, ...params, per, offset).map((x) => x.id);
  let items = [];
  if (ids.length) {
    const map = Object.fromEntries(decorate(q.all(`${PRODUCT_SELECT} WHERE p.id IN (${ids.map(() => '?').join(',')})`, ...ids)).map((x) => [x.id, x]));
    items = ids.map((id) => map[id]);
  }
  return { items, total, page, pages: Math.max(1, Math.ceil(total / per)) };
});

r.get('/api/products/:slug', (ctx) => {
  const row = q.get(`${PRODUCT_SELECT} WHERE p.slug=? AND p.active=1`, ctx.params.slug);
  if (!row) throw new HttpError(404, 'المنتج غير موجود');
  const full = q.get('SELECT desc_en,desc_ar FROM products WHERE id=?', row.id);
  const [p] = decorate([{ ...row, ...full }]);
  p.images = q.all('SELECT url FROM product_images WHERE product_id=? ORDER BY sort,id', p.id).map((x) => x.url);
  p.reviews = q.all(`SELECT rv.id,rv.rating,rv.comment,rv.created_at,u.name AS user_name FROM reviews rv JOIN users u ON u.id=rv.user_id WHERE rv.product_id=? AND rv.approved=1 ORDER BY rv.id DESC LIMIT 50`, p.id);
  p.related = decorate(q.all(`${PRODUCT_SELECT} WHERE p.active=1 AND p.id<>? AND (p.category_id=? OR p.brand_id=?) ORDER BY p.sold DESC LIMIT 4`, p.id, p.category_id, p.brand_id));
  if (ctx.user) p.in_wishlist = !!q.get('SELECT 1 x FROM wishlist WHERE user_id=? AND product_id=?', ctx.user.id, p.id);
  return p;
});

r.post('/api/products/:id/reviews', limit('review', 10, 3600_000), (ctx) => {
  requireUser(ctx);
  const pid = int(ctx.params.id, { min: 1, field: 'product' });
  if (!q.get('SELECT id FROM products WHERE id=? AND active=1', pid)) throw new HttpError(404, 'المنتج غير موجود');
  const rating = int(ctx.body.rating, { min: 1, max: 5, field: 'التقييم' });
  const comment = str(ctx.body.comment, { max: 1000, field: 'التعليق' });
  q.run(`INSERT INTO reviews(product_id,user_id,rating,comment,approved) VALUES (?,?,?,?,0)
         ON CONFLICT(product_id,user_id) DO UPDATE SET rating=excluded.rating, comment=excluded.comment, approved=0, created_at=datetime('now')`, pid, ctx.user.id, rating, comment);
  return { ok: true, message: 'شكرًا! تقييمك هيظهر بعد مراجعة الإدارة.' };
});

/* ------------------------------ auth ------------------------------ */
function startSession(ctx, user) {
  const secure = ctx.secure;
  A.setAuthCookie(ctx.res, A.signToken({ uid: user.id, role: user.role }), secure);
}
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, cashback_balance: u.cashback_balance });

r.post('/api/auth/register', limit('register', 10, 3600_000), (ctx) => {
  const name = str(ctx.body.name, { min: 2, max: 80, field: 'الاسم', required: true });
  const email = str(ctx.body.email, { max: 254, field: 'الإيميل', required: true }).toLowerCase();
  if (!EMAIL_RE.test(email)) throw new HttpError(400, 'الإيميل غير صالح');
  const phone = ctx.body.phone ? cleanPhone(ctx.body.phone) : null;
  const pw = str(ctx.body.password, { min: 8, max: 128, field: 'كلمة السر', required: true });
  if (q.get('SELECT id FROM users WHERE email=?', email)) throw new HttpError(409, 'الإيميل ده مسجّل قبل كده');
  const res = q.run('INSERT INTO users(name,email,phone,password_hash) VALUES (?,?,?,?)', name, email, phone, A.hashPassword(pw));
  const user = q.get('SELECT * FROM users WHERE id=?', Number(res.lastInsertRowid));
  startSession(ctx, user);
  return { user: publicUser(user) };
});

r.post('/api/auth/login', (ctx) => {
  const email = str(ctx.body.email, { max: 254, required: true, field: 'الإيميل' }).toLowerCase();
  if (!A.rateLimit(`login:${ctx.ip}:${email}`, 8, 15 * 60_000) || !A.rateLimit(`loginip:${ctx.ip}`, 40, 15 * 60_000))
    throw new HttpError(429, 'محاولات دخول كتير، جرّب بعد 15 دقيقة');
  const pw = typeof ctx.body.password === 'string' ? ctx.body.password.slice(0, 128) : '';
  const u = q.get('SELECT * FROM users WHERE email=?', email);
  // نفس الزمن تقريبًا حتى لو المستخدم مش موجود
  const ok = A.verifyPassword(pw, u ? u.password_hash : 's1$00$00');
  if (!u || !ok || !u.active) throw new HttpError(401, 'الإيميل أو كلمة السر غلط');
  startSession(ctx, u);
  return { user: publicUser(u) };
});

r.post('/api/auth/logout', (ctx) => { A.clearAuthCookie(ctx.res); return { ok: true }; });

r.get('/api/me', (ctx) => ({ user: ctx.user ? publicUser(ctx.user) : null }));

r.put('/api/me', (ctx) => {
  requireUser(ctx);
  const name = str(ctx.body.name, { min: 2, max: 80, required: true, field: 'الاسم' });
  const phone = ctx.body.phone ? cleanPhone(ctx.body.phone) : null;
  q.run('UPDATE users SET name=?, phone=? WHERE id=?', name, phone, ctx.user.id);
  return { user: publicUser(q.get('SELECT * FROM users WHERE id=?', ctx.user.id)) };
});

r.put('/api/me/password', limit('pw', 10, 3600_000), (ctx) => {
  requireUser(ctx);
  const u = q.get('SELECT * FROM users WHERE id=?', ctx.user.id);
  if (!A.verifyPassword(String(ctx.body.current || ''), u.password_hash)) throw new HttpError(400, 'كلمة السر الحالية غلط');
  const pw = str(ctx.body.password, { min: 8, max: 128, required: true, field: 'كلمة السر الجديدة' });
  q.run('UPDATE users SET password_hash=? WHERE id=?', A.hashPassword(pw), u.id);
  return { ok: true };
});

/* ------------------------------ wishlist ------------------------------ */
r.get('/api/wishlist', (ctx) => {
  requireUser(ctx);
  return { items: decorate(q.all(`${PRODUCT_SELECT} WHERE p.active=1 AND p.id IN (SELECT product_id FROM wishlist WHERE user_id=?)`, ctx.user.id)) };
});
r.post('/api/wishlist/:id', (ctx) => {
  requireUser(ctx);
  const pid = int(ctx.params.id, { min: 1 });
  if (!q.get('SELECT id FROM products WHERE id=?', pid)) throw new HttpError(404, 'المنتج غير موجود');
  q.run('INSERT OR IGNORE INTO wishlist(user_id,product_id) VALUES (?,?)', ctx.user.id, pid);
  return { ok: true };
});
r.delete('/api/wishlist/:id', (ctx) => {
  requireUser(ctx);
  q.run('DELETE FROM wishlist WHERE user_id=? AND product_id=?', ctx.user.id, int(ctx.params.id, { min: 1 }));
  return { ok: true };
});

/* ------------------------------ coupons / pricing ------------------------------ */
function evalCoupon(code, subtotal) {
  const c = q.get('SELECT * FROM coupons WHERE code=? AND active=1', String(code || '').trim().toUpperCase());
  if (!c) throw new HttpError(400, 'كود الخصم غير صحيح');
  if (c.expires_at && c.expires_at < new Date().toISOString().slice(0, 10)) throw new HttpError(400, 'كود الخصم منتهي');
  if (c.max_uses > 0 && c.used >= c.max_uses) throw new HttpError(400, 'كود الخصم استُهلك بالكامل');
  if (subtotal < c.min_order) throw new HttpError(400, `الحد الأدنى للطلب لاستخدام الكود ${c.min_order}`);
  const discount = c.type === 'percent' ? round2((subtotal * c.value) / 100) : Math.min(subtotal, c.value);
  return { coupon: c, discount: round2(discount) };
}

/** يحسب الأسعار من قاعدة البيانات فقط (مش من العميل). */
function priceCart(rawItems, { forUpdate = false } = {}) {
  if (!Array.isArray(rawItems) || !rawItems.length) throw new HttpError(400, 'السلة فاضية');
  if (rawItems.length > 40) throw new HttpError(400, 'عدد المنتجات كبير');
  const lines = [];
  for (const it of rawItems) {
    const pid = int(it.product_id, { min: 1, field: 'منتج' });
    const qty = int(it.qty, { min: 1, max: 20, field: 'الكمية' });
    const p = q.get('SELECT * FROM products WHERE id=? AND active=1', pid);
    if (!p) throw new HttpError(400, 'منتج في السلة لم يعد متاحًا');
    const variants = q.all('SELECT * FROM variants WHERE product_id=?', pid);
    let v = null;
    if (variants.length) {
      v = variants.find((x) => x.id === Number(it.variant_id));
      if (!v) throw new HttpError(400, `اختر الحجم/النكهة للمنتج: ${p.name_ar}`);
    }
    const stock = v ? v.stock : p.stock;
    if (stock < qty) throw new HttpError(409, `الكمية المطلوبة من "${p.name_ar}" غير متوفرة (المتاح ${stock})`);
    const unit = v ? eff(v.price, v.sale_price) : eff(p.price, p.sale_price);
    lines.push({ product: p, variant: v, qty, unit, total: round2(unit * qty), name: p.name_ar, label: v ? v.label : '' });
  }
  const subtotal = round2(lines.reduce((s, l) => s + l.total, 0));
  return { lines, subtotal };
}
function shippingFor(amount) {
  const s = getSettings();
  return amount >= Number(s.free_shipping_over) && Number(s.free_shipping_over) > 0 ? 0 : Number(s.shipping_fee);
}

r.post('/api/cart/quote', (ctx) => {
  const { lines, subtotal } = priceCart(ctx.body.items);
  let discount = 0, couponInfo = null;
  if (ctx.body.coupon) {
    try { const e = evalCoupon(ctx.body.coupon, subtotal); discount = e.discount; couponInfo = { code: e.coupon.code, discount }; }
    catch (e) { couponInfo = { error: e.message }; }
  }
  const after = round2(subtotal - discount);
  const settings = getSettings();
  let cashbackAvail = 0;
  if (ctx.user && settings.cashback_enabled === '1' && ctx.body.use_cashback) {
    cashbackAvail = Math.min(ctx.user.cashback_balance, Math.floor((after * Number(settings.max_cashback_use_pct)) / 100));
  }
  const shipping = shippingFor(after);
  return {
    lines: lines.map((l) => ({ product_id: l.product.id, variant_id: l.variant?.id ?? null, qty: l.qty, unit: l.unit, total: l.total })),
    subtotal, discount, coupon: couponInfo, cashback_used: cashbackAvail, shipping,
    total: round2(after - cashbackAvail + shipping),
  };
});

r.post('/api/coupons/validate', limit('coupon', 30, 600_000), (ctx) => {
  const subtotal = num(ctx.body.subtotal, { min: 0, field: 'الإجمالي' });
  const e = evalCoupon(ctx.body.code, subtotal);
  return { code: e.coupon.code, discount: e.discount };
});

/* ------------------------------ orders ------------------------------ */
const RANK = { pending: 0, confirmed: 1, shipped: 2, delivered: 3 };

function newOrderCode() {
  for (;;) {
    const c = 'IF-' + crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
    if (!q.get('SELECT id FROM orders WHERE code=?', c)) return c;
  }
}
function orderWithItems(o) {
  return { ...o, items: q.all('SELECT * FROM order_items WHERE order_id=?', o.id) };
}

r.post('/api/orders', limit('order', 20, 3600_000), (ctx) => {
  const c = ctx.body.customer || {};
  const name = str(c.name, { min: 2, max: 80, required: true, field: 'الاسم' });
  const phone = cleanPhone(c.phone);
  const email = c.email ? str(c.email, { max: 254 }).toLowerCase() : null;
  if (email && !EMAIL_RE.test(email)) throw new HttpError(400, 'الإيميل غير صالح');
  const city = str(c.city, { min: 2, max: 60, required: true, field: 'المحافظة' });
  const address = str(c.address, { min: 5, max: 300, required: true, field: 'العنوان' });
  const notes = str(c.notes, { max: 300 });
  const method = ctx.body.payment_method;
  if (!['cod', 'online'].includes(method)) throw new HttpError(400, 'طريقة الدفع غير صالحة');

  const order = tx(() => {
    const { lines, subtotal } = priceCart(ctx.body.items);
    let discount = 0, couponCode = null;
    if (ctx.body.coupon) {
      const e = evalCoupon(ctx.body.coupon, subtotal);
      const upd = q.run('UPDATE coupons SET used=used+1 WHERE id=? AND (max_uses=0 OR used<max_uses)', e.coupon.id);
      if (!upd.changes) throw new HttpError(400, 'كود الخصم استُهلك بالكامل');
      discount = e.discount; couponCode = e.coupon.code;
    }
    const after = round2(subtotal - discount);
    const settings = getSettings();
    let cashbackUsed = 0;
    if (ctx.user && settings.cashback_enabled === '1' && ctx.body.use_cashback) {
      const bal = q.get('SELECT cashback_balance b FROM users WHERE id=?', ctx.user.id).b;
      cashbackUsed = Math.min(bal, Math.floor((after * Number(settings.max_cashback_use_pct)) / 100));
      if (cashbackUsed > 0) q.run('UPDATE users SET cashback_balance=cashback_balance-? WHERE id=?', cashbackUsed, ctx.user.id);
    }
    const shipping = shippingFor(after);
    const total = round2(after - cashbackUsed + shipping);
    const earned = settings.cashback_enabled === '1' ? round2(lines.reduce((s, l) => s + (l.total * l.product.cashback_pct) / 100, 0)) : 0;
    const code = newOrderCode();
    const res = q.run(
      `INSERT INTO orders(code,user_id,payment_method,subtotal,discount,shipping,total,coupon_code,cashback_earned,cashback_used,name,phone,email,city,address,notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      code, ctx.user?.id ?? null, method, subtotal, discount, shipping, total, couponCode, earned, cashbackUsed, name, phone, email, city, address, notes);
    const oid = Number(res.lastInsertRowid);
    for (const l of lines) {
      // خصم المخزون بشكل ذري: لو الكمية خلصت في نفس اللحظة الطلب يفشل
      if (l.variant) {
        const u = q.run('UPDATE variants SET stock=stock-? WHERE id=? AND stock>=?', l.qty, l.variant.id, l.qty);
        if (!u.changes) throw new HttpError(409, `"${l.name}" خلص من المخزون`);
      }
      const u2 = q.run('UPDATE products SET stock=stock-?, sold=sold+? WHERE id=? AND stock>=?', l.qty, l.qty, l.product.id, l.qty);
      if (!u2.changes) throw new HttpError(409, `"${l.name}" خلص من المخزون`);
      q.run('INSERT INTO order_items(order_id,product_id,variant_id,name,variant_label,price,qty) VALUES (?,?,?,?,?,?,?)',
        oid, l.product.id, l.variant?.id ?? null, l.name, l.label, l.unit, l.qty);
    }
    return q.get('SELECT * FROM orders WHERE id=?', oid);
  });

  wa.queue(order, 'created');
  const out = orderWithItems(order);
  if (method === 'online') {
    try { out.payment = getProvider().createSession(order); }
    catch (e) { out.payment = null; out.payment_error = 'تعذّر بدء الدفع الأونلاين، تواصل مع الدعم'; }
  }
  return out;
});

r.get('/api/orders', (ctx) => {
  requireUser(ctx);
  return { items: q.all('SELECT * FROM orders WHERE user_id=? ORDER BY id DESC LIMIT 100', ctx.user.id).map(orderWithItems) };
});

// تتبع الطلب: بالكود + رقم الموبايل (للضيوف) أو من حساب صاحب الطلب
r.get('/api/orders/track', limit('track', 30, 600_000), (ctx) => {
  const code = String(ctx.query.code || '').trim().toUpperCase();
  const o = q.get('SELECT * FROM orders WHERE code=?', code);
  const phone = String(ctx.query.phone || '').replace(/[\s\-()]/g, '');
  const mine = o && ctx.user && o.user_id === ctx.user.id;
  if (!o || (!mine && (!phone || !o.phone.endsWith(phone.slice(-8)) || phone.length < 8))) throw new HttpError(404, 'مفيش طلب بالبيانات دي');
  return orderWithItems(o);
});

// فتح جلسة دفع جديدة لطلب أونلاين لسه مدفعش
r.post('/api/orders/:code/pay', limit('paysession', 20, 600_000), (ctx) => {
  const o = q.get('SELECT * FROM orders WHERE code=?', ctx.params.code);
  const phone = String(ctx.body.phone || '').replace(/[\s\-()]/g, '');
  const mine = o && ctx.user && o.user_id === ctx.user.id;
  if (!o || (!mine && (phone.length < 8 || !o.phone.endsWith(phone.slice(-8))))) throw new HttpError(404, 'الطلب غير موجود');
  if (o.payment_method !== 'online' || o.payment_status === 'paid' || o.status === 'cancelled') throw new HttpError(400, 'لا يمكن الدفع لهذا الطلب');
  try { return getProvider().createSession(o); } catch { throw new HttpError(502, 'تعذّر بدء الدفع الأونلاين'); }
});

r.post('/api/orders/:code/cancel', (ctx) => {
  const o = q.get('SELECT * FROM orders WHERE code=?', ctx.params.code);
  const mine = o && ctx.user && o.user_id === ctx.user.id;
  if (!mine) throw new HttpError(404, 'الطلب غير موجود');
  if (o.status !== 'pending') throw new HttpError(400, 'مينفعش تلغي الطلب بعد تأكيده، كلّم الدعم');
  tx(() => applyStatus(o, 'cancelled'));
  wa.queue(q.get('SELECT * FROM orders WHERE id=?', o.id), 'cancelled');
  return orderWithItems(q.get('SELECT * FROM orders WHERE id=?', o.id));
});

/** تغيير حالة الطلب مع تبعاته (مخزون، كاش باك، كوبون). لازم تتنادى داخل tx. */
function applyStatus(o, next) {
  if (o.status === next) return;
  if (o.status === 'cancelled' || o.status === 'delivered') throw new HttpError(400, 'الطلب في حالة نهائية');
  if (next !== 'cancelled' && !(next in RANK && RANK[next] > RANK[o.status])) throw new HttpError(400, 'انتقال حالة غير مسموح');
  if (next === 'cancelled') {
    for (const it of q.all('SELECT * FROM order_items WHERE order_id=?', o.id)) {
      if (it.variant_id) q.run('UPDATE variants SET stock=stock+? WHERE id=?', it.qty, it.variant_id);
      if (it.product_id) q.run('UPDATE products SET stock=stock+?, sold=MAX(0,sold-?) WHERE id=?', it.qty, it.qty, it.product_id);
    }
    if (o.user_id && o.cashback_used > 0) q.run('UPDATE users SET cashback_balance=cashback_balance+? WHERE id=?', o.cashback_used, o.user_id);
    if (o.coupon_code) q.run('UPDATE coupons SET used=MAX(0,used-1) WHERE code=?', o.coupon_code);
    q.run(`UPDATE orders SET status='cancelled', payment_status=CASE WHEN payment_status='paid' THEN 'refunded' ELSE payment_status END, updated_at=datetime('now') WHERE id=?`, o.id);
    return;
  }
  if (next === 'delivered') {
    if (o.user_id && !o.cashback_credited && o.cashback_earned > 0)
      q.run('UPDATE users SET cashback_balance=cashback_balance+? WHERE id=?', o.cashback_earned, o.user_id);
    q.run(`UPDATE orders SET status='delivered', cashback_credited=1, payment_status=CASE WHEN payment_method='cod' THEN 'paid' ELSE payment_status END, updated_at=datetime('now') WHERE id=?`, o.id);
    return;
  }
  q.run(`UPDATE orders SET status=?, updated_at=datetime('now') WHERE id=?`, next, o.id);
}

/* ------------------------------ payments ------------------------------ */
function markPaid(code, ref, success) {
  return tx(() => {
    const o = q.get('SELECT * FROM orders WHERE code=?', code);
    if (!o || o.payment_method !== 'online' || o.payment_status === 'paid') return o;
    if (success) {
      q.run(`UPDATE orders SET payment_status='paid', payment_ref=?, status=CASE WHEN status='pending' THEN 'confirmed' ELSE status END, updated_at=datetime('now') WHERE id=?`, ref || null, o.id);
    } else {
      q.run(`UPDATE orders SET payment_status='failed', payment_ref=?, updated_at=datetime('now') WHERE id=?`, ref || null, o.id);
    }
    return q.get('SELECT * FROM orders WHERE code=?', code);
  });
}

// Webhook من بوابة الدفع (موقّع). الـ sandbox مبيستخدمهوش.
r.post('/api/payments/webhook', async (ctx) => {
  const raw = ctx.rawBody;
  const ev = getProvider().verifyWebhook(raw, ctx.req.headers);
  if (!ev) throw new HttpError(400, 'توقيع غير صالح');
  markPaid(ev.orderCode, ev.ref, ev.success);
  return { ok: true };
}, { raw: true });

// تأكيد/فشل الدفع في وضع التجربة فقط
r.post('/api/payments/sandbox/:code', (ctx) => {
  if (getProvider().name !== 'sandbox') throw new HttpError(404, 'غير متاح');
  if (!checkPayToken(ctx.params.code, ctx.body.token)) throw new HttpError(403, 'رمز الدفع غير صالح');
  const o = markPaid(ctx.params.code, 'SANDBOX-' + crypto.randomBytes(4).toString('hex'), !!ctx.body.success);
  if (!o) throw new HttpError(404, 'الطلب غير موجود');
  return { ok: true, payment_status: o.payment_status };
});

/* ------------------------------ admin ------------------------------ */
const adm = (...h) => h; // وضوح فقط
function guard(ctx) { requireAdmin(ctx); }

r.get('/api/admin/stats', guard, (ctx) => {
  const rev = q.get(`SELECT COALESCE(SUM(total),0) v, COUNT(*) n FROM orders WHERE status<>'cancelled'`);
  const paid = q.get(`SELECT COALESCE(SUM(total),0) v FROM orders WHERE payment_status='paid'`);
  const today = q.get(`SELECT COALESCE(SUM(total),0) v, COUNT(*) n FROM orders WHERE status<>'cancelled' AND date(created_at)=date('now')`);
  const byStatus = q.all('SELECT status, COUNT(*) n FROM orders GROUP BY status');
  const series = q.all(`SELECT date(created_at) d, COUNT(*) n, ROUND(SUM(total),2) v FROM orders WHERE status<>'cancelled' AND created_at>=date('now','-13 days') GROUP BY d ORDER BY d`);
  return {
    revenue: rev.v, orders: rev.n, paid_revenue: paid.v, today_revenue: today.v, today_orders: today.n,
    customers: q.get(`SELECT COUNT(*) n FROM users WHERE role='customer'`).n,
    products: q.get('SELECT COUNT(*) n FROM products').n,
    pending_reviews: q.get('SELECT COUNT(*) n FROM reviews WHERE approved=0').n,
    by_status: Object.fromEntries(byStatus.map((x) => [x.status, x.n])),
    series,
    top_products: q.all(`SELECT oi.name, SUM(oi.qty) qty, ROUND(SUM(oi.qty*oi.price),2) revenue FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.status<>'cancelled' GROUP BY oi.name ORDER BY qty DESC LIMIT 5`),
    low_stock: q.all('SELECT id,name_ar,name_en,stock FROM products WHERE active=1 AND stock<=5 ORDER BY stock LIMIT 8'),
  };
});

// ---- products
function readProductBody(b, id = 0) {
  const name_en = str(b.name_en, { min: 2, max: 150, required: true, field: 'الاسم بالإنجليزي' });
  const name_ar = str(b.name_ar, { min: 2, max: 150, required: true, field: 'الاسم بالعربي' });
  const variants = Array.isArray(b.variants) ? b.variants.slice(0, 60).map((v) => {
    const price = num(v.price, { min: 0.01, max: 1e7, field: 'سعر الحجم' });
    const sale = num(v.sale_price, { min: 0, max: 1e7, allowNull: true, field: 'سعر الخصم' });
    return {
      id: v.id ? int(v.id, { min: 1 }) : null, label: str(v.label, { min: 1, max: 80, required: true, field: 'اسم الحجم/النكهة' }),
      price, sale_price: sale && sale < price ? sale : null, stock: int(v.stock, { min: 0, max: 1e6, field: 'المخزون' }),
    };
  }) : [];
  const images = (Array.isArray(b.images) ? b.images : []).map((u) => String(u || '').trim()).filter((u) => /^\/uploads\/[\w.\-]{1,120}$/.test(u)).slice(0, 8);
  const price = num(b.price, { min: 0.01, max: 1e7, field: 'السعر' });
  const sale = num(b.sale_price, { min: 0, max: 1e7, allowNull: true, field: 'سعر الخصم' });
  return {
    name_en, name_ar, desc_en: str(b.desc_en, { max: 4000 }), desc_ar: str(b.desc_ar, { max: 4000 }),
    category_id: b.category_id ? int(b.category_id, { min: 1 }) : null, brand_id: b.brand_id ? int(b.brand_id, { min: 1 }) : null,
    price, sale_price: sale && sale < price ? sale : null, images, image: images.length ? images[0] : str(b.image, { max: 300 }),
    stock: int(b.stock ?? 0, { min: 0, max: 1e6, field: 'المخزون' }), featured: flag(b.featured), active: b.active === undefined ? 1 : flag(b.active),
    cashback_pct: num(b.cashback_pct ?? 1, { min: 0, max: 50, field: 'الكاش باك' }), variants,
  };
}
function saveImages(pid, images) {
  q.run('DELETE FROM product_images WHERE product_id=?', pid);
  if (images.length) q.run(`INSERT INTO product_images(product_id,url,sort) VALUES ${images.map(() => '(?,?,?)').join(',')}`, ...images.flatMap((u, i) => [pid, u, i]));
}
function saveVariants(pid, variants, base) {
  const keep = [];
  for (const v of variants) {
    if (v.id && q.get('SELECT id FROM variants WHERE id=? AND product_id=?', v.id, pid)) {
      q.run('UPDATE variants SET label=?,price=?,sale_price=?,stock=? WHERE id=?', v.label, v.price, v.sale_price, v.stock, v.id);
      keep.push(v.id);
    } else {
      keep.push(Number(q.run('INSERT INTO variants(product_id,label,price,sale_price,stock) VALUES (?,?,?,?,?)', pid, v.label, v.price, v.sale_price, v.stock).lastInsertRowid));
    }
  }
  if (keep.length) q.run(`DELETE FROM variants WHERE product_id=? AND id NOT IN (${keep.map(() => '?').join(',')})`, pid, ...keep);
  else q.run('DELETE FROM variants WHERE product_id=?', pid);
  if (variants.length) { // نزامن سعر ومخزون المنتج من أرخص حجم
    const all = q.all('SELECT * FROM variants WHERE product_id=?', pid);
    const cheapest = all.reduce((a, b) => (eff(b.price, b.sale_price) < eff(a.price, a.sale_price) ? b : a));
    q.run('UPDATE products SET price=?, sale_price=?, stock=? WHERE id=?', cheapest.price, cheapest.sale_price, all.reduce((s, x) => s + x.stock, 0), pid);
  }
}

r.get('/api/admin/products', guard, (ctx) => {
  const { page, per, offset } = pageParams(ctx.query, 20, 100);
  const where = [], params = [];
  if (ctx.query.search) { const l = `%${String(ctx.query.search).replace(/[%_]/g, '')}%`; where.push('(p.name_en LIKE ? OR p.name_ar LIKE ?)'); params.push(l, l); }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = q.get(`SELECT COUNT(*) n FROM products p ${w}`, ...params).n;
  const rows = decorate(q.all(`${PRODUCT_SELECT} ${w} ORDER BY p.id DESC LIMIT ? OFFSET ?`, ...params, per, offset));
  return { items: rows, total, page, pages: Math.max(1, Math.ceil(total / per)) };
});
r.get('/api/admin/products/:id', guard, (ctx) => {
  const row = q.get('SELECT * FROM products WHERE id=?', int(ctx.params.id, { min: 1 }));
  if (!row) throw new HttpError(404, 'غير موجود');
  row.variants = q.all('SELECT * FROM variants WHERE product_id=? ORDER BY id', row.id);
  row.images = q.all('SELECT url FROM product_images WHERE product_id=? ORDER BY sort,id', row.id).map((x) => x.url);
  return row;
});
r.post('/api/admin/products', guard, (ctx) => {
  const d = readProductBody(ctx.body);
  const id = tx(() => {
    const slug = uniqueSlug('products', d.name_en);
    const res = q.run(`INSERT INTO products(slug,name_en,name_ar,desc_en,desc_ar,category_id,brand_id,price,sale_price,image,stock,featured,active,cashback_pct) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      slug, d.name_en, d.name_ar, d.desc_en, d.desc_ar, d.category_id, d.brand_id, d.price, d.sale_price, d.image, d.stock, d.featured, d.active, d.cashback_pct);
    const pid = Number(res.lastInsertRowid);
    saveImages(pid, d.images);
    saveVariants(pid, d.variants);
    return pid;
  });
  audit(ctx, 'product.create', id);
  return { id };
});
r.put('/api/admin/products/:id', guard, (ctx) => {
  const id = int(ctx.params.id, { min: 1 });
  if (!q.get('SELECT id FROM products WHERE id=?', id)) throw new HttpError(404, 'غير موجود');
  const d = readProductBody(ctx.body, id);
  tx(() => {
    q.run(`UPDATE products SET name_en=?,name_ar=?,desc_en=?,desc_ar=?,category_id=?,brand_id=?,price=?,sale_price=?,image=?,stock=?,featured=?,active=?,cashback_pct=? WHERE id=?`,
      d.name_en, d.name_ar, d.desc_en, d.desc_ar, d.category_id, d.brand_id, d.price, d.sale_price, d.image, d.stock, d.featured, d.active, d.cashback_pct, id);
    saveImages(id, d.images);
    saveVariants(id, d.variants);
  });
  audit(ctx, 'product.update', id);
  return { ok: true };
});
r.delete('/api/admin/products/:id', guard, (ctx) => {
  const id = int(ctx.params.id, { min: 1 });
  q.run('DELETE FROM products WHERE id=?', id);
  audit(ctx, 'product.delete', id);
  return { ok: true };
});

// ---- categories / brands
r.get('/api/admin/categories', guard, () => ({ items: q.all('SELECT * FROM categories ORDER BY sort,id') }));
r.post('/api/admin/categories', guard, (ctx) => {
  const en = str(ctx.body.name_en, { min: 2, max: 80, required: true, field: 'الاسم EN' });
  const ar = str(ctx.body.name_ar, { min: 2, max: 80, required: true, field: 'الاسم AR' });
  const id = Number(q.run('INSERT INTO categories(slug,name_en,name_ar,icon,sort) VALUES (?,?,?,?,?)', uniqueSlug('categories', en), en, ar, str(ctx.body.icon, { max: 8 }), int(ctx.body.sort ?? 0, { min: 0, max: 9999 })).lastInsertRowid);
  audit(ctx, 'category.create', id);
  return { id };
});
r.put('/api/admin/categories/:id', guard, (ctx) => {
  const id = int(ctx.params.id, { min: 1 });
  q.run('UPDATE categories SET name_en=?,name_ar=?,icon=?,sort=? WHERE id=?', str(ctx.body.name_en, { min: 2, max: 80, required: true, field: 'الاسم EN' }), str(ctx.body.name_ar, { min: 2, max: 80, required: true, field: 'الاسم AR' }), str(ctx.body.icon, { max: 8 }), int(ctx.body.sort ?? 0, { min: 0, max: 9999 }), id);
  return { ok: true };
});
r.delete('/api/admin/categories/:id', guard, (ctx) => { q.run('DELETE FROM categories WHERE id=?', int(ctx.params.id, { min: 1 })); audit(ctx, 'category.delete', ctx.params.id); return { ok: true }; });

r.get('/api/admin/brands', guard, () => ({ items: q.all('SELECT * FROM brands ORDER BY name') }));
r.post('/api/admin/brands', guard, (ctx) => {
  const name = str(ctx.body.name, { min: 2, max: 80, required: true, field: 'الاسم' });
  const id = Number(q.run('INSERT INTO brands(slug,name) VALUES (?,?)', uniqueSlug('brands', name), name).lastInsertRowid);
  audit(ctx, 'brand.create', id);
  return { id };
});
r.put('/api/admin/brands/:id', guard, (ctx) => { q.run('UPDATE brands SET name=? WHERE id=?', str(ctx.body.name, { min: 2, max: 80, required: true, field: 'الاسم' }), int(ctx.params.id, { min: 1 })); return { ok: true }; });
r.delete('/api/admin/brands/:id', guard, (ctx) => { q.run('DELETE FROM brands WHERE id=?', int(ctx.params.id, { min: 1 })); audit(ctx, 'brand.delete', ctx.params.id); return { ok: true }; });

// ---- orders
r.get('/api/admin/orders', guard, (ctx) => {
  const { page, per, offset } = pageParams(ctx.query, 20, 100);
  const where = [], params = [];
  if (ctx.query.status) { where.push('status=?'); params.push(ctx.query.status); }
  if (ctx.query.payment) { where.push('payment_status=?'); params.push(ctx.query.payment); }
  if (ctx.query.search) { const l = `%${String(ctx.query.search).replace(/[%_]/g, '')}%`; where.push('(code LIKE ? OR name LIKE ? OR phone LIKE ?)'); params.push(l, l, l); }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = q.get(`SELECT COUNT(*) n FROM orders ${w}`, ...params).n;
  const items = q.all(`SELECT * FROM orders ${w} ORDER BY id DESC LIMIT ? OFFSET ?`, ...params, per, offset).map(orderWithItems);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / per)) };
});
r.patch('/api/admin/orders/:code', guard, (ctx) => {
  const o = q.get('SELECT * FROM orders WHERE code=?', ctx.params.code);
  if (!o) throw new HttpError(404, 'الطلب غير موجود');
  tx(() => {
    if (ctx.body.status) {
      if (!['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'].includes(ctx.body.status)) throw new HttpError(400, 'حالة غير صالحة');
      applyStatus(o, ctx.body.status);
    }
    if (ctx.body.payment_status) {
      if (!['unpaid', 'paid', 'failed', 'refunded'].includes(ctx.body.payment_status)) throw new HttpError(400, 'حالة دفع غير صالحة');
      q.run(`UPDATE orders SET payment_status=?, updated_at=datetime('now') WHERE id=?`, ctx.body.payment_status, o.id);
    }
  });
  audit(ctx, 'order.update', `${o.code} ${ctx.body.status || ''} ${ctx.body.payment_status || ''}`);
  const fresh = q.get('SELECT * FROM orders WHERE id=?', o.id);
  if (ctx.body.status && fresh.status !== o.status) wa.queue(fresh, fresh.status);
  return orderWithItems(fresh);
});
const csvCell = (v) => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
r.get('/api/admin/orders.csv', guard, (ctx) => {
  const rows = q.all('SELECT * FROM orders ORDER BY id DESC LIMIT 5000');
  const head = ['code', 'created_at', 'status', 'payment_method', 'payment_status', 'name', 'phone', 'city', 'address', 'subtotal', 'discount', 'shipping', 'total', 'coupon_code'];
  const csv = '﻿' + [head.join(','), ...rows.map((o) => head.map((h) => csvCell(o[h])).join(','))].join('\r\n');
  ctx.res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="orders.csv"' });
  ctx.res.end(csv);
  return undefined;
});

// ---- coupons
r.get('/api/admin/coupons', guard, () => ({ items: q.all('SELECT * FROM coupons ORDER BY id DESC') }));
function readCoupon(b) {
  const type = b.type === 'fixed' ? 'fixed' : 'percent';
  const value = num(b.value, { min: 0.01, max: type === 'percent' ? 100 : 1e6, field: 'قيمة الخصم' });
  return {
    code: str(b.code, { min: 3, max: 30, required: true, field: 'الكود' }).toUpperCase().replace(/[^A-Z0-9_-]/g, ''),
    type, value, min_order: num(b.min_order ?? 0, { min: 0, field: 'الحد الأدنى' }), max_uses: int(b.max_uses ?? 0, { min: 0, max: 1e7, field: 'عدد الاستخدامات' }),
    expires_at: b.expires_at ? str(b.expires_at, { max: 10 }) : null, active: b.active === undefined ? 1 : flag(b.active),
  };
}
r.post('/api/admin/coupons', guard, (ctx) => {
  const c = readCoupon(ctx.body);
  if (q.get('SELECT id FROM coupons WHERE code=?', c.code)) throw new HttpError(409, 'الكود موجود قبل كده');
  const id = Number(q.run('INSERT INTO coupons(code,type,value,min_order,max_uses,expires_at,active) VALUES (?,?,?,?,?,?,?)', c.code, c.type, c.value, c.min_order, c.max_uses, c.expires_at, c.active).lastInsertRowid);
  audit(ctx, 'coupon.create', c.code);
  return { id };
});
r.put('/api/admin/coupons/:id', guard, (ctx) => {
  const c = readCoupon(ctx.body);
  q.run('UPDATE coupons SET code=?,type=?,value=?,min_order=?,max_uses=?,expires_at=?,active=? WHERE id=?', c.code, c.type, c.value, c.min_order, c.max_uses, c.expires_at, c.active, int(ctx.params.id, { min: 1 }));
  return { ok: true };
});
r.delete('/api/admin/coupons/:id', guard, (ctx) => { q.run('DELETE FROM coupons WHERE id=?', int(ctx.params.id, { min: 1 })); audit(ctx, 'coupon.delete', ctx.params.id); return { ok: true }; });

// ---- users
r.get('/api/admin/users', guard, (ctx) => {
  const { page, per, offset } = pageParams(ctx.query, 20, 100);
  const where = [], params = [];
  if (ctx.query.search) { const l = `%${String(ctx.query.search).replace(/[%_]/g, '')}%`; where.push('(name LIKE ? OR email LIKE ? OR phone LIKE ?)'); params.push(l, l, l); }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = q.get(`SELECT COUNT(*) n FROM users ${w}`, ...params).n;
  const items = q.all(`SELECT id,name,email,phone,role,cashback_balance,active,created_at,(SELECT COUNT(*) FROM orders o WHERE o.user_id=users.id) AS orders FROM users ${w} ORDER BY id DESC LIMIT ? OFFSET ?`, ...params, per, offset);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / per)) };
});
r.patch('/api/admin/users/:id', guard, (ctx) => {
  const id = int(ctx.params.id, { min: 1 });
  if (id === ctx.user.id && (ctx.body.active === false || (ctx.body.role && ctx.body.role !== 'admin'))) throw new HttpError(400, 'مينفعش تعدّل صلاحياتك أو توقف حسابك');
  if (ctx.body.role) { if (!['admin', 'customer'].includes(ctx.body.role)) throw new HttpError(400, 'دور غير صالح'); q.run('UPDATE users SET role=? WHERE id=?', ctx.body.role, id); }
  if (ctx.body.active !== undefined) q.run('UPDATE users SET active=? WHERE id=?', flag(ctx.body.active), id);
  if (ctx.body.cashback_balance !== undefined) q.run('UPDATE users SET cashback_balance=? WHERE id=?', num(ctx.body.cashback_balance, { min: 0, max: 1e7, field: 'الكاش باك' }), id);
  audit(ctx, 'user.update', `${id} ${JSON.stringify(ctx.body).slice(0, 120)}`);
  return { ok: true };
});

// ---- reviews
r.get('/api/admin/reviews', guard, (ctx) => ({
  items: q.all(`SELECT rv.*, u.name AS user_name, p.name_ar AS product FROM reviews rv JOIN users u ON u.id=rv.user_id JOIN products p ON p.id=rv.product_id WHERE (?='' OR rv.approved=?) ORDER BY rv.approved, rv.id DESC LIMIT 200`, String(ctx.query.approved ?? ''), Number(ctx.query.approved) || 0),
}));
r.patch('/api/admin/reviews/:id', guard, (ctx) => { q.run('UPDATE reviews SET approved=? WHERE id=?', flag(ctx.body.approved), int(ctx.params.id, { min: 1 })); return { ok: true }; });
r.delete('/api/admin/reviews/:id', guard, (ctx) => { q.run('DELETE FROM reviews WHERE id=?', int(ctx.params.id, { min: 1 })); return { ok: true }; });

// ---- settings
r.get('/api/admin/settings', guard, () => getSettings());
r.put('/api/admin/settings', guard, (ctx) => {
  const allowed = ['store_name', 'shipping_fee', 'free_shipping_over', 'cashback_enabled', 'max_cashback_use_pct', 'contact_phone', 'contact_email', 'announcement_ar', 'announcement_en'];
  for (const k of allowed) {
    if (ctx.body[k] === undefined) continue;
    let v = String(ctx.body[k]).slice(0, 300);
    if (['shipping_fee', 'free_shipping_over', 'max_cashback_use_pct'].includes(k)) v = String(num(ctx.body[k], { min: 0, max: 1e6, field: k }));
    if (k === 'cashback_enabled') v = flag(ctx.body[k]) ? '1' : '0';
    q.run('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', k, v);
  }
  for (const k of wa.WA_KEYS) {
    if (ctx.body[k] === undefined) continue;
    const isFlag = k === 'wa_enabled' || k.startsWith('wa_on_');
    const v = isFlag ? (flag(ctx.body[k]) ? '1' : '0') : String(ctx.body[k]).slice(0, k.startsWith('wa_text_') ? 1000 : 80);
    q.run('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', k, v);
  }
  audit(ctx, 'settings.update', '');
  return getSettings();
});

// ---- واتساب
r.get('/api/admin/whatsapp', guard, (ctx) => {
  const { page, per, offset } = pageParams(ctx.query, 20, 100);
  const where = ctx.query.status ? 'WHERE w.status=?' : '', params = ctx.query.status ? [ctx.query.status] : [];
  const total = q.get(`SELECT COUNT(*) n FROM wa_outbox w ${where}`, ...params).n;
  const items = q.all(`SELECT w.*, o.code, o.name FROM wa_outbox w LEFT JOIN orders o ON o.id=w.order_id ${where} ORDER BY w.id DESC LIMIT ? OFFSET ?`, ...params, per, offset);
  const counts = Object.fromEntries(q.all('SELECT status, COUNT(*) n FROM wa_outbox GROUP BY status').map((x) => [x.status, x.n]));
  return { items, total, page, pages: Math.max(1, Math.ceil(total / per)), counts, mode: wa.mode(), events: wa.EVENTS.map((e) => ({ key: e, label: wa.EVENT_LABEL[e] })) };
});
r.post('/api/admin/whatsapp/:id/retry', guard, (ctx) => { if (!wa.retry(int(ctx.params.id, { min: 1 }))) throw new HttpError(404, 'غير موجود'); return { ok: true }; });
r.post('/api/admin/whatsapp/:id/sent', guard, (ctx) => { wa.markSent(int(ctx.params.id, { min: 1 })); return { ok: true }; });

r.get('/api/admin/audit', guard, () => ({ items: q.all('SELECT a.*, u.email FROM audit_log a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 100') }));

// ---- image upload (base64 JSON) مع التحقق من نوع الملف الحقيقي
r.post('/api/admin/upload', guard, (ctx) => {
  const m = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(String(ctx.body.data || ''));
  if (!m) throw new HttpError(400, 'الصورة لازم تكون PNG أو JPG أو WEBP أو GIF');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 3_000_000) throw new HttpError(413, 'حجم الصورة أكبر من 3MB');
  const sig = buf.subarray(0, 12);
  const isPng = sig.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const isJpg = sig[0] === 0xff && sig[1] === 0xd8;
  const isGif = sig.subarray(0, 3).toString() === 'GIF';
  const isWebp = sig.subarray(0, 4).toString() === 'RIFF' && sig.subarray(8, 12).toString() === 'WEBP';
  const ext = isPng ? 'png' : isJpg ? 'jpg' : isGif ? 'gif' : isWebp ? 'webp' : null;
  if (!ext) throw new HttpError(400, 'محتوى الملف مش صورة صالحة');
  const name = crypto.randomBytes(12).toString('hex') + '.' + ext;
  if (REMOTE) q.run('INSERT INTO uploads(name,mime,data) VALUES (?,?,?)', name, 'image/' + (ext === 'jpg' ? 'jpeg' : ext), buf);
  else fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  audit(ctx, 'upload', name);
  return { url: '/uploads/' + name };
});

module.exports = { router: r, loadUser, UPLOAD_DIR, markPaid };
