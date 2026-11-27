ALTER TABLE chat_messages DROP CONSTRAINT chat_messages_text_check;
ALTER TABLE chat_messages
  ADD CONSTRAINT chat_messages_text_length CHECK (length(text) <= 2048),
  ADD COLUMN details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN shared_playlist JSONB;

CREATE TABLE chat_attachments (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  message_id BIGINT REFERENCES chat_messages(id) ON DELETE CASCADE,
  mime_type TEXT NOT NULL,
  content BYTEA NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes BETWEEN 1 AND 10485760),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX chat_attachments_message_idx ON chat_attachments (message_id);
CREATE INDEX chat_attachments_pending_idx ON chat_attachments (user_id, created_at)
  WHERE message_id IS NULL;

INSERT INTO chat_rooms (id, label, builtin) VALUES
  ('noticias', 'Noticias', TRUE), ('informatica', 'Informática', TRUE)
ON CONFLICT (id) DO UPDATE SET builtin = TRUE;
