import { createHmac, createHash, randomBytes, randomInt, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { config } from './config.js';

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
export const createOtp = () => String(randomInt(0, 100_000_000)).padStart(8, '0');
export const createSessionToken = () => randomBytes(32).toString('base64url');
export const digestToken = (value) => createHash('sha256').update(value).digest('hex');
export const digestOtp = (purpose, userId, code) => createHmac('sha256', config.challengeSecret)
  .update(`${purpose}\0${userId}\0${code}`).digest('hex');

export function safeEqualHex(left, right) {
  if (!/^[a-f0-9]{64}$/i.test(left || '') || !/^[a-f0-9]{64}$/i.test(right || '')) return false;
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) return 'La contraseña debe tener entre 8 y 128 caracteres';
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) return 'La contraseña debe incluir mayúsculas, minúsculas y números';
  return null;
}

export function validateEmail(email) {
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Correo electrónico no válido';
  return null;
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
  return `scrypt$${SCRYPT_OPTIONS.N}$${SCRYPT_OPTIONS.r}$${SCRYPT_OPTIONS.p}$${salt.toString('base64url')}$${Buffer.from(derived).toString('base64url')}`;
}

export async function verifyPassword(password, storedHash) {
  const [algorithm, n, r, p, saltText, hashText] = String(storedHash || '').split('$');
  if (algorithm !== 'scrypt' || !n || !r || !p || !saltText || !hashText) return false;
  try {
    const expected = Buffer.from(hashText, 'base64url');
    const derived = Buffer.from(await scrypt(password, Buffer.from(saltText, 'base64url'), expected.length, {
      N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024,
    }));
    return expected.length === derived.length && timingSafeEqual(expected, derived);
  } catch { return false; }
}
