-- The migration runner applies the copy and removal in one transaction.
LOCK TABLE music_playlists, music_playlist_deletions IN ACCESS EXCLUSIVE MODE;

CREATE TABLE classical_playlists (
  owner_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  playlist_id TEXT NOT NULL,
  collection_type TEXT NOT NULL DEFAULT 'classical' CHECK (collection_type = 'classical'),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  tracks JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(tracks) = 'array'),
  details JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
  created_at_ms BIGINT NOT NULL,
  updated_at_ms BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (owner_id, collection_type, playlist_id)
);

CREATE INDEX classical_playlists_owner_updated_idx
  ON classical_playlists (owner_id, updated_at_ms DESC);

CREATE TABLE classical_playlist_deletions (
  owner_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  playlist_id TEXT NOT NULL,
  collection_type TEXT NOT NULL DEFAULT 'classical' CHECK (collection_type = 'classical'),
  deleted_at_ms BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (owner_id, collection_type, playlist_id)
);

INSERT INTO classical_playlists (
  owner_id, playlist_id, collection_type, title, tracks, details,
  created_at_ms, updated_at_ms, created_at, updated_at
)
SELECT owner_id, playlist_id, collection_type, title, tracks, details,
       created_at_ms, updated_at_ms, created_at, updated_at
FROM music_playlists
WHERE collection_type = 'classical';

INSERT INTO classical_playlist_deletions (
  owner_id, playlist_id, collection_type, deleted_at_ms, created_at
)
SELECT owner_id, playlist_id, collection_type, deleted_at_ms, created_at
FROM music_playlist_deletions
WHERE collection_type = 'classical';

DELETE FROM music_playlists WHERE collection_type = 'classical';
DELETE FROM music_playlist_deletions WHERE collection_type = 'classical';

ALTER TABLE music_playlists
  ADD CONSTRAINT music_playlists_music_only CHECK (collection_type = 'playlist');

ALTER TABLE music_playlist_deletions
  ADD CONSTRAINT music_playlist_deletions_music_only CHECK (collection_type = 'playlist');
