import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pool } from './db.js';

const migrationsDirectory = fileURLToPath(new URL('../migrations/', import.meta.url));

export async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(20261115, 1)');
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    const files = (await readdir(migrationsDirectory))
      .filter((file) => /^\d+_[a-z0-9_-]+\.sql$/i.test(file)).sort();
    for (const file of files) {
      const version = file.slice(0, -4);
      const applied = await client.query('SELECT 1 FROM schema_migrations WHERE version = $1', [version]);
      if (applied.rowCount) continue;
      const sql = await readFile(path.join(migrationsDirectory, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
        await client.query('COMMIT');
        console.log(`Migración aplicada: ${version}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(20261115, 1)').catch(() => {});
    client.release();
  }
}
