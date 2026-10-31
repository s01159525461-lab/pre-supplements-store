'use strict';
// سيرفر Turso "وهمي" على جهازك (بيقلّد HTTP API بتاع Turso فوق SQLite محلي) - للاختبار بس.
// node scripts/fake-turso.js [port]
const http = require('node:http');
const { DatabaseSync } = require('node:sqlite');
const crypto = require('node:crypto');

function start(port = 0, { token = '' } = {}) {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  const batons = new Set();
  const stats = { requests: 0, statements: 0 };
  const enc = (v) => v === null || v === undefined ? { type: 'null' } : typeof v === 'bigint' || Number.isInteger(v) ? { type: 'integer', value: String(v) } : typeof v === 'number' ? { type: 'float', value: v } : v instanceof Uint8Array ? { type: 'blob', base64: Buffer.from(v).toString('base64') } : { type: 'text', value: String(v) };
  const dec = (a) => a.type === 'null' ? null : a.type === 'integer' ? Number(a.value) : a.type === 'float' ? Number(a.value) : a.type === 'blob' ? Buffer.from(a.base64, 'base64') : a.value;

  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const out = (code, o) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
      if (req.url !== '/v2/pipeline' || req.method !== 'POST') return out(404, { error: 'not found' });
      if (token && req.headers.authorization !== 'Bearer ' + token) return out(401, { error: 'unauthorized' });
      stats.requests++;
      const j = JSON.parse(body);
      if (j.baton && !batons.has(j.baton)) return out(400, { error: { message: 'stream expired' } });
      let baton = j.baton || null, closed = false;
      const results = [];
      for (const r of j.requests) {
        if (r.type === 'close') { closed = true; results.push({ type: 'ok', response: { type: 'close' } }); continue; }
        try {
          stats.statements++;
          if (r.type === 'sequence') { db.exec(r.sql); results.push({ type: 'ok', response: { type: 'sequence' } }); continue; }
          const st = db.prepare(r.stmt.sql);
          const args = (r.stmt.args || []).map(dec);
          const cols = st.columns().map((c) => ({ name: c.name }));
          if (cols.length) {
            const rows = st.all(...args).map((o) => cols.map((c) => enc(o[c.name])));
            results.push({ type: 'ok', response: { type: 'execute', result: { cols, rows, affected_row_count: 0, last_insert_rowid: null } } });
          } else {
            const info = st.run(...args);
            results.push({ type: 'ok', response: { type: 'execute', result: { cols: [], rows: [], affected_row_count: info.changes, last_insert_rowid: String(info.lastInsertRowid) } } });
          }
        } catch (e) { results.push({ type: 'error', error: { message: e.message } }); }
        if (results[results.length - 1].type === 'error') break;
      }
      if (!closed) { if (!baton) { baton = crypto.randomBytes(8).toString('hex'); batons.add(baton); } } else if (baton) { batons.delete(baton); baton = null; }
      out(200, { baton, base_url: null, results });
    });
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, port: server.address().port, db, stats })));
}
module.exports = { start };
if (require.main === module) start(Number(process.argv[2]) || 8080).then((s) => console.log('fake turso on http://127.0.0.1:' + s.port));
