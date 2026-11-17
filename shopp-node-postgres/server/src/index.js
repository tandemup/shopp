import { createServer } from 'node:http';
import app from './app.js';
import { pool } from './db.js';
import { config } from './config.js';
import { runMigrations } from './migrations.js';
import { attachRealtime } from './realtime.js';

await runMigrations();
const server = createServer(app);
const realtime = attachRealtime(server);
server.listen(config.port, '0.0.0.0', () => console.log(`API Shopp escuchando en el puerto ${config.port}`));
const rateLimitCleanup = setInterval(() => {
  pool.query("DELETE FROM api_rate_limit_buckets WHERE window_expires_at < NOW() - INTERVAL '1 hour'")
    .catch((error) => console.error('No se pudieron limpiar los límites de solicitudes:', error.message));
  pool.query("DELETE FROM realtime_tickets WHERE expires_at < NOW() - INTERVAL '1 hour'")
    .catch((error) => console.error('No se pudieron limpiar los tickets WebSocket:', error.message));
  pool.query("DELETE FROM chat_messages WHERE expires_at IS NOT NULL AND expires_at < NOW()")
    .catch((error) => console.error('No se pudieron limpiar mensajes de chat caducados:', error.message));
}, 60 * 60 * 1000);
rateLimitCleanup.unref();

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Recibido ${signal}; cerrando API...`);
  clearInterval(rateLimitCleanup);
  const timeout = setTimeout(() => process.exit(1), 10_000);
  timeout.unref();
  await realtime.close();
  server.close(async () => {
    await pool.end();
    clearTimeout(timeout);
    process.exit(0);
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
