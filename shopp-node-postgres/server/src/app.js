import express from 'express';
import { pool } from './db.js';
import { authRouter } from './routes/auth.js';
import { shoppingListsRouter } from './routes/shoppingLists.js';
import { productsRouter } from './routes/products.js';
import { scanHistoryRouter } from './routes/scanHistory.js';
import { storesRouter } from './routes/stores.js';
import { storeOffersRouter } from './routes/storeOffers.js';
import { productReviewsRouter } from './routes/productReviews.js';
import { realtimeRouter } from './routes/realtime.js';
import { config } from './config.js';

const app = express();
app.disable('x-powered-by');
if (config.trustProxy) app.set('trust proxy', 1);

app.use((req, res, next) => {
  const origin = req.get('origin');
  if (origin) {
    if (!config.corsOrigins.includes(origin)) {
      return res.status(403).json({ error: { code: 'origin_not_allowed', message: 'Origen no permitido' } });
    }
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});
app.use(express.json({ limit: '64kb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/api/ready', async (_req, res, next) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ready', database: 'connected' });
  } catch (error) { next(error); }
});
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/shopping', shoppingListsRouter);
app.use('/api/v1/products', productsRouter);
app.use('/api/v1/scans', scanHistoryRouter);
app.use('/api/v1/stores', storesRouter);
app.use('/api/v1/store-offers', storeOffersRouter);
app.use('/api/v1/product-reviews', productReviewsRouter);
app.use('/api/v1/realtime', realtimeRouter);
app.use((_req, res) => res.status(404).json({ error: { code: 'not_found', message: 'Ruta no encontrada' } }));
app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({ error: { code: 'invalid_json', message: 'El cuerpo JSON no es válido' } });
  }
  console.error('Error API:', error.message);
  res.status(500).json({ error: { code: 'internal_error', message: 'Error interno del servidor' } });
});

export default app;
