ALTER TABLE app_users ADD COLUMN public_alias TEXT;

UPDATE app_users SET public_alias = name WHERE public_alias IS NULL;

ALTER TABLE app_users ALTER COLUMN public_alias SET NOT NULL;
ALTER TABLE app_users ALTER COLUMN public_alias SET DEFAULT '';
