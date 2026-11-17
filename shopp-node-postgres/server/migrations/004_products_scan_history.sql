CREATE TABLE product_catalog (
  barcode TEXT PRIMARY KEY CHECK (barcode ~ '^[0-9]{8,14}$'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','complete','not_found')),
  source TEXT NOT NULL DEFAULT 'scanner' CHECK (source IN ('convex','internet','manual','scanner')),
  access_count INTEGER NOT NULL DEFAULT 1 CHECK (access_count >= 0),
  lookup_failure_count INTEGER NOT NULL DEFAULT 0 CHECK (lookup_failure_count >= 0),
  last_external_lookup_at_ms BIGINT,
  next_external_lookup_at_ms BIGINT,
  created_at_ms BIGINT NOT NULL,
  updated_at_ms BIGINT NOT NULL,
  last_accessed_at_ms BIGINT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX product_catalog_status_idx ON product_catalog (status);
CREATE INDEX product_catalog_last_accessed_idx ON product_catalog (last_accessed_at_ms DESC);

CREATE TABLE user_scan_history (
  owner_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  barcode TEXT NOT NULL,
  scanned_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  scan_count INTEGER NOT NULL DEFAULT 1 CHECK (scan_count > 0),
  created_at_ms BIGINT NOT NULL,
  updated_at_ms BIGINT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (owner_id, barcode)
);
CREATE INDEX user_scan_history_owner_updated_idx ON user_scan_history (owner_id, updated_at_ms DESC);
