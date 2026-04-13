-- down migration: reverse FK order
DROP TRIGGER IF EXISTS set_preferences_updated_at ON "preferences";
DROP TRIGGER IF EXISTS set_payouts_updated_at ON "payouts";
DROP TRIGGER IF EXISTS set_creatives_updated_at ON "creatives";
DROP TRIGGER IF EXISTS set_campaigns_updated_at ON "campaigns";
DROP TRIGGER IF EXISTS set_advertisers_updated_at ON "advertisers";
DROP TRIGGER IF EXISTS set_users_updated_at ON "users";

DROP TABLE IF EXISTS "invite_codes" CASCADE;
DROP TABLE IF EXISTS "referrals" CASCADE;
DROP TABLE IF EXISTS "preferences" CASCADE;
DROP TABLE IF EXISTS "payouts" CASCADE;
DROP TABLE IF EXISTS "earnings_ledger" CASCADE;
DROP TABLE IF EXISTS "clicks" CASCADE;
DROP TABLE IF EXISTS "impressions" CASCADE;
DROP TABLE IF EXISTS "creatives" CASCADE;
DROP TABLE IF EXISTS "devices" CASCADE;
DROP TABLE IF EXISTS "campaigns" CASCADE;
DROP TABLE IF EXISTS "advertisers" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;

DROP TYPE IF EXISTS "public"."referral_status";
DROP TYPE IF EXISTS "public"."payout_status";
DROP TYPE IF EXISTS "public"."pacing_strategy";
DROP TYPE IF EXISTS "public"."impression_result";
DROP TYPE IF EXISTS "public"."earning_status";
DROP TYPE IF EXISTS "public"."campaign_status";
DROP TYPE IF EXISTS "public"."ad_surface";
DROP TYPE IF EXISTS "public"."ad_source";
DROP TYPE IF EXISTS "public"."ad_format";

DROP FUNCTION IF EXISTS set_updated_at();
