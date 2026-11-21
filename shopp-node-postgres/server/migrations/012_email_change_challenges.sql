ALTER TABLE auth_challenges DROP CONSTRAINT IF EXISTS auth_challenges_purpose_check;
ALTER TABLE auth_challenges
  ADD CONSTRAINT auth_challenges_purpose_check
  CHECK (purpose IN ('verify_email', 'reset_password', 'change_email'));

ALTER TABLE auth_challenges ADD COLUMN target_email TEXT;
ALTER TABLE auth_challenges
  ADD CONSTRAINT auth_challenges_target_email_check
  CHECK ((purpose = 'change_email' AND target_email IS NOT NULL)
      OR (purpose <> 'change_email' AND target_email IS NULL));
