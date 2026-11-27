import { fileURLToPath } from 'node:url';
import { Router, static as serveStatic } from 'express';
import { pool } from '../db.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';

const pageDirectory = fileURLToPath(new URL('../dashboard/', import.meta.url));
export const dashboardPages = Router();
dashboardPages.use((_req, res, next) => {
  res.set({
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
  });
  next();
});
dashboardPages.use(serveStatic(pageDirectory, { cacheControl: false, etag: false, lastModified: false }));

export const dashboardApiRouter = Router();
dashboardApiRouter.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
}, requireAuth, requireAdmin);

dashboardApiRouter.get('/', async (_req, res) => {
  const start = performance.now();
  await pool.query('SELECT 1');
  const databasePingMs = Math.round(performance.now() - start);

  const { rows: [row] } = await pool.query(`
    SELECT
      NOW() AS sampled_at,
      current_setting('server_version') AS postgres_version,
      (SELECT COUNT(*) FROM app_users WHERE status = 'active') AS users,
      (SELECT COUNT(*) FROM auth_sessions JOIN app_users ON app_users.id = auth_sessions.user_id
       WHERE auth_sessions.revoked_at IS NULL AND auth_sessions.expires_at > NOW() AND app_users.status = 'active') AS sessions,
      (SELECT COUNT(*) FROM shopping_lists WHERE NOT archived) AS lists,
      (SELECT COUNT(*) FROM music_playlists) AS music,
      (SELECT COUNT(*) FROM classical_playlists) AS classical,
      (SELECT COUNT(*) FROM chat_rooms) AS rooms,
      (SELECT COUNT(*) FROM chat_messages WHERE status = 'visible'
       AND (expires_at IS NULL OR expires_at > NOW()) AND created_at >= NOW() - INTERVAL '24 hours') AS messages,
      (SELECT COUNT(*) FROM store_requests WHERE status = 'pending') AS pending_stores,
      (SELECT COUNT(*) FROM product_review_submissions WHERE status = 'pending_review') AS pending_products,
      (SELECT version FROM schema_migrations ORDER BY applied_at DESC, version DESC LIMIT 1) AS latest_migration,
      (SELECT COUNT(*) FROM schema_migrations) AS migrations
  `);
  const { rows: activity } = await pool.query(`
    WITH days AS (
      SELECT day::date AS day FROM generate_series(
        (NOW() AT TIME ZONE 'UTC')::date - 6, (NOW() AT TIME ZONE 'UTC')::date, INTERVAL '1 day'
      ) AS day
    ), created AS (
      SELECT (created_at AT TIME ZONE 'UTC')::date AS day, COUNT(*) AS total
      FROM shopping_lists
      WHERE created_at >= (((NOW() AT TIME ZONE 'UTC')::date - 6)::timestamp AT TIME ZONE 'UTC')
      GROUP BY (created_at AT TIME ZONE 'UTC')::date
    )
    SELECT to_char(days.day, 'YYYY-MM-DD') AS day, COALESCE(created.total, 0) AS total
      FROM days LEFT JOIN created USING (day) ORDER BY days.day
  `);

  const memory = process.memoryUsage();
  res.json({
    sampledAt: row.sampled_at,
    api: {
      status: 'online',
      nodeVersion: process.version,
      uptimeSeconds: Math.floor(process.uptime()),
      rssBytes: memory.rss,
    },
    database: {
      status: 'online',
      version: row.postgres_version,
      pingMs: databasePingMs,
      openConnections: pool.totalCount,
      idleConnections: pool.idleCount,
      waitingRequests: pool.waitingCount,
      migrations: Number(row.migrations),
      latestMigration: row.latest_migration,
    },
    counts: {
      users: Number(row.users), sessions: Number(row.sessions), lists: Number(row.lists),
      music: Number(row.music), classical: Number(row.classical), rooms: Number(row.rooms),
      messages: Number(row.messages), pendingStores: Number(row.pending_stores), pendingProducts: Number(row.pending_products),
    },
    activity: activity.map(item => ({ day: item.day, lists: Number(item.total) })),
  });
});
