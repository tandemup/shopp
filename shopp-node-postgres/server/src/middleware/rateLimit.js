import { createHmac } from 'node:crypto';
import { pool } from '../db.js';
import { config } from '../config.js';

export function authRateLimit({ limit = 12, windowMs = 15 * 60 * 1000 } = {}) {
  return async (req, res, next) => {
    const address = req.ip || req.socket.remoteAddress || 'unknown';
    const bucketHash = createHmac('sha256', config.challengeSecret || 'shopp-rate-limit')
      .update(`${address}:${req.path}`).digest('hex');
    try {
      const { rows } = await pool.query(
        `INSERT INTO api_rate_limit_buckets
           (bucket_hash, window_started_at, window_expires_at, request_count)
         VALUES ($1, NOW(), NOW() + ($2 * INTERVAL '1 millisecond'), 1)
         ON CONFLICT (bucket_hash) DO UPDATE SET
           request_count = CASE
             WHEN api_rate_limit_buckets.window_expires_at <= NOW() THEN 1
             ELSE api_rate_limit_buckets.request_count + 1
           END,
           window_started_at = CASE
             WHEN api_rate_limit_buckets.window_expires_at <= NOW() THEN NOW()
             ELSE api_rate_limit_buckets.window_started_at
           END,
           window_expires_at = CASE
             WHEN api_rate_limit_buckets.window_expires_at <= NOW()
               THEN NOW() + ($2 * INTERVAL '1 millisecond')
             ELSE api_rate_limit_buckets.window_expires_at
           END,
           updated_at = NOW()
         RETURNING request_count, window_expires_at`,
        [bucketHash, windowMs],
      );
      const bucket = rows[0];
      const remaining = Math.max(0, limit - bucket.request_count);
      const retryAfter = Math.max(1, Math.ceil((new Date(bucket.window_expires_at).getTime() - Date.now()) / 1000));
      res.setHeader('RateLimit-Limit', String(limit));
      res.setHeader('RateLimit-Remaining', String(remaining));
      res.setHeader('RateLimit-Reset', String(retryAfter));
      if (bucket.request_count > limit) {
        res.setHeader('Retry-After', String(retryAfter));
        return res.status(429).json({ error: { code: 'rate_limited', message: 'Demasiadas solicitudes. Inténtalo más tarde.' } });
      }
      return next();
    } catch (error) {
      return next(error);
    }
  };
}
