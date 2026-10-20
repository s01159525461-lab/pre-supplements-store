/* لوحة تحكم الأدمن (Bootstrap 5) */
(function () {
  'use strict';
  const { esc, $, $$, get, post, put, patch, del, qs, debounce, toast, productImg, badge, statusMeta, payMeta, date } = IF;
  const ic = (n, s, c) => IF.icon(n, s || 18, c);
  IF.lang = 'ar';
  const money = (n) => IF.money(n, 'ج.م');
  const root = $('#root');
  const S = { user: null, cats: [], brands: [], settings: {}, page: 1, modal: null };

  const NAV = [
    ['main', 'الرئيسية'], ['dashboard', 'chart', 'لوحة التحكم'], ['orders', 'package', 'الطلبات'],
    ['main', 'الكتالوج'], ['products', 'tag', 'المنتجات'], ['categories', 'layers', 'الأقسام'], ['brands', 'award', 'البراندات'],
    ['main', 'التسويق والعملاء'], ['coupons', 'ticket', 'الكوبونات'], ['whatsapp', 'phone', 'واتساب'], ['users', 'users', 'المستخدمون'], ['reviews', 'star', 'التقييمات'],
    ['main', 'النظام'], ['settings', 'gear', 'الإعدادات'], ['audit', 'file', 'سجل النشاط'],
  ];
  const PAY_METHOD = { cod: 'عند الاستلام', online: 'أونلاين' };
  const B = () => window.bootstrap;

  /* ---------- مودال (Bootstrap Modal) ---------- */
  function openModal(title, body, { onSubmit, wide = false, submit = 'حفظ' } = {}) {
    closeModal(true);
    const m = $('#modal');
    m.innerHTML = `<div class="modal fade" tabindex="-1" aria-hidden="true"><div class="modal-dialog modal-dialog-scrollable modal-dialog-centered ${wide ? 'modal-lg' : ''}"><form class="modal-content" novalidate>
      <div class="modal-header"><h5 class="modal-title">${esc(title)}</h5><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="إغلاق"></button></div>
      <div class="modal-body">${body}<div id="mErr"></div></div>
      <div class="modal-footer"><button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">إلغاء</button>${onSubmit ? `<button class="btn btn-primary" id="mSubmit">${esc(submit)}</button>` : ''}</div></form></div></div>`;
    const el = $('.modal', m), form = $('form', m);
    S.modal = B().Modal.getOrCreateInstance(el);
    el.addEventListener('hidden.bs.modal', () => { if (S.modal && S.modal._element === el) S.modal = null; m.innerHTML = ''; });
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); if (!onSubmit) return;
      const btn = $('#mSubmit', form); btn.disabled = true;
      try { await onSubmit(form); closeModal(); } catch (err) { $('#mErr').innerHTML = `<div class="notice">${esc(err.message)}</div>`; }
      finally { btn.disabled = false; }
    });
    S.modal.show();
    return form;
  }
  function closeModal(now) {
    if (S.modal) { try { S.modal.hide(); } catch {} }
    if (now) { $('#modal').innerHTML = ''; $$('.modal-backdrop').forEach((b) => b.remove()); document.body.classList.remove('modal-open'); document.body.style.removeProperty('overflow'); document.body.style.removeProperty('padding-right'); S.modal = null; }
  }

  /* ---------- هيكل الصفحة ---------- */
  const LOGO = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#c8ff2e"/><path d="M18 4 8 18h7l-2 10 11-15h-7z" fill="#0b1200"/></svg>';
  function shell(active, title, actionsHtml, bodyHtml) {
    const name = esc((S.settings && S.settings.store_name) || 'Pre Supplements');
    root.innerHTML = `<div class="shell">
      <aside class="sidebar offcanvas-lg offcanvas-start" id="sb" tabindex="-1" aria-label="القائمة">
        <div class="offcanvas-header d-lg-none"><span class="fw-bold">القائمة</span><button type="button" class="btn-close" data-bs-dismiss="offcanvas" data-bs-target="#sb" aria-label="إغلاق"></button></div>
        <div class="offcanvas-body">
          <a class="sb-logo" href="#/dashboard">${LOGO}<span>${name}<small>لوحة التحكم</small></span></a>
          ${NAV.map((n) => (n[0] === 'main' ? `<div class="sb-label">${esc(n[1])}</div>` : `<a class="nav-i ${n[0] === active ? 'active' : ''}" href="#/${n[0]}">${ic(n[1], 19)}<span>${esc(n[2])}</span></a>`)).join('')}
          <div class="sb-spacer"></div>
          <a class="nav-i" href="/" target="_blank" rel="noopener">${ic('globe', 19)}<span>فتح المتجر</span></a>
          <button class="nav-i out" type="button" data-act="logout">${ic('logout', 19)}<span>تسجيل الخروج</span></button>
        </div></aside>
      <section class="content">
        <div class="topbar"><button class="icon-btn d-lg-none" type="button" data-bs-toggle="offcanvas" data-bs-target="#sb" aria-label="القائمة" style="border:1px solid var(--line-2);border-radius:12px;width:42px;height:42px;display:grid;place-items:center;background:var(--surface);color:var(--text)">${ic('menu', 20)}</button>
          <h1>${esc(title)}</h1><div class="tb-actions">${actionsHtml || ''}<span class="tb-user"><span class="av">${esc(((S.user && S.user.name) || 'A').slice(0, 1).toUpperCase())}</span>${esc((S.user && S.user.name) || 'Admin')}</span></div></div>
        <div id="view">${bodyHtml}</div></section></div>`;
    document.title = title + ' | لوحة التحكم';
  }
  const pager = (r) => (r.pages > 1 ? `<div class="pager">${Array.from({ length: r.pages }, (_, i) => i + 1).slice(Math.max(0, r.page - 4), r.page + 3).map((i) => `<button type="button" class="${i === r.page ? 'active' : ''}" data-act="apage" data-page="${i}">${i}</button>`).join('')}</div>` : '');
  const table = (heads, rows, empty = 'لا توجد بيانات') => `<div class="tbl-card"><div class="table-responsive"><table class="table table-hover align-middle"><thead><tr>${heads.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.join('') : `<tr><td colspan="${heads.length}" class="empty-row">${esc(empty)}</td></tr>`}</tbody></table></div></div>`;
  const btnSm = (act, label, extra = '', cls = 'btn-outline-secondary') => `<button type="button" class="btn btn-sm ${cls}" data-act="${act}" ${extra}>${label}</button>`;
  const editBtn = (act, id) => btnSm(act, `${ic('edit', 14)} تعديل`, `data-id="${id}"`);
  const delBtn = (act, id, extra = '') => btnSm(act, `${ic('trash', 14)}`, `data-id="${id}" ${extra} aria-label="حذف" title="حذف"`, 'btn-danger-soft');
  const chip = (cls, text) => `<span class="badge ${cls}">${text}</span>`;

  /* ---------- الراوتر ---------- */
  const views = {};
  function parseHash() { const h = location.hash.slice(1) || '/dashboard'; const [p, qq = ''] = h.split('?'); return { name: p.replace(/^\//, '') || 'dashboard', q: Object.fromEntries(new URLSearchParams(qq)) }; }
  async function route() {
    if (!S.user || S.user.role !== 'admin') return renderLogin();
    const { name, q } = parseHash();
    S.q = q; S.page = Number(q.page) || 1;
    const v = views[name] || views.dashboard;
    try {
      await v(q);
      if (S.focusFilter) { const i = $(`input[data-filter="${S.focusFilter}"]`); if (i) { i.focus(); try { i.setSelectionRange(i.value.length, i.value.length); } catch {} } S.focusFilter = null; }
    } catch (e) {
      if (e.status === 401 || e.status === 403) { S.user = null; return renderLogin(); }
      $('#view') ? ($('#view').innerHTML = `<div class="notice">${esc(e.message)}</div>`) : (root.innerHTML = `<div class="notice m-4">${esc(e.message)}</div>`);
    }
  }
  const nav = (name, params = {}) => { location.hash = '#/' + name + qs(params); };
  async function loadRefs() {
    const [c, b] = await Promise.all([get('/api/admin/categories'), get('/api/admin/brands')]);
    S.cats = c.items; S.brands = b.items;
  }

  /* ---------- تسجيل الدخول ---------- */
  function renderLogin(msg = '') {
    document.title = 'دخول الأدمن';
    root.innerHTML = `<div class="login-wrap"><div class="login-card"><div class="lg-ico">${ic('lock', 26)}</div><h2>لوحة التحكم</h2><p class="text-secondary mb-4">سجّل دخولك بحساب الأدمن للمتابعة</p>
      ${msg ? `<div class="notice">${esc(msg)}</div>` : ''}
      <form id="lf" class="stack"><div class="field"><label>الإيميل</label><input class="form-control" name="email" type="email" required dir="ltr" autocomplete="username" placeholder="admin@example.com"></div>
      <div class="field"><label>كلمة السر</label><input class="form-control" name="password" type="password" required autocomplete="current-password"></div><button class="btn btn-primary btn-lg mt-2">دخول</button></form></div></div>`;
    $('#lf').addEventListener('submit', async (e) => {
      e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); const b = $('button', e.target); b.disabled = true;
      try {
        const r = await post('/api/auth/login', f);
        if (r.user.role !== 'admin') { await post('/api/auth/logout'); return renderLogin('الحساب ده مش أدمن.'); }
        S.user = r.user; await loadRefs(); route();
      } catch (err) { renderLogin(err.message); }
    });
  }

  /* ---------- لوحة التحكم ---------- */
  function chartSvg(series) {
    const days = [];
    for (let i = 13; i >= 0; i--) { const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10); const f = series.find((x) => x.d === d); days.push({ d, v: f ? f.v : 0, n: f ? f.n : 0 }); }
    const max = Math.max(1, ...days.map((x) => x.v)), W = 700, H = 200, bw = W / days.length;
    const lines = [0, 0.5, 1].map((p) => `<line class="grid-l" x1="0" x2="${W}" y1="${H - p * (H - 20)}" y2="${H - p * (H - 20)}"/>`).join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${H + 24}" preserveAspectRatio="none" role="img" aria-label="مبيعات آخر 14 يوم"><defs><linearGradient id="barg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c8ff2e"/><stop offset="1" stop-color="#7fb312"/></linearGradient></defs>${lines}${days.map((x, i) => {
      const h = Math.max(3, (x.v / max) * (H - 20)), bx = i * bw + 7;
      return `<g><title>${x.d}: ${money(x.v)} (${x.n} طلب)</title><rect class="bar" x="${bx}" y="${H - h}" width="${bw - 14}" height="${h}" rx="5"/><text x="${bx + (bw - 14) / 2}" y="${H + 16}" text-anchor="middle">${x.d.slice(8)}</text></g>`;
    }).join('')}</svg>`;
  }
  const statCard = (cls, icon, label, value, sub) => `<div class="stat ${cls}"><span class="si">${ic(icon, 22)}</span><div><small>${esc(label)}</small><b>${value}</b>${sub ? `<em>${sub}</em>` : ''}</div></div>`;
  views.dashboard = async () => {
    shell('dashboard', 'لوحة التحكم', '', '<div class="skel"></div>');
    const s = await get('/api/admin/stats');
    const st = (k) => s.by_status[k] || 0;
    $('#view').innerHTML = `
      <div class="stats">
        ${statCard('hl', 'bolt', 'مبيعات اليوم', money(s.today_revenue), `${s.today_orders} طلب`)}
        ${statCard('', 'chart', 'إجمالي المبيعات', money(s.revenue), `${s.orders} طلب`)}
        ${statCard('ok', 'wallet', 'المدفوع فعليًا', money(s.paid_revenue))}
        ${statCard('info', 'users', 'العملاء', s.customers)}
        ${statCard('fire', 'tag', 'المنتجات', s.products)}
        ${statCard('warn', 'star', 'تقييمات للمراجعة', s.pending_reviews)}</div>
      <div class="dgrid a"><div class="panel"><h3>${ic('chart', 20)} المبيعات آخر 14 يوم</h3>${chartSvg(s.series)}</div>
        <div class="panel"><h3>${ic('package', 20)} حالات الطلبات</h3><ul class="list-plain">${['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'].map((k) => `<li><a href="#/orders?status=${k}">${badge(statusMeta, k)}</a><b>${st(k)}</b></li>`).join('')}</ul></div></div>
      <div class="dgrid b"><div class="panel"><h3>${ic('award', 20)} الأكثر مبيعًا</h3><ul class="list-plain">${s.top_products.length ? s.top_products.map((p) => `<li><span>${esc(p.name)}</span><b>${p.qty} قطعة · ${money(p.revenue)}</b></li>`).join('') : '<li class="muted">لا توجد بيانات</li>'}</ul></div>
        <div class="panel"><h3>${ic('alert', 20)} مخزون منخفض</h3><ul class="list-plain">${s.low_stock.length ? s.low_stock.map((p) => `<li><a href="#/products?edit=${p.id}">${esc(p.name_ar)}</a>${chip(p.stock === 0 ? 'bad' : 'warn', p.stock)}</li>`).join('') : '<li class="muted">كل المنتجات مخزونها كافي ✅</li>'}</ul></div></div>`;
  };

  /* ---------- الطلبات ---------- */
  views.orders = async (q) => {
    shell('orders', 'الطلبات', `<a class="btn btn-outline-secondary btn-sm" href="/api/admin/orders.csv">${ic('download', 16)} تصدير CSV</a>`, '<div class="skel"></div>');
    const r = await get('/api/admin/orders' + qs({ status: q.status, payment: q.payment, search: q.search, page: S.page }));
    const sel = (name, opts, cur) => `<select class="form-select" data-filter="${name}"><option value="">${opts[0]}</option>${opts.slice(1).map(([v, l]) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    $('#view').innerHTML = `<div class="filters-bar"><input class="form-control grow" data-filter="search" placeholder="بحث بالكود / الاسم / الموبايل" value="${esc(q.search || '')}">
      ${sel('status', ['كل الحالات', ...Object.entries(statusMeta).map(([k, v]) => [k, v.ar])], q.status)}${sel('payment', ['كل حالات الدفع', ...Object.entries(payMeta).map(([k, v]) => [k, v.ar])], q.payment)}<span class="muted">${r.total} طلب</span></div>
      ${table(['الكود', 'التاريخ', 'العميل', 'الإجمالي', 'الدفع', 'الحالة', ''], r.items.map((o) => `<tr><td><b dir="ltr" class="text-nowrap">${esc(o.code)}</b></td><td class="small muted text-nowrap">${esc(date(o.created_at))}</td>
        <td>${esc(o.name)}<div class="small muted" dir="ltr" style="text-align:start">${esc(o.phone)} · ${esc(o.city)}</div></td><td><b>${money(o.total)}</b></td>
        <td>${esc(PAY_METHOD[o.payment_method])}<div>${badge(payMeta, o.payment_status)}</div></td><td>${badge(statusMeta, o.status)}</td>
        <td><div class="row-actions">${btnSm('order', `${ic('edit', 14)} عرض / تعديل`, `data-code="${esc(o.code)}"`)}</div></td></tr>`))}${pager(r)}`;
    S.orders = Object.fromEntries(r.items.map((o) => [o.code, o]));
  };
  function orderModal(o) {
    const finalSt = ['delivered', 'cancelled'].includes(o.status);
    const body = `<div class="d-flex gap-2 flex-wrap mb-3">${badge(statusMeta, o.status)} ${badge(payMeta, o.payment_status)} ${chip('mute', esc(PAY_METHOD[o.payment_method]))}</div>
      <p class="mb-1"><b>${esc(o.name)}</b> · <span dir="ltr">${esc(o.phone)}</span>${o.email ? ` · ${esc(o.email)}` : ''}</p><p class="muted mb-1">${ic('pin', 15)} ${esc(o.city)} — ${esc(o.address)}</p>${o.notes ? `<p class="muted mb-1">${ic('file', 15)} ${esc(o.notes)}</p>` : ''}
      <table class="table order-items my-3"><tbody>${o.items.map((i) => `<tr><td>${esc(i.name)}${i.variant_label ? ` — ${esc(i.variant_label)}` : ''}</td><td>× ${i.qty}</td><td style="text-align:end">${money(i.price * i.qty)}</td></tr>`).join('')}</tbody></table>
      <ul class="list-plain"><li><span>المجموع</span><span>${money(o.subtotal)}</span></li>${o.discount ? `<li><span>خصم ${esc(o.coupon_code || '')}</span><span>-${money(o.discount)}</span></li>` : ''}${o.cashback_used ? `<li><span>كاش باك مستخدم</span><span>-${money(o.cashback_used)}</span></li>` : ''}<li><span>الشحن</span><span>${money(o.shipping)}</span></li><li><b>الإجمالي</b><b style="color:var(--volt)">${money(o.total)}</b></li></ul>
      <div class="form-grid mt-3"><div class="field"><label>حالة الطلب</label><select class="form-select" name="status" ${finalSt ? 'disabled' : ''}>${Object.entries(statusMeta).map(([k, v]) => `<option value="${k}" ${k === o.status ? 'selected' : ''}>${v.ar}</option>`).join('')}</select></div>
      <div class="field"><label>حالة الدفع</label><select class="form-select" name="payment_status">${Object.entries(payMeta).map(([k, v]) => `<option value="${k}" ${k === o.payment_status ? 'selected' : ''}>${v.ar}</option>`).join('')}</select></div></div>
      ${finalSt ? '<p class="muted small mt-2 mb-0">الطلب في حالة نهائية، يمكن تعديل حالة الدفع فقط.</p>' : ''}`;
    openModal('طلب ' + o.code, body, {
      wide: true, onSubmit: async (f) => {
        const d = Object.fromEntries(new FormData(f)); const patchBody = {};
        if (d.status && d.status !== o.status) patchBody.status = d.status;
        if (d.payment_status !== o.payment_status) patchBody.payment_status = d.payment_status;
        if (Object.keys(patchBody).length) { await patch('/api/admin/orders/' + encodeURIComponent(o.code), patchBody); toast('تم تحديث الطلب'); route(); }
      },
    });
  }

  /* ---------- المنتجات ---------- */
  views.products = async (q) => {
    shell('products', 'المنتجات', `<button class="btn btn-primary btn-sm" type="button" data-act="newproduct">${ic('plus', 16)} منتج جديد</button>`, '<div class="skel"></div>');
    const r = await get('/api/admin/products' + qs({ search: q.search, page: S.page }));
    $('#view').innerHTML = `<div class="filters-bar"><input class="form-control grow" data-filter="search" placeholder="بحث باسم المنتج" value="${esc(q.search || '')}"><span class="muted">${r.total} منتج</span></div>
      ${table(['', 'المنتج', 'القسم / البراند', 'السعر', 'المخزون', 'الحالة', ''], r.items.map((p) => `<tr><td><img class="thumb" src="${esc(productImg(p))}" alt=""></td>
        <td><b>${esc(p.name_ar)}</b><div class="small muted" dir="ltr" style="text-align:start">${esc(p.name_en)}</div></td><td>${esc(p.category_ar || '—')}<div class="small muted">${esc(p.brand_name || '—')}</div></td>
        <td class="text-nowrap">${p.min_price === p.max_price ? money(p.min_price) : `${money(p.min_price)} – ${money(p.max_price)}`}${p.discount_pct ? ` ${chip('warn', '-' + p.discount_pct + '%')}` : ''}</td>
        <td>${chip(p.stock <= 0 ? 'bad' : p.stock <= 5 ? 'warn' : 'ok', p.stock)}</td><td>${p.active ? chip('ok', 'ظاهر') : chip('mute', 'مخفي')}${p.featured ? ` <span style="color:var(--warn)">${ic('star', 14)}</span>` : ''}</td>
        <td><div class="row-actions">${editBtn('editproduct', p.id)}${delBtn('delproduct', p.id, `data-name="${esc(p.name_ar)}"`)}</div></td></tr>`))}${pager(r)}`;
    if (q.edit) { const id = q.edit; history.replaceState(null, '', '#/products'); productForm(Number(id)); }
  };
  const num = (v) => (v === '' || v == null ? null : Number(v));
  function variantRow(v = {}) {
    return `<div class="variant-row" data-variant><input type="hidden" name="vid" value="${v.id || ''}"><input class="form-control" name="vlabel" placeholder="الحجم / النكهة (مثال: 5 Lbs)" value="${esc(v.label || '')}"><input class="form-control" name="vprice" type="number" min="0" step="0.01" placeholder="السعر" value="${v.price ?? ''}"><input class="form-control" name="vsale" type="number" min="0" step="0.01" placeholder="سعر الخصم" value="${v.sale_price ?? ''}"><input class="form-control" name="vstock" type="number" min="0" placeholder="المخزون" value="${v.stock ?? ''}"><button type="button" class="btn btn-sm btn-danger-soft" data-act="rmvariant" aria-label="حذف">${ic('x', 16)}</button></div>`;
  }
  const gimg = (u) => `<div class="gimg" data-url="${esc(u)}"><img src="${esc(u)}" alt=""><button type="button" class="gx" data-act="rmimg" aria-label="حذف">×</button><button type="button" class="gm" data-act="mainimg" aria-label="رئيسية">★</button></div>`;
  async function productForm(id) {
    await loadRefs();
    const p = id ? await get('/api/admin/products/' + id) : { active: 1, featured: 0, cashback_pct: 1, stock: 0, variants: [], image: '' };
    const sel = (name, list, cur, label) => `<select class="form-select" name="${name}"><option value="">— ${label} —</option>${list.map((x) => `<option value="${x.id}" ${x.id === cur ? 'selected' : ''}>${esc(x.name_ar || x.name)}</option>`).join('')}</select>`;
    const body = `<div class="form-grid">
      <div class="field"><label>الاسم بالعربي *</label><input class="form-control" name="name_ar" required maxlength="150" value="${esc(p.name_ar || '')}"></div>
      <div class="field"><label>الاسم بالإنجليزي *</label><input class="form-control" name="name_en" required maxlength="150" dir="ltr" value="${esc(p.name_en || '')}"></div>
      <div class="field"><label>القسم</label>${sel('category_id', S.cats, p.category_id, 'اختر القسم')}</div>
      <div class="field"><label>البراند</label>${sel('brand_id', S.brands, p.brand_id, 'اختر البراند')}</div>
      <div class="field"><label>السعر (لو من غير أحجام)</label><input class="form-control" name="price" type="number" min="0" step="0.01" value="${p.price ?? ''}"></div>
      <div class="field"><label>سعر الخصم</label><input class="form-control" name="sale_price" type="number" min="0" step="0.01" value="${p.sale_price ?? ''}"></div>
      <div class="field"><label>المخزون (لو من غير أحجام)</label><input class="form-control" name="stock" type="number" min="0" value="${p.stock ?? 0}"></div>
      <div class="field"><label>نسبة الكاش باك %</label><input class="form-control" name="cashback_pct" type="number" min="0" max="50" step="0.1" value="${p.cashback_pct ?? 1}"></div>
      <div class="field full"><label>الوصف بالعربي</label><textarea class="form-control" name="desc_ar" rows="3" maxlength="4000">${esc(p.desc_ar || '')}</textarea></div>
      <div class="field full"><label>الوصف بالإنجليزي</label><textarea class="form-control" name="desc_en" rows="3" maxlength="4000" dir="ltr">${esc(p.desc_en || '')}</textarea></div>
      <div class="field full"><label>صور المنتج (حتى 8، الأولى هي الرئيسية)</label><div class="gimgs" id="gimgs">${(p.images && p.images.length ? p.images : (p.image ? [p.image] : [])).map(gimg).join('')}</div><input class="form-control mt-2" type="file" id="imgFile" multiple accept="image/png,image/jpeg,image/webp,image/gif"><div class="small muted mt-1">PNG / JPG / WEBP حتى 3MB للصورة. تقدر تختار أكتر من صورة مرة واحدة. لو مفيش صور بيظهر غلاف تلقائي.</div></div>
      <label class="check"><input class="form-check-input m-0" type="checkbox" name="active" ${p.active ? 'checked' : ''}> ظاهر في المتجر</label><label class="check"><input class="form-check-input m-0" type="checkbox" name="featured" ${p.featured ? 'checked' : ''}> منتج مميز (الرئيسية)</label></div>
      <div class="h-sec">الأحجام / النكهات</div><p class="muted small mb-2">لو أضفت أحجام، السعر والمخزون بيتحسبوا منها تلقائيًا.</p>
      <div id="variants">${p.variants.map(variantRow).join('')}</div><button type="button" class="btn btn-sm btn-outline-secondary" data-act="addvariant">${ic('plus', 14)} إضافة حجم / نكهة</button>`;
    const form = openModal(id ? 'تعديل منتج' : 'منتج جديد', body, {
      wide: true, onSubmit: async (f) => {
        const d = new FormData(f);
        const rows = $$('[data-variant]', f).map((r) => ({ id: num($('[name=vid]', r).value), label: $('[name=vlabel]', r).value, price: num($('[name=vprice]', r).value), sale_price: num($('[name=vsale]', r).value), stock: num($('[name=vstock]', r).value) ?? 0 }));
        const payload = {
          name_ar: d.get('name_ar'), name_en: d.get('name_en'), desc_ar: d.get('desc_ar'), desc_en: d.get('desc_en'), category_id: num(d.get('category_id')), brand_id: num(d.get('brand_id')),
          price: num(d.get('price')) ?? (rows[0] ? rows[0].price : null), sale_price: num(d.get('sale_price')), stock: num(d.get('stock')) ?? 0, cashback_pct: num(d.get('cashback_pct')) ?? 1,
          images: $$('.gimg', f).map((g) => g.dataset.url), active: d.get('active') === 'on', featured: d.get('featured') === 'on', variants: rows,
        };
        if (payload.price == null) throw new Error('اكتب السعر أو أضف حجم واحد على الأقل');
        if (id) await put('/api/admin/products/' + id, payload); else await post('/api/admin/products', payload);
        toast('تم الحفظ'); route();
      },
    });
    $('#imgFile', form).addEventListener('change', async (e) => {
      const box = $('#gimgs', form);
      for (const file of [...e.target.files]) {
        if ($$('.gimg', box).length >= 8) { toast('الحد الأقصى 8 صور', 'bad'); break; }
        if (file.size > 3_000_000) { toast(file.name + ' أكبر من 3MB', 'bad'); continue; }
        const data = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file); });
        try { const r = await post('/api/admin/upload', { data }); box.insertAdjacentHTML('beforeend', gimg(r.url)); toast('تم رفع الصورة'); } catch (err) { toast(err.message, 'bad'); }
      }
      e.target.value = '';
    });
  }

  /* ---------- أقسام / براندات / كوبونات ---------- */
  views.categories = async () => {
    shell('categories', 'الأقسام', `<button class="btn btn-primary btn-sm" type="button" data-act="newcat">${ic('plus', 16)} قسم جديد</button>`, '');
    await loadRefs();
    $('#view').innerHTML = table(['الأيقونة', 'العربي', 'English', 'الترتيب', ''], S.cats.map((c) => `<tr><td style="font-size:22px">${esc(c.icon)}</td><td><b>${esc(c.name_ar)}</b></td><td dir="ltr" style="text-align:start">${esc(c.name_en)}</td><td>${c.sort}</td>
      <td><div class="row-actions">${editBtn('editcat', c.id)}${delBtn('delcat', c.id)}</div></td></tr>`));
  };
  function catForm(c = {}) {
    openModal(c.id ? 'تعديل قسم' : 'قسم جديد', `<div class="form-grid"><div class="field"><label>الاسم بالعربي *</label><input class="form-control" name="name_ar" required value="${esc(c.name_ar || '')}"></div><div class="field"><label>الاسم بالإنجليزي *</label><input class="form-control" name="name_en" required dir="ltr" value="${esc(c.name_en || '')}"></div><div class="field"><label>أيقونة (إيموجي)</label><input class="form-control" name="icon" maxlength="8" value="${esc(c.icon || '')}"></div><div class="field"><label>الترتيب</label><input class="form-control" name="sort" type="number" min="0" value="${c.sort ?? 0}"></div></div>`, {
      onSubmit: async (f) => { const d = Object.fromEntries(new FormData(f)); if (c.id) await put('/api/admin/categories/' + c.id, d); else await post('/api/admin/categories', d); toast('تم الحفظ'); route(); },
    });
  }
  views.brands = async () => {
    shell('brands', 'البراندات', `<button class="btn btn-primary btn-sm" type="button" data-act="newbrand">${ic('plus', 16)} براند جديد</button>`, '');
    await loadRefs();
    $('#view').innerHTML = table(['البراند', ''], S.brands.map((b) => `<tr><td><b>${esc(b.name)}</b></td><td><div class="row-actions">${editBtn('editbrand', b.id)}${delBtn('delbrand', b.id)}</div></td></tr>`));
  };
  function brandForm(b = {}) {
    openModal(b.id ? 'تعديل براند' : 'براند جديد', `<div class="field"><label>اسم البراند *</label><input class="form-control" name="name" required maxlength="80" value="${esc(b.name || '')}"></div>`, {
      onSubmit: async (f) => { const d = Object.fromEntries(new FormData(f)); if (b.id) await put('/api/admin/brands/' + b.id, d); else await post('/api/admin/brands', d); toast('تم الحفظ'); route(); },
    });
  }
  views.coupons = async () => {
    shell('coupons', 'الكوبونات', `<button class="btn btn-primary btn-sm" type="button" data-act="newcoupon">${ic('plus', 16)} كوبون جديد</button>`, '');
    const r = await get('/api/admin/coupons'); S.coupons = Object.fromEntries(r.items.map((c) => [c.id, c]));
    $('#view').innerHTML = table(['الكود', 'الخصم', 'حد أدنى', 'الاستخدام', 'ينتهي', 'الحالة', ''], r.items.map((c) => `<tr><td><b dir="ltr">${esc(c.code)}</b></td><td>${c.type === 'percent' ? c.value + '%' : money(c.value)}</td><td>${money(c.min_order)}</td>
      <td>${c.used}${c.max_uses ? ' / ' + c.max_uses : ' / ∞'}</td><td>${esc(c.expires_at || '—')}</td><td>${c.active ? chip('ok', 'فعّال') : chip('mute', 'موقوف')}</td>
      <td><div class="row-actions">${editBtn('editcoupon', c.id)}${delBtn('delcoupon', c.id)}</div></td></tr>`));
  };
  function couponForm(c = { type: 'percent', active: 1, min_order: 0, max_uses: 0 }) {
    openModal(c.id ? 'تعديل كوبون' : 'كوبون جديد', `<div class="form-grid">
      <div class="field"><label>الكود *</label><input class="form-control" name="code" required dir="ltr" maxlength="30" value="${esc(c.code || '')}"></div>
      <div class="field"><label>النوع</label><select class="form-select" name="type"><option value="percent" ${c.type === 'percent' ? 'selected' : ''}>نسبة %</option><option value="fixed" ${c.type === 'fixed' ? 'selected' : ''}>مبلغ ثابت</option></select></div>
      <div class="field"><label>قيمة الخصم *</label><input class="form-control" name="value" type="number" min="0.01" step="0.01" required value="${c.value ?? ''}"></div>
      <div class="field"><label>الحد الأدنى للطلب</label><input class="form-control" name="min_order" type="number" min="0" value="${c.min_order ?? 0}"></div>
      <div class="field"><label>أقصى عدد استخدامات (0 = بلا حد)</label><input class="form-control" name="max_uses" type="number" min="0" value="${c.max_uses ?? 0}"></div>
      <div class="field"><label>تاريخ الانتهاء</label><input class="form-control" name="expires_at" type="date" value="${esc(c.expires_at || '')}"></div>
      <label class="check"><input class="form-check-input m-0" type="checkbox" name="active" ${c.active ? 'checked' : ''}> فعّال</label></div>`, {
      onSubmit: async (f) => { const d = Object.fromEntries(new FormData(f)); d.active = d.active === 'on'; if (c.id) await put('/api/admin/coupons/' + c.id, d); else await post('/api/admin/coupons', d); toast('تم الحفظ'); route(); },
    });
  }

  /* ---------- المستخدمون / التقييمات / الإعدادات / السجل ---------- */
  views.users = async (q) => {
    shell('users', 'المستخدمون', '', '<div class="skel"></div>');
    const r = await get('/api/admin/users' + qs({ search: q.search, page: S.page })); S.users = Object.fromEntries(r.items.map((u) => [u.id, u]));
    $('#view').innerHTML = `<div class="filters-bar"><input class="form-control grow" data-filter="search" placeholder="بحث بالاسم / الإيميل / الموبايل" value="${esc(q.search || '')}"><span class="muted">${r.total} مستخدم</span></div>
      ${table(['الاسم', 'الإيميل', 'الموبايل', 'الطلبات', 'كاش باك', 'الدور', 'الحالة', ''], r.items.map((u) => `<tr><td><b>${esc(u.name)}</b><div class="small muted">${esc(date(u.created_at))}</div></td><td dir="ltr" style="text-align:start">${esc(u.email)}</td><td dir="ltr" style="text-align:start">${esc(u.phone || '—')}</td><td>${u.orders}</td><td>${money(u.cashback_balance)}</td>
        <td>${u.role === 'admin' ? chip('info', 'أدمن') : 'عميل'}</td><td>${u.active ? chip('ok', 'نشط') : chip('bad', 'موقوف')}</td>
        <td><div class="row-actions">${editBtn('edituser', u.id)}</div></td></tr>`))}${pager(r)}`;
  };
  views.reviews = async () => {
    shell('reviews', 'التقييمات', '', '<div class="skel"></div>');
    const r = await get('/api/admin/reviews');
    $('#view').innerHTML = table(['المنتج', 'العميل', 'التقييم', 'التعليق', 'الحالة', ''], r.items.map((v) => `<tr><td>${esc(v.product)}</td><td>${esc(v.user_name)}</td><td style="color:var(--warn);white-space:nowrap">${'★'.repeat(v.rating)}</td><td style="max-width:320px">${esc(v.comment)}</td>
      <td>${v.approved ? chip('ok', 'منشور') : chip('warn', 'بانتظار المراجعة')}</td>
      <td><div class="row-actions">${v.approved ? btnSm('rvoff', 'إخفاء', `data-id="${v.id}"`) : btnSm('rvon', `${ic('check', 14)} نشر`, `data-id="${v.id}"`, 'btn-primary')}${delBtn('rvdel', v.id)}</div></td></tr>`), 'لا توجد تقييمات');
  };

  /* ---------- واتساب ---------- */
  const WA_ST = { pending: ['warn', 'في الانتظار'], sent: ['ok', 'اتبعتت'], failed: ['bad', 'فشلت'], manual: ['info', 'جاهزة للإرسال'] };
  views.whatsapp = async (q) => {
    shell('whatsapp', 'رسائل واتساب', '', '<div class="skel"></div>');
    const [r, s] = await Promise.all([get('/api/admin/whatsapp' + qs({ status: q.status, page: S.page })), get('/api/admin/settings')]);
    const c = (k) => r.counts[k] || 0;
    const api = r.mode === 'api';
    const evRow = (e) => `<div class="wa-ev"><div class="d-flex align-items-center justify-content-between gap-3 mb-2"><b>${esc(e.label)}</b>
        <label class="check m-0"><input class="form-check-input m-0" type="checkbox" name="wa_on_${e.key}" ${s['wa_on_' + e.key] === '1' ? 'checked' : ''}> إرسال</label></div>
        <textarea class="form-control" name="wa_text_${e.key}" rows="3" maxlength="1000">${esc(s['wa_text_' + e.key] || '')}</textarea>
        <input class="form-control form-control-sm mt-2" name="wa_tpl_${e.key}" dir="ltr" maxlength="80" placeholder="اسم قالب واتساب المعتمد (اختياري، للـ API)" value="${esc(s['wa_tpl_' + e.key] || '')}"></div>`;
    $('#view').innerHTML = `
      <div class="notice ${api ? 'ok' : ''}" style="${api ? '' : 'background:rgba(76,194,255,.1);border-color:rgba(76,194,255,.4);color:#a8def8'}">${api
        ? `${ic('check', 16)} الإرسال التلقائي شغّال عبر WhatsApp Cloud API. أي طلب جديد أو تغيير حالة بيبعت رسالة للعميل لوحده.`
        : `${ic('info', 16)} الوضع الحالي: <b>يدوي</b>. الرسائل بتتجهّز تلقائيًا وتظهر هنا، وبتدوس "فتح واتساب" وتبعت. للإرسال التلقائي بالكامل ضيف WHATSAPP_TOKEN و WHATSAPP_PHONE_ID في ملف .env.`}</div>
      <div class="filters-bar"><a class="btn btn-sm ${!q.status ? 'btn-primary' : 'btn-outline-secondary'}" href="#/whatsapp">الكل</a>
        ${Object.entries(WA_ST).map(([k, v]) => `<a class="btn btn-sm ${q.status === k ? 'btn-primary' : 'btn-outline-secondary'}" href="#/whatsapp?status=${k}">${v[1]} (${c(k)})</a>`).join('')}</div>
      ${table(['الوقت', 'الطلب', 'الرقم', 'الحدث', 'الرسالة', 'الحالة', ''], r.items.map((m) => {
        const ev = (r.events.find((e) => e.key === m.event) || {}).label || m.event;
        const link = `https://wa.me/${esc(m.to_phone)}?text=${encodeURIComponent(m.body)}`;
        return `<tr><td class="small muted text-nowrap">${esc(date(m.created_at))}</td><td><b dir="ltr">${esc(m.code || '—')}</b><div class="small muted">${esc(m.name || '')}</div></td><td dir="ltr" style="text-align:start">${esc(m.to_phone)}</td><td>${esc(ev)}</td>
          <td class="small" style="max-width:300px;white-space:pre-line">${esc(m.body)}${m.error ? `<div style="color:var(--bad)">${esc(m.error)}</div>` : ''}</td><td>${chip(WA_ST[m.status][0], WA_ST[m.status][1])}</td>
          <td><div class="row-actions"><a class="btn btn-sm btn-primary" href="${link}" target="_blank" rel="noopener" data-act="wasent" data-id="${m.id}">${ic('phone', 14)} فتح واتساب</a>${m.status === 'failed' ? btnSm('waretry', 'إعادة', `data-id="${m.id}"`) : ''}</div></td></tr>`;
      }), 'لسه مفيش رسائل. أول طلب هتشوف رسالته هنا.')}${pager(r)}
      <form class="panel mt-4" id="waf" style="max-width:900px"><h3>${ic('gear', 20)} قوالب الرسائل</h3>
        <label class="check mb-2"><input class="form-check-input m-0" type="checkbox" name="wa_enabled" ${s.wa_enabled === '1' ? 'checked' : ''}> تفعيل رسائل واتساب</label>
        <p class="muted small">المتغيرات: <code dir="ltr">{name}</code> اسم العميل · <code dir="ltr">{code}</code> كود الطلب · <code dir="ltr">{total}</code> الإجمالي · <code dir="ltr">{store}</code> اسم المتجر · <code dir="ltr">{track_url}</code> رابط التتبع · <code dir="ltr">{phone}</code> رقم الدعم</p>
        <div class="d-grid gap-3">${r.events.map(evRow).join('')}</div><div id="waErr"></div><button class="btn btn-primary mt-3">${ic('check', 16)} حفظ القوالب</button></form>`;
    $('#waf').addEventListener('submit', async (e) => {
      e.preventDefault(); const f = new FormData(e.target), d = {};
      for (const [k] of f) d[k] = f.get(k);
      for (const k of ['wa_enabled', ...r.events.map((x) => 'wa_on_' + x.key)]) d[k] = f.get(k) === 'on';
      try { await put('/api/admin/settings', d); toast('تم حفظ القوالب'); } catch (err) { $('#waErr').innerHTML = `<div class="notice">${esc(err.message)}</div>`; }
    });
  };
  views.settings = async () => {
    shell('settings', 'الإعدادات', '', '<div class="skel"></div>');
    const s = await get('/api/admin/settings'); S.settings = s;
    $('#view').innerHTML = `<form class="panel" id="sf" style="max-width:780px"><div class="form-grid">
      <div class="field"><label>اسم المتجر</label><input class="form-control" name="store_name" maxlength="40" value="${esc(s.store_name)}"></div>
      <div class="field"><label>رقم التواصل</label><input class="form-control" name="contact_phone" dir="ltr" value="${esc(s.contact_phone)}"></div>
      <div class="field"><label>إيميل التواصل</label><input class="form-control" name="contact_email" dir="ltr" value="${esc(s.contact_email)}"></div><div></div>
      <div class="field"><label>مصاريف الشحن (ج.م)</label><input class="form-control" name="shipping_fee" type="number" min="0" value="${esc(s.shipping_fee)}"></div>
      <div class="field"><label>شحن مجاني لو الطلب أكبر من (0 = معطّل)</label><input class="form-control" name="free_shipping_over" type="number" min="0" value="${esc(s.free_shipping_over)}"></div>
      <div class="field"><label>أقصى نسبة كاش باك تتخصم من الطلب %</label><input class="form-control" name="max_cashback_use_pct" type="number" min="0" max="100" value="${esc(s.max_cashback_use_pct)}"></div>
      <label class="check" style="align-self:end;padding-bottom:10px"><input class="form-check-input m-0" type="checkbox" name="cashback_enabled" ${s.cashback_enabled === '1' ? 'checked' : ''}> تفعيل نظام الكاش باك</label>
      <div class="field full"><label>شريط الإعلان (عربي)</label><input class="form-control" name="announcement_ar" maxlength="200" value="${esc(s.announcement_ar)}"></div>
      <div class="field full"><label>شريط الإعلان (English)</label><input class="form-control" name="announcement_en" maxlength="200" dir="ltr" value="${esc(s.announcement_en)}"></div></div>
      <div id="sErr"></div><button class="btn btn-primary mt-3">${ic('check', 16)} حفظ الإعدادات</button></form>`;
    $('#sf').addEventListener('submit', async (e) => {
      e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); d.cashback_enabled = d.cashback_enabled === 'on';
      try { await put('/api/admin/settings', d); toast('تم حفظ الإعدادات'); } catch (err) { $('#sErr').innerHTML = `<div class="notice">${esc(err.message)}</div>`; }
    });
  };
  views.audit = async () => {
    shell('audit', 'سجل النشاط', '', '<div class="skel"></div>');
    const r = await get('/api/admin/audit');
    $('#view').innerHTML = table(['الوقت', 'المستخدم', 'العملية', 'تفاصيل', 'IP'], r.items.map((a) => `<tr><td class="small muted text-nowrap">${esc(date(a.created_at))}</td><td dir="ltr" style="text-align:start">${esc(a.email || '—')}</td><td><b>${esc(a.action)}</b></td><td class="small">${esc(a.detail || '')}</td><td class="small muted" dir="ltr">${esc(a.ip || '')}</td></tr>`));
  };

  /* ---------- الأحداث ---------- */
  document.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const act = el.dataset.act, id = Number(el.dataset.id);
    if (act !== 'wasent') e.preventDefault();
    const run = async (fn) => { try { await fn(); } catch (err) { toast(err.message, 'bad'); } };
    switch (act) {
      case 'logout': await post('/api/auth/logout'); S.user = null; renderLogin(); break;
      case 'apage': { const { name, q } = parseHash(); nav(name, { ...q, page: el.dataset.page }); break; }
      case 'order': orderModal(S.orders[el.dataset.code]); break;
      case 'newproduct': run(() => productForm(0)); break;
      case 'editproduct': run(() => productForm(id)); break;
      case 'delproduct': if (confirm(`حذف المنتج "${el.dataset.name}" نهائيًا؟ (الأفضل تخفيه بدل ما تحذفه)`)) run(async () => { await del('/api/admin/products/' + id); toast('تم الحذف'); route(); }); break;
      case 'addvariant': $('#variants').insertAdjacentHTML('beforeend', variantRow()); break;
      case 'rmvariant': el.closest('[data-variant]').remove(); break;
      case 'rmimg': el.closest('.gimg').remove(); break;
      case 'mainimg': { const g = el.closest('.gimg'); g.parentNode.prepend(g); break; }
      case 'newcat': catForm(); break;
      case 'editcat': catForm(S.cats.find((c) => c.id === id)); break;
      case 'delcat': if (confirm('حذف القسم؟ المنتجات هتفضل بدون قسم.')) run(async () => { await del('/api/admin/categories/' + id); route(); }); break;
      case 'newbrand': brandForm(); break;
      case 'editbrand': brandForm(S.brands.find((b) => b.id === id)); break;
      case 'delbrand': if (confirm('حذف البراند؟')) run(async () => { await del('/api/admin/brands/' + id); route(); }); break;
      case 'newcoupon': couponForm(); break;
      case 'editcoupon': couponForm(S.coupons[id]); break;
      case 'delcoupon': if (confirm('حذف الكوبون؟')) run(async () => { await del('/api/admin/coupons/' + id); route(); }); break;
      case 'edituser': {
        const u = S.users[id];
        openModal('تعديل مستخدم: ' + u.name, `<div class="form-grid"><div class="field"><label>الدور</label><select class="form-select" name="role"><option value="customer" ${u.role === 'customer' ? 'selected' : ''}>عميل</option><option value="admin" ${u.role === 'admin' ? 'selected' : ''}>أدمن</option></select></div>
          <div class="field"><label>رصيد الكاش باك</label><input class="form-control" name="cashback_balance" type="number" min="0" step="0.01" value="${u.cashback_balance}"></div>
          <label class="check"><input class="form-check-input m-0" type="checkbox" name="active" ${u.active ? 'checked' : ''}> الحساب نشط</label></div>`, {
          onSubmit: async (f) => { const d = Object.fromEntries(new FormData(f)); await patch('/api/admin/users/' + id, { role: d.role, cashback_balance: Number(d.cashback_balance), active: d.active === 'on' }); toast('تم الحفظ'); route(); },
        }); break;
      }
      case 'wasent': run(async () => { await post('/api/admin/whatsapp/' + id + '/sent'); setTimeout(route, 400); }); return;
      case 'waretry': run(async () => { await post('/api/admin/whatsapp/' + id + '/retry'); toast('اتعاد الإرسال'); setTimeout(route, 800); }); break;
      case 'rvon': run(async () => { await patch('/api/admin/reviews/' + id, { approved: true }); route(); }); break;
      case 'rvoff': run(async () => { await patch('/api/admin/reviews/' + id, { approved: false }); route(); }); break;
      case 'rvdel': if (confirm('حذف التقييم؟')) run(async () => { await del('/api/admin/reviews/' + id); route(); }); break;
    }
  });
  document.addEventListener('click', (e) => { const a = e.target.closest('#sb a[href^="#/"]'); if (a && B()) { const i = B().Offcanvas.getInstance($('#sb')); if (i) i.hide(); } });
  document.addEventListener('input', debounce((e) => { const el = e.target.closest('input[data-filter]'); if (el) { const { name, q } = parseHash(); S.focusFilter = el.dataset.filter; nav(name, { ...q, [el.dataset.filter]: el.value, page: '' }); } }, 400));
  document.addEventListener('change', (e) => { const el = e.target.closest('select[data-filter]'); if (el) { const { name, q } = parseHash(); nav(name, { ...q, [el.dataset.filter]: el.value, page: '' }); } });
  window.addEventListener('hashchange', route);

  (async function init() {
    try {
      const me = await get('/api/me'); S.user = me.user;
      if (S.user && S.user.role === 'admin') { await loadRefs(); try { S.settings = await get('/api/admin/settings'); } catch {} }
    } catch { S.user = null; }
    route();
  })();
})();
