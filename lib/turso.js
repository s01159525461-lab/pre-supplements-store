'use strict';
// اتصال "متزامن" بـ Turso (SQLite على السحابة) من غير أي مكتبات.
// بيشغّل Worker بيكلّم Turso بـ fetch، والـ main thread بيستنى النتيجة بـ Atomics.wait
// عشان باقي الكود (q.get / q.all / q.run / tx) يفضل زي ما هو بالظبط.
const path = require('node:path');
const { Worker, MessageChannel, receiveMessageOnPort } = require('node:worker_threads');

function connect(url, token) {
  const { port1, port2 } = new MessageChannel();
  const sab = new SharedArrayBuffer(4);
  const flag = new Int32Array(sab);
  const worker = new Worker(path.join(__dirname, 'turso-worker.js'), { workerData: { url, token, port: port2, sab }, transferList: [port2] });
  worker.unref();
  port1.unref();
  let seq = 0;

  function call(kind, sql, args) {
    const id = ++seq;
    Atomics.store(flag, 0, 0);
    worker.postMessage({ id, kind, sql, args });
    const w = Atomics.wait(flag, 0, 0, 30_000);
    if (w === 'timed-out') throw new Error('Turso timeout');
    const got = receiveMessageOnPort(port1);
    if (!got) throw new Error('Turso: no reply');
    const m = got.message;
    if (!m.ok) throw new Error(m.error);
    const r = m.result;
    for (const row of r.rows) for (const k in row) if (row[k] instanceof Uint8Array && !Buffer.isBuffer(row[k])) row[k] = Buffer.from(row[k]);
    return r;
  }

  return {
    exec(sql) {
      const s = String(sql).trim();
      if (/^PRAGMA\b/i.test(s)) return;                       // مش بتتحفظ بين الطلبات على HTTP
      if (/^BEGIN\b/i.test(s)) return void call('exec', 'BEGIN', []);
      if (/^(COMMIT|ROLLBACK|END)\b/i.test(s)) return void call('exec', s, []);
      call('seq', s, []);
    },
    prepare(sql) {
      return {
        all: (...p) => call('exec', sql, p).rows,
        get: (...p) => call('exec', sql, p).rows[0],
        run: (...p) => { const r = call('exec', sql, p); return { changes: r.changes, lastInsertRowid: r.lastInsertRowid }; },
      };
    },
  };
}
module.exports = { connect };
