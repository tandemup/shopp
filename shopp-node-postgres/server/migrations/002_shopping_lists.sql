CREATE TABLE shopping_lists (
  owner_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  list_id TEXT NOT NULL,
  name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at_ms BIGINT,
  store_id TEXT,
  created_at_ms BIGINT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (owner_id, list_id)
);
CREATE INDEX shopping_lists_owner_order_idx ON shopping_lists (owner_id, archived, created_at_ms DESC);

CREATE TABLE shopping_list_items (
  owner_id TEXT NOT NULL,
  list_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  name TEXT NOT NULL,
  checked BOOLEAN NOT NULL DEFAULT FALSE,
  position INTEGER NOT NULL DEFAULT 0,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (owner_id, list_id, item_id),
  CONSTRAINT shopping_list_items_list_fk
    FOREIGN KEY (owner_id, list_id) REFERENCES shopping_lists(owner_id, list_id) ON DELETE CASCADE
);
CREATE INDEX shopping_list_items_order_idx ON shopping_list_items (owner_id, list_id, position, created_at);
