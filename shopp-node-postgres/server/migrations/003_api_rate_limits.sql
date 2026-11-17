CREATE TABLE api_rate_limit_buckets (
  bucket_hash CHAR(64) PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL,
  window_expires_at TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL CHECK (request_count > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX api_rate_limit_buckets_expiry_idx ON api_rate_limit_buckets (window_expires_at);
