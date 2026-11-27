CREATE TABLE user_profile_avatars (
  user_id TEXT PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  jpeg BYTEA NOT NULL CHECK (octet_length(jpeg) BETWEEN 1 AND 262144),
  size SMALLINT NOT NULL CHECK (size BETWEEN 1 AND 256)
);
