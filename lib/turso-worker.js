'use strict';
// Worker: بينفّذ طلبات Turso (HTTP / Hrana) ويرجّع النتيجة للـ main thread اللي واقف منتظر (Atomics.wait)
const { workerData, parentPort } = require('node:worker_threads');
const { url: rawUrl, token, port, sab } = workerData;
const flag = new Int32Array(sab);
const ORIGIN = rawUrl.replace(/^libsql:\/\//, 'https://').replace(/\/+$/, '');

let baton = null, base = ORIGIN, inTx = false;

const enc = (v) => {
  if (v === null || v === undefined) return { type: 'null' };
  if (typeof v === 'bigint') return { type: 'integer', value: String(v) };
  if (typeof v === 'boolean') return { type: 'integer', value: v ? '1' : '0' };
  if (typeof v === 'number') return Number.isInteger(v) ? { type: 'integer', value: String(v) } : { type: 'float', value: v };
  if (v instanceof Uint8Array) return { type: 'blob', base64: Buffer.from(v).toString('base64') };
  return { type: 'text', value: String(v) };
};
const dec = (c) => {
  switch (c.type) {
    case 'null': return null;
    case 'integer': return Number(c.value);
    case 'float': return Number(c.value);
    case 'blob': return new Uint8Array(Buffer.from(c.base64 || '', 'base64'));
    default: return c.value;
  }
};

async function pipeline(requests, close) {
  const body = { requests: [...requests] };
  if (baton) body.baton = baton;
  if (close) body.requests.push({ type: 'close' });
  const res = await fetch(`${base}/v2/pipeline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25_000),
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = null; }
  if (!res.ok || !json) throw new Error((json && json.error && (json.error.message || json.error)) || `Turso HTTP ${res.status}: ${text.slice(0, 200)}`);
  baton = json.baton || null;
  base = baton && json.base_url ? json.base_url.replace(/\/+$/, '') : ORIGIN;
  const out = json.results[0];
  if (out.type === 'error') throw new Error((out.error && out.error.message) || 'Turso error');
  return out.response;
}

async function run(m) {
  const sql = m.sql;
  const isBegin = /^\s*BEGIN\b/i.test(sql), isEnd = /^\s*(COMMIT|ROLLBACK|END)\b/i.test(sql);
  try {
    if (m.kind === 'seq') { await pipeline([{ type: 'sequence', sql }], !inTx); return { rows: [], changes: 0, lastInsertRowid: 0 }; }
    const stmt = { sql, args: (m.args || []).map(enc) };
    const r = await pipeline([{ type: 'execute', stmt }], !(inTx || isBegin));
    if (isBegin) inTx = true;
    const res = r.result;
    const names = res.cols.map((c) => c.name);
    return {
      rows: res.rows.map((row) => { const o = {}; row.forEach((c, i) => { o[names[i]] = dec(c); }); return o; }),
      changes: res.affected_row_count || 0,
      lastInsertRowid: res.last_insert_rowid == null ? 0 : Number(res.last_insert_rowid),
    };
  } finally {
    if (isEnd) { inTx = false; baton = null; base = ORIGIN; }
  }
}

parentPort.on('message', async (m) => {
  let reply;
  try { reply = { id: m.id, ok: true, result: await run(m) }; }
  catch (e) { reply = { id: m.id, ok: false, error: String(e && e.message || e) }; }
  port.postMessage(reply);
  Atomics.store(flag, 0, 1);
  Atomics.notify(flag, 0);
});
