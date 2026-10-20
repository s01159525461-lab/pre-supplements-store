/* أدوات مشتركة بين المتجر ولوحة الأدمن */
(function () {
  'use strict';
  const IF = (window.IF = window.IF || {});

  IF.esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  IF.$ = (s, r = document) => r.querySelector(s);
  IF.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  IF.api = async function (method, url, body) {
    const opt = { method, headers: {}, credentials: 'same-origin' };
    if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    let res;
    try { res = await fetch(url, opt); } catch { throw new Error(IF.lang === 'en' ? 'Network error' : 'مشكلة في الاتصال بالإنترنت'); }
    const type = res.headers.get('content-type') || '';
    const data = type.includes('json') ? await res.json() : await res.text();
    if (!res.ok) { const e = new Error((data && data.error) || 'Error'); e.status = res.status; throw e; }
    return data;
  };
  IF.get = (u) => IF.api('GET', u);
  IF.post = (u, b) => IF.api('POST', u, b ?? {});
  IF.put = (u, b) => IF.api('PUT', u, b ?? {});
  IF.patch = (u, b) => IF.api('PATCH', u, b ?? {});
  IF.del = (u) => IF.api('DELETE', u);

  IF.money = (n, cur) => `${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} ${cur || (IF.lang === 'en' ? 'EGP' : 'ج.م')}`;
  IF.qs = (obj) => { const p = new URLSearchParams(); for (const [k, v] of Object.entries(obj)) if (v !== '' && v != null && v !== false) p.set(k, v); const s = p.toString(); return s ? '?' + s : ''; };
  IF.debounce = (fn, ms = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  IF.date = (s) => { try { return new Date(String(s).replace(' ', 'T') + 'Z').toLocaleString(IF.lang === 'en' ? 'en-GB' : 'ar-EG', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return s; } };

  /* ---------- أيقونات SVG (بدون أي خط أيقونات خارجي) ---------- */
  const P = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.3l7.8-7.8 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    cart: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>',
    menu: '<path d="M3 12h18M3 6h18M3 18h18"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    truck: '<path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    bolt: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
    tag: '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><path d="M7 7h.01"/>',
    star: '<path d="M12 2l3.1 6.3 6.9 1-5 4.8 1.2 6.9-6.2-3.2-6.2 3.2L7 14.1 2 9.3l6.9-1z"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    left: '<path d="m15 18-6-6 6-6"/>', right: '<path d="m9 18 6-6-6-6"/>', down: '<path d="m6 9 6 6 6-6"/>', up: '<path d="m18 15-6-6-6 6"/>',
    arrow: '<path d="M5 12h14M12 5l7 7-7 7"/>', arrowback: '<path d="M19 12H5M12 19l-7-7 7-7"/>', top: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    filter: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
    package: '<path d="M16.5 9.4 7.5 4.2"/><path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z"/><path d="M3.3 7 12 12l8.7-5M12 22V12"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    chart: '<path d="M12 20V10M18 20V4M6 20v-4"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
    mail: '<path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="m22 6-10 7L2 6"/>',
    pin: '<path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    wallet: '<path d="M20 12V8H6a2 2 0 0 1 0-4h12v4"/><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>',
    card: '<rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/>',
    cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.4 1-3 0 1.4 1 2.5 2.5 2.5z"/>',
    dumbbell: '<path d="M6 6v12M18 6v12M3 9v6M21 9v6M6 12h12"/>',
    flask: '<path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2.2h12.4a1.5 1.5 0 0 0 1.3-2.2L14 9V3"/><path d="M7.5 15h9"/>',
    leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10z"/><path d="M2 21c0-3 1.9-5.5 6-7"/>',
    kettle: '<circle cx="12" cy="14" r="7"/><path d="M9 7.5a3 3 0 0 1 6 0"/>',
    bar: '<rect x="3" y="8" width="18" height="8" rx="2"/><path d="M7 8v8M12 8v8M17 8v8"/>',
    bottle: '<path d="M9 2h6v3l1.5 2.5V20a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2V7.5L9 5z"/><path d="M8 12h8"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
    ticket: '<path d="M2 9a3 3 0 0 1 0 6v3a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3a3 3 0 0 1 0-6V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/><path d="M13 5v2M13 17v2M13 11v2"/>',
    layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
    award: '<circle cx="12" cy="8" r="6"/><path d="M15.5 13.9 17 23l-5-3-5 3 1.5-9.1"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    party: '<path d="M5.8 11.3 2 22l10.7-3.8"/><path d="M4 3h.01M22 8h.01M15 2h.01M22 20h.01M22 2l-2.2.7a2.9 2.9 0 0 0-2 2.7v.1a2.9 2.9 0 0 1-1.9 2.7L15 9"/><path d="m8 15 1.3-3.4 3.4-1.3L9.3 14.4z"/>',
  };
  IF.icon = (name, size = 20, cls = '') => `<svg class="ico ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[name] || ''}</svg>`;
  IF.catIcon = (slug) => ({ protein: 'dumbbell', creatine: 'flask', 'fat-burners': 'flame', 'pre-workout': 'bolt', vitamins: 'leaf', 'weight-gainers': 'kettle', 'protein-bars': 'bar', accessories: 'bottle' }[slug] || 'tag');

  /* ---------- إشعارات (Bootstrap Toast مع بديل بسيط لو المكتبة مش محمّلة) ---------- */
  IF.toast = function (msg, type = 'ok') {
    let box = IF.$('#toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.className = 'toast-container position-fixed bottom-0 end-0 p-3'; box.style.zIndex = 2000; document.body.appendChild(box); }
    const el = document.createElement('div');
    el.className = 'toast align-items-center border-0 if-toast ' + type;
    el.setAttribute('role', type === 'bad' ? 'alert' : 'status');
    el.innerHTML = `<div class="d-flex"><div class="toast-body d-flex align-items-center gap-2">${IF.icon(type === 'bad' ? 'alert' : 'check', 18)}<span></span></div><button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button></div>`;
    el.querySelector('span').textContent = msg;
    box.appendChild(el);
    if (window.bootstrap && window.bootstrap.Toast) {
      const t = window.bootstrap.Toast.getOrCreateInstance(el, { delay: 3200 });
      el.addEventListener('hidden.bs.toast', () => el.remove());
      t.show();
    } else {
      el.classList.add('show'); setTimeout(() => el.remove(), 3200);
    }
  };

  /* ---------- صورة المنتج: لو مفيش صورة مرفوعة نولّد علبة مميزة لكل قسم ---------- */
  const ART = {
    protein: ['#C8FF2E', '#0d1a00'], creatine: ['#2EE6FF', '#00212a'], 'fat-burners': ['#FF6A2B', '#2a0e00'],
    'pre-workout': ['#B66CFF', '#1a0033'], vitamins: ['#3EE08A', '#022414'], 'weight-gainers': ['#FFC12E', '#2a1c00'],
    'protein-bars': ['#FF7AA8', '#2a0012'], accessories: ['#9FB0C6', '#0f151d'],
  };
  const KIND = { protein: 'PROTEIN', creatine: 'CREATINE', 'fat-burners': 'FAT BURNER', 'pre-workout': 'PRE-WORKOUT', vitamins: 'VITAMINS', 'weight-gainers': 'MASS GAINER', 'protein-bars': 'PROTEIN BAR', accessories: 'GEAR' };
  IF.productImg = function (p) {
    if (p.image) return p.image;
    const [c, bg] = ART[p.category_slug] || ['#C8FF2E', '#10151c'];
    const brand = IF.esc((p.brand_name || 'PRE SUPPLEMENTS').toUpperCase()).slice(0, 16);
    const kind = KIND[p.category_slug] || 'SUPPLEMENT';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><defs>
<radialGradient id="g" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="${c}" stop-opacity=".30"/><stop offset="1" stop-color="${bg}"/></radialGradient>
<linearGradient id="b" x1="0" x2="1"><stop offset="0" stop-color="#0a0c10"/><stop offset=".45" stop-color="#1e242d"/><stop offset="1" stop-color="#0a0c10"/></linearGradient>
<linearGradient id="l" x1="0" x2="1"><stop offset="0" stop-color="${c}" stop-opacity=".75"/><stop offset=".5" stop-color="${c}"/><stop offset="1" stop-color="${c}" stop-opacity=".75"/></linearGradient></defs>
<rect width="400" height="400" fill="${bg}"/><rect width="400" height="400" fill="url(#g)"/>
<ellipse cx="200" cy="352" rx="108" ry="14" fill="#000" opacity=".45"/>
<rect x="104" y="92" width="192" height="258" rx="26" fill="url(#b)" stroke="${c}" stroke-opacity=".35" stroke-width="2"/>
<rect x="120" y="54" width="160" height="44" rx="12" fill="url(#l)"/><rect x="120" y="82" width="160" height="6" fill="#000" opacity=".25"/>
<rect x="104" y="150" width="192" height="132" fill="#07090c" opacity=".55"/><rect x="104" y="150" width="192" height="5" fill="${c}"/><rect x="104" y="277" width="192" height="5" fill="${c}"/>
<text x="200" y="196" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="${brand.length > 11 ? 21 : 26}" fill="#fff" letter-spacing="1">${brand}</text>
<text x="200" y="228" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="15" fill="${c}" letter-spacing="3">${kind}</text>
<path d="M170 252h60" stroke="${c}" stroke-width="3" stroke-linecap="round" opacity=".7"/>
<rect x="116" y="104" width="10" height="236" rx="5" fill="#fff" opacity=".07"/></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  };

  IF.stars = function (rating, count) {
    const r = Math.round((rating || 0) * 2) / 2;
    let s = '';
    for (let i = 1; i <= 5; i++) s += `<span class="star ${i <= r ? 'on' : i - 0.5 === r ? 'half' : ''}">${IF.icon('star', 14)}</span>`;
    return `<span class="stars" aria-label="${r}/5">${s}${count != null ? `<small>(${count})</small>` : ''}</span>`;
  };

  IF.statusMeta = {
    pending: { ar: 'قيد المراجعة', en: 'Pending', cls: 'warn' }, confirmed: { ar: 'مؤكد', en: 'Confirmed', cls: 'info' },
    shipped: { ar: 'تم الشحن', en: 'Shipped', cls: 'info' }, delivered: { ar: 'تم التسليم', en: 'Delivered', cls: 'ok' },
    cancelled: { ar: 'ملغي', en: 'Cancelled', cls: 'bad' },
  };
  IF.payMeta = {
    unpaid: { ar: 'غير مدفوع', en: 'Unpaid', cls: 'warn' }, paid: { ar: 'مدفوع', en: 'Paid', cls: 'ok' },
    failed: { ar: 'فشل الدفع', en: 'Failed', cls: 'bad' }, refunded: { ar: 'مُسترد', en: 'Refunded', cls: 'info' },
  };
  IF.badge = (meta, key) => { const m = meta[key] || { ar: key, en: key, cls: '' }; return `<span class="badge-soft ${m.cls}">${IF.esc(IF.lang === 'en' ? m.en : m.ar)}</span>`; };

  IF.GOVS = [
    ['القاهرة', 'Cairo'], ['الجيزة', 'Giza'], ['الإسكندرية', 'Alexandria'], ['الدقهلية', 'Dakahlia'], ['الشرقية', 'Sharqia'], ['القليوبية', 'Qalyubia'],
    ['الغربية', 'Gharbia'], ['المنوفية', 'Monufia'], ['البحيرة', 'Beheira'], ['كفر الشيخ', 'Kafr El Sheikh'], ['دمياط', 'Damietta'], ['بورسعيد', 'Port Said'],
    ['الإسماعيلية', 'Ismailia'], ['السويس', 'Suez'], ['شمال سيناء', 'North Sinai'], ['جنوب سيناء', 'South Sinai'], ['الفيوم', 'Fayoum'], ['بني سويف', 'Beni Suef'],
    ['المنيا', 'Minya'], ['أسيوط', 'Assiut'], ['سوهاج', 'Sohag'], ['قنا', 'Qena'], ['الأقصر', 'Luxor'], ['أسوان', 'Aswan'], ['البحر الأحمر', 'Red Sea'],
    ['الوادي الجديد', 'New Valley'], ['مطروح', 'Matrouh'],
  ];
})();
