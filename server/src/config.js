export function readConfig(env = process.env) {
  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT debe ser un entero entre 1 y 65535');
  }
  if (!env.DATABASE_URL) {
    throw new Error('Falta DATABASE_URL. Configura server/.env antes de iniciar.');
  }
  const sessionTtlHours = Number(env.SESSION_TTL_HOURS || 168);
  if (!Number.isInteger(sessionTtlHours) || sessionTtlHours < 1 || sessionTtlHours > 720) {
    throw new Error('SESSION_TTL_HOURS debe ser un entero entre 1 y 720');
  }
  return {
    port,
    host: env.HOST || '127.0.0.1',
    databaseUrl: env.DATABASE_URL,
    nodeEnv: env.NODE_ENV || 'development',
    sessionTtlHours,
    corsOrigins: (env.CORS_ORIGINS || '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    trustProxy: env.TRUST_PROXY === 'true',
    resendApiKey: env.AUTH_RESEND_KEY || '',
    authEmailFrom: env.AUTH_EMAIL_FROM || 'Shopp <auth@ramshopp.com>',
    authChallengeSecret: env.AUTH_CHALLENGE_SECRET || '',
  };
}
