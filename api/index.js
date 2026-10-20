'use strict';
// نقطة الدخول على Vercel (Serverless Function). كل الطلبات اللي مش ملفات ثابتة بتيجي هنا.
let app = null, loadError = null;
try { app = require('../lib/app'); } catch (e) { loadError = e; console.error('[startup]', e); }

module.exports = async (req, res) => {
  if (loadError) { // بدل صفحة 500 الغامضة: اعرض سبب الخطأ (الرسالة بس) عشان نعرف نصلحه
    res.statusCode = 500; res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end('Startup error: ' + String(loadError && loadError.message || loadError).slice(0, 300));
  }
  await app.handle(req, res);
  await app.whatsapp.idle();   // استنى لحد ما رسائل الواتساب تتبعت قبل ما الدالة تتجمّد
};
