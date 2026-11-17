CREATE TABLE stores (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL,
  provincia TEXT NOT NULL DEFAULT 'Asturias',
  zipcode TEXT NOT NULL DEFAULT '0',
  latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  location_source TEXT NOT NULL DEFAULT 'manual',
  created_at_ms BIGINT NOT NULL,
  updated_at_ms BIGINT NOT NULL
);
CREATE INDEX stores_city_name_idx ON stores (city, name);

CREATE TABLE user_store_favorites (
  owner_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  created_at_ms BIGINT NOT NULL,
  PRIMARY KEY (owner_id, store_id)
);
CREATE INDEX user_store_favorites_store_idx ON user_store_favorites (store_id);

CREATE TABLE store_requests (
  id TEXT PRIMARY KEY,
  submitted_by TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  provincia TEXT NOT NULL DEFAULT 'Asturias',
  zipcode TEXT,
  latitude DOUBLE PRECISION CHECK (latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION CHECK (longitude BETWEEN -180 AND 180),
  location_source TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  reviewed_at_ms BIGINT,
  rejection_reason TEXT,
  approved_store_id TEXT,
  created_at_ms BIGINT NOT NULL,
  updated_at_ms BIGINT NOT NULL,
  CHECK ((latitude IS NULL) = (longitude IS NULL))
);
CREATE INDEX store_requests_status_created_idx ON store_requests (status, created_at_ms DESC);
CREATE INDEX store_requests_submitter_created_idx ON store_requests (submitted_by, created_at_ms DESC);
