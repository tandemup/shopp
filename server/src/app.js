import express from 'express';
import { createAuthRouter } from './auth/authRoutes.js';
import { createSessionMiddleware } from './auth/sessionMiddleware.js';
import { requireAdmin, requireAuth, requireFeature } from './auth/authorization.js';

function corsMiddleware(allowedOrigins) {
  const allowed = new Set(allowedOrigins);
  return (req, res, next) => {
    const origin = req.get('origin');
    if (!origin) return next(); // Native clients do not send Origin.
    if (!allowed.has(origin)) {
      return res.status(403).json({ error: { code: 'origin_not_allowed', message: 'Origen no permitido.' } });
    }

    res.set('Access-Control-Allow-Origin', origin);
    res.vary('Origin');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Max-Age', '600');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    return next();
  };
}

export function createApp({ pool, config = {} }) {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy === true) app.set('trust proxy', 1);
  app.use(corsMiddleware(config.corsOrigins || []));
  app.use(express.json({ limit: '128kb' }));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/v1/auth/')) res.set('Cache-Control', 'no-store');
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.status(200).json({ status: 'ok', service: 'shopp-api' });
  });

  app.get('/api/ready', async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      await pool.query('SELECT 1');
      res.status(200).json({ status: 'ready', database: 'ok' });
    } catch {
      res.status(503).json({ status: 'unavailable', database: 'unavailable' });
    }
  });

  const sessionMiddleware = createSessionMiddleware({ pool });
  app.use('/api/v1/auth', createAuthRouter({
    pool,
    sessionMiddleware,
    sessionTtlHours: config.sessionTtlHours || 168,
    resendApiKey: config.resendApiKey || '',
    authEmailFrom: config.authEmailFrom || 'Shopp <auth@ramshopp.com>',
    challengeSecret: config.authChallengeSecret || '',
  }));

  // Exported for subsequent route modules; authorization is always server-side.
  app.locals.authMiddleware = { requireAuth, requireAdmin, requireFeature };

  app.use((_req, res) => res.status(404).json({ error: 'not_found' }));
  app.use((error, _req, res, _next) => {
    // Do not expose SQL, stack traces, tokens, or other internal details.
    if (error?.type === 'entity.parse.failed') {
      return res.status(400).json({ error: { code: 'invalid_json', message: 'El cuerpo JSON no es válido.' } });
    }
    if (error?.type === 'entity.too.large') {
      return res.status(413).json({ error: { code: 'payload_too_large', message: 'La petición supera el tamaño permitido.' } });
    }
    return res.status(500).json({ error: { code: 'internal_error', message: 'Error interno del servidor.' } });
  });
  return app;
}
