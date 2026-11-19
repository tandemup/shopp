import { Router } from 'express';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { pool } from '../db.js';
import { config } from '../config.js';
import { createSessionToken, digestToken, normalizeEmail } from '../security.js';
import { publicUser } from '../middleware/auth.js';

export const internalAuthRouter = Router();

function isTrustedBridge(req) {
  const supplied = req.get('x-shopp-convex-bridge') || '';
  const expected = config.convexBridgeSecret;
  if (expected.length < 32 || expected.startsWith('REPLACE_')) return false;
  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected);
  if (suppliedBytes.length !== expectedBytes.length) return false;
  return timingSafeEqual(suppliedBytes, expectedBytes);
}

internalAuthRouter.post('/convex-session', async (req, res, next) => {
  if (!isTrustedBridge(req)) {
    return res.status(401).json({ error: { code: 'unauthorized', message: 'Solicitud no autorizada' } });
  }
  const convexUserId = typeof req.body?.convexUserId === 'string' ? req.body.convexUserId.trim() : '';
  const email = normalizeEmail(req.body?.email);
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(convexUserId) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !name || name.length > 120 || req.body?.emailVerified !== true) {
    return res.status(400).json({ error: { code: 'invalid_identity', message: 'La cuenta Convex no tiene una identidad verificada válida' } });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serialize concurrent first-time links for the same Convex account.
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [convexUserId]);
    let { rows } = await client.query(
      'SELECT * FROM app_users WHERE convex_user_id = $1 FOR UPDATE',
      [convexUserId],
    );
    let user = rows[0];
    if (!user) {
      const byEmail = await client.query('SELECT id FROM app_users WHERE email = $1', [email]);
      if (byEmail.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: { code: 'account_link_required', message: 'Ya existe una cuenta Node con este correo; requiere vinculación administrativa.' } });
      }
      const inserted = await client.query(
        `INSERT INTO app_users (id, convex_user_id, email, name, email_verified_at)
         VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
        [`usr_${randomUUID()}`, convexUserId, email, name],
      );
      user = inserted.rows[0];
    }
    if (user.status !== 'active' || !user.email_verified_at) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: { code: 'account_unavailable', message: 'La cuenta no está disponible.' } });
    }

    const token = createSessionToken();
    const session = await client.query(
      `INSERT INTO auth_sessions (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + ($3 * INTERVAL '1 hour')) RETURNING expires_at`,
      [user.id, digestToken(token), config.sessionTtlHours],
    );
    await client.query('COMMIT');
    return res.json({ token, expiresAt: session.rows[0].expires_at, user: publicUser(user) });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    return next(error);
  } finally {
    client.release();
  }
});
