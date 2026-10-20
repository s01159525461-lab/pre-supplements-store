/* واجهة المتجر - Single Page App (Bootstrap 5 + Swiper) */
(function () {
  'use strict';
  const { esc, $, $$, get, post, put, del, qs, debounce, toast, productImg, stars, badge, statusMeta, payMeta, GOVS, date, icon, catIcon } = IF;
  const ic = (n, s, c) => IF.icon(n, s, c);

  /* ---------- حالة التطبيق ---------- */
  IF.lang = localStorage.getItem('if_lang') === 'en' ? 'en' : 'ar';
  const S = { cfg: null, user: null, wish: new Set(), coupon: '', useCb: false, cart: [], draft: null };
  try { S.cart = JSON.parse(localStorage.getItem('if_cart') || '[]'); if (!Array.isArray(S.cart)) S.cart = []; } catch { S.cart = []; }
  const saveCart = () => { try { localStorage.setItem('if_cart', JSON.stringify(S.cart)); } catch {} paintCounts(); };
  const cartCount = () => S.cart.reduce((n, l) => n + l.qty, 0);

  const t = (k, v) => {
    let s = (IF.T[IF.lang] || {})[k] ?? IF.T.ar[k] ?? k;
    if (v) for (const [a, b] of Object.entries(v)) s = s.replace('{' + a + '}', b);
    return s;
  };
  const nm = (o, f = 'name') => o[`${f}_${IF.lang}`] || o[`${f}_ar`] || o[`${f}_en`] || '';
  const $m = (n) => IF.money(n, t('egp'));
  const app = $('#app');
  const setTitle = (s) => { document.title = (s ? s + ' | ' : '') + (S.cfg ? S.cfg.settings.store_name : 'Pre Supplements'); };
  const nl2br = (s) => esc(s).replace(/\n/g, '<br>');
  const BS = () => window.bootstrap || null;

  /* ---------- الهيدر والفوتر ---------- */
  const BOLT = '<svg viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9ff5c"/><stop offset="1" stop-color="#b6f01f"/></linearGradient></defs><rect width="32" height="32" rx="9" fill="url(#lg)"/><path d="M18 4 8 18h7l-2 10 11-15h-7z" fill="#0b1200"/></svg>';
  const logoHtml = (name, half) => `<a class="logo" href="#/" aria-label="${name}">${BOLT}<span>${name.slice(0, half)}<b>${name.slice(half)}</b></span></a>`;

  function navLinks() {
    return [
      ['shop', '#/shop', 'grid', t('shop')],
      ['deals', '#/shop?deals=1', 'flame', t('deals'), 'deal'],
      ...S.cfg.categories.map((c) => ['cat-' + c.slug, '#/shop?cat=' + c.slug, catIcon(c.slug), nm(c)]),
      ['brands', '#/brands', 'award', t('brands')],
      ['track', '#/track', 'package', t('track')],
    ];
  }

  function renderChrome() {
    window.IF_BOOT && window.IF_BOOT.setDir(IF.lang);
    const s = S.cfg.settings;
    const name = esc(s.store_name || 'Pre Supplements'), half = Math.ceil(name.length / 2);
    const phone = esc(s.contact_phone || '');


    $('#header').innerHTML = `
      <div class="container hdr">
        <button class="icon-btn d-lg-none hdr-menu" type="button" data-bs-toggle="offcanvas" data-bs-target="#menuOc" aria-label="${esc(t('menu'))}">${ic('menu', 22)}</button>
        ${logoHtml(name, half)}
        <form class="search" id="searchForm" role="search" autocomplete="off">
          <span class="s-ico">${ic('search', 18)}</span>
          <input id="q" type="search" placeholder="${esc(t('search_ph'))}" maxlength="60" aria-label="${esc(t('search_ph'))}">
          <div class="suggest" id="suggest" hidden></div>
        </form>
        <div class="hdr-actions">
          <button class="act" type="button" data-act="lang" aria-label="${esc(t('lang'))}">${ic('globe', 20)}<span class="lbl">${esc(t('lang'))}</span></button>
          <a class="act d-none d-md-flex" href="${S.user ? '#/account' : '#/login'}" aria-label="${esc(t('account'))}">${ic('user', 22)}<span class="lbl d-none d-xl-inline">${esc(S.user ? (S.user.name || '').split(' ')[0] : t('login'))}</span></a>
          <a class="act d-none d-md-flex" href="#/account/wishlist" aria-label="${esc(t('wishlist'))}">${ic('heart', 22)}<span class="count" data-count="wish" ${S.wish.size ? '' : 'hidden'}>${S.wish.size}</span></a>
          <button class="act" type="button" data-act="opencart" aria-label="${esc(t('cart'))}">${ic('bag', 22)}<span class="count" data-count="cart" ${cartCount() ? '' : 'hidden'}>${cartCount()}</span><span class="lbl d-none d-xl-inline">${esc(t('cart'))}</span></button>
        </div>
      </div>
      <nav class="catbar d-none d-lg-block" aria-label="Categories"><div class="container"><div class="catbar-row">
        ${navLinks().map(([k, href, i, l, c]) => `<a href="${esc(href)}" data-nav="${esc(k)}" class="${c || ''}">${ic(i, 16)}${esc(l)}</a>`).join('')}
      </div></div></nav>`;

    $('#menuOcTitle').innerHTML = logoHtml(name, half);
    $('#menuBody').innerHTML = `
      <div class="menu-user">${S.user ? `<div class="avatar">${esc((S.user.name || '?').slice(0, 1).toUpperCase())}</div><div><b>${esc(t('hello'))} ${esc((S.user.name || '').split(' ')[0])}</b><small>${esc(S.user.email)}</small></div>`
        : `<a class="btn btn-primary w-100" href="#/login">${ic('user', 18)} ${esc(t('login'))}</a>`}</div>
      <ul class="menu-list">
        <li><a href="#/">${ic('home', 18)}${esc(t('home'))}</a></li>
        ${navLinks().map(([k, href, i, l, c]) => `<li><a href="${esc(href)}" class="${c || ''}">${ic(i, 18)}${esc(l)}</a></li>`).join('')}
        <li><a href="#/account/wishlist">${ic('heart', 18)}${esc(t('wishlist'))}</a></li>
        ${S.user ? `<li><a href="#/account">${ic('user', 18)}${esc(t('account'))}</a></li>` : ''}
      </ul>
      <button class="btn btn-outline-secondary w-100 mt-3" type="button" data-act="lang">${ic('globe', 18)} ${esc(t('lang'))}</button>
      ${phone ? `<a class="menu-phone" href="tel:${phone.replace(/\s/g, '')}" dir="ltr">${ic('phone', 16)} ${phone}</a>` : ''}`;
    $('#cartOcTitle').innerHTML = `${ic('bag', 20)} ${esc(t('cart'))}`;

    $('#tabbar').innerHTML = [
      ['home', '#/', 'home', t('home')], ['shop', '#/shop', 'grid', t('shop')],
      ['wish', S.user ? '#/account/wishlist' : '#/login', 'heart', t('wishlist')], ['cart', null, 'bag', t('cart')], ['acc', S.user ? '#/account' : '#/login', 'user', t('account')],
    ].map(([k, href, i, l]) => (k === 'cart'
      ? `<button type="button" data-act="opencart" class="tab" data-tab="cart">${ic(i, 22)}<span>${esc(l)}</span><em class="count" data-count="cart" ${cartCount() ? '' : 'hidden'}>${cartCount()}</em></button>`
      : `<a href="${href}" class="tab" data-tab="${k}">${ic(i, 22)}<span>${esc(l)}</span>${k === 'wish' ? `<em class="count" data-count="wish" ${S.wish.size ? '' : 'hidden'}>${S.wish.size}</em>` : ''}</a>`)).join('');
    $('#toTop').innerHTML = ic('top', 20); $('#toTop').setAttribute('aria-label', t('back_top'));

    $('#footer').innerHTML = `
      <div class="container">
        <div class="ft-grid">
          <div class="ft-about">${logoHtml(name, half)}<p>${esc(t('f_about'))}</p>
            <div class="ft-pay"><span>${ic('cash', 16)} ${esc(t('cod'))}</span><span>${ic('card', 16)} ${esc(t('online'))}</span></div></div>
          <div><h5>${esc(t('f_links'))}</h5><ul><li><a href="#/shop">${esc(t('shop'))}</a></li><li><a href="#/shop?deals=1">${esc(t('deals'))}</a></li><li><a href="#/brands">${esc(t('brands'))}</a></li><li><a href="#/page/about">${esc(t('about'))}</a></li></ul></div>
          <div><h5>${esc(t('f_help'))}</h5><ul><li><a href="#/track">${esc(t('track'))}</a></li><li><a href="#/account">${esc(t('account'))}</a></li><li><a href="#/cart">${esc(t('cart'))}</a></li></ul></div>
          <div><h5>${esc(t('f_contact'))}</h5><ul class="ft-contact">${phone ? `<li dir="ltr">${ic('phone', 16)}${phone}</li>` : ''}${s.contact_email ? `<li>${ic('mail', 16)}${esc(s.contact_email)}</li>` : ''}<li>${ic('truck', 16)}${esc(t('st_shipping'))}: 27</li></ul></div>
        </div>
        <div class="copy"><span>© ${new Date().getFullYear()} ${name} — ${esc(t('rights'))}</span><span>${ic('shield', 14)} ${esc(t('trust_note'))}</span></div>
      </div>`;
    bindSearch();
    markNav();
  }
  function markNav() {
    const { path, q } = parseHash();
    $$('.catbar a, .menu-list a').forEach((a) => {
      const k = a.dataset.nav; if (!k) return;
      let on = false;
      if (path === '/shop') on = (k === 'shop' && !q.cat && !q.deals) || (k === 'deals' && q.deals === '1') || (q.cat && k === 'cat-' + q.cat);
      else if (path === '/brands') on = k === 'brands'; else if (path === '/track') on = k === 'track';
      a.classList.toggle('active', !!on);
    });
    const cur = path === '/' ? 'home' : path === '/shop' ? 'shop' : path.startsWith('/account/wishlist') ? 'wish' : path.startsWith('/account') || path === '/login' || path === '/register' ? 'acc' : '';
    $$('.tabbar .tab').forEach((a) => a.classList.toggle('active', a.dataset.tab === cur));
  }
  function paintCounts() {
    $$('[data-count="cart"]').forEach((el) => { el.textContent = cartCount(); el.hidden = !cartCount(); });
    $$('[data-count="wish"]').forEach((el) => { el.textContent = S.wish.size; el.hidden = !S.wish.size; });
  }

  function bindSearch() {
    const form = $('#searchForm'), input = $('#q'), box = $('#suggest');
    form.addEventListener('submit', (e) => { e.preventDefault(); box.hidden = true; const v = input.value.trim(); go('/shop', v ? { search: v } : {}); input.blur(); });
    const run = debounce(async () => {
      const v = input.value.trim();
      if (v.length < 2) { box.hidden = true; return; }
      try {
        const r = await get('/api/products' + qs({ search: v, per: 5 }));
        box.innerHTML = r.items.length ? r.items.map((p) => `<a href="#/p/${esc(p.slug)}"><img src="${esc(productImg(p))}" alt=""><div><div>${esc(nm(p))}</div><small>${$m(p.min_price)}</small></div></a>`).join('') : `<div class="no-res">${esc(t('no_results'))}</div>`;
        box.hidden = false;
      } catch { box.hidden = true; }
    }, 250);
    input.addEventListener('input', run);
    if (!bindSearch.done) { bindSearch.done = true; document.addEventListener('click', (e) => { const f = $('#searchForm'), b = $('#suggest'); if (f && b && !f.contains(e.target)) b.hidden = true; }); }
    box.addEventListener('click', () => { box.hidden = true; });
  }

  /* ---------- الراوتر ---------- */
  function parseHash() {
    const h = location.hash.slice(1) || '/';
    const [path, query = ''] = h.split('?');
    return { path: path || '/', q: Object.fromEntries(new URLSearchParams(query)) };
  }
  function go(path, params = {}) { location.hash = '#' + path + qs(params); }

  const routes = [];
  const on = (re, fn) => routes.push([re, fn]);
  let token = 0;

  const skeleton = (n = 8) => `<div class="container section"><div class="skel-title"></div><div class="grid">${Array.from({ length: n }, () => '<div class="skel-card"></div>').join('')}</div></div>`;

  /* إغلاق أي Offcanvas مفتوح (مثلًا فلاتر الموبايل) قبل إعادة رسم الصفحة، وتنظيف أي Backdrop عالق */
  function closeOverlays() {
    const B = BS(); if (!B) return;
    $$('.offcanvas.show').forEach((el) => { try { const i = B.Offcanvas.getInstance(el); if (i) i.hide(); } catch {} });
    setTimeout(() => {
      if (!$('.offcanvas.show')) { $$('.offcanvas-backdrop').forEach((b) => b.remove()); document.body.style.removeProperty('overflow'); document.body.style.removeProperty('padding-right'); }
    }, 700);
  }

  async function route() {
    const my = ++token;
    const { path, q } = parseHash();
    markNav();
    closeOverlays();
    window.scrollTo(0, 0);
    for (const [re, fn] of routes) {
      const m = re.exec(path);
      if (!m) continue;
      app.innerHTML = skeleton(path === '/' ? 4 : 8);
      try { await fn(m, q, () => my === token); }
      catch (e) { if (my === token) app.innerHTML = `<div class="container page"><div class="empty">${ic('alert', 44)}<p>${esc(e.message || t('error'))}</p><a class="btn btn-primary" href="#/">${esc(t('back_home'))}</a></div></div>`; }
      return;
    }
    setTitle(t('not_found'));
    app.innerHTML = `<div class="container page"><div class="empty">${ic('search', 44)}<p>${esc(t('not_found'))}</p><a class="btn btn-primary" href="#/">${esc(t('back_home'))}</a></div></div>`;
  }

  /* ---------- مكونات ---------- */
  function card(p) {
    const out = p.stock <= 0;
    const hasSale = p.sale_price > 0 && p.sale_price < p.price;
    const range = p.variant_count > 1 && p.min_price !== p.max_price;
    const price = range ? `<small>${esc(t('from'))}</small><b>${$m(p.min_price)}</b>` : `<b>${$m(p.min_price)}</b>${hasSale ? `<s>${$m(p.price)}</s>` : ''}`;
    const multi = p.variant_count > 1;
    const vid = !multi && p.variants && p.variants[0] ? p.variants[0].id : '';
    return `<article class="pcard ${out ? 'is-out' : ''}">
      <div class="p-media"><a href="#/p/${esc(p.slug)}" tabindex="-1" aria-hidden="true"><img loading="lazy" src="${esc(productImg(p))}" alt="${esc(nm(p))}"></a>
        ${out ? `<span class="tag out">${esc(t('out_of_stock'))}</span>` : p.discount_pct ? `<span class="tag">-${p.discount_pct}%</span>` : ''}
        <button class="p-wish ${S.wish.has(p.id) ? 'on' : ''}" type="button" data-act="wish" data-id="${p.id}" aria-label="${esc(t('wishlist'))}">${ic('heart', 18)}</button></div>
      <div class="p-body">
        <span class="p-brand">${esc(p.brand_name || '')}</span>
        <h3><a href="#/p/${esc(p.slug)}">${esc(nm(p))}</a></h3>
        ${p.rating_count ? stars(p.rating, p.rating_count) : ''}
        <div class="p-price">${price}</div>
        ${S.cfg.settings.cashback_enabled === '1' && p.cashback > 0 && !out ? `<span class="cashback">${ic('wallet', 13)} +${$m(p.cashback)} ${esc(t('cashback_get'))}</span>` : ''}
        ${out ? '' : multi ? `<a class="btn btn-outline-secondary btn-sm w-100 p-btn" href="#/p/${esc(p.slug)}">${esc(t('choose_option'))}</a>`
          : `<button class="btn btn-primary btn-sm w-100 p-btn" type="button" data-act="quickadd" data-id="${p.id}" data-vid="${vid}">${ic('bag', 16)} ${esc(t('add_to_cart'))}</button>`}
      </div></article>`;
  }
  const grid = (items) => `<div class="grid">${items.map(card).join('')}</div>`;
  const sectionHead = (title, link, kicker) => `<div class="sec-head"><div>${kicker ? `<span class="kicker">${kicker}</span>` : ''}<h2>${title}</h2></div>${link ? `<a class="more" href="${link}">${esc(t('all'))} ${ic(IF.lang === 'ar' ? 'left' : 'right', 16)}</a>` : ''}</div>`;
  const carousel = (items, id) => `<div class="swiper prod-swiper" id="${id}"><div class="swiper-wrapper">${items.map((p) => `<div class="swiper-slide">${card(p)}</div>`).join('')}</div>
    <button class="sw-btn sw-prev" type="button" aria-label="prev">${ic('right', 20)}</button><button class="sw-btn sw-next" type="button" aria-label="next">${ic('right', 20)}</button></div>`;
  const known = new Map();
  const remember = (items) => items.forEach((p) => known.set(p.id, p));

  function initSwipers() {
    if (!window.Swiper) return;
    try {
      const hero = $('#heroSwiper');
      if (hero) new window.Swiper(hero, { rewind: true, speed: 650, autoplay: { delay: 6500, disableOnInteraction: false, pauseOnMouseEnter: true }, pagination: { el: '.hero-dots', clickable: true }, a11y: true });
      $$('.prod-swiper').forEach((el) => new window.Swiper(el, {
        slidesPerView: 2, spaceBetween: 12, navigation: { nextEl: $('.sw-next', el), prevEl: $('.sw-prev', el) },
        breakpoints: { 576: { slidesPerView: 3, spaceBetween: 14 }, 992: { slidesPerView: 4, spaceBetween: 18 }, 1280: { slidesPerView: 5, spaceBetween: 18 } },
      }));
    } catch (e) { console.warn('Swiper init failed', e); }
  }

  /* ---------- صفحات HTML قابلة للتعديل (مجلد public/pages) ---------- */
  async function loadFragment(name) {
    for (const f of [`${name}.${IF.lang}.html`, `${name}.html`]) {
      try {
        const r = await fetch('/pages/' + f, { cache: 'no-store', credentials: 'same-origin' });
        if (r.ok && /html/.test(r.headers.get('content-type') || '')) { const txt = (await r.text()).trim(); if (txt) return txt; }
      } catch { /* ignore */ }
    }
    return null;
  }
  on(/^\/page\/([\w-]+)$/, async (m, q, alive) => {
    const html = await loadFragment(m[1]);
    if (!alive()) return;
    if (!html) { setTitle(t('not_found')); app.innerHTML = `<div class="container page"><div class="empty">${ic('search', 44)}<p>${esc(t('not_found'))}</p><a class="btn btn-primary" href="#/">${esc(t('back_home'))}</a></div></div>`; return; }
    const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
    setTitle(h1 ? h1[1].replace(/<[^>]+>/g, '').trim() : m[1]);
    app.innerHTML = `<div class="container page page-html">${html}</div>`;
  });

  /* ---------- الرئيسية ---------- */
  on(/^\/$/, async (m, q, alive) => {
    const [feat, deals, best, heroFrag, extraFrag] = await Promise.all([
      get('/api/products?featured=1&per=8'), get('/api/products?deals=1&sort=discount&per=10'), get('/api/products?sort=popular&per=10'),
      loadFragment('home-hero'), loadFragment('home-extra'),
    ]);
    if (!alive()) return;
    [feat, deals, best].forEach((r) => remember(r.items));
    setTitle('');
    const totalProducts = S.cfg.categories.reduce((n, c) => n + c.count, 0);
    const pool = (best.items.length ? best.items : feat.items);
    const tiles = pool.slice(0, 3).map((p) => `<div class="tile"><img src="${esc(productImg(p))}" alt=""></div>`).join('');
    const dealTiles = (deals.items.length ? deals.items : pool).slice(0, 2).map((p) => `<div class="tile"><img src="${esc(productImg(p))}" alt=""></div>`).join('');
    const maxOff = Math.max(10, ...deals.items.map((p) => p.discount_pct || 0));
    const slide = (cls, text, art) => `<div class="swiper-slide"><section class="hero-slide ${cls}"><div class="container hs-wrap"><div class="hs-text">${text}</div><div class="hs-art" aria-hidden="true">${art}</div></div></section></div>`;
    const features = [['shield', 'f1'], ['truck', 'f2'], ['wallet', 'f3'], ['cash', 'f4']];
    app.innerHTML = `
      <div class="swiper hero-swiper" id="heroSwiper"><div class="swiper-wrapper">
        ${slide('hs-1', `<span class="eyebrow">${ic('bolt', 16)} ${esc(t('hero_eyebrow'))}</span><h1>${t('hero_h1')}</h1><p>${esc(t('hero_p'))}</p>
          <div class="hs-cta"><a class="btn btn-primary btn-lg" href="#/shop">${esc(t('shop_now'))} ${ic(IF.lang === 'ar' ? 'left' : 'right', 18)}</a><a class="btn btn-outline-light btn-lg" href="#/shop?deals=1">${ic('flame', 18)} ${esc(t('see_deals'))}</a></div>
          <div class="hs-stats"><div><b>${totalProducts}+</b><span>${esc(t('st_products'))}</span></div><div><b>${S.cfg.brands.length}</b><span>${esc(t('st_brands'))}</span></div><div><b>27</b><span>${esc(t('st_shipping'))}</span></div></div>`, `<div class="art-tiles">${tiles}</div>`)}
        ${slide('hs-2', `<span class="eyebrow fire">${ic('flame', 16)} ${esc(t('slide2_eyebrow'))}</span><h2 class="hs-title">${esc(t('deal_banner_t'))}</h2><p>${esc(t('deal_banner_p'))}</p>
          <div class="hs-cta"><a class="btn btn-accent btn-lg" href="#/shop?deals=1">${esc(t('see_deals'))} ${ic(IF.lang === 'ar' ? 'left' : 'right', 18)}</a></div>`, `<div class="art-pct"><span>${maxOff}<small>%</small></span><em>${esc(t('off'))}</em></div><div class="art-tiles two">${dealTiles}</div>`)}
        ${slide('hs-3', `<span class="eyebrow">${ic('truck', 16)} ${esc(t('slide3_eyebrow'))}</span><h2 class="hs-title">${t('slide3_t')}</h2><p>${esc(t('slide3_p'))}</p>
          <div class="hs-cta"><a class="btn btn-primary btn-lg" href="#/shop">${esc(t('shop_now'))} ${ic(IF.lang === 'ar' ? 'left' : 'right', 18)}</a></div>`, `<div class="art-orbs"><span class="orb o1">${ic('truck', 44)}</span><span class="orb o2">${ic('wallet', 44)}</span><span class="orb o3">${ic('shield', 44)}</span></div>`)}
      </div><div class="hero-dots"></div></div>

      <section class="trust"><div class="container"><div class="trust-row">${features.map(([i, k]) => `<div class="trust-item"><span class="ti">${ic(i, 24)}</span><div><b>${esc(t(k + '_t'))}</b><small>${esc(t(k + '_p'))}</small></div></div>`).join('')}</div></div></section>

      <section class="section container">${sectionHead(esc(t('cats')), '#/shop', esc(t('explore')))}<div class="cats">${S.cfg.categories.map((c) => `<a class="cat-card" href="#/shop?cat=${esc(c.slug)}"><span class="ci">${ic(catIcon(c.slug), 28)}</span><b>${esc(nm(c))}</b><small>${c.count}</small></a>`).join('')}</div></section>
      ${deals.items.length ? `<section class="section container">${sectionHead(t('hot_deals'), '#/shop?deals=1')}${carousel(deals.items, 'swDeals')}</section>` : ''}
      <section class="section container"><div class="deal-banner"><div><h3>${esc(t('deal_banner_t'))}</h3><p>${esc(t('deal_banner_p'))}</p></div><a class="btn btn-dark btn-lg" href="#/shop?deals=1">${esc(t('see_deals'))}</a></div></section>
      <section class="section container">${sectionHead(esc(t('best_sellers')), '#/shop?sort=popular')}${carousel(best.items, 'swBest')}</section>
      ${feat.items.length ? `<section class="section container">${sectionHead(t('featured'), '#/shop')}${grid(feat.items.slice(0, 4))}</section>` : ''}
      <section class="section container">${sectionHead(esc(t('shop_brands')), '#/brands')}<div class="brands">${S.cfg.brands.map((b) => `<a class="brand-pill" href="#/shop?brand=${esc(b.slug)}">${esc(b.name)}</a>`).join('')}</div></section>`;
    if (heroFrag) { const h = $('#heroSwiper'); if (h) h.outerHTML = `<div class="hero-custom">${heroFrag}</div>`; }
    if (extraFrag) { const tr = $('.trust'); if (tr) tr.insertAdjacentHTML('afterend', `<div class="home-extra">${extraFrag}</div>`); }
    initSwipers();
  });

  /* ---------- المتجر ---------- */
  on(/^\/shop$/, async (m, q, alive) => {
    const params = { cat: q.cat, brand: q.brand, search: q.search, sort: q.sort, min: q.min, max: q.max, deals: q.deals, instock: q.instock, page: q.page, per: 12 };
    const r = await get('/api/products' + qs(params));
    if (!alive()) return;
    remember(r.items);
    const cat = S.cfg.categories.find((c) => c.slug === q.cat), brand = S.cfg.brands.find((b) => b.slug === q.brand);
    const heading = q.deals === '1' ? t('deals') : cat ? nm(cat) : brand ? brand.name : q.search ? '“' + q.search + '”' : t('shop');
    setTitle(heading);
    const chips = [];
    if (cat) chips.push(['cat', nm(cat)]); if (brand) chips.push(['brand', brand.name]); if (q.search) chips.push(['search', '“' + q.search + '”']);
    if (q.deals === '1') chips.push(['deals', t('only_deals')]); if (q.instock === '1') chips.push(['instock', t('only_in_stock')]);
    if (q.min || q.max) chips.push(['price', `${q.min || 0} - ${q.max || '∞'}`]);
    const opt = (key, val, label, count) => `<button type="button" class="opt ${(q[key] || '') === val ? 'active' : ''}" data-act="filter" data-key="${key}" data-val="${esc(val)}"><span>${esc(label)}</span>${count != null ? `<small>${count}</small>` : ''}</button>`;
    const sorts = ['featured', 'popular', 'latest', 'price_asc', 'price_desc', 'discount'];
    app.innerHTML = `<div class="container">
      <div class="crumbs"><a href="#/">${esc(t('home'))}</a><span>/</span><b>${esc(heading)}</b></div>
      <div class="shop">
      <aside class="filters offcanvas-lg offcanvas-start" id="filters" tabindex="-1" aria-labelledby="filtersTitle">
        <div class="offcanvas-header"><h5 class="offcanvas-title" id="filtersTitle">${ic('filter', 18)} ${esc(t('filters'))}</h5><button type="button" class="btn-close" data-bs-dismiss="offcanvas" data-bs-target="#filters" aria-label="Close"></button></div>
        <div class="offcanvas-body"><div class="f-card">
          <h4>${esc(t('category'))}</h4>${opt('cat', '', t('all'))}${S.cfg.categories.map((c) => opt('cat', c.slug, nm(c), c.count)).join('')}
          <h4>${esc(t('brand'))}</h4>${opt('brand', '', t('all'))}${S.cfg.brands.map((b) => opt('brand', b.slug, b.name, b.count)).join('')}
          <h4>${esc(t('price'))}</h4>
          <form data-form="price"><div class="price-row"><input class="form-control" name="min" type="number" min="0" placeholder="${esc(t('min'))}" value="${esc(q.min || '')}"><input class="form-control" name="max" type="number" min="0" placeholder="${esc(t('max'))}" value="${esc(q.max || '')}"></div><button class="btn btn-outline-secondary btn-sm w-100 mt-2">${esc(t('apply'))}</button></form>
          <h4>${esc(t('filters'))}</h4>
          <div class="form-check form-switch"><input class="form-check-input" type="checkbox" role="switch" id="fInStock" data-change="instock" ${q.instock === '1' ? 'checked' : ''}><label class="form-check-label" for="fInStock">${esc(t('only_in_stock'))}</label></div>
          <div class="form-check form-switch"><input class="form-check-input" type="checkbox" role="switch" id="fDeals" data-change="deals" ${q.deals === '1' ? 'checked' : ''}><label class="form-check-label" for="fDeals">${esc(t('only_deals'))}</label></div>
        </div></div>
      </aside>
      <section class="shop-main">
        <div class="toolbar"><div class="tb-left"><button class="btn btn-outline-secondary btn-sm d-lg-none" type="button" data-bs-toggle="offcanvas" data-bs-target="#filters">${ic('filter', 16)} ${esc(t('filters'))}</button><b class="res-count">${esc(t('results', { n: r.total }))}</b></div>
          <select class="form-select form-select-sm sort-sel" data-change="sort" aria-label="${esc(t('sort'))}">${sorts.map((s) => `<option value="${s}" ${(q.sort || 'featured') === s ? 'selected' : ''}>${esc(t('s_' + s))}</option>`).join('')}</select></div>
        ${chips.length ? `<div class="chips">${chips.map(([k, l]) => `<button type="button" class="chip" data-act="unfilter" data-key="${k}">${esc(l)} ${ic('x', 13)}</button>`).join('')}<button type="button" class="chip clear" data-act="clearfilters">${esc(t('clear'))}</button></div>` : ''}
        ${r.items.length ? grid(r.items) : `<div class="empty">${ic('search', 44)}<p>${esc(t('no_results'))}</p><button class="btn btn-outline-secondary" data-act="clearfilters">${esc(t('clear'))}</button></div>`}
        ${r.pages > 1 ? `<nav class="pager" aria-label="pages">${pageButtons(r.page, r.pages)}</nav>` : ''}
      </section></div></div>`;
  });
  function pageButtons(cur, total) {
    const out = [];
    for (let i = 1; i <= total; i++) if (i === 1 || i === total || Math.abs(i - cur) <= 2) out.push(i); else if (out[out.length - 1] !== '…') out.push('…');
    return out.map((i) => (i === '…' ? '<span class="dots">…</span>' : `<button type="button" class="${i === cur ? 'active' : ''}" data-act="page" data-page="${i}" ${i === cur ? 'aria-current="page"' : ''}>${i}</button>`)).join('');
  }

  on(/^\/brands$/, async () => {
    setTitle(t('brands'));
    app.innerHTML = `<div class="container page"><h1 class="page-title">${esc(t('brands'))}</h1><div class="brands lg">${S.cfg.brands.map((b) => `<a class="brand-pill" href="#/shop?brand=${esc(b.slug)}">${esc(b.name)} <small>${b.count}</small></a>`).join('')}</div></div>`;
  });

  /* ---------- صفحة المنتج ---------- */
  let pdp = null;
  on(/^\/p\/([^/]+)$/, async (m, q, alive) => {
    const p = await get('/api/products/' + encodeURIComponent(m[1]));
    if (!alive()) return;
    remember([p]); known.set(p.id, p);
    const first = p.variants.find((v) => v.stock > 0) || p.variants[0];
    pdp = { p, vid: first ? first.id : null, qty: 1 };
    setTitle(nm(p));
    const desc = nm(p, 'desc');
    app.innerHTML = `<div class="container">
      <div class="crumbs"><a href="#/">${esc(t('home'))}</a><span>/</span><a href="#/shop?cat=${esc(p.category_slug || '')}">${esc(IF.lang === 'ar' ? p.category_ar || '' : p.category_en || '')}</a><span>/</span><b>${esc(nm(p))}</b></div>
      <div class="pdp">
        <div class="gallery"><img id="gmain" src="${esc((p.images && p.images[0]) || productImg(p))}" alt="${esc(nm(p))}">${p.images && p.images.length > 1 ? `<div class="gthumbs">${p.images.map((u, i) => `<button type="button" class="gth ${i ? '' : 'on'}" data-act="gimg" data-src="${esc(u)}"><img src="${esc(u)}" alt=""></button>`).join('')}</div>` : ''}</div>
        <div class="buybox">
          <a class="pdp-brand" href="#/shop?brand=${esc(p.brand_slug || '')}">${esc(p.brand_name || '')}</a>
          <h1>${esc(nm(p))}</h1>
          <div class="pdp-rate">${stars(p.rating, p.rating_count)}</div>
          <div class="big-price" id="pdpPrice"></div>
          <div id="pdpStock" class="pdp-stock"></div>
          ${p.variants.length ? `<div class="opt-label">${esc(t('size'))}</div><div class="opts" id="pdpOpts">${p.variants.map((v) => `<button type="button" class="opt-chip ${v.id === pdp.vid ? 'active' : ''} ${v.stock <= 0 ? 'na' : ''}" data-act="opt" data-vid="${v.id}" ${v.stock <= 0 ? 'disabled' : ''}>${esc(v.label)}</button>`).join('')}</div>` : ''}
          <div class="buy-row"><div class="qty"><button type="button" data-act="pqty" data-d="-1" aria-label="-">${ic('minus', 16)}</button><span id="pdpQty">1</span><button type="button" data-act="pqty" data-d="1" aria-label="+">${ic('plus', 16)}</button></div>
            <button class="btn btn-primary btn-lg flex-fill" type="button" id="pdpAdd" data-act="padd">${ic('bag', 18)} ${esc(t('add_to_cart'))}</button>
            <button class="btn btn-icon ${S.wish.has(p.id) ? 'on' : ''}" type="button" data-act="wish" data-id="${p.id}" aria-label="${esc(t('wishlist'))}">${ic('heart', 20)}</button></div>
          <button class="btn btn-accent btn-lg w-100" type="button" id="pdpBuy" data-act="pbuy">${ic('bolt', 18)} ${esc(t('buy_now'))}</button>
          <div class="perks">${[['shield', 'f1_t'], ['truck', 'f2_t'], ['wallet', 'f3_t'], ['cash', 'f4_t']].map(([i, k]) => `<div class="perk">${ic(i, 20)}<span>${esc(t(k))}</span></div>`).join('')}</div>
        </div>
      </div>
      <div class="panel pdp-tabs">
        <div class="tabs" role="tablist"><button type="button" class="active" data-act="tab" data-tab="desc" role="tab">${esc(t('description'))}</button><button type="button" data-act="tab" data-tab="rev" role="tab">${esc(t('reviews'))} (${p.rating_count})</button></div>
        <div id="tab-desc">${desc ? `<p class="desc">${nl2br(desc)}</p>` : `<p class="text-secondary">—</p>`}</div>
        <div id="tab-rev" hidden>
          ${p.reviews.length ? p.reviews.map((r) => `<div class="review"><div class="rv-top">${stars(r.rating)} <b>${esc(r.user_name)}</b> <small>${esc(date(r.created_at))}</small></div><p>${nl2br(r.comment)}</p></div>`).join('') : `<p class="text-secondary">${esc(t('no_reviews'))}</p>`}
          <h4 class="mt-4">${esc(t('write_review'))}</h4>
          ${S.user ? `<form data-form="review" class="rv-form"><select class="form-select" name="rating" aria-label="${esc(t('rating'))}">${[5, 4, 3, 2, 1].map((n) => `<option value="${n}">${'★'.repeat(n)}</option>`).join('')}</select><textarea class="form-control" name="comment" rows="3" maxlength="1000" placeholder="${esc(t('comment'))}"></textarea><button class="btn btn-primary">${esc(t('submit'))}</button></form>` : `<p><a class="link-accent" href="#/login?next=${encodeURIComponent('/p/' + p.slug)}">${esc(t('login_to_review'))}</a></p>`}
        </div>
      </div>
      ${p.related.length ? `<section class="section">${sectionHead(esc(t('related')))}${carousel(p.related, 'swRel')}</section>` : ''}</div>`;
    remember(p.related);
    paintPdp();
    initSwipers();
  });
  function curVariant() { return pdp.p.variants.find((v) => v.id === pdp.vid) || null; }
  function paintPdp() {
    const { p } = pdp, v = curVariant();
    const base = v ? v.price : p.price, sale = v ? v.sale_price : p.sale_price;
    const hasSale = sale > 0 && sale < base, now = hasSale ? sale : base, stock = v ? v.stock : p.stock;
    $('#pdpPrice').innerHTML = `<b>${$m(now)}</b>${hasSale ? `<s>${$m(base)}</s><span class="tag">-${Math.round((1 - sale / base) * 100)}%</span>` : ''}`;
    $('#pdpStock').innerHTML = stock <= 0 ? `<span class="badge-soft bad">${esc(t('out_of_stock'))}</span>` : stock <= 5 ? `<span class="badge-soft warn">${esc(t('low_stock', { n: stock }))}</span>`
      : `<span class="badge-soft ok">${ic('check', 13)} ${esc(t('in_stock'))}</span>` + (S.cfg.settings.cashback_enabled === '1' && p.cashback_pct > 0 ? ` <span class="cashback">${ic('wallet', 14)} +${$m(Math.round(now * p.cashback_pct) / 100)} ${esc(t('cashback_get'))}</span>` : '');
    $('#pdpAdd').disabled = $('#pdpBuy').disabled = stock <= 0;
    pdp.qty = Math.max(1, Math.min(pdp.qty, Math.min(20, stock || 1)));
    $('#pdpQty').textContent = pdp.qty;
    $$('#pdpOpts .opt-chip').forEach((b) => b.classList.toggle('active', Number(b.dataset.vid) === pdp.vid));
  }

  /* ---------- السلة ---------- */
  function addToCart(p, vid, qty = 1, silent = false) {
    if (!p) return toast(t('error'), 'bad');
    const v = p.variants && p.variants.find((x) => x.id === Number(vid));
    const stock = v ? v.stock : p.stock;
    if (stock <= 0) return toast(t('out_of_stock'), 'bad');
    const line = S.cart.find((l) => l.pid === p.id && (l.vid || null) === (v ? v.id : null));
    if (line) line.qty = Math.min(20, stock, line.qty + qty);
    else S.cart.push({ pid: p.id, vid: v ? v.id : null, qty: Math.min(qty, stock, 20), slug: p.slug, name_ar: p.name_ar, name_en: p.name_en, label: v ? v.label : '', image: p.image || '', category_slug: p.category_slug, brand_name: p.brand_name });
    saveCart();
    if (!silent) { if (BS()) openCart(); else toast(t('added')); }
  }
  const cartItems = () => S.cart.map((l) => ({ product_id: l.pid, variant_id: l.vid, qty: l.qty }));
  const lineKey = (l) => `${l.pid}:${l.vid || 0}`;

  async function getQuote() {
    return post('/api/cart/quote', { items: cartItems(), coupon: S.coupon || undefined, use_cashback: S.useCb && !!S.user });
  }
  function qtyBox(l) { return `<div class="qty sm"><button type="button" data-act="cqty" data-key="${lineKey(l)}" data-d="-1" aria-label="-">${ic('minus', 14)}</button><span>${l.qty}</span><button type="button" data-act="cqty" data-key="${lineKey(l)}" data-d="1" aria-label="+">${ic('plus', 14)}</button></div>`; }
  function lineHtml(l, q) {
    const ql = q && q.lines.find((x) => x.product_id === l.pid && (x.variant_id || null) === (l.vid || null));
    return `<div class="line"><a href="#/p/${esc(l.slug)}"><img src="${esc(productImg(l))}" alt=""></a>
      <div class="meta"><a href="#/p/${esc(l.slug)}"><b>${esc(nm(l))}</b></a>${l.label ? `<small>${esc(l.label)}</small>` : ''}${ql ? `<small>${$m(ql.unit)}</small>` : ''}
        <button class="rm" type="button" data-act="rm" data-key="${lineKey(l)}">${ic('trash', 14)} ${esc(t('remove'))}</button></div>
      <div class="line-end">${qtyBox(l)}${ql ? `<div class="line-total">${$m(ql.total)}</div>` : ''}</div></div>`;
  }
  function shipBar(q) {
    const s = S.cfg.settings, over = Number(s.free_shipping_over);
    if (!(over > 0)) return '';
    const net = q.subtotal - q.discount, left = over - net, pct = Math.max(0, Math.min(100, (net / over) * 100));
    return `<div class="ship-bar ${left <= 0 ? 'done' : ''}"><div class="sb-text">${ic('truck', 16)} ${left > 0 ? esc(t('free_ship_hint', { n: $m(left) })) : esc(t('free_ship_done'))}</div><div class="progress" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><div class="progress-bar" style="width:${pct}%"></div></div></div>`;
  }
  function summaryHtml(q, withCoupon, btn) {
    const s = S.cfg.settings;
    return `<div class="panel sum-panel"><h3>${esc(t('order_summary'))}</h3>
      ${withCoupon ? `<form class="coupon" data-form="coupon"><input class="form-control" name="code" placeholder="${esc(t('coupon_ph'))}" value="${esc(S.coupon)}" maxlength="30"><button class="btn btn-outline-secondary">${esc(t('apply_coupon'))}</button></form>${q.coupon && q.coupon.error ? `<div class="notice">${esc(q.coupon.error)}</div>` : ''}` : ''}
      ${S.user && s.cashback_enabled === '1' && S.user.cashback_balance > 0 ? `<label class="pay-opt ${S.useCb ? 'active' : ''}"><input type="checkbox" class="form-check-input" data-change="usecb" ${S.useCb ? 'checked' : ''}><span>${esc(t('use_cashback'))}<small>${esc(t('cashback_bal'))}: ${$m(S.user.cashback_balance)}</small></span></label>` : ''}
      <div class="sum-row"><span>${esc(t('subtotal'))}</span><span>${$m(q.subtotal)}</span></div>
      ${q.discount ? `<div class="sum-row"><span>${esc(t('discount'))} ${q.coupon && q.coupon.code ? `(${esc(q.coupon.code)})` : ''}</span><span class="good">-${$m(q.discount)}</span></div>` : ''}
      ${q.cashback_used ? `<div class="sum-row"><span>${esc(t('cashback_get'))}</span><span class="good">-${$m(q.cashback_used)}</span></div>` : ''}
      <div class="sum-row"><span>${esc(t('shipping'))}</span><span>${q.shipping ? $m(q.shipping) : esc(t('free'))}</span></div>
      ${shipBar(q)}
      <div class="sum-row total"><span>${esc(t('total'))}</span><span>${$m(q.total)}</span></div>${btn || ''}</div>`;
  }

  async function renderCart() {
    setTitle(t('cart'));
    if (!S.cart.length) { app.innerHTML = `<div class="container page"><div class="empty">${ic('bag', 52)}<h2>${esc(t('cart_empty'))}</h2><p>${esc(t('cart_empty_p'))}</p><a class="btn btn-primary btn-lg" href="#/shop">${esc(t('shop_now'))}</a></div></div>`; return; }
    let q = null, err = '';
    try { q = await getQuote(); } catch (e) { err = e.message; }
    if (parseHash().path !== '/cart') return;
    app.innerHTML = `<div class="container page"><h1 class="page-title">${esc(t('cart'))} <small>(${cartCount()})</small></h1>${err ? `<div class="notice">${esc(err)}</div>` : ''}
      <div class="two-col"><div class="panel">${S.cart.map((l) => lineHtml(l, q)).join('')}</div>
      ${q ? summaryHtml(q, true, `<a class="btn btn-primary btn-lg w-100 mt-3" href="#/checkout">${esc(t('checkout'))} ${ic(IF.lang === 'ar' ? 'left' : 'right', 18)}</a><a class="btn btn-outline-secondary w-100 mt-2" href="#/shop">${esc(t('continue_shopping'))}</a>`) : ''}</div></div>`;
  }
  on(/^\/cart$/, renderCart);

  /* السلة الجانبية */
  async function renderMiniCart() {
    const body = $('#cartBody'), foot = $('#cartFoot'); if (!body) return;
    $('#cartOcTitle').innerHTML = `${ic('bag', 20)} ${esc(t('cart'))} <small>(${cartCount()})</small>`;
    if (!S.cart.length) { body.innerHTML = `<div class="empty sm">${ic('bag', 44)}<h5>${esc(t('cart_empty'))}</h5><p>${esc(t('cart_empty_p'))}</p><a class="btn btn-primary" href="#/shop">${esc(t('shop_now'))}</a></div>`; foot.innerHTML = ''; return; }
    body.innerHTML = '<div class="skel-lines"></div>';
    let q; try { q = await getQuote(); } catch (e) { body.innerHTML = `<div class="notice">${esc(e.message)}</div>`; foot.innerHTML = ''; return; }
    body.innerHTML = shipBar(q) + S.cart.map((l) => lineHtml(l, q)).join('');
    foot.innerHTML = `<div class="sum-row total"><span>${esc(t('total'))}</span><span>${$m(q.total)}</span></div>
      <a class="btn btn-primary btn-lg w-100" href="#/checkout">${esc(t('checkout'))} ${ic(IF.lang === 'ar' ? 'left' : 'right', 18)}</a>
      <a class="btn btn-outline-secondary w-100 mt-2" href="#/cart">${esc(t('view_cart'))}</a>`;
  }
  function openCart() {
    const B = BS(); if (!B) { go('/cart'); return; }
    B.Offcanvas.getOrCreateInstance($('#cartOc')).show();
    renderMiniCart();
  }
  function refreshCartViews() {
    if ($('#cartOc').classList.contains('show')) renderMiniCart();
    if (parseHash().path === '/cart') renderCart();
  }

  /* ---------- إتمام الشراء ---------- */
  let payMethod = 'cod';
  on(/^\/checkout$/, async () => {
    if (!S.cart.length) return go('/cart');
    setTitle(t('checkout'));
    let q;
    try { q = await getQuote(); } catch (e) { app.innerHTML = `<div class="container page"><div class="notice">${esc(e.message)}</div><a class="btn btn-outline-secondary" href="#/cart">${esc(t('cart'))}</a></div>`; return; }
    const u = S.user || {}, d = S.draft || {};
    const fld = (label, inner, cls = '') => `<div class="field ${cls}"><label>${esc(label)}</label>${inner}</div>`;
    app.innerHTML = `<div class="container page"><h1 class="page-title">${esc(t('checkout'))}</h1>
      <form data-form="order" class="two-col" novalidate><div>
        <div class="panel mb-3"><h3>${ic('pin', 20)} ${esc(t('customer_info'))}</h3><div class="form-grid">
          ${fld(t('name'), `<input class="form-control" name="name" required maxlength="80" autocomplete="name" value="${esc(d.name ?? u.name ?? '')}">`)}
          ${fld(t('phone'), `<input class="form-control" name="phone" required inputmode="tel" dir="ltr" maxlength="20" autocomplete="tel" value="${esc(d.phone ?? u.phone ?? '')}" placeholder="01XXXXXXXXX">`)}
          ${fld(t('email'), `<input class="form-control" name="email" type="email" maxlength="254" autocomplete="email" dir="ltr" value="${esc(d.email ?? u.email ?? '')}">`)}
          ${fld(t('city'), `<select class="form-select" name="city" required><option value="">${esc(t('choose'))}</option>${GOVS.map(([ar, en]) => `<option value="${esc(ar)}" ${d.city === ar ? 'selected' : ''}>${esc(IF.lang === 'ar' ? ar : en)}</option>`).join('')}</select>`)}
          ${fld(t('address'), `<input class="form-control" name="address" required maxlength="300" autocomplete="street-address" value="${esc(d.address ?? '')}">`, 'full')}
          ${fld(t('notes'), `<input class="form-control" name="notes" maxlength="300" value="${esc(d.notes ?? '')}">`, 'full')}</div></div>
        <div class="panel"><h3>${ic('card', 20)} ${esc(t('payment'))}</h3>
          <label class="pay-opt ${payMethod === 'cod' ? 'active' : ''}"><input class="form-check-input" type="radio" name="pay" value="cod" ${payMethod === 'cod' ? 'checked' : ''}><span class="po-ic">${ic('cash', 22)}</span><span><b>${esc(t('cod'))}</b><small>${esc(t('cod_p'))}</small></span></label>
          <label class="pay-opt ${payMethod === 'online' ? 'active' : ''}"><input class="form-check-input" type="radio" name="pay" value="online" ${payMethod === 'online' ? 'checked' : ''}><span class="po-ic">${ic('card', 22)}</span><span><b>${esc(t('online'))}</b><small>${esc(t('online_p'))}</small></span></label></div>
        <div id="formErr"></div></div>
        <div>${summaryHtml(q, false, `<button class="btn btn-primary btn-lg w-100 mt-3" id="placeBtn">${ic('lock', 18)} ${esc(t('place_order'))}</button>`)}</div></form></div>`;
  });

  /* ---------- صفحة الطلب والتتبع ---------- */
  const STEPS = ['pending', 'confirmed', 'shipped', 'delivered'];
  const STEP_ICON = { pending: 'clock', confirmed: 'check', shipped: 'truck', delivered: 'package' };
  function orderView(o) {
    const idx = STEPS.indexOf(o.status), cancelled = o.status === 'cancelled';
    const mine = S.user && o.user_id === S.user.id;
    return `<div class="panel order-card">
      <div class="oc-head"><div><small>${esc(t('order_code'))}</small><div class="oc-code" dir="ltr">${esc(o.code)}</div><small>${esc(date(o.created_at))}</small></div>
        <div class="oc-badges">${badge(statusMeta, o.status)} ${badge(payMeta, o.payment_status)}</div></div>
      ${cancelled ? '' : `<div class="steps">${STEPS.map((s, i) => `<div class="step ${i <= idx ? 'done' : ''} ${i === idx ? 'now' : ''}"><i>${ic(i < idx ? 'check' : STEP_ICON[s], 16)}</i><span>${esc(t('st_' + s))}</span></div>`).join('')}</div>`}
      <h4>${esc(t('items'))}</h4>
      ${o.items.map((i) => `<div class="sum-row it"><span>${esc(i.name)}${i.variant_label ? ` — ${esc(i.variant_label)}` : ''} × ${i.qty}</span><span>${$m(i.price * i.qty)}</span></div>`).join('')}
      <div class="sum-row"><span>${esc(t('subtotal'))}</span><span>${$m(o.subtotal)}</span></div>
      ${o.discount ? `<div class="sum-row"><span>${esc(t('discount'))}</span><span class="good">-${$m(o.discount)}</span></div>` : ''}
      ${o.cashback_used ? `<div class="sum-row"><span>${esc(t('cashback_get'))}</span><span class="good">-${$m(o.cashback_used)}</span></div>` : ''}
      <div class="sum-row"><span>${esc(t('shipping'))}</span><span>${o.shipping ? $m(o.shipping) : esc(t('free'))}</span></div>
      <div class="sum-row total"><span>${esc(t('total'))}</span><span>${$m(o.total)}</span></div>
      <p class="oc-addr">${ic('pin', 16)} ${esc(o.city)} — ${esc(o.address)}</p>
      <div class="oc-actions">
        ${o.payment_method === 'online' && o.payment_status !== 'paid' && !cancelled ? `<button class="btn btn-primary" type="button" data-act="paynow" data-code="${esc(o.code)}">${ic('card', 18)} ${esc(t('pay_now'))}</button>` : ''}
        ${mine && o.status === 'pending' ? `<button class="btn btn-outline-danger" type="button" data-act="cancelorder" data-code="${esc(o.code)}">${esc(t('cancel_order'))}</button>` : ''}
      </div></div>`;
  }
  on(/^\/order\/([^/]+)$/, async (m, q, alive) => {
    const code = decodeURIComponent(m[1]).toUpperCase();
    setTitle(code);
    let last = null; try { last = JSON.parse(sessionStorage.getItem('if_last') || 'null'); } catch {}
    const phone = last && last.code === code ? last.phone : '';
    let o;
    try { o = await get('/api/orders/track' + qs({ code, phone })); }
    catch { if (!alive()) return; return trackForm(code); }
    if (!alive()) return;
    const banner = q.paid === '1' ? `<div class="notice ok">${esc(t('pay_ok'))}</div>` : q.paid === '0' ? `<div class="notice">${esc(t('pay_failed'))}</div>` : '';
    app.innerHTML = `<div class="container page narrow">${q.new === '1' ? `<div class="empty done">${ic('party', 52)}<h2>${esc(t('order_done'))}</h2><p>${esc(t('save_code'))}</p></div>` : `<h1 class="page-title">${esc(t('track_title'))}</h1>`}${banner}${orderView(o)}<a class="btn btn-primary" href="#/shop">${esc(t('continue_shopping'))}</a></div>`;
  });
  function trackForm(code = '') {
    setTitle(t('track_title'));
    app.innerHTML = `<div class="container page"><div class="auth panel"><h1>${ic('package', 26)} ${esc(t('track_title'))}</h1><p class="text-secondary">${esc(t('track_p'))}</p>
      <form data-form="track" class="stack"><input class="form-control" name="code" required placeholder="IF-XXXXXX" dir="ltr" value="${esc(code)}" maxlength="20"><input class="form-control" name="phone" required placeholder="01XXXXXXXXX" dir="ltr" inputmode="tel" maxlength="20"><div id="formErr"></div><button class="btn btn-primary btn-lg">${esc(t('track_btn'))}</button></form></div></div>`;
  }
  on(/^\/track$/, async () => trackForm());

  /* ---------- الحساب ---------- */
  function authPage(kind) {
    return async (m, q) => {
      if (S.user) return go('/account');
      const reg = kind === 'register';
      setTitle(reg ? t('register_title') : t('login_title'));
      app.innerHTML = `<div class="container page"><div class="auth panel"><div class="auth-ico">${ic('user', 26)}</div><h1>${esc(reg ? t('register_title') : t('login_title'))}</h1>
        <form data-form="${kind}" data-next="${esc(q.next || '')}" class="stack" novalidate>
          ${reg ? `<div class="field"><label>${esc(t('name'))}</label><input class="form-control" name="name" required maxlength="80" autocomplete="name"></div><div class="field"><label>${esc(t('phone'))}</label><input class="form-control" name="phone" dir="ltr" inputmode="tel" maxlength="20" autocomplete="tel"></div>` : ''}
          <div class="field"><label>${esc(t('email_l'))}</label><input class="form-control" name="email" type="email" required maxlength="254" autocomplete="email" dir="ltr"></div>
          <div class="field"><label>${esc(t('password'))}${reg ? ` <small>(${esc(t('password_hint'))})</small>` : ''}</label><input class="form-control" name="password" type="password" required minlength="8" maxlength="128" autocomplete="${reg ? 'new-password' : 'current-password'}"></div>
          <div id="formErr"></div><button class="btn btn-primary btn-lg">${esc(reg ? t('register') : t('login'))}</button></form>
        <p class="auth-alt">${esc(reg ? t('have_account') : t('no_account'))} <a class="link-accent" href="#/${reg ? 'login' : 'register'}${q.next ? '?next=' + encodeURIComponent(q.next) : ''}">${esc(reg ? t('login') : t('register'))}</a></p></div></div>`;
    };
  }
  on(/^\/login$/, authPage('login'));
  on(/^\/register$/, authPage('register'));

  on(/^\/account(?:\/(\w+))?$/, async (m, q, alive) => {
    if (!S.user) return go('/login', { next: '/account' });
    const tab = m[1] || 'profile';
    setTitle(t('account'));
    let content = '';
    if (tab === 'orders') {
      const r = await get('/api/orders'); if (!alive()) return;
      content = r.items.length ? r.items.map((o) => orderView(o)).join('') : `<div class="empty">${ic('package', 44)}<p>${esc(t('no_orders'))}</p></div>`;
    } else if (tab === 'wishlist') {
      const r = await get('/api/wishlist'); if (!alive()) return; remember(r.items);
      S.wish = new Set(r.items.map((p) => p.id)); paintCounts();
      content = r.items.length ? grid(r.items) : `<div class="empty">${ic('heart', 44)}<p>${esc(t('wishlist_empty'))}</p></div>`;
    } else if (tab === 'password') {
      content = `<div class="panel narrow-panel"><h3>${esc(t('change_password'))}</h3><form data-form="password" class="stack"><input class="form-control" type="password" name="current" placeholder="${esc(t('current_password'))}" required autocomplete="current-password"><input class="form-control" type="password" name="password" placeholder="${esc(t('new_password'))}" minlength="8" required autocomplete="new-password"><div id="formErr"></div><button class="btn btn-primary">${esc(t('save'))}</button></form></div>`;
    } else {
      const me = await get('/api/me'); if (!alive()) return; S.user = me.user;
      content = `${S.cfg.settings.cashback_enabled === '1' ? `<div class="cashback-box">${ic('wallet', 30)}<div><small>${esc(t('cashback_title'))}</small><b>${$m(S.user.cashback_balance)}</b><small>${esc(t('cashback_note'))}</small></div></div>` : ''}
        <div class="panel narrow-panel"><h3>${esc(t('profile'))}</h3><form data-form="profile" class="stack"><div class="field"><label>${esc(t('name'))}</label><input class="form-control" name="name" required maxlength="80" value="${esc(S.user.name)}"></div><div class="field"><label>${esc(t('phone'))}</label><input class="form-control" name="phone" dir="ltr" maxlength="20" value="${esc(S.user.phone || '')}"></div><div class="field"><label>${esc(t('email_l'))}</label><input class="form-control" value="${esc(S.user.email)}" disabled dir="ltr"></div><div id="formErr"></div><button class="btn btn-primary">${esc(t('save'))}</button></form></div>`;
    }
    const nav = [['profile', t('profile'), 'user'], ['orders', t('my_orders'), 'package'], ['wishlist', t('wishlist'), 'heart'], ['password', t('change_password'), 'lock']];
    app.innerHTML = `<div class="container page"><div class="account"><nav class="side-nav">
      ${nav.map(([k, l, i]) => `<a href="#/account${k === 'profile' ? '' : '/' + k}" class="${tab === k ? 'active' : ''}">${ic(i, 18)} ${esc(l)}</a>`).join('')}
      ${S.user.role === 'admin' ? `<a href="/admin/">${ic('gear', 18)} ${esc(t('dashboard'))}</a>` : ''}<button type="button" data-act="logout" class="danger">${ic('logout', 18)} ${esc(t('logout'))}</button></nav><div class="acc-main">${content}</div></div></div>`;
  });

  /* ---------- الأحداث (Delegation) ---------- */
  const errBox = (form, msg) => { const b = $('#formErr', form) || form; if (b.id === 'formErr') b.innerHTML = msg ? `<div class="notice">${esc(msg)}</div>` : ''; else toast(msg, 'bad'); };

  async function toggleWish(id) {
    if (!S.user) { toast(t('login_first'), 'bad'); return go('/login', { next: location.hash.slice(1) }); }
    try {
      if (S.wish.has(id)) { await del('/api/wishlist/' + id); S.wish.delete(id); } else { await post('/api/wishlist/' + id); S.wish.add(id); }
      $$(`[data-act="wish"][data-id="${id}"]`).forEach((b) => b.classList.toggle('on', S.wish.has(id)));
      paintCounts();
    } catch (e) { toast(e.message, 'bad'); }
  }

  function changeQuery(patch) {
    const { path, q } = parseHash();
    const next = { ...q, ...patch, page: patch.page || '' };
    for (const k of Object.keys(next)) if (next[k] === '' || next[k] == null) delete next[k];
    go(path, next);
  }

  document.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const act = el.dataset.act;
    if (el.tagName === 'A') return;
    if (act !== 'opt') e.preventDefault();
    try {
      switch (act) {
        case 'lang': IF.lang = IF.lang === 'ar' ? 'en' : 'ar'; localStorage.setItem('if_lang', IF.lang); { const oc = $('#menuOc'); const i = BS() && oc && BS().Offcanvas.getInstance(oc); if (i) i.hide(); } renderChrome(); route(); break;
        case 'opencart': openCart(); break;
        case 'wish': toggleWish(Number(el.dataset.id)); break;
        case 'quickadd': {
          let p = known.get(Number(el.dataset.id));
          if (p && el.dataset.vid && !p.variants) p = null;
          addToCart(p, el.dataset.vid ? Number(el.dataset.vid) : null, 1); break;
        }
        case 'gimg': { const m = document.getElementById('gmain'); if (m) m.src = el.dataset.src; document.querySelectorAll('.gth').forEach((b) => b.classList.toggle('on', b === el)); break; }
        case 'opt': pdp.vid = Number(el.dataset.vid); paintPdp(); break;
        case 'pqty': pdp.qty = Math.max(1, Math.min(20, pdp.qty + Number(el.dataset.d))); { const v = curVariant(); const st = v ? v.stock : pdp.p.stock; pdp.qty = Math.min(pdp.qty, Math.max(1, st)); } $('#pdpQty').textContent = pdp.qty; break;
        case 'padd': addToCart(pdp.p, pdp.vid, pdp.qty); break;
        case 'pbuy': addToCart(pdp.p, pdp.vid, pdp.qty, true); go('/checkout'); break;
        case 'tab': $$('.tabs button').forEach((b) => b.classList.toggle('active', b === el)); $('#tab-desc').hidden = el.dataset.tab !== 'desc'; $('#tab-rev').hidden = el.dataset.tab !== 'rev'; break;
        case 'rm': S.cart = S.cart.filter((l) => lineKey(l) !== el.dataset.key); saveCart(); refreshCartViews(); break;
        case 'cqty': { const l = S.cart.find((x) => lineKey(x) === el.dataset.key); if (l) { l.qty = Math.max(1, Math.min(20, l.qty + Number(el.dataset.d))); saveCart(); refreshCartViews(); } break; }
        case 'filter': changeQuery({ [el.dataset.key]: el.dataset.val }); break;
        case 'unfilter': changeQuery(el.dataset.key === 'price' ? { min: '', max: '' } : { [el.dataset.key]: '' }); break;
        case 'clearfilters': go('/shop'); break;
        case 'page': changeQuery({ page: el.dataset.page }); break;
        case 'logout': await post('/api/auth/logout'); S.user = null; S.wish = new Set(); S.useCb = false; renderChrome(); go('/'); break;
        case 'paynow': {
          let last = null; try { last = JSON.parse(sessionStorage.getItem('if_last') || 'null'); } catch {}
          const r = await post(`/api/orders/${encodeURIComponent(el.dataset.code)}/pay`, { phone: last && last.code === el.dataset.code ? last.phone : '' });
          location.href = r.url; break;
        }
        case 'cancelorder':
          if (confirm(t('confirm_cancel'))) { await post(`/api/orders/${encodeURIComponent(el.dataset.code)}/cancel`); route(); }
          break;
      }
    } catch (err) { toast(err.message || t('error'), 'bad'); }
  });

  document.addEventListener('click', (e) => {
    const a = e.target.closest('.offcanvas a[href^="#/"]'); if (!a || !BS()) return;
    const oc = a.closest('.offcanvas'); const i = BS().Offcanvas.getInstance(oc); if (i) i.hide();
  });

  document.addEventListener('change', (e) => {
    if (e.target.name === 'pay') { payMethod = e.target.value; $$('.pay-opt').forEach((l) => l.classList.toggle('active', !!$('input[name=pay]:checked', l))); return; }
    const el = e.target.closest('[data-change]'); if (!el) return;
    const k = el.dataset.change;
    if (k === 'sort') changeQuery({ sort: el.value === 'featured' ? '' : el.value });
    else if (k === 'instock') changeQuery({ instock: el.checked ? '1' : '' });
    else if (k === 'deals') changeQuery({ deals: el.checked ? '1' : '' });
    else if (k === 'usecb') {
      S.useCb = el.checked;
      const of = $('form[data-form="order"]'); if (of) S.draft = Object.fromEntries(new FormData(of));
      route();
    }
  });

  document.addEventListener('submit', async (e) => {
    const form = e.target.closest('[data-form]'); if (!form) return;
    e.preventDefault();
    const kind = form.dataset.form, f = Object.fromEntries(new FormData(form));
    const btn = form.querySelector('button:not([type=button])');
    if (btn) btn.disabled = true;
    try {
      if (kind === 'price') changeQuery({ min: f.min, max: f.max });
      else if (kind === 'coupon') { S.coupon = String(f.code || '').trim().toUpperCase(); route(); }
      else if (kind === 'review') {
        const r = await post(`/api/products/${pdp.p.id}/reviews`, { rating: Number(f.rating), comment: f.comment });
        toast(r.message); form.reset();
      } else if (kind === 'login' || kind === 'register') {
        const r = await post('/api/auth/' + kind, kind === 'login' ? { email: f.email, password: f.password } : f);
        S.user = r.user;
        try { const w = await get('/api/wishlist'); S.wish = new Set(w.items.map((p) => p.id)); } catch {}
        renderChrome();
        go(form.dataset.next || '/account');
      } else if (kind === 'profile') { const r = await put('/api/me', f); S.user = r.user; toast(t('saved')); }
      else if (kind === 'password') { await put('/api/me/password', f); toast(t('pw_changed')); form.reset(); }
      else if (kind === 'track') {
        const code = String(f.code).trim().toUpperCase();
        try { sessionStorage.setItem('if_last', JSON.stringify({ code, phone: String(f.phone).replace(/[\s\-()]/g, '') })); } catch {}
        go('/order/' + encodeURIComponent(code));
      } else if (kind === 'order') {
        errBox(form, '');
        const customer = { name: f.name, phone: f.phone, email: f.email, city: f.city, address: f.address, notes: f.notes };
        if (!customer.city) throw new Error(t('gov_required'));
        const o = await post('/api/orders', { items: cartItems(), customer, payment_method: f.pay || 'cod', coupon: S.coupon || undefined, use_cashback: S.useCb && !!S.user });
        try { sessionStorage.setItem('if_last', JSON.stringify({ code: o.code, phone: String(f.phone).replace(/[\s\-()]/g, '') })); } catch {}
        S.cart = []; S.coupon = ''; S.useCb = false; S.draft = null; saveCart();
        if (S.user) { try { S.user = (await get('/api/me')).user; } catch {} }
        if (o.payment && o.payment.url) { location.href = o.payment.url; return; }
        go('/order/' + encodeURIComponent(o.code), { new: 1 });
      }
    } catch (err) { errBox(form, err.message || t('error')); if (kind === 'order') toast(err.message, 'bad'); }
    finally { if (btn) btn.disabled = false; }
  });

  /* زر الرجوع للأعلى + ظل الهيدر */
  window.addEventListener('scroll', () => {
    const y = window.scrollY, b = $('#toTop'), h = $('#header');
    if (b) b.hidden = y < 600;
    if (h) h.classList.toggle('scrolled', y > 8);
  }, { passive: true });
  $('#toTop').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  /* ---------- تشغيل ---------- */
  async function init() {
    try {
      const [cfg, me] = await Promise.all([get('/api/config'), get('/api/me')]);
      S.cfg = cfg; S.user = me.user;
      if (S.user) { try { S.wish = new Set((await get('/api/wishlist')).items.map((p) => p.id)); } catch {} }
    } catch (e) { app.innerHTML = `<div class="container page"><div class="notice">${esc(e.message)}</div></div>`; return; }
    renderChrome();
    window.addEventListener('hashchange', route);
    route();
  }
  init();
})();
