CREATE TABLE user_profiles (
  user_id TEXT PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  phone TEXT,
  phone_visible BOOLEAN NOT NULL DEFAULT FALSE,
  scan_history_sync_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at_ms BIGINT NOT NULL,
  updated_at_ms BIGINT NOT NULL
);

CREATE INDEX user_profiles_alias_idx ON user_profiles (lower(alias));
