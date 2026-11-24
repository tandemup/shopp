CREATE TABLE IF NOT EXISTS music_playlist_deletions (
  owner_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  playlist_id TEXT NOT NULL,
  deleted_at_ms BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (owner_id, playlist_id)
);
