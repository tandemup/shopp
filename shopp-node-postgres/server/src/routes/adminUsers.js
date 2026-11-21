import { Router } from 'express';
import { pool } from '../db.js';
import { requireAdmin, requireAuth, publicUser } from '../middleware/auth.js';

export const adminUsersRouter = Router();
adminUsersRouter.use(requireAuth, requireAdmin);

const FEATURE_KEYS = Object.freeze([
  'scanner', 'stores', 'chat', 'parking', 'englishTutor', 'library',
  'musicPlaylist', 'classicalMusic', 'tutorials', 'news', 'shoppLive',
  'p2pPlaylistExchange', 'fireAlarm', 'investments',
]);

function invalid(res, message) {
  return res.status(400).json({ error: { code: 'invalid_input', message } });
}

function parsePermissions(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (Object.keys(value).some((key) => !FEATURE_KEYS.includes(key))) return null;
  if (Object.values(value).some((enabled) => typeof enabled !== 'boolean')) return null;
  return Object.fromEntries(FEATURE_KEYS.map((key) => [key, value[key] === true]));
}

adminUsersRouter.get('/', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, email, name, role, status, permissions, email_verified_at, created_at
       FROM app_users ORDER BY lower(email), id LIMIT 500`,
    );
    res.json({ users: rows.map((row) => ({
      ...publicUser(row), createdAt: row.created_at,
    })) });
  } catch (error) { next(error); }
});

adminUsersRouter.patch('/:userId/role', async (req, res, next) => {
  const userId = String(req.params.userId || '').trim();
  const role = req.body?.role;
  if (!userId || userId.length > 160) return invalid(res, 'Identificador de usuario no válido.');
  if (!['user', 'tester', 'admin'].includes(role)) return invalid(res, 'El rol debe ser user, tester o admin.');
  if (req.auth.user.id === userId && role !== 'admin') {
    return res.status(409).json({ error: { code: 'self_role_change', message: 'No puedes retirar tu propio rol de administrador.' } });
  }
  try {
    const result = await pool.query(
      `UPDATE app_users SET role = $1,
         permissions = CASE WHEN $1 = 'tester' AND permissions = '{}'::jsonb
           THEN '{"scanner":true,"stores":true,"musicPlaylist":true,"classicalMusic":true,"tutorials":true,"p2pPlaylistExchange":true}'::jsonb
           ELSE permissions END,
         updated_at = NOW()
       WHERE id = $2 RETURNING id, email, name, role, status, permissions, email_verified_at`,
      [role, userId],
    );
    if (!result.rowCount) return res.status(404).json({ error: { code: 'user_not_found', message: 'Usuario no encontrado.' } });
    res.json({ user: publicUser(result.rows[0]) });
  } catch (error) { next(error); }
});

adminUsersRouter.patch('/:userId/status', async (req, res, next) => {
  const userId = String(req.params.userId || '').trim();
  const status = req.body?.status;
  if (!userId || userId.length > 160) return invalid(res, 'Identificador de usuario no válido.');
  if (!['active', 'blocked'].includes(status)) return invalid(res, 'El estado debe ser active o blocked.');
  if (req.auth.user.id === userId && status === 'blocked') {
    return res.status(409).json({ error: { code: 'self_block', message: 'No puedes bloquear tu propia cuenta.' } });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE app_users SET status = $1, updated_at = NOW()
       WHERE id = $2 RETURNING id, email, name, role, status, permissions, email_verified_at`,
      [status, userId],
    );
    if (!result.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: { code: 'user_not_found', message: 'Usuario no encontrado.' } });
    }
    if (status === 'blocked') {
      await client.query('UPDATE auth_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
    }
    await client.query('COMMIT');
    res.json({ user: publicUser(result.rows[0]) });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    next(error);
  } finally { client.release(); }
});

adminUsersRouter.patch('/:userId/permissions', async (req, res, next) => {
  const userId = String(req.params.userId || '').trim();
  const permissions = parsePermissions(req.body?.permissions);
  if (!userId || userId.length > 160) return invalid(res, 'Identificador de usuario no válido.');
  if (!permissions) return invalid(res, 'El mapa de permisos contiene campos desconocidos o valores no booleanos.');
  try {
    const result = await pool.query(
      `UPDATE app_users SET permissions = $1::jsonb, updated_at = NOW()
       WHERE id = $2 AND role <> 'admin'
       RETURNING id, email, name, role, status, permissions, email_verified_at`,
      [JSON.stringify(permissions), userId],
    );
    if (!result.rowCount) {
      const exists = await pool.query('SELECT role FROM app_users WHERE id = $1', [userId]);
      if (!exists.rowCount) return res.status(404).json({ error: { code: 'user_not_found', message: 'Usuario no encontrado.' } });
      return res.status(409).json({ error: { code: 'admin_permissions', message: 'Los administradores ya tienen acceso a todas las utilidades.' } });
    }
    res.json({ user: publicUser(result.rows[0]) });
  } catch (error) { next(error); }
});
