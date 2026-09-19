-- 2026-05-22 github oauth cutover: drop magic-link surface + dead user columns.
-- pre-mvp, no real users — safe to truncate satellite tables before tightening
-- constraints. drizzle-kit wraps the migration in its own transaction, so no
-- explicit BEGIN/COMMIT here.

TRUNCATE TABLE devices, slot_impressions, reading_list_items, alert_events,
               alerts, channel_subscriptions, watchlist_tickers, watchlists,
               preferences, users CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS magic_link_tokens;
--> statement-breakpoint
ALTER TABLE users
  DROP COLUMN IF EXISTS magic_link_last_sent_at,
  DROP COLUMN IF EXISTS referral_code,
  DROP COLUMN IF EXISTS streak_days,
  DROP COLUMN IF EXISTS tos_accepted_at,
  DROP COLUMN IF EXISTS data_sharing_consent;
--> statement-breakpoint
ALTER TABLE users
  ALTER COLUMN github_id    SET NOT NULL,
  ALTER COLUMN github_login SET NOT NULL,
  ALTER COLUMN email        SET NOT NULL,
  ALTER COLUMN avatar_url   SET NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_github_id_unique' AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_github_id_unique UNIQUE (github_id);
  END IF;
END $$;
