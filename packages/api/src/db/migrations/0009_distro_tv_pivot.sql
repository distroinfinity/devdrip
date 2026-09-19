-- distro tv pivot: drop dead ad/payout tables, rename news_impressions → slot_impressions,
-- clean up users columns (world/wallet/privy), add magic_link_last_sent_at,
-- and clean up agent-treasury tables that were never in our drizzle snapshots.
-- Uses IF EXISTS throughout for safe re-runs against environments with partial schema state.

--> statement-breakpoint
DROP TABLE IF EXISTS "clicks" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "earnings_ledger" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "impressions" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "creatives" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "campaigns" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "advertisers" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "payouts" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "referrals" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "invite_codes" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "nullifiers" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "refresh_tokens" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "cli_pair_sessions" CASCADE;
--> statement-breakpoint
-- agent-treasury tables not tracked in drizzle snapshots but present in DB from prior branch migrations
DROP TABLE IF EXISTS "vault_fills" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "vault_rules" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "keeperhub_links" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "wallet_connections" CASCADE;
--> statement-breakpoint
-- rename news_impressions → slot_impressions (RENAME preserves rows + indexes)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='news_impressions') THEN
    ALTER TABLE "news_impressions" RENAME TO "slot_impressions";
  END IF;
END $$;
--> statement-breakpoint
-- slot_impressions ALTER block — wrapped in EXISTS guard for partial-state safety:
-- environments where neither news_impressions nor slot_impressions exist skip this block.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='slot_impressions') THEN
    -- drop old FK constraints before renaming/recreating them
    ALTER TABLE "slot_impressions" DROP CONSTRAINT IF EXISTS "news_impressions_user_id_users_id_fk";
    ALTER TABLE "slot_impressions" DROP CONSTRAINT IF EXISTS "news_impressions_device_id_devices_id_fk";
    DROP INDEX IF EXISTS "news_impressions_user_id_idx";
    DROP INDEX IF EXISTS "news_impressions_user_created_at_idx";
    -- add kind column (idempotent via IF NOT EXISTS)
    ALTER TABLE "slot_impressions" ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'news' NOT NULL;
    -- recreate FKs with new names (idempotent via EXCEPTION handler)
    BEGIN
      ALTER TABLE "slot_impressions" ADD CONSTRAINT "slot_impressions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TABLE "slot_impressions" ADD CONSTRAINT "slot_impressions_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    CREATE INDEX IF NOT EXISTS "slot_impressions_user_id_idx" ON "slot_impressions" USING btree ("user_id");
    CREATE INDEX IF NOT EXISTS "slot_impressions_user_created_at_idx" ON "slot_impressions" USING btree ("user_id","created_at");
  END IF;
END $$;
--> statement-breakpoint
-- users: drop world/wallet/nullifier columns (IF EXISTS for partial-migration safety)
ALTER TABLE "users" DROP COLUMN IF EXISTS "wallet_address";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "nullifier_hash";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "verification_level";
--> statement-breakpoint
-- users: drop privy_user_id leftover from older branch migrations
ALTER TABLE "users" DROP COLUMN IF EXISTS "privy_user_id";
--> statement-breakpoint
-- users: add magic_link_last_sent_at for M2 magic-link throttle (nullable)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "magic_link_last_sent_at" timestamp with time zone;
--> statement-breakpoint
DROP TYPE IF EXISTS "public"."ad_category";
--> statement-breakpoint
DROP TYPE IF EXISTS "public"."ad_format";
--> statement-breakpoint
DROP TYPE IF EXISTS "public"."ad_source";
--> statement-breakpoint
DROP TYPE IF EXISTS "public"."ad_surface";
--> statement-breakpoint
DROP TYPE IF EXISTS "public"."campaign_status";
--> statement-breakpoint
DROP TYPE IF EXISTS "public"."earning_status";
--> statement-breakpoint
DROP TYPE IF EXISTS "public"."impression_result";
--> statement-breakpoint
DROP TYPE IF EXISTS "public"."pacing_strategy";
--> statement-breakpoint
DROP TYPE IF EXISTS "public"."payout_status";
--> statement-breakpoint
DROP TYPE IF EXISTS "public"."referral_status";
