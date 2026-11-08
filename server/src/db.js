import pg from 'pg';

export function createDatabase(connectionString) {
  const pool = new pg.Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 30000,
  });
  pool.on('error', (err) => {
    // No imprimir cadenas de conexión ni secretos.
    console.error('Error de conexión inactiva a PostgreSQL:', err.message);
  });
  return pool;
}
