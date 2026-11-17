CREATE TABLE realtime_tickets (
  token_hash CHAR(64) PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES auth_sessions(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX realtime_tickets_expiry_idx ON realtime_tickets (expires_at);
