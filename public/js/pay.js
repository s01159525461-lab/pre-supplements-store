(function () {
  'use strict';
  var code = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || '');
  var token = new URLSearchParams(location.search).get('t') || '';
  document.getElementById('code').textContent = code;
  var body = document.getElementById('body');
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function waNumber(p) { var d = String(p || '').replace(/\D/g, ''); if (d.indexOf('00') === 0) d = d.slice(2); if (d.charAt(0) === '0') d = '20' + d.slice(1); return d; }
  function row(label, value, key) {
    if (!value) return '';
    return '<div class="sum-row" style="align-items:center;gap:10px"><span>' + esc(label) + '<br><b dir="ltr" style="font-size:1.15rem;color:var(--volt)">' + esc(value) + '</b></span>' +
      '<button class="btn btn-outline-secondary btn-sm" type="button" data-copy="' + esc(value) + '">نسخ</button></div>';
  }
  fetch('/api/payments/manual/' + encodeURIComponent(code) + '?t=' + encodeURIComponent(token), { credentials: 'same-origin' })
    .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'خطأ'); return j; }); })
    .then(function (o) {
      if (o.payment_status === 'paid') { body.innerHTML = '<div class="notice">تم تأكيد دفع الطلب ✅ شكرًا لك.</div><a class="btn btn-primary w-100 mt-3" href="/#/order/' + encodeURIComponent(code) + '">متابعة الطلب</a>'; return; }
      var amount = Number(o.total || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
      var wa = waNumber(o.whatsapp);
      var msg = encodeURIComponent('أهلاً، حوّلت مبلغ ' + amount + ' ج.م للطلب رقم ' + o.code + ' وده إيصال التحويل:');
      body.innerHTML =
        '<div class="panel" style="text-align:center;margin-bottom:14px"><small class="text-secondary">المبلغ المطلوب</small><div style="font-size:2.2rem;font-weight:900;color:var(--volt)" dir="ltr">' + esc(amount) + ' EGP</div></div>' +
        '<ol class="text-secondary" style="padding-inline-start:20px;line-height:2"><li>حوّل المبلغ بالظبط على أي وسيلة من اللي تحت.</li><li>صوّر إيصال التحويل.</li><li>ابعته لنا على واتساب مع رقم الطلب، وهنأكد الدفع ونجهّز طلبك.</li></ol>' +
        row('InstaPay', o.instapay) + row('محفظة كاش (فودافون / اتصالات / أورنج)', o.vodafone) +
        (!o.instapay && !o.vodafone ? '<div class="notice">تواصل معنا على واتساب لإتمام الدفع.</div>' : '') +
        (wa ? '<a class="btn btn-primary btn-lg w-100 mt-3" target="_blank" rel="noopener" href="https://wa.me/' + wa + '?text=' + msg + '">ابعت الإيصال على واتساب</a>' : '') +
        '<a class="btn btn-outline-secondary w-100 mt-2" href="/#/order/' + encodeURIComponent(code) + '">متابعة الطلب</a>' +
        '<p class="small text-secondary mt-3 mb-0">الطلب بيتجهّز بعد تأكيد التحويل. لو اتأخر التأكيد كلّمنا على واتساب.</p>';
    })
    .catch(function (e) { body.innerHTML = '<div class="notice">' + esc(e.message || 'تعذّر تحميل بيانات الدفع') + '</div>'; });
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-copy]'); if (!b) return;
    var v = b.getAttribute('data-copy');
    (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject()).then(function () { b.textContent = 'تم النسخ ✓'; }, function () { b.textContent = v; });
  });
})();
