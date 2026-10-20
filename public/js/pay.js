(function () {
  'use strict';
  const code = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || '');
  const token = new URLSearchParams(location.search).get('t') || '';
  document.getElementById('code').textContent = code;
  async function finish(success) {
    const btns = document.querySelectorAll('button'); btns.forEach((b) => (b.disabled = true));
    try {
      const res = await fetch('/api/payments/sandbox/' + encodeURIComponent(code), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ token, success }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error');
      location.href = '/#/order/' + encodeURIComponent(code) + '?paid=' + (success ? '1' : '0');
    } catch (e) { alert(e.message); btns.forEach((b) => (b.disabled = false)); }
  }
  document.getElementById('f').addEventListener('submit', (e) => { e.preventDefault(); finish(true); });
  document.getElementById('fail').addEventListener('click', () => finish(false));
})();
