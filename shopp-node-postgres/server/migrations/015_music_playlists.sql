CREATE TABLE IF NOT EXISTS music_playlists (
  owner_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  playlist_id TEXT NOT NULL,
  title TEXT NOT NULL,
  tracks JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at_ms BIGINT NOT NULL,
  updated_at_ms BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (owner_id, playlist_id),
  CHECK (length(title) BETWEEN 1 AND 120),
  CHECK (jsonb_typeof(tracks) = 'array')
);

CREATE INDEX IF NOT EXISTS music_playlists_owner_updated_idx
  ON music_playlists (owner_id, updated_at_ms DESC);
