import express from 'express';
import { randomUUID } from 'node:crypto';
import { assertPasswordPolicy, hashPassword, verifyPassword } from './passwords.js';
import { createSessionToken, hashSessionToken } from './sessionTokens.js';
import { createLoginRateLimit } from './loginRateLimit.js';
import { requireAuth } from './authorization.js';
import { issueChallenge, consumeChallenge } from './challengeStore.js';
import { createAuthEmailSender } from './emailSender.js';

const DEFAULT_NEW_USER_PERMISSIONS = {
  scanner: true,
  stores: true,
  musicPlaylist: true,
  classicalMusic: true,
  tutorials: true,
  p2pPlaylistExchange: true,
};
const OTP_LENGTH = 8;

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isValidEmail(email) {
  return email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function publicUser(row) {
  return {
    id: row.id,
    name: row.display_name,
    email: row.email,
    role: row.role,
    isAdmin: row.role === 'admin',
    status: row.status,
    emailVerifiedAt: row.email_verified_at,
    permissions: row.permissions || {},
  };
}

function accepted(res, message) {
  return res.status(202).json({ ok: true, message });
}

function challengeServiceAvailable(res, challengeSecret, emailSender) {
  if (typeof challengeSecret === 'string' && challengeSecret.length >= 32 && emailSender.isConfigured) return true;
  res.status(503).json({
    error: { code: 'email_service_unavailable', message: 'El servicio de correo no está configurado.' },
  });
  return false;
}

async function withTransaction(pool, callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const value = await callback(client);
    await client.query('COMMIT');
    return value;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function invalidCode(res) {
  return res.status(400).json({
    error: { code: 'invalid_or_expired_code', message: 'El código no es válido o ha caducado.' },
  });
}

export function createAuthRouter({
  pool,
  sessionMiddleware,
  sessionTtlHours = 168,
  resendApiKey = '',
  authEmailFrom = 'Shopp <auth@ramshopp.com>',
  challengeSecret = '',
}) {
  const router = express.Router();
  const emailSender = createAuthEmailSender({ apiKey: resendApiKey, from: authEmailFrom });
  const limitLogin = createLoginRateLimit();
  const limitRegistration = createLoginRateLimit();
  const limitVerification = createLoginRateLimit();
  const limitResetRequest = createLoginRateLimit();
  const limitResetConfirm = createLoginRateLimit();

  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    return next();
  });

  router.post('/register', limitRegistration, async (req, res, next) => {
    if (!challengeServiceAvailable(res, challengeSecret, emailSender)) return;
    const email = normalizeEmail(req.body?.email);
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const password = req.body?.password;
    if (!isValidEmail(email) || !name || name.length > 120) {
      return res.status(400).json({ error: { code: 'invalid_registration', message: 'Revisa el nombre y el correo electrónico.' } });
    }

    let passwordHash;
    try {
      assertPasswordPolicy(password);
      passwordHash = await hashPassword(password);
    } catch (error) {
      return res.status(400).json({ error: { code: 'invalid_password', message: error.message } });
    }

    try {
      const result = await withTransaction(pool, async (client) => {
        const inserted = await client.query(`
          INSERT INTO app_users (id, email, email_normalized, display_name, password_hash, permissions)
          VALUES ($1, $2, $2, $3, $4, $5::jsonb)
          ON CONFLICT (email_normalized) DO NOTHING
          RETURNING id, email_verified_at, status
        `, [randomUUID(), email, name, passwordHash, JSON.stringify(DEFAULT_NEW_USER_PERMISSIONS)]);
        const user = inserted.rows[0] || (await client.query(`
          SELECT id, email_verified_at, status
          FROM app_users
          WHERE email_normalized = $1
          FOR UPDATE
        `, [email])).rows[0];

        if (!user || user.email_verified_at || user.status !== 'active') {
          return { sendCode: false };
        }
        const challenge = await issueChallenge(client, {
          userId: user.id,
          purpose: 'verify_email',
          secret: challengeSecret,
        });
        return { sendCode: Boolean(challenge.code), userId: user.id, code: challenge.code };
      });

      if (result.sendCode) {
        try {
          await emailSender.sendCode({ to: email, code: result.code, purpose: 'verify_email' });
        } catch {
          console.error('Shopp no pudo enviar un correo de verificación.');
        }
      }
      return accepted(res, 'Si el correo puede registrarse, recibirás un código de verificación.');
    } catch (error) {
      return next(error);
    }
  });

  router.post('/verify-email', limitVerification, async (req, res, next) => {
    if (!challengeServiceAvailable(res, challengeSecret, emailSender)) return;
    const email = normalizeEmail(req.body?.email);
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
    if (!isValidEmail(email) || !new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code)) return invalidCode(res);

    try {
      const accessToken = createSessionToken();
      const tokenHash = hashSessionToken(accessToken);
      const result = await withTransaction(pool, async (client) => {
        const userResult = await client.query(`
          SELECT id, email, display_name, role, status, permissions, email_verified_at
          FROM app_users
          WHERE email_normalized = $1
          FOR UPDATE
        `, [email]);
        const user = userResult.rows[0];
        if (!user || user.email_verified_at || user.status !== 'active') return null;

        const valid = await consumeChallenge(client, {
          userId: user.id,
          purpose: 'verify_email',
          code,
          secret: challengeSecret,
        });
        if (!valid) return null;

        const verified = await client.query(`
          UPDATE app_users SET email_verified_at = now(), updated_at = now()
          WHERE id = $1
          RETURNING id, email, display_name, role, status, permissions, email_verified_at
        `, [user.id]);
        const session = await client.query(`
          INSERT INTO app_sessions (token_hash, user_id, expires_at)
          VALUES ($1, $2, now() + ($3::int * interval '1 hour'))
          RETURNING expires_at
        `, [tokenHash, user.id, sessionTtlHours]);
        return { user: verified.rows[0], expiresAt: session.rows[0].expires_at };
      });

      if (!result) return invalidCode(res);
      return res.status(200).json({
        accessToken,
        tokenType: 'Bearer',
        expiresAt: result.expiresAt,
        user: publicUser(result.user),
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/request-password-reset', limitResetRequest, async (req, res, next) => {
    if (!challengeServiceAvailable(res, challengeSecret, emailSender)) return;
    const email = normalizeEmail(req.body?.email);
    if (!isValidEmail(email)) {
      return accepted(res, 'Si la cuenta existe, recibirás un código para restablecer la contraseña.');
    }

    try {
      const result = await withTransaction(pool, async (client) => {
        const user = (await client.query(`
          SELECT id, email FROM app_users
          WHERE email_normalized = $1 AND status = 'active' AND email_verified_at IS NOT NULL
          FOR UPDATE
        `, [email])).rows[0];
        if (!user) return null;
        const challenge = await issueChallenge(client, {
          userId: user.id,
          purpose: 'password_reset',
          secret: challengeSecret,
        });
        return challenge.code ? { email: user.email, code: challenge.code } : null;
      });

      if (result) {
        try {
          await emailSender.sendCode({ to: result.email, code: result.code, purpose: 'password_reset' });
        } catch {
          console.error('Shopp no pudo enviar un correo de recuperación.');
        }
      }
      return accepted(res, 'Si la cuenta existe, recibirás un código para restablecer la contraseña.');
    } catch (error) {
      return next(error);
    }
  });

  router.post('/reset-password', limitResetConfirm, async (req, res, next) => {
    if (!challengeServiceAvailable(res, challengeSecret, emailSender)) return;
    const email = normalizeEmail(req.body?.email);
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
    const newPassword = req.body?.newPassword;
    if (!isValidEmail(email) || !new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code)) return invalidCode(res);

    try {
      assertPasswordPolicy(newPassword);
    } catch (error) {
      return res.status(400).json({ error: { code: 'invalid_password', message: error.message } });
    }

    try {
      const reset = await withTransaction(pool, async (client) => {
        const user = (await client.query(`
          SELECT id FROM app_users
          WHERE email_normalized = $1 AND status = 'active' AND email_verified_at IS NOT NULL
          FOR UPDATE
        `, [email])).rows[0];
        if (!user) return false;
        const valid = await consumeChallenge(client, {
          userId: user.id,
          purpose: 'password_reset',
          code,
          secret: challengeSecret,
        });
        if (!valid) return false;

        const newPasswordHash = await hashPassword(newPassword);
        await client.query(`
          UPDATE app_users SET password_hash = $2, updated_at = now() WHERE id = $1
        `, [user.id, newPasswordHash]);
        await client.query(`
          UPDATE app_sessions SET revoked_at = now()
          WHERE user_id = $1 AND revoked_at IS NULL
        `, [user.id]);
        return true;
      });

      if (!reset) return invalidCode(res);
      return res.status(200).json({ ok: true, message: 'La contraseña se ha actualizado.' });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/login', limitLogin, async (req, res, next) => {
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;
    if (!isValidEmail(email) || typeof password !== 'string' || password.length > 1024) {
      return res.status(401).json({ error: { code: 'invalid_credentials', message: 'Correo o contraseña incorrectos.' } });
    }

    try {
      const result = await pool.query(`
        SELECT id, email, display_name, password_hash, email_verified_at, role, status, permissions
        FROM app_users
        WHERE email_normalized = $1
        LIMIT 1
      `, [email]);
      const user = result.rows[0];
      if (!user || !user.password_hash || !(await verifyPassword(password, user.password_hash))) {
        return res.status(401).json({ error: { code: 'invalid_credentials', message: 'Correo o contraseña incorrectos.' } });
      }
      if (user.status !== 'active') {
        return res.status(403).json({ error: { code: 'account_blocked', message: 'La cuenta no está activa.' } });
      }
      if (!user.email_verified_at) {
        return res.status(403).json({ error: { code: 'email_not_verified', message: 'El correo electrónico no está verificado.' } });
      }

      const accessToken = createSessionToken();
      const tokenHash = hashSessionToken(accessToken);
      const session = await pool.query(`
        INSERT INTO app_sessions (token_hash, user_id, expires_at)
        VALUES ($1, $2, now() + ($3::int * interval '1 hour'))
        RETURNING expires_at
      `, [tokenHash, user.id, sessionTtlHours]);

      return res.status(200).json({
        accessToken,
        tokenType: 'Bearer',
        expiresAt: session.rows[0].expires_at,
        user: publicUser(user),
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/me', sessionMiddleware, requireAuth, (req, res) => {
    res.status(200).json({ user: req.auth.user });
  });

  router.post('/logout', sessionMiddleware, requireAuth, async (req, res, next) => {
    try {
      await pool.query(
        'UPDATE app_sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL',
        [req.auth.sessionTokenHash],
      );
      return res.status(204).end();
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
