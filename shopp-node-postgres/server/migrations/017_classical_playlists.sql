ALTER TABLE music_playlists
  ADD COLUMN collection_type TEXT NOT NULL DEFAULT 'playlist'
    CHECK (collection_type IN ('playlist', 'classical')),
  ADD COLUMN details JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(details) = 'object'),
  DROP CONSTRAINT music_playlists_pkey,
  ADD PRIMARY KEY (owner_id, collection_type, playlist_id);

DROP INDEX IF EXISTS music_playlists_owner_updated_idx;
CREATE INDEX music_playlists_owner_collection_updated_idx
  ON music_playlists (owner_id, collection_type, updated_at_ms DESC);

ALTER TABLE music_playlist_deletions
  ADD COLUMN collection_type TEXT NOT NULL DEFAULT 'playlist'
    CHECK (collection_type IN ('playlist', 'classical')),
  DROP CONSTRAINT music_playlist_deletions_pkey,
  ADD PRIMARY KEY (owner_id, collection_type, playlist_id);
