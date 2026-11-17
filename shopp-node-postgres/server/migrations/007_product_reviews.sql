CREATE TABLE product_review_submissions (
  id TEXT PRIMARY KEY,
  barcode TEXT NOT NULL CHECK (barcode ~ '^[0-9]{8,14}$'),
  submitted_by TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  submitter_email TEXT,
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT,
  product_type TEXT,
  subcategory TEXT,
  image_url TEXT,
  thumbnail_uri TEXT,
  product_url TEXT,
  details JSONB,
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'user_review' CHECK (source IN ('user_review','manual','scanner','internet')),
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','approved','rejected')),
  review_note TEXT,
  reviewed_by TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  reviewed_at_ms BIGINT,
  created_at_ms BIGINT NOT NULL,
  updated_at_ms BIGINT NOT NULL
);
CREATE INDEX product_review_status_created_idx ON product_review_submissions (status, created_at_ms DESC);
CREATE INDEX product_review_barcode_status_idx ON product_review_submissions (barcode, status);
CREATE UNIQUE INDEX product_review_one_pending_per_submitter_idx
  ON product_review_submissions (submitted_by, barcode) WHERE status='pending_review';
