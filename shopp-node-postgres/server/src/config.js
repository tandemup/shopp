const numberFromEnv = (name, fallback) => {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${name} debe ser un entero positivo`);
  return parsed;
};

export const config = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: numberFromEnv('PORT', 3000),
  dbHost: process.env.DB_HOST || 'localhost',
  dbPort: numberFromEnv('DB_PORT', 5432),
  dbName: process.env.POSTGRES_DB || 'shopp',
  dbUser: process.env.POSTGRES_USER || 'shopp_app',
  dbPassword: process.env.POSTGRES_PASSWORD || '',
  sessionTtlHours: numberFromEnv('SESSION_TTL_HOURS', 168),
  resendKey: process.env.AUTH_RESEND_KEY || '',
  emailFrom: process.env.AUTH_EMAIL_FROM || '',
  challengeSecret: process.env.AUTH_CHALLENGE_SECRET || '',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:8081,http://127.0.0.1:8081')
    .split(',').map((origin) => origin.trim()).filter(Boolean),
  trustProxy: process.env.TRUST_PROXY === 'true',
});

if (config.sessionTtlHours > 720) throw new Error('SESSION_TTL_HOURS no puede superar 720');

export function authConfigurationError() {
  if (config.challengeSecret.length < 32 || config.challengeSecret.startsWith('replace-with-')) return 'AUTH_CHALLENGE_SECRET debe generarse con openssl';
  if (!config.resendKey || config.resendKey.startsWith('re_replace')) return 'Falta una clave privada válida de Resend';
  if (!config.emailFrom || config.emailFrom.includes('example.com')) return 'Falta un remitente autorizado de correo';
  return null;
}
