'use strict';
/**
 * أتمتة رسائل واتساب للعملاء (تأكيد الطلب، الشحن، التسليم، الإلغاء).
 *
 * الفكرة: كل رسالة بتتسجّل في جدول wa_outbox، وشغّال في الخلفية "عامل" بيبعتها:
 *   1) لو WHATSAPP_TOKEN و WHATSAPP_PHONE_ID متظبطين في .env  => بيبعت تلقائيًا عبر WhatsApp Cloud API (Meta).
 *   2) لو مش متظبطين => الرسالة بتفضل "يدوي": في لوحة الأدمن (واتساب) زرار يفتح واتساب برسالة جاهزة.
 * الإرسال عمره ما بيعطّل إنشاء الطلب: أي فشل بيتسجّل وبيتعاد المحاولة.
 */
const { db, q, getSettings, ensureSettings } = require('./db');

db.exec(`CREATE TABLE IF NOT EXISTS wa_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER,
  event TEXT NOT NULL,
  to_phone TEXT NOT NULL,
  body TEXT NOT NULL,
  template TEXT DEFAULT '',
  params TEXT DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending',   -- pending | sent | failed | manual
  attempts INTEGER NOT NULL DEFAULT 0,
  error TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_wa_status ON wa_outbox(status, id);
`);

const EVENTS = ['created', 'confirmed', 'shipped', 'delivered', 'cancelled'];
const EVENT_LABEL = { created: 'تم استلام الطلب', confirmed: 'تأكيد الطلب', shipped: 'تم الشحن', delivered: 'تم التسليم', cancelled: 'إلغاء الطلب' };
const DEFAULT_TEXT = {
  created: 'أهلاً {name} 👋\nتم استلام طلبك رقم {code} من {store} ✅\nالإجمالي: {total}\nتقدر تتابع الطلب من هنا: {track_url}\nشكرًا لثقتك!',
  confirmed: 'أهلاً {name}،\nطلبك رقم {code} اتأكد وجاري تجهيزه 📦',
  shipped: 'أهلاً {name}،\nطلبك رقم {code} خرج للشحن 🚚 وهيوصلك قريب.',
  delivered: 'أهلاً {name}،\nطلبك رقم {code} اتسلّم ✅ نتمنى تكون مبسوط، وبنشكرك على اختيارك {store}!',
  cancelled: 'أهلاً {name}،\nطلبك رقم {code} اتلغى. لو محتاج مساعدة كلّمنا على {phone}.',
};
const DEFAULTS = { wa_enabled: '1' };
for (const ev of EVENTS) { DEFAULTS['wa_on_' + ev] = '1'; DEFAULTS['wa_text_' + ev] = DEFAULT_TEXT[ev]; DEFAULTS['wa_tpl_' + ev] = ''; }
ensureSettings(DEFAULTS);
const WA_KEYS = Object.keys(DEFAULTS);

const API_BASE = () => (process.env.WHATSAPP_API_BASE || 'https://graph.facebook.com/v21.0').replace(/\/$/, '');
const apiReady = () => !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);
const mode = () => (apiReady() ? 'api' : 'manual');

/** 01012345678 / +201012345678 / 201012345678  =>  201012345678 (صيغة واتساب بدون +) */
function normalizePhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (/^01\d{9}$/.test(d)) d = '20' + d.slice(1);
  else if (/^1\d{9}$/.test(d)) d = '20' + d;
  return /^\d{9,15}$/.test(d) ? d : '';
}

const egp = (n) => `${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} ج.م`;
function render(text, vars) { return String(text || '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m)); }
function baseUrl() { return (process.env.PUBLIC_URL || '').replace(/\/$/, ''); }

/** بيسجّل رسالة للطلب حسب الحدث. بيرجّع id أو null لو الحدث متقفّل/الرقم غلط. آمن: عمره ما بيرمي. */
function queue(order, event) {
  try {
    const s = getSettings();
    if (s.wa_enabled !== '1' || s['wa_on_' + event] !== '1') return null;
    const to = normalizePhone(order.phone);
    if (!to) return null;
    const vars = {
      name: order.name, code: order.code, total: egp(order.total), store: s.store_name || 'Pre Supplements', phone: s.contact_phone || '',
      track_url: `${baseUrl()}/#/order/${order.code}`, status: EVENT_LABEL[event] || event,
    };
    const body = render(s['wa_text_' + event] || DEFAULT_TEXT[event], vars);
    const tpl = (s['wa_tpl_' + event] || '').trim();
    const params = JSON.stringify([vars.name, vars.code, vars.total, vars.store]);
    const dup = q.get(`SELECT id FROM wa_outbox WHERE order_id=? AND event=? AND status IN ('pending','sent','manual')`, order.id, event);
    if (dup) return dup.id;
    const r = q.run('INSERT INTO wa_outbox(order_id,event,to_phone,body,template,params,status) VALUES (?,?,?,?,?,?,?)',
      order.id, event, to, body, tpl, params, mode() === 'api' ? 'pending' : 'manual');
    if (mode() === 'api') setImmediate(() => work().catch(() => {}));
    return Number(r.lastInsertRowid);
  } catch (e) { console.error('[whatsapp] queue failed:', e.message); return null; }
}

async function sendOne(row) {
  const payload = { messaging_product: 'whatsapp', to: row.to_phone };
  if (row.template) {
    payload.type = 'template';
    payload.template = { name: row.template, language: { code: process.env.WHATSAPP_TEMPLATE_LANG || 'ar' }, components: [{ type: 'body', parameters: JSON.parse(row.params || '[]').map((t) => ({ type: 'text', text: String(t) })) }] };
  } else {
    payload.type = 'text';
    payload.text = { body: row.body, preview_url: true };
  }
  const res = await fetch(`${API_BASE()}/${encodeURIComponent(process.env.WHATSAPP_PHONE_ID)}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data.error && (data.error.message || data.error.error_user_msg)) || `HTTP ${res.status}`);
}

let running = false, again = false, cur = Promise.resolve();
function work() {
  if (!apiReady()) return Promise.resolve();
  if (running) { again = true; return cur; }   // رسالة جديدة وصلت أثناء الإرسال: نعيد الدورة بعد ما نخلص
  running = true;
  cur = (async () => {
    try {
      do {
        again = false;
        await drain();
      } while (again);
    } finally { running = false; }
  })();
  return cur;
}
/** بيستنى لحد ما أي إرسال شغال يخلص (مهم على Vercel قبل ما الدالة تقفل) */
async function idle() { await new Promise((r) => setImmediate(r)); await cur.catch(() => {}); }
async function drain() {
  {
    const rows = q.all(`SELECT * FROM wa_outbox WHERE status='pending' AND attempts<3 ORDER BY id LIMIT 10`);
    for (const row of rows) {
      try {
        await sendOne(row);
        q.run(`UPDATE wa_outbox SET status='sent', attempts=attempts+1, error='', sent_at=datetime('now') WHERE id=?`, row.id);
      } catch (e) {
        const att = row.attempts + 1;
        q.run(`UPDATE wa_outbox SET attempts=?, error=?, status=? WHERE id=?`, att, String(e.message).slice(0, 300), att >= 3 ? 'failed' : 'pending', row.id);
      }
    }
  }
}

/** إعادة محاولة رسالة فشلت (من لوحة الأدمن) */
function retry(id) {
  const row = q.get('SELECT * FROM wa_outbox WHERE id=?', id);
  if (!row) return false;
  q.run(`UPDATE wa_outbox SET status=?, attempts=0, error='' WHERE id=?`, apiReady() ? 'pending' : 'manual', id);
  if (apiReady()) setImmediate(() => work().catch(() => {}));
  return true;
}
function markSent(id) { return q.run(`UPDATE wa_outbox SET status='sent', sent_at=datetime('now') WHERE id=?`, id).changes > 0; }

function start() {
  if (start.t) return;
  start.t = setInterval(() => work().catch(() => {}), 15_000);
  start.t.unref();
}

module.exports = { queue, work, idle, retry, markSent, start, normalizePhone, mode, apiReady, WA_KEYS, EVENTS, EVENT_LABEL, DEFAULT_TEXT };
