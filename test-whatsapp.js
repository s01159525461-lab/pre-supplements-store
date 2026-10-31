'use strict';
// اختبار أتمتة واتساب باستخدام خادم واتساب مزيّف (من غير ما نبعت لحد حقيقي). التشغيل: npm run test:wa
const { spawn } = require('node:child_process');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const PORT = 3800 + Math.floor(Math.random() * 100), FAKE = 4800 + Math.floor(Math.random() * 100);
const BASE = `http://127.0.0.1:${PORT}`;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL:', m); } };
const got = [];
let failNext = 0;
const fake = http.createServer((req, res) => {
  let b = ''; req.on('data', (c) => (b += c));
  req.on('end', () => {
    if (failNext > 0) { failNext--; res.writeHead(400, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: { message: 'Recipient not in allowed list' } })); }
    got.push({ url: req.url, auth: req.headers.authorization, body: JSON.parse(b || '{}') });
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"messages":[{"id":"wamid.X"}]}');
  });
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let cookie = '';
async function call(method, url, body) {
  const res = await fetch(BASE + url, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const sc = res.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  const t = await res.text(); try { return { status: res.status, data: JSON.parse(t) }; } catch { return { status: res.status, data: t }; }
}

(async () => {
  await new Promise((r) => fake.listen(FAKE, '127.0.0.1', r));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'if-wa-'));
  const srv = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(__dirname, '..', 'local-server.js')], {
    env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR: dir, ADMIN_EMAIL: 'a@t.local', ADMIN_PASSWORD: 'Sup3r-Secret-1', WHATSAPP_TOKEN: 'tok123', WHATSAPP_PHONE_ID: '999', WHATSAPP_API_BASE: `http://127.0.0.1:${FAKE}`, PUBLIC_URL: 'https://shop.example' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((r) => srv.stdout.on('data', (d) => { if (String(d).includes('يعمل على')) r(); }));
  try {
    console.log('[واتساب]');
    const cfg = (await call('GET', '/api/products?per=1')).data;
    const p = cfg.items[0];
    const full = (await call('GET', '/api/products/' + p.slug)).data;
    const item = { product_id: full.id, variant_id: full.variants[0] ? full.variants[0].id : null, qty: 1 };
    const order = (await call('POST', '/api/orders', { items: [item], payment_method: 'cod', customer: { name: 'أحمد علي', phone: '01012345678', city: 'القاهرة', address: 'شارع التحرير 12' } })).data;
    ok(order.code, 'الطلب اتعمل: ' + order.code);
    await sleep(800);
    ok(got.length === 1, 'رسالة التأكيد اتبعتت للـ API');
    const m = got[0] || { body: {} };
    ok(m.url === '/999/messages' && m.auth === 'Bearer tok123', 'المسار والتوكن صح');
    ok(m.body.to === '201012345678', 'الرقم اتحوّل لصيغة دولية: ' + m.body.to);
    ok(m.body.type === 'text' && /أحمد علي/.test(m.body.text.body) && m.body.text.body.includes(order.code), 'نص الرسالة فيه الاسم والكود');
    ok(m.body.text.body.includes('https://shop.example/#/order/' + order.code), 'رابط التتبع موجود');

    await call('POST', '/api/auth/login', { email: 'a@t.local', password: 'Sup3r-Secret-1' });
    await call('PATCH', '/api/admin/orders/' + order.code, { status: 'confirmed' });
    await call('PATCH', '/api/admin/orders/' + order.code, { status: 'shipped' });
    await sleep(800);
    ok(got.length === 3, 'رسائل التأكيد والشحن اتبعتت (' + got.length + ')');
    await call('PATCH', '/api/admin/orders/' + order.code, { payment_status: 'paid' });
    await sleep(300);
    ok(got.length === 3, 'تغيير حالة الدفع لوحده مبيبعتش رسالة');

    // الإرسال لا يتكرر لنفس الحدث
    await call('PATCH', '/api/admin/orders/' + order.code, { status: 'delivered' });
    await sleep(800);
    ok(got.length === 4, 'رسالة التسليم اتبعتت');

    // إيقاف حدث من الإعدادات
    await call('PUT', '/api/admin/settings', { wa_on_created: false });
    const o2 = (await call('POST', '/api/orders', { items: [item], payment_method: 'cod', customer: { name: 'منى', phone: '+20 111 222 3333', city: 'الجيزة', address: 'شارع الهرم 5' } })).data;
    await sleep(600);
    ok(got.length === 4, 'حدث "تم استلام الطلب" متقفّل = مفيش رسالة');
    await call('PUT', '/api/admin/settings', { wa_on_created: true, wa_text_cancelled: 'يا {name} طلبك {code} اتلغى', wa_tpl_cancelled: 'order_cancelled' });
    await call('PATCH', '/api/admin/orders/' + o2.code, { status: 'cancelled' });
    await sleep(800);
    const last = got[got.length - 1];
    ok(last.body.type === 'template' && last.body.template.name === 'order_cancelled', 'قالب واتساب معتمد اتستخدم');
    ok(last.body.to === '201112223333', 'رقم بصيغة +20 اتظبط');

    // فشل الإرسال + إعادة المحاولة
    failNext = 1;
    const o3 = (await call('POST', '/api/orders', { items: [item], payment_method: 'cod', customer: { name: 'سارة', phone: '01255556666', city: 'الجيزة', address: 'شارع الهرم 7' } })).data;
    await sleep(500);
    let list = (await call('GET', '/api/admin/whatsapp')).data;
    const row = list.items.find((x) => x.code === o3.code);
    ok(row && row.status !== 'sent' && /allowed list/.test(row.error), 'فشل الإرسال اتسجّل بسببه');
    await call('POST', `/api/admin/whatsapp/${row.id}/retry`);
    await sleep(900);
    list = (await call('GET', '/api/admin/whatsapp')).data;
    ok(list.items.find((x) => x.id === row.id).status === 'sent', 'إعادة المحاولة نجحت');
    ok(list.mode === 'api' && list.counts.sent >= 5, 'لوحة الأدمن بتعرض الوضع والأعداد');

    // لوحة الأدمن ممنوعة على غير الأدمن
    cookie = '';
    ok((await call('GET', '/api/admin/whatsapp')).status === 401, 'صفحة واتساب محمية');
  } catch (e) { fail++; console.log('  ✗ ERROR', e); }
  srv.kill(); fake.close();
  console.log(`\nالنتيجة: ${pass} نجح، ${fail} فشل`);
  process.exit(fail ? 1 : 0);
})();
