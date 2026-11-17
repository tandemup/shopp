CREATE TABLE store_offer_submissions (
  id TEXT PRIMARY KEY,
  submitted_by TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  submission_type TEXT NOT NULL CHECK (submission_type IN ('shopper','owner')),
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  barcode TEXT,
  offer_text TEXT NOT NULL,
  starts_at_ms BIGINT,
  ends_at_ms BIGINT,
  contact_name TEXT,
  contact_email TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at_ms BIGINT NOT NULL,
  updated_at_ms BIGINT NOT NULL
);
CREATE INDEX store_offer_status_created_idx ON store_offer_submissions (status, created_at_ms DESC);
CREATE INDEX store_offer_store_status_idx ON store_offer_submissions (store_id, status);
