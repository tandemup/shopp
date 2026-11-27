import { Router, text } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const MAX_AVATAR_BYTES = 256 * 1024;
const JPEG_FRAMES = new Set([0xc0, 0xc1, 0xc2]);

function squareJpegSize(data) {
  if (data.length < 4 || data.readUInt16BE(0) !== 0xffd8 || data.readUInt16BE(data.length - 2) !== 0xffd9) return 0;

  let offset = 2;
  while (offset + 4 <= data.length) {
    if (data[offset++] !== 0xff) return 0;
    while (data[offset] === 0xff) offset++;
    const marker = data[offset++];
    if (marker === 0xda || marker === 0xd9 || offset + 2 > data.length) return 0;
    const length = data.readUInt16BE(offset);
    if (length < 2 || offset + length > data.length) return 0;
    if (JPEG_FRAMES.has(marker)) {
      if (length < 8) return 0;
      const height = data.readUInt16BE(offset + 3);
      const width = data.readUInt16BE(offset + 5);
      return width === height && width <= 256 ? width : 0;
    }
    offset += length;
  }
  return 0;
}

export const profileAvatarRouter = Router();
profileAvatarRouter.use(requireAuth);

profileAvatarRouter.get('/', async (req, res) => {
  const { rows: [avatar] } = await pool.query(
    'SELECT jpeg, size FROM user_profile_avatars WHERE user_id = $1',
    [req.auth.user.id],
  );
  res.json({ avatar: avatar ? { base64: Buffer.from(avatar.jpeg).toString('base64'), size: avatar.size } : null });
});

profileAvatarRouter.put('/', text({ type: 'text/plain', limit: 350 * 1024 }), async (req, res) => {
  const base64 = req.body;
  const validEncoding = typeof base64 === 'string' && base64.length > 0 &&
    base64.length <= 4 * Math.ceil(MAX_AVATAR_BYTES / 3) &&
    base64.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(base64);
  const jpeg = validEncoding ? Buffer.from(base64, 'base64') : null;
  const size = jpeg && jpeg.length <= MAX_AVATAR_BYTES && squareJpegSize(jpeg);

  if (!size) {
    return res.status(400).json({ error: { code: 'invalid_avatar', message: 'Usa una imagen JPEG cuadrada de hasta 256 × 256 px.' } });
  }
  await pool.query(
    `INSERT INTO user_profile_avatars (user_id, jpeg, size) VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET jpeg = EXCLUDED.jpeg, size = EXCLUDED.size`,
    [req.auth.user.id, jpeg, size],
  );
  res.json({ avatar: { base64, size } });
});

profileAvatarRouter.delete('/', async (req, res) => {
  await pool.query('DELETE FROM user_profile_avatars WHERE user_id = $1', [req.auth.user.id]);
  res.status(204).end();
});

profileAvatarRouter.use((error, _req, res, next) => {
  if (error.type !== 'entity.too.large') return next(error);
  return res.status(413).json({ error: { code: 'avatar_too_large', message: 'La imagen supera el tamaño permitido.' } });
});
