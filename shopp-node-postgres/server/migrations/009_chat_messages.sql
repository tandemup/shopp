CREATE TABLE chat_messages (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  room TEXT NOT NULL CHECK (room ~ '^[a-z0-9_-]{1,50}$'),
  username VARCHAR(40) NOT NULL,
  text TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 2048),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'hidden', 'blocked'))
);

CREATE INDEX chat_messages_room_created_idx ON chat_messages (room, created_at DESC, id DESC);
CREATE INDEX chat_messages_expiry_idx ON chat_messages (expires_at) WHERE expires_at IS NOT NULL;
