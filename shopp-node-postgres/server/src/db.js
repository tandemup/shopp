import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;
if (!config.dbPassword) throw new Error('POSTGRES_PASSWORD no está definida');

export const pool = new Pool({
  host: config.dbHost,
  port: config.dbPort,
  database: config.dbName,
  user: config.dbUser,
  password: config.dbPassword,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (error) => console.error('Error inesperado del pool PostgreSQL:', error.message));
