import { hashSessionToken } from './sessionTokens.js';

function unauthorized(res) {
  return res.status(401).json({ error: { code: 'invalid_session', message: 'La sesión no es válida o ha caducado.' } });
}

export function createSessionMiddleware({ pool }) {
  return async (req, res, next) => {
    const authorization = req.get('authorization') || '';
    const match = /^Bearer\s+([A-Za-z0-9_-]{40,64})$/i.exec(authorization);
    if (!match) return unauthorized(res);

    const tokenHash = hashSessionToken(match[1]);
    try {
      const result = await pool.query(`
        SELECT s.token_hash, u.id, u.email, u.display_name, u.role, u.status, u.permissions,
               u.email_verified_at
        FROM app_sessions AS s
        JOIN app_users AS u ON u.id = s.user_id
        WHERE s.token_hash = $1
          AND s.revoked_at IS NULL
          AND s.expires_at > now()
      `, [tokenHash]);
      const row = result.rows[0];
      if (!row) return unauthorized(res);
      if (row.status !== 'active') {
        return res.status(403).json({ error: { code: 'account_blocked', message: 'La cuenta no está activa.' } });
      }
      req.auth = {
        sessionTokenHash: tokenHash,
        user: {
          id: row.id,
          email: row.email,
          name: row.display_name,
          role: row.role,
          isAdmin: row.role === 'admin',
          status: row.status,
          emailVerifiedAt: row.email_verified_at,
          permissions: row.permissions || {},
        },
      };
      return next();
    } catch (error) {
      return next(error);
    }
  };
}
