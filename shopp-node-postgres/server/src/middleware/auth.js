import { pool } from '../db.js';
import { digestToken } from '../security.js';

export async function requireAuth(req, res, next) {
  const match = /^Bearer\s+([A-Za-z0-9_-]{32,})$/i.exec(req.get('authorization') || '');
  if (!match) return res.status(401).json({ error: { code: 'unauthorized', message: 'Sesión no válida' } });
  try {
    const { rows } = await pool.query(
      `SELECT s.id AS session_id, u.id, u.email, u.name, u.role, u.status, u.permissions, u.email_verified_at
       FROM auth_sessions s JOIN app_users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > NOW() LIMIT 1`,
      [digestToken(match[1])],
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: { code: 'unauthorized', message: 'Sesión no válida' } });
    if (user.status === 'blocked') return res.status(403).json({ error: { code: 'account_blocked', message: 'La cuenta está bloqueada' } });
    req.auth = { token: match[1], sessionId: user.session_id, user };
    next();
  } catch (error) { next(error); }
}

export function requireAdmin(req, res, next) {
  if (req.auth?.user?.role === 'admin') return next();
  return res.status(403).json({ error: { code: 'forbidden', message: 'Se requieren permisos de administrador' } });
}

export function requireFeature(feature) {
  return (req, res, next) => {
    const user = req.auth?.user;
    if (user?.role === 'admin' || user?.permissions?.[feature] === true) return next();
    return res.status(403).json({ error: { code: 'forbidden', message: 'No tienes permiso para esta función' } });
  };
}

export function publicUser(user) {
  return {
    id: user.id, email: user.email, name: user.name,
    emailVerified: Boolean(user.email_verified_at), role: user.role,
    status: user.status, permissions: user.permissions || {},
  };
}
