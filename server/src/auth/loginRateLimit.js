const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const MAX_KEYS = 5000;

/** Single-process guard for the initial one-instance server deployment. */
export function createLoginRateLimit({ now = Date.now } = {}) {
  const attempts = new Map();
  return (req, res, next) => {
    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    const currentTime = now();
    const entry = attempts.get(key);
    if (entry && currentTime - entry.startedAt < WINDOW_MS && entry.count >= MAX_ATTEMPTS) {
      res.set('Retry-After', String(Math.ceil((WINDOW_MS - (currentTime - entry.startedAt)) / 1000)));
      return res.status(429).json({ error: { code: 'rate_limited', message: 'Demasiados intentos. Espera antes de volver a intentarlo.' } });
    }

    if (!entry || currentTime - entry.startedAt >= WINDOW_MS) {
      attempts.set(key, { startedAt: currentTime, count: 1 });
    } else {
      entry.count += 1;
    }

    if (attempts.size > MAX_KEYS) {
      for (const [candidate, value] of attempts) {
        if (currentTime - value.startedAt >= WINDOW_MS) attempts.delete(candidate);
      }
      while (attempts.size > MAX_KEYS) attempts.delete(attempts.keys().next().value);
    }
    return next();
  };
}
