'use strict';
const http = require('node:http');
const { handle, whatsapp } = require('./lib/app');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const server = http.createServer(handle);
server.requestTimeout = 30_000;
server.headersTimeout = 15_000;
server.listen(PORT, HOST, () => console.log(`Pre Supplements يعمل على http://localhost:${PORT}  (الأدمن: /admin)`));

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { console.log('إيقاف السيرفر...'); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 5000).unref(); });
module.exports = server;
