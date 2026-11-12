import { promisify } from 'node:util';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';

const scrypt = promisify(scryptCallback);
const COST = 32768;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const KEY_LENGTH = 64;
const MAX_MEMORY = 64 * 1024 * 1024;

export function assertPasswordPolicy(password) {
  if (
    typeof password !== 'string' ||
    password.length < 8 ||
    password.length > 1024 ||
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/\d/.test(password)
  ) {
    throw new Error('La contraseña debe tener al menos 8 caracteres, mayúsculas, minúsculas y números.');
  }
}

export async function hashPassword(password) {
  assertPasswordPolicy(password);
  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt, KEY_LENGTH, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLELIZATION,
    maxmem: MAX_MEMORY,
  });
  return [
    'scrypt', COST, BLOCK_SIZE, PARALLELIZATION,
    salt.toString('base64url'), Buffer.from(derivedKey).toString('base64url'),
  ].join('$');
}

export async function verifyPassword(password, encodedHash) {
  if (typeof password !== 'string' || typeof encodedHash !== 'string') return false;
  const [algorithm, costText, blockText, parallelText, saltText, keyText, extra] = encodedHash.split('$');
  if (extra !== undefined || algorithm !== 'scrypt') return false;

  const cost = Number(costText);
  const blockSize = Number(blockText);
  const parallelization = Number(parallelText);
  if (cost !== COST || blockSize !== BLOCK_SIZE || parallelization !== PARALLELIZATION) return false;

  try {
    const salt = Buffer.from(saltText, 'base64url');
    const expected = Buffer.from(keyText, 'base64url');
    if (salt.length !== 16 || expected.length !== KEY_LENGTH) return false;
    const actual = Buffer.from(await scrypt(password, salt, KEY_LENGTH, {
      N: COST,
      r: BLOCK_SIZE,
      p: PARALLELIZATION,
      maxmem: MAX_MEMORY,
    }));
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
