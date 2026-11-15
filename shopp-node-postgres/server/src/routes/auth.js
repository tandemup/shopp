import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { pool } from '../db.js';
import { config, authConfigurationError } from '../config.js';
import { sendAuthCode } from '../email.js';
import { requireAuth, publicUser } from '../middleware/auth.js';
import { authRateLimit } from '../middleware/rateLimit.js';
import {
  createOtp, createSessionToken, digestOtp, digestToken, hashPassword,
  normalizeEmail, safeEqualHex, validateEmail, validatePassword, verifyPassword,
} from '../security.js';

export const authRouter = Router();
const genericMessage = 'Si la solicitud puede completarse, recibirás un correo con instrucciones.';
authRouter.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
authRouter.use(authRateLimit());

function ensureAuthConfigured(res) {
  if (!authConfigurationError()) return false;
  res.status(503).json({ error: { code: 'auth_not_configured', message: 'La autenticación no está configurada en el servidor' } });
  return true;
}

function getEmailAndCode(body) {
  return {
    email: normalizeEmail(body?.email),
    code: typeof body?.code === 'string' ? body.code.trim() : '',
  };
}

async function createChallenge(client, userId, purpose) {
  const code = createOtp();
  await client.query(
    `UPDATE auth_challenges SET consumed_at = NOW()
     WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL`, [userId, purpose],
  );
  await client.query(
    `INSERT INTO auth_challenges (user_id, purpose, code_digest, expires_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '15 minutes')`,
    [userId, purpose, digestOtp(purpose, userId, code)],
  );
  return code;
}

async function issueSession(client, userId) {
  const token = createSessionToken();
  const { rows } = await client.query(
    `INSERT INTO auth_sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() + ($3 * INTERVAL '1 hour')) RETURNING expires_at`,
    [userId, digestToken(token), config.sessionTtlHours],
  );
  return { token, expiresAt: rows[0].expires_at };
}

async function consumeOtp(client, userId, purpose, code) {
  const { rows } = await client.query(
    `SELECT id, code_digest, attempts, expires_at FROM auth_challenges
     WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL
     ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, [userId, purpose],
  );
  const challenge = rows[0];
  if (!challenge || new Date(challenge.expires_at).getTime() <= Date.now() || challenge.attempts >= 5) return false;
  if (!safeEqualHex(challenge.code_digest, digestOtp(purpose, userId, code))) {
    await client.query(
      `UPDATE auth_challenges SET attempts = attempts + 1,
       consumed_at = CASE WHEN attempts + 1 >= 5 THEN NOW() ELSE consumed_at END WHERE id = $1`,
      [challenge.id],
    );
    return false;
  }
  await client.query('UPDATE auth_challenges SET consumed_at = NOW() WHERE id = $1', [challenge.id]);
  return true;
}

async function sendChallengeWithoutLeakingDetails(mail, label) {
  try { await sendAuthCode(mail); }
  catch (error) { console.error(`No se pudo enviar ${label}:`, error.message); }
}

authRouter.post('/register', async (req, res, next) => {
  if (ensureAuthConfigured(res)) return;
  const email = normalizeEmail(req.body?.email);
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const password = req.body?.password;
  const invalid = validateEmail(email) || validatePassword(password) || (!name || name.length > 120 ? 'El nombre es obligatorio y no puede superar 120 caracteres' : null);
  if (invalid) return res.status(400).json({ error: { code: 'invalid_input', message: invalid } });

  const client = await pool.connect();
  let mail;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT id, email_verified_at FROM app_users WHERE email = $1 FOR UPDATE', [email]);
    let user = rows[0];
    if (user?.email_verified_at) {
      await client.query('COMMIT');
      return res.status(202).json({ message: genericMessage });
    }
    if (!user) {
      const passwordHash = await hashPassword(password);
      const created = await client.query(
        'INSERT INTO app_users (id, email, name, password_hash) VALUES ($1, $2, $3, $4) RETURNING id',
        [`usr_${randomUUID()}`, email, name, passwordHash],
      );
      user = created.rows[0];
    }
    mail = { email, code: await createChallenge(client, user.id, 'verify_email'), purpose: 'verify_email' };
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.code === '23505') return res.status(202).json({ message: genericMessage });
    return next(error);
  } finally { client.release(); }
  await sendChallengeWithoutLeakingDetails(mail, 'el correo de verificación');
  res.status(202).json({ message: genericMessage });
});

authRouter.post('/verify-email', async (req, res, next) => {
  if (ensureAuthConfigured(res)) return;
  const { email, code } = getEmailAndCode(req.body);
  if (validateEmail(email) || !/^\d{8}$/.test(code)) {
    return res.status(400).json({ error: { code: 'invalid_code', message: 'Correo o código no válido' } });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM app_users WHERE email = $1 FOR UPDATE', [email]);
    const user = rows[0];
    if (!user || user.status === 'blocked' || !(await consumeOtp(client, user.id, 'verify_email', code))) {
      await client.query('COMMIT');
      return res.status(400).json({ error: { code: 'invalid_code', message: 'Correo o código no válido o caducado' } });
    }
    await client.query('UPDATE app_users SET email_verified_at = COALESCE(email_verified_at, NOW()), updated_at = NOW() WHERE id = $1', [user.id]);
    const session = await issueSession(client, user.id);
    await client.query('COMMIT');
    res.json({
      token: session.token,
      expiresAt: session.expiresAt,
      user: publicUser({ ...user, email_verified_at: new Date(), status: 'active' }),
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    next(error);
  } finally { client.release(); }
});

authRouter.post('/request-password-reset', async (req, res, next) => {
  if (ensureAuthConfigured(res)) return;
  const email = normalizeEmail(req.body?.email);
  if (validateEmail(email)) return res.status(202).json({ message: genericMessage });
  const client = await pool.connect();
  let mail;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT id FROM app_users WHERE email = $1 AND email_verified_at IS NOT NULL AND status = 'active' FOR UPDATE`, [email],
    );
    if (rows[0]) mail = { email, code: await createChallenge(client, rows[0].id, 'reset_password'), purpose: 'reset_password' };
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    return next(error);
  } finally { client.release(); }
  if (mail) await sendChallengeWithoutLeakingDetails(mail, 'el correo de recuperación');
  res.status(202).json({ message: genericMessage });
});

authRouter.post('/reset-password', async (req, res, next) => {
  if (ensureAuthConfigured(res)) return;
  const { email, code } = getEmailAndCode(req.body);
  const password = req.body?.password;
  const passwordError = validatePassword(password);
  if (validateEmail(email) || !/^\d{8}$/.test(code) || passwordError) {
    return res.status(400).json({ error: { code: 'invalid_input', message: passwordError || 'Correo o código no válido' } });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT id, status, email_verified_at FROM app_users WHERE email = $1 FOR UPDATE', [email]);
    const user = rows[0];
    if (!user || user.status !== 'active' || !user.email_verified_at || !(await consumeOtp(client, user.id, 'reset_password', code))) {
      await client.query('COMMIT');
      return res.status(400).json({ error: { code: 'invalid_code', message: 'Correo o código no válido o caducado' } });
    }
    const passwordHash = await hashPassword(password);
    await client.query('UPDATE app_users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, user.id]);
    await client.query('UPDATE auth_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [user.id]);
    await client.query('COMMIT');
    res.json({ message: 'La contraseña se ha actualizado. Inicia sesión con la nueva contraseña.' });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    next(error);
  } finally { client.release(); }
});

authRouter.post('/login', async (req, res, next) => {
  const email = normalizeEmail(req.body?.email);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (validateEmail(email) || !password || password.length > 128) {
    return res.status(400).json({ error: { code: 'invalid_input', message: 'Correo o contraseña no válidos' } });
  }
  try {
    const { rows } = await pool.query('SELECT * FROM app_users WHERE email = $1', [email]);
    const user = rows[0];
    const valid = user?.password_hash ? await verifyPassword(password, user.password_hash) : false;
    if (!user || !valid || !user.email_verified_at || user.status !== 'active') {
      return res.status(401).json({ error: { code: 'invalid_credentials', message: 'Correo o contraseña no válidos' } });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const session = await issueSession(client, user.id);
      await client.query('COMMIT');
      res.json({ token: session.token, expiresAt: session.expiresAt, user: publicUser(user) });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally { client.release(); }
  } catch (error) { next(error); }
});

authRouter.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.auth.user) }));
authRouter.post('/logout', requireAuth, async (req, res, next) => {
  try {
    await pool.query('UPDATE auth_sessions SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL', [req.auth.sessionId]);
    res.status(204).end();
  } catch (error) { next(error); }
});
