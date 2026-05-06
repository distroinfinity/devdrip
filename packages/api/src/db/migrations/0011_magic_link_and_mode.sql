-- 0011 magic-link auth + mode enum value swap.
-- - magic_link_tokens table for pending sign-in tokens (15-min TTL via expires_at; consumed_at marks one-shot use)
-- - preferences.channel_mode value swap: 'earn'|'learn'|'both' → 'news'|'markets'|'mix'
-- All DDL guarded with IF EXISTS / IF NOT EXISTS for partial-state safety.

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "magic_link_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" text NOT NULL,
  "token_hash" text NOT NULL UNIQUE,
  "pairing_code" text,
  "expires_at" timestamp with time zone NOT NULL,
  "consumed_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magic_link_tokens_email_idx" ON "magic_link_tokens" ("email");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magic_link_tokens_expires_at_idx" ON "magic_link_tokens" ("expires_at");
--> statement-breakpoint
-- mode enum value swap (no real users; just remap any stale rows defensively)
UPDATE "preferences" SET "channel_mode" = 'news' WHERE "channel_mode" = 'learn';
--> statement-breakpoint
UPDATE "preferences" SET "channel_mode" = 'mix' WHERE "channel_mode" IN ('earn', 'both', 'trade');
--> statement-breakpoint
-- (mode column is text, not a postgres enum, so no DROP TYPE needed)
