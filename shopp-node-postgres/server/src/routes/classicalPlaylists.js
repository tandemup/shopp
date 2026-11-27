import { requireFeature } from '../middleware/auth.js';
import { createPlaylistRouter } from './playlistCollection.js';

export const classicalPlaylistsRouter = createPlaylistRouter(
  'classical', requireFeature('classicalMusic', { defaultEnabled: true }),
);
