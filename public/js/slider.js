/* سلايدر خفيف بدون مكتبات (scroll-snap) — بيحاكي الجزء المستخدم من Swiper:
   new Swiper(el, { slidesPerView, spaceBetween, breakpoints, navigation:{nextEl,prevEl}, autoplay:{delay}, pagination:{el}, rewind }) */
(function () {
  'use strict';
  function Swiper(root, opt) {
    opt = opt || {};
    const wrap = root.querySelector('.swiper-wrapper');
    if (!wrap) return;
    const slides = Array.from(wrap.children);
    root.classList.add('sw-ready');
    let timer = null, per = 1, gap = 0;

    function layout() {
      per = opt.slidesPerView || 1; gap = opt.spaceBetween || 0;
      const bp = opt.breakpoints || {};
      Object.keys(bp).map(Number).sort((a, b) => a - b).forEach((w) => {
        if (window.innerWidth >= w) { per = bp[w].slidesPerView || per; gap = bp[w].spaceBetween != null ? bp[w].spaceBetween : gap; }
      });
      wrap.style.setProperty('--per', per); wrap.style.setProperty('--gap', gap + 'px');
      updateUi();
    }

    const dir = () => (getComputedStyle(root).direction === 'rtl' ? -1 : 1);
    function index() {
      const w = slides[0] ? slides[0].getBoundingClientRect().width + gap : 1;
      return Math.max(0, Math.min(slides.length - 1, Math.round(Math.abs(wrap.scrollLeft) / w)));
    }
    function to(i) {
      const last = Math.max(0, slides.length - per);
      i = Math.max(0, Math.min(last, i));
      const w = slides[0].getBoundingClientRect().width + gap;
      wrap.scrollTo({ left: i * w * dir(), behavior: 'smooth' });
    }
    function atEnd() { return index() >= slides.length - per; }

    const prev = opt.navigation && opt.navigation.prevEl, next = opt.navigation && opt.navigation.nextEl;
    if (prev) prev.addEventListener('click', () => to(index() - Math.max(1, per - 1)));
    if (next) next.addEventListener('click', () => to(index() + Math.max(1, per - 1)));

    let dots = null;
    if (opt.pagination && opt.pagination.el) {
      const pe = typeof opt.pagination.el === 'string' ? root.querySelector(opt.pagination.el) : opt.pagination.el;
      if (pe) {
        pe.innerHTML = slides.map((_, i) => `<button type="button" aria-label="${i + 1}"></button>`).join('');
        dots = Array.from(pe.children);
        dots.forEach((d, i) => d.addEventListener('click', () => { to(i); restart(); }));
      }
    }
    function updateUi() {
      const i = index();
      if (dots) dots.forEach((d, k) => d.classList.toggle('on', k === i));
      if (prev) prev.disabled = i <= 0;
      if (next) next.disabled = atEnd();
    }
    let raf = 0;
    wrap.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(updateUi); }, { passive: true });

    function restart() {
      clearInterval(timer);
      if (!opt.autoplay || document.hidden) return;
      timer = setInterval(() => {
        if (!root.isConnected) return clearInterval(timer);
        if (root.matches(':hover') || root.contains(document.activeElement)) return;
        const i = index(); to(i >= slides.length - 1 ? 0 : i + 1);
      }, (opt.autoplay && opt.autoplay.delay) || 6000);
    }
    window.addEventListener('resize', layout);
    layout(); restart();
    this.destroy = () => { clearInterval(timer); window.removeEventListener('resize', layout); };
  }
  window.Swiper = Swiper;
})();
