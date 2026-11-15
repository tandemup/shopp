const buckets = new Map();
let operations = 0;

export function authRateLimit({ limit = 12, windowMs = 15 * 60 * 1000 } = {}) {
  return (req, res, next) => {
    const key = `${req.ip || req.socket.remoteAddress || 'unknown'}:${req.path}`;
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (++operations % 1000 === 0) {
      for (const [storedKey, storedBucket] of buckets) if (storedBucket.resetAt <= now) buckets.delete(storedKey);
    }
    res.setHeader('RateLimit-Limit', String(limit));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, limit - bucket.count)));
    if (bucket.count > limit) {
      res.setHeader('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
      return res.status(429).json({ error: { code: 'rate_limited', message: 'Demasiadas solicitudes. Inténtalo más tarde.' } });
    }
    next();
  };
}
