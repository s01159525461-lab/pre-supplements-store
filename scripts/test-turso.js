'use strict';
// بيشغّل اختبار الباك اند الشامل (npm test) على قاعدة Turso وهمية، للتأكد إن وضع Vercel شغال.
const { spawn } = require('node:child_process');
const path = require('node:path');
const fake = require('./fake-turso');
(async () => {
  const { server, port, stats } = await fake.start(0, { token: 'tok' });
  const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(__dirname, 'smoke-test.js')], {
    stdio: 'inherit', env: { ...process.env, TURSO_DATABASE_URL: `http://127.0.0.1:${port}`, TURSO_AUTH_TOKEN: 'tok' },
  });
  const r = { status: await new Promise((res) => child.on('exit', res)) };
  console.log(`\n(Turso الوهمي استقبل ${stats.requests} طلب / ${stats.statements} استعلام)`);
  server.close();
  process.exit(r.status);
})();
