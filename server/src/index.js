import 'dotenv/config';
import { readConfig } from './config.js';
import { createDatabase } from './db.js';
import { createApp } from './app.js';
import { migrateDatabase } from './migrations.js';

const config = readConfig();
const pool = createDatabase(config.databaseUrl);
await migrateDatabase(pool);
const app = createApp({ pool, config });
const server = app.listen(config.port, config.host, () => {
  console.log(`Shopp API escuchando en http://${config.host}:${config.port}`);
});

async function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
