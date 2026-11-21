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

async function createChallenge(client, userId, purpose, targetEmail = null) {
  const code = createOtp();
  await client.query(
    `UPDATE auth_challenges SET consumed_at = NOW()
     WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL`, [userId, purpose],
  );
  await client.query(
    `INSERT INTO auth_challenges (user_id, purpose, code_digest, expires_at, target_email)
     VALUES ($1, $2, $3, NOW() + INTERVAL '15 minutes', $4)`,
    [userId, purpose, digestOtp(purpose, userId, code), targetEmail],
  );
  return code;
}

async function issueSession(client, userId) {
  const expiresAt = new Date(Date.now() + config.sessionTtlHours * 60 * 60 * 1000);
  const token = createSessionToken(userId, expiresAt);
  const { rows } = await client.query(
    `INSERT INTO auth_sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3) RETURNING expires_at`,
    [userId, digestToken(token), expiresAt],
  );
  return { token, expiresAt: rows[0].expires_at };
}

async function rotateSession(client, sessionId, userId, currentToken) {
  const expiresAt = new Date(Date.now() + config.sessionTtlHours * 60 * 60 * 1000);
  const token = createSessionToken(userId, expiresAt);
  const { rows } = await client.query(
    `UPDATE auth_sessions SET token_hash = $1, expires_at = $2
     WHERE id = $3 AND user_id = $4 AND token_hash = $5
       AND revoked_at IS NULL AND expires_at > NOW()
     RETURNING expires_at`,
    [digestToken(token), expiresAt, sessionId, userId, digestToken(currentToken)],
  );
  if (!rows[0]) return null;
  return { token, expiresAt: rows[0].expires_at };
}

async function consumeOtp(client, userId, purpose, code, { targetEmail } = {}) {
  const { rows } = await client.query(
    `SELECT id, code_digest, attempts, expires_at FROM auth_challenges
     WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL
       AND ($3::text IS NULL OR target_email = $3)
     ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, [userId, purpose, targetEmail || null],
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
        'INSERT INTO app_users (id, email, name, public_alias, password_hash) VALUES ($1, $2, $3, $3, $4) RETURNING id',
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
  if (ensureAuthConfigured(res)) return;
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

authRouter.get('/me', requireAuth, (req, res) => res.json({
  user: publicUser(req.auth.user),
  expiresAt: new Date(req.auth.claims.exp * 1000),
}));
authRouter.patch('/me', requireAuth, async (req, res, next) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const alias = typeof req.body?.alias === 'string' ? req.body.alias.trim() : null;
  if (!name || name.length > 120) {
    return res.status(400).json({ error: { code: 'invalid_input', message: 'El nombre es obligatorio y no puede superar 120 caracteres' } });
  }
  if (alias !== null && (alias.length < 2 || alias.length > 40)) {
    return res.status(400).json({ error: { code: 'invalid_input', message: 'El alias público debe tener entre 2 y 40 caracteres' } });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE app_users SET name = $1, public_alias = COALESCE($2, public_alias, $1), updated_at = NOW()
       WHERE id = $3 AND status = 'active'
       RETURNING id, email, name, public_alias, role, status, permissions, email_verified_at`,
      [name, alias, req.auth.user.id],
    );
    if (!rows[0]) return res.status(401).json({ error: { code: 'unauthorized', message: 'La sesión no está activa' } });
    res.json({ user: publicUser(rows[0]) });
  } catch (error) { next(error); }
});
authRouter.post('/me/email-change/request', requireAuth, async (req, res, next) => {
  if (ensureAuthConfigured(res)) return;
  const targetEmail = normalizeEmail(req.body?.email);
  if (validateEmail(targetEmail)) return res.status(400).json({ error: { code: 'invalid_input', message: 'Correo electrónico no válido' } });
  if (targetEmail === req.auth.user.email) return res.status(409).json({ error: { code: 'email_unchanged', message: 'La nueva dirección coincide con la actual' } });

  const client = await pool.connect();
  let mail;
  try {
    await client.query('BEGIN');
    const duplicate = await client.query('SELECT 1 FROM app_users WHERE email = $1 AND id <> $2 LIMIT 1', [targetEmail, req.auth.user.id]);
    if (duplicate.rowCount) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: { code: 'email_in_use', message: 'Esa dirección ya está asociada a otra cuenta' } });
    }
    const code = await createChallenge(client, req.auth.user.id, 'change_email', targetEmail);
    await client.query('COMMIT');
    mail = { email: targetEmail, code, purpose: 'change_email' };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    return next(error);
  } finally { client.release(); }
  await sendChallengeWithoutLeakingDetails(mail, 'el correo de confirmación del cambio de dirección');
  res.status(202).json({ message: 'Si la solicitud puede completarse, recibirás un código en la nueva dirección.' });
});

authRouter.post('/me/email-change/confirm', requireAuth, async (req, res, next) => {
  if (ensureAuthConfigured(res)) return;
  const targetEmail = normalizeEmail(req.body?.email);
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
  if (validateEmail(targetEmail) || !/^\d{8}$/.test(code)) {
    return res.status(400).json({ error: { code: 'invalid_input', message: 'Correo o código no válidos' } });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: userRows } = await client.query('SELECT id, email, status FROM app_users WHERE id = $1 FOR UPDATE', [req.auth.user.id]);
    const user = userRows[0];
    if (!user || user.status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(401).json({ error: { code: 'unauthorized', message: 'La sesión no está activa' } });
    }
    if (targetEmail === user.email) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: { code: 'email_unchanged', message: 'La nueva dirección coincide con la actual' } });
    }
    const duplicate = await client.query('SELECT 1 FROM app_users WHERE email = $1 AND id <> $2 LIMIT 1', [targetEmail, user.id]);
    if (duplicate.rowCount) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: { code: 'email_in_use', message: 'Esa dirección ya está asociada a otra cuenta' } });
    }
    if (!(await consumeOtp(client, user.id, 'change_email', code, { targetEmail }))) {
      await client.query('COMMIT');
      return res.status(400).json({ error: { code: 'invalid_code', message: 'Correo o código no válido o caducado' } });
    }
    const { rows } = await client.query(
      `UPDATE app_users SET email = $1, email_verified_at = NOW(), updated_at = NOW()
       WHERE id = $2 RETURNING id, email, name, role, status, permissions, email_verified_at`,
      [targetEmail, user.id],
    );
    await client.query('UPDATE auth_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [user.id]);
    await client.query('COMMIT');
    res.json({ user: publicUser(rows[0]), message: 'Correo actualizado. Inicia sesión con la nueva dirección.' });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.code === '23505') return res.status(409).json({ error: { code: 'email_in_use', message: 'Esa dirección ya está asociada a otra cuenta' } });
    next(error);
  } finally { client.release(); }
});
authRouter.post('/refresh', requireAuth, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const session = await rotateSession(client, req.auth.sessionId, req.auth.user.id, req.auth.token);
    if (!session) {
      await client.query('ROLLBACK');
      return res.status(401).json({ error: { code: 'unauthorized', message: 'La sesión ha caducado o ya se ha renovado' } });
    }
    await client.query('COMMIT');
    res.json({ token: session.token, expiresAt: session.expiresAt, user: publicUser(req.auth.user) });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    next(error);
  } finally { client.release(); }
});
authRouter.post('/logout', requireAuth, async (req, res, next) => {
  try {
    await pool.query('UPDATE auth_sessions SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL', [req.auth.sessionId]);
    res.status(204).end();
  } catch (error) { next(error); }
});
