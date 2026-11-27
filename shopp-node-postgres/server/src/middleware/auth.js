import { pool } from '../db.js';
import { digestToken, verifySessionToken } from '../security.js';

export async function requireAuth(req, res, next) {
  const match = /^Bearer\s+([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(req.get('authorization') || '');
  if (!match) return res.status(401).json({ error: { code: 'unauthorized', message: 'Sesión no válida' } });
  const claims = verifySessionToken(match[1]);
  if (!claims) return res.status(401).json({ error: { code: 'unauthorized', message: 'Sesión no válida' } });
  try {
    const { rows } = await pool.query(
      `SELECT s.id AS session_id, u.id, u.email, u.name, u.public_alias, u.role, u.status, u.permissions, u.email_verified_at,
              p.phone, p.scan_history_sync_enabled
       FROM auth_sessions s JOIN app_users u ON u.id = s.user_id
       LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE s.token_hash = $1 AND s.user_id = $2 AND u.id = $2
         AND s.revoked_at IS NULL AND s.expires_at > NOW() LIMIT 1`,
      [digestToken(match[1]), claims.sub],
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: { code: 'unauthorized', message: 'Sesión no válida' } });
    if (user.status === 'blocked') return res.status(403).json({ error: { code: 'account_blocked', message: 'La cuenta está bloqueada' } });
    req.auth = { token: match[1], claims, sessionId: user.session_id, user };
    next();
  } catch (error) { next(error); }
}

export function optionalAuth(req, res, next) {
  if (!req.get('authorization')) return next();
  return requireAuth(req, res, next);
}

export function requireAdmin(req, res, next) {
  if (req.auth?.user?.role === 'admin') return next();
  return res.status(403).json({ error: { code: 'forbidden', message: 'Se requieren permisos de administrador' } });
}

export function requireFeature(feature, { defaultEnabled = false } = {}) {
  return (req, res, next) => {
    const user = req.auth?.user;
    if (user && (user.role === 'admin' || (user.permissions?.[feature] ?? defaultEnabled) === true)) return next();
    return res.status(403).json({ error: { code: 'forbidden', message: 'No tienes permiso para esta función' } });
  };
}

export function publicUser(user) {
  return {
    id: user.id, email: user.email, name: user.name,
    alias: user.public_alias || user.alias || user.name,
    emailVerified: Boolean(user.email_verified_at), role: user.role,
    status: user.status, permissions: user.permissions || {},
    scanHistorySyncEnabled: user.scan_history_sync_enabled === true,
  };
}

export function accountUser(user) {
  return { ...publicUser(user), phone: user.phone || null };
}
