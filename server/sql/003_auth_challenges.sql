CREATE TABLE IF NOT EXISTS app_auth_challenges (
  id bigserial PRIMARY KEY,
  user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('verify_email', 'password_reset')),
  token_hash char(64) NOT NULL,
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS app_auth_challenges_one_active_idx
  ON app_auth_challenges (user_id, purpose)
  WHERE consumed_at IS NULL;

CREATE INDEX IF NOT EXISTS app_auth_challenges_expiry_idx
  ON app_auth_challenges (expires_at);
