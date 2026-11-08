export function readConfig(env = process.env) {
  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT debe ser un entero entre 1 y 65535');
  }
  if (!env.DATABASE_URL) {
    throw new Error('Falta DATABASE_URL. Configura server/.env antes de iniciar.');
  }
  return {
    port,
    host: env.HOST || '127.0.0.1',
    databaseUrl: env.DATABASE_URL,
    nodeEnv: env.NODE_ENV || 'development',
  };
}
