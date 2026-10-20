'use strict';
/**
 * طبقة الدفع الأونلاين (Payment adapter).
 *
 * الافتراضي: بوابة "sandbox" للتجربة فقط (صفحة دفع وهمية بتأكد الطلب) — مفيش فلوس حقيقية بتتحرك.
 * عشان تربط بوابة حقيقية (Paymob / Fawry / Kashier ...) اعمل adapter بنفس الشكل ده:
 *   createSession(order, ctx) -> { url }            رابط صفحة الدفع اللي العميل بيتحول لها
 *   verifyWebhook(rawBody, headers) -> { orderCode, success, ref } | null    التحقق من إشعار البوابة
 * وغيّر PAYMENT_PROVIDER في ملف البيئة. مفاتيح البوابة لازم تتحط في environment variables بس، مش في الكود.
 */
const crypto = require('node:crypto');
const { SECRET } = require('./auth');

function payToken(code) {
  return crypto.createHmac('sha256', SECRET).update('pay:' + code).digest('base64url').slice(0, 32);
}
function checkPayToken(code, token) {
  const a = Buffer.from(payToken(code));
  const b = Buffer.from(String(token || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const providers = {
  sandbox: {
    name: 'sandbox',
    createSession(order) {
      return { url: `/pay/${encodeURIComponent(order.code)}?t=${payToken(order.code)}` };
    },
    // الـ sandbox بيأكد من صفحة /pay مباشرة (مش webhook)
    verifyWebhook() { return null; },
  },
  // مثال لشكل الـ webhook العام الموقّع بـ HMAC (استخدمه كنقطة بداية لبوابتك)
  generic: {
    name: 'generic',
    createSession(order) {
      const base = process.env.PAYMENT_CHECKOUT_URL;
      if (!base) throw new Error('PAYMENT_CHECKOUT_URL غير مضبوط');
      return { url: `${base}?order=${encodeURIComponent(order.code)}&amount=${order.total}` };
    },
    verifyWebhook(raw, headers) {
      const secret = process.env.PAYMENT_WEBHOOK_SECRET;
      if (!secret) return null;
      const sig = String(headers['x-signature'] || '');
      const exp = crypto.createHmac('sha256', secret).update(raw).digest('hex');
      const a = Buffer.from(exp), b = Buffer.from(sig);
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
      try {
        const j = JSON.parse(raw.toString('utf8'));
        return { orderCode: String(j.order_code), success: !!j.success, ref: String(j.reference || '') };
      } catch { return null; }
    },
  },
};

function getProvider() {
  return providers[process.env.PAYMENT_PROVIDER || 'sandbox'] || providers.sandbox;
}

module.exports = { getProvider, payToken, checkPayToken };
