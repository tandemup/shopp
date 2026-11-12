import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

const CODE_DIGITS = 8;
const CODE_TTL_MINUTES = 15;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_CODE_ATTEMPTS = 5;

function hashCode(secret, userId, purpose, code) {
  return createHmac('sha256', secret)
    .update(`${userId}:${purpose}:${code}`)
    .digest('hex');
}

function generateCode() {
  return String(randomInt(0, 10 ** CODE_DIGITS)).padStart(CODE_DIGITS, '0');
}

export async function issueChallenge(client, { userId, purpose, secret }) {
  await client.query('SELECT id FROM app_users WHERE id = $1 FOR UPDATE', [userId]);
  const active = await client.query(`
    SELECT id, created_at
    FROM app_auth_challenges
    WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL
    ORDER BY id DESC
    LIMIT 1
    FOR UPDATE
  `, [userId, purpose]);
  const current = active.rows[0];
  if (current && Date.now() - new Date(current.created_at).getTime() < RESEND_COOLDOWN_SECONDS * 1000) {
    return { code: null, coolingDown: true };
  }

  await client.query(`
    UPDATE app_auth_challenges
    SET consumed_at = now()
    WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL
  `, [userId, purpose]);

  const code = generateCode();
  await client.query(`
    INSERT INTO app_auth_challenges (user_id, purpose, token_hash, expires_at)
    VALUES ($1, $2, $3, now() + ($4::int * interval '1 minute'))
  `, [userId, purpose, hashCode(secret, userId, purpose, code), CODE_TTL_MINUTES]);
  return { code, coolingDown: false };
}

export async function consumeChallenge(client, { userId, purpose, code, secret }) {
  const result = await client.query(`
    SELECT id, token_hash, attempts
    FROM app_auth_challenges
    WHERE user_id = $1 AND purpose = $2
      AND consumed_at IS NULL AND expires_at > now()
    ORDER BY id DESC
    LIMIT 1
    FOR UPDATE
  `, [userId, purpose]);
  const challenge = result.rows[0];
  if (!challenge || challenge.attempts >= MAX_CODE_ATTEMPTS) return false;

  const expected = Buffer.from(challenge.token_hash.trim(), 'hex');
  const submitted = Buffer.from(hashCode(secret, userId, purpose, code), 'hex');
  if (expected.length !== submitted.length || !timingSafeEqual(expected, submitted)) {
    const attempts = challenge.attempts + 1;
    await client.query(`
      UPDATE app_auth_challenges
      SET attempts = $2, consumed_at = CASE WHEN $2 >= $3 THEN now() ELSE consumed_at END
      WHERE id = $1
    `, [challenge.id, attempts, MAX_CODE_ATTEMPTS]);
    return false;
  }

  await client.query('UPDATE app_auth_challenges SET consumed_at = now() WHERE id = $1', [challenge.id]);
  return true;
}
