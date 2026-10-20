/* يتحمّل في <head> قبل أي رسم: بيحدد اللغة والاتجاه وبيحمّل Bootstrap (RTL أو LTR) من مجلد vendor المحلي */
(function () {
  'use strict';
  var BS = '/vendor/bootstrap/';
  var admin = document.documentElement.hasAttribute('data-admin');
  var lang = 'ar';
  try { if (!admin && localStorage.getItem('if_lang') === 'en') lang = 'en'; } catch (e) {}
  if (admin) { try { lang = localStorage.getItem('if_admin_lang') === 'en' ? 'en' : 'ar'; } catch (e) {} }
  var de = document.documentElement;
  de.lang = lang; de.dir = lang === 'ar' ? 'rtl' : 'ltr'; de.setAttribute('data-bs-theme', 'dark');

  var anchor = document.getElementById('theme-css');
  var l = document.createElement('link'); l.rel = 'stylesheet'; l.id = 'bs-css';
  l.href = BS + (lang === 'ar' ? 'bootstrap.rtl.min.css' : 'bootstrap.min.css');
  anchor.parentNode.insertBefore(l, anchor);

  window.IF_BOOT = { lang: lang, setDir: function (lng) {
    de.lang = lng; de.dir = lng === 'ar' ? 'rtl' : 'ltr';
    var el = document.getElementById('bs-css'); if (el) el.href = BS + (lng === 'ar' ? 'bootstrap.rtl.min.css' : 'bootstrap.min.css');
  } };
})();
