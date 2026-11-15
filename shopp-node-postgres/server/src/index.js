import express from 'express';
import { pool } from './db.js';

const app = express();
const port = Number(process.env.PORT || 3000);
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    console.error('Health check falló:', error.message);
    res.status(503).json({ status: 'error', database: 'unavailable' });
  }
});

app.get('/api/items', async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id, name, created_at FROM items ORDER BY id');
    res.json(rows);
  } catch (error) { next(error); }
});

app.post('/api/items', async (req, res, next) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name || name.length > 200) return res.status(400).json({ error: 'name es obligatorio (máximo 200 caracteres)' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO items (name) VALUES ($1) RETURNING id, name, created_at', [name]
    );
    res.status(201).json(rows[0]);
  } catch (error) { next(error); }
});

app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const server = app.listen(port, '0.0.0.0', () => console.log(`API escuchando en puerto ${port}`));
async function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
