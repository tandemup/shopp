INSERT INTO user_profiles (user_id, alias, phone, phone_visible, scan_history_sync_enabled, created_at_ms, updated_at_ms)
SELECT id, COALESCE(public_alias, name), NULL, FALSE, FALSE,
       (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
       (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
FROM app_users
ON CONFLICT (user_id) DO NOTHING;
