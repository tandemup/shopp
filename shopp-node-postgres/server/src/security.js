import {
  createHmac,
  createHash,
  randomBytes,
  randomInt,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { config } from "./config.js";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export const normalizeEmail = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();
export const createOtp = () =>
  String(randomInt(0, 100_000_000)).padStart(8, "0");
export const digestToken = (value) =>
  createHash("sha256").update(value).digest("hex");
export const digestOtp = (purpose, userId, code) =>
  createHmac("sha256", config.challengeSecret)
    .update(`${purpose}\0${userId}\0${code}`)
    .digest("hex");

const encodeBase64UrlJson = (value) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

/** Create a signed HS256 access JWT. The session remains database-backed so logout and password reset revoke it immediately. */
export function createSessionToken(userId, expiresAt) {
  if (Buffer.byteLength(config.jwtSecret, "utf8") < 32) {
    throw new Error("AUTH_JWT_SECRET debe tener al menos 32 bytes aleatorios");
  }
  const subject = String(userId || "");
  const expirationSeconds = Math.floor(new Date(expiresAt).getTime() / 1000);
  const issuedAt = Math.floor(Date.now() / 1000);
  if (
    !subject ||
    subject.length > 128 ||
    !Number.isFinite(expirationSeconds) ||
    expirationSeconds <= issuedAt
  ) {
    throw new Error("No se pueden emitir credenciales JWT con estos datos");
  }
  const header = encodeBase64UrlJson({ alg: "HS256", typ: "JWT" });
  const payload = encodeBase64UrlJson({
    iss: config.jwtIssuer,
    aud: config.jwtAudience,
    sub: subject,
    iat: issuedAt,
    exp: expirationSeconds,
    jti: randomUUID(),
  });
  const signingInput = `${header}.${payload}`;
  const signature = createHmac("sha256", config.jwtSecret)
    .update(signingInput)
    .digest("base64url");
  return `${signingInput}.${signature}`;
}

/** Verify the expected JWT format and claims. Returns claims or null; never accepts another signing algorithm. */
export function verifySessionToken(token) {
  if (typeof token !== "string" || token.length > 4096) return null;
  const parts = token.split(".");
  if (
    parts.length !== 3 ||
    parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))
  )
    return null;
  if (Buffer.byteLength(config.jwtSecret, "utf8") < 32) return null;

  const [headerPart, payloadPart, signaturePart] = parts;
  const signingInput = `${headerPart}.${payloadPart}`;
  const expected = createHmac("sha256", config.jwtSecret)
    .update(signingInput)
    .digest();
  let supplied;
  try {
    supplied = Buffer.from(signaturePart, "base64url");
  } catch {
    return null;
  }
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  )
    return null;

  let header;
  let claims;
  try {
    header = JSON.parse(Buffer.from(headerPart, "base64url").toString("utf8"));
    claims = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (header?.alg !== "HS256" || header?.typ !== "JWT") return null;
  if (claims?.iss !== config.jwtIssuer || claims?.aud !== config.jwtAudience)
    return null;
  if (typeof claims?.sub !== "string" || !claims.sub || claims.sub.length > 128)
    return null;
  if (!Number.isInteger(claims.iat) || claims.iat > now + 60) return null;
  if (
    !Number.isInteger(claims.exp) ||
    claims.exp <= now ||
    claims.exp <= claims.iat
  )
    return null;
  if (typeof claims.jti !== "string" || claims.jti.length > 64) return null;
  return claims;
}

export function safeEqualHex(left, right) {
  if (
    !/^[a-f0-9]{64}$/i.test(left || "") ||
    !/^[a-f0-9]{64}$/i.test(right || "")
  )
    return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

export function validatePassword(password) {
  if (
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 128
  )
    return "La contraseña debe tener entre 8 y 128 caracteres";
  if (
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/[0-9]/.test(password)
  )
    return "La contraseña debe incluir mayúsculas, minúsculas y números";
  return null;
}

export function validateEmail(email) {
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return "Correo electrónico no válido";
  return null;
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
  return `scrypt$${SCRYPT_OPTIONS.N}$${SCRYPT_OPTIONS.r}$${SCRYPT_OPTIONS.p}$${salt.toString("base64url")}$${Buffer.from(derived).toString("base64url")}`;
}

export async function verifyPassword(password, storedHash) {
  const [algorithm, n, r, p, saltText, hashText] = String(
    storedHash || "",
  ).split("$");
  if (algorithm !== "scrypt" || !n || !r || !p || !saltText || !hashText)
    return false;
  try {
    const expected = Buffer.from(hashText, "base64url");
    const derived = Buffer.from(
      await scrypt(
        password,
        Buffer.from(saltText, "base64url"),
        expected.length,
        {
          N: Number(n),
          r: Number(r),
          p: Number(p),
          maxmem: 64 * 1024 * 1024,
        },
      ),
    );
    return (
      expected.length === derived.length && timingSafeEqual(expected, derived)
    );
  } catch {
    return false;
  }
}
