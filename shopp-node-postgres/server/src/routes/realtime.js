import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { digestToken } from '../security.js';

export const realtimeRouter = Router();

realtimeRouter.post('/ticket', requireAuth, async (req, res, next) => {
  try {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 60_000);
    await pool.query(
      `INSERT INTO realtime_tickets (token_hash, session_id, expires_at)
       VALUES ($1, $2, $3)`,
      [digestToken(token), req.auth.sessionId, expiresAt],
    );
    res.status(201).json({ ticket: token, expiresAt: expiresAt.toISOString(), path: '/ws' });
  } catch (error) { next(error); }
});
