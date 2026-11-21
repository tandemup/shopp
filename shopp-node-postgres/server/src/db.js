import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;
if (!config.databaseUrl && !config.dbPassword) {
  throw new Error('Define DATABASE_URL o POSTGRES_PASSWORD para conectar PostgreSQL');
}

export const pool = new Pool({
  ...(config.databaseUrl
    ? {
      connectionString: config.databaseUrl,
      ssl: { rejectUnauthorized: config.databaseSslRejectUnauthorized },
    }
    : {
      host: config.dbHost,
      port: config.dbPort,
      database: config.dbName,
      user: config.dbUser,
      password: config.dbPassword,
    }),
  max: config.databaseUrl ? 5 : 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (error) => console.error('Error inesperado del pool PostgreSQL:', error.message));
