/* يعرض أي خطأ JavaScript أو ملف ناقص على الشاشة بدل ما الصفحة تفضل فاضية. تقدر تحذف السطر ده من index.html بعد ما كل حاجة تشتغل. */
(function () {
  'use strict';
  var box;
  function show(msg) {
    if (!box) {
      box = document.createElement('pre');
      box.style.cssText = 'position:fixed;z-index:99999;inset:auto 12px 12px 12px;max-height:50vh;overflow:auto;margin:0;padding:14px;background:#2a0b0e;color:#ffb3b5;border:2px solid #ff5a5f;border-radius:12px;font:13px/1.5 Consolas,monospace;direction:ltr;text-align:left;white-space:pre-wrap';
      box.textContent = 'Pre Supplements diagnostic - screenshot this box:\n';
      (document.body || document.documentElement).appendChild(box);
    }
    box.textContent += '\n• ' + msg;
  }
  window.addEventListener('error', function (e) {
    if (e.target && e.target !== window && (e.target.src || e.target.href)) show('FILE NOT LOADED: ' + (e.target.src || e.target.href));
    else show((e.message || 'error') + '  @ ' + String(e.filename || '').replace(location.origin, '') + ':' + e.lineno);
  }, true);
  window.addEventListener('unhandledrejection', function (e) { var r = e.reason; show('PROMISE: ' + (r && (r.stack || r.message) || r)); });
  setTimeout(function () {
    var app = document.getElementById('app');
    if (app && app.querySelector('.skel') && !document.querySelector('#header .hdr')) show('The page is still loading after 6s. window.IF=' + (typeof window.IF) + ', IF.T=' + (window.IF && typeof window.IF.T) + ', bootstrap=' + typeof window.bootstrap);
  }, 6000);
})();
