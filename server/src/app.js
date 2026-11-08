import express from 'express';

/** La fase 2A expone únicamente comprobación de salud, ninguna ruta de datos. */
export function createApp({ pool }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '128kb' }));

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

  app.use((_req, res) => res.status(404).json({ error: 'not_found' }));
  return app;
}
