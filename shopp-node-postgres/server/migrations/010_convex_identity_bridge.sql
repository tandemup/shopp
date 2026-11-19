ALTER TABLE app_users ADD COLUMN convex_user_id TEXT;
CREATE UNIQUE INDEX app_users_convex_user_id_unique
  ON app_users (convex_user_id)
  WHERE convex_user_id IS NOT NULL;
