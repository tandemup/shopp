import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const migrationsDirectory = fileURLToPath(new URL('../sql/', import.meta.url));
const migrationLockId = 731204611;

export async function migrateDatabase(pool) {
  const files = (await readdir(migrationsDirectory))
    .filter((name) => /^\d{3}_[a-z0-9_]+\.sql$/i.test(name))
    .sort();

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    for (const file of files) {
      const version = path.basename(file, '.sql');
      await client.query('BEGIN');
      try {
        await client.query('SELECT pg_advisory_xact_lock($1)', [migrationLockId]);
        const alreadyApplied = await client.query(
          'SELECT 1 FROM schema_migrations WHERE version = $1',
          [version],
        );
        if (alreadyApplied.rowCount === 0) {
          const sql = await readFile(path.join(migrationsDirectory, file), 'utf8');
          await client.query(sql);
          await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`No se pudo aplicar la migración ${version}: ${error.message}`, { cause: error });
      }
    }
  } finally {
    client.release();
  }
}
