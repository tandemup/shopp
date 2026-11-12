CREATE TABLE IF NOT EXISTS app_users (
  id text PRIMARY KEY,
  convex_user_id text UNIQUE,
  email text NOT NULL,
  email_normalized text NOT NULL UNIQUE,
  display_name text,
  password_hash text,
  email_verified_at timestamptz,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'tester', 'admin')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(permissions) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_sessions (
  token_hash char(64) PRIMARY KEY,
  user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_sessions_user_active_idx
  ON app_sessions (user_id, expires_at)
  WHERE revoked_at IS NULL;
