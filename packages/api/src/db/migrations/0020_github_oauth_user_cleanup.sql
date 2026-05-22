-- 2026-05-22 github oauth cutover: drop magic-link surface + dead user columns.
-- pre-mvp, no real users — safe to truncate satellite tables before tightening
-- constraints.

BEGIN;

TRUNCATE TABLE devices, slot_impressions, reading_list_items, alert_events,
               alerts, channel_subscriptions, watchlist_tickers, watchlists,
               preferences, users CASCADE;

DROP TABLE IF EXISTS magic_link_tokens;

ALTER TABLE users
  DROP COLUMN IF EXISTS magic_link_last_sent_at,
  DROP COLUMN IF EXISTS referral_code,
  DROP COLUMN IF EXISTS streak_days,
  DROP COLUMN IF EXISTS tos_accepted_at,
  DROP COLUMN IF EXISTS data_sharing_consent;

ALTER TABLE users
  ALTER COLUMN github_id    SET NOT NULL,
  ALTER COLUMN github_login SET NOT NULL,
  ALTER COLUMN email        SET NOT NULL,
  ALTER COLUMN avatar_url   SET NOT NULL;

ALTER TABLE users
  ADD CONSTRAINT users_github_id_unique UNIQUE (github_id);

COMMIT;
