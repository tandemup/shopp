CREATE TABLE chat_rooms (
  id VARCHAR(50) PRIMARY KEY CHECK (id ~ '^[a-z0-9_-]{1,50}$'),
  label VARCHAR(60) NOT NULL CHECK (length(trim(label)) BETWEEN 1 AND 60),
  builtin BOOLEAN NOT NULL DEFAULT FALSE,
  created_by TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO chat_rooms (id, label, builtin) VALUES
  ('compras', 'Compras', TRUE),
  ('musica', 'Música', TRUE),
  ('youtube', 'YouTube', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Preserva salas que ya tengan mensajes aunque se crearan antes del catálogo compartido.
INSERT INTO chat_rooms (id, label, builtin)
SELECT DISTINCT m.room,
       COALESCE(NULLIF(initcap(replace(regexp_replace(m.room, '^custom-', ''), '-', ' ')), ''), m.room),
       FALSE
FROM chat_messages m
WHERE NOT EXISTS (SELECT 1 FROM chat_rooms r WHERE r.id = m.room)
ON CONFLICT (id) DO NOTHING;
