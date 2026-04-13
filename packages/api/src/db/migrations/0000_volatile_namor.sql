-- updated_at trigger function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TYPE "public"."ad_format" AS ENUM('text', 'banner', 'sponsored-link');--> statement-breakpoint
CREATE TYPE "public"."ad_source" AS ENUM('direct', 'carbon', 'ethicalads', 'google', 'amazon', 'x402');--> statement-breakpoint
CREATE TYPE "public"."ad_surface" AS ENUM('terminal-tv', 'companion-tab', 'idle-dashboard', 'digest', 'challenge', 'audio');--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('draft', 'active', 'paused', 'completed');--> statement-breakpoint
CREATE TYPE "public"."earning_status" AS ENUM('pending', 'confirmed');--> statement-breakpoint
CREATE TYPE "public"."impression_result" AS ENUM('completed', 'skipped', 'expired', 'interrupted');--> statement-breakpoint
CREATE TYPE "public"."pacing_strategy" AS ENUM('even', 'front_loaded', 'asap');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('pending', 'processing', 'confirmed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."referral_status" AS ENUM('pending', 'activated', 'paid');--> statement-breakpoint
CREATE TABLE "advertisers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"contact_email" varchar(255) NOT NULL,
	"company_name" varchar(255),
	"billing_info" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "advertisers_contact_email_unique" UNIQUE("contact_email")
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"advertiser_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"budget_total" numeric(12, 6) NOT NULL,
	"budget_daily" numeric(12, 6) NOT NULL,
	"budget_spent" numeric(12, 6) DEFAULT '0' NOT NULL,
	"cpm_rate" numeric(12, 6) NOT NULL,
	"target_categories" text[] DEFAULT '{}' NOT NULL,
	"target_surfaces" text[] DEFAULT '{}' NOT NULL,
	"targeting_rules" jsonb,
	"pacing_strategy" "pacing_strategy" DEFAULT 'even' NOT NULL,
	"status" "campaign_status" DEFAULT 'draft' NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clicks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"impression_id" uuid NOT NULL,
	"creative_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clicks_impression_id_unique" UNIQUE("impression_id")
);
--> statement-breakpoint
CREATE TABLE "creatives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"headline" varchar(60) NOT NULL,
	"body" varchar(140),
	"cta_text" varchar(30),
	"cta_url" varchar(2048),
	"format" "ad_format" DEFAULT 'text' NOT NULL,
	"surface" "ad_surface" DEFAULT 'terminal-tv' NOT NULL,
	"category" varchar(50) NOT NULL,
	"source" "ad_source" NOT NULL,
	"cpm_rate" numeric(12, 6) NOT NULL,
	"external_campaign_id" varchar(255),
	"external_creative_id" varchar(255),
	"impression_beacon_url" varchar(2048),
	"click_tracking_url" varchar(2048),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"machine_id_hash" varchar(64) NOT NULL,
	"device_name" varchar(255),
	"os" varchar(50) NOT NULL,
	"ide_type" varchar(20) NOT NULL,
	"last_heartbeat" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "earnings_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"impression_id" uuid NOT NULL,
	"amount_usdc" numeric(12, 6) NOT NULL,
	"surface" varchar(30) NOT NULL,
	"ad_category" varchar(50) NOT NULL,
	"status" "earning_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "impressions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creative_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"source" "ad_source" NOT NULL,
	"surface" "ad_surface" NOT NULL,
	"duration_ms" integer NOT NULL,
	"result" "impression_result" NOT NULL,
	"cpm_rate" numeric(12, 6) NOT NULL,
	"earned_amount" numeric(12, 6) NOT NULL,
	"clicked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invite_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(20) NOT NULL,
	"used_by" uuid,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invite_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount_usdc" numeric(12, 6) NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"tx_hash" varchar(66),
	"status" "payout_status" DEFAULT 'pending' NOT NULL,
	"failure_reason" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payouts_tx_hash_unique" UNIQUE("tx_hash")
);
--> statement-breakpoint
CREATE TABLE "preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"blocked_categories" text[] DEFAULT '{}' NOT NULL,
	"enabled_surfaces" text[] DEFAULT '{}' NOT NULL,
	"max_per_hour" integer DEFAULT 8 NOT NULL,
	"max_per_day" integer DEFAULT 60 NOT NULL,
	"quiet_hours_start" integer,
	"quiet_hours_end" integer,
	"idle_sensitivity_ms" integer DEFAULT 10000 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referrer_id" uuid NOT NULL,
	"referee_id" uuid NOT NULL,
	"code" varchar(20) NOT NULL,
	"status" "referral_status" DEFAULT 'pending' NOT NULL,
	"bonus_paid" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referrals_referee_id_unique" UNIQUE("referee_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"github_id" integer,
	"github_login" varchar(255),
	"email" varchar(255) NOT NULL,
	"avatar_url" varchar(512),
	"wallet_address" varchar(42),
	"referral_code" varchar(20) NOT NULL,
	"tos_accepted_at" timestamp with time zone,
	"streak_days" integer DEFAULT 0 NOT NULL,
	"data_sharing_consent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_github_id_unique" UNIQUE("github_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_advertiser_id_advertisers_id_fk" FOREIGN KEY ("advertiser_id") REFERENCES "public"."advertisers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clicks" ADD CONSTRAINT "clicks_impression_id_impressions_id_fk" FOREIGN KEY ("impression_id") REFERENCES "public"."impressions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clicks" ADD CONSTRAINT "clicks_creative_id_creatives_id_fk" FOREIGN KEY ("creative_id") REFERENCES "public"."creatives"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creatives" ADD CONSTRAINT "creatives_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "earnings_ledger" ADD CONSTRAINT "earnings_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "earnings_ledger" ADD CONSTRAINT "earnings_ledger_impression_id_impressions_id_fk" FOREIGN KEY ("impression_id") REFERENCES "public"."impressions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impressions" ADD CONSTRAINT "impressions_creative_id_creatives_id_fk" FOREIGN KEY ("creative_id") REFERENCES "public"."creatives"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impressions" ADD CONSTRAINT "impressions_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impressions" ADD CONSTRAINT "impressions_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_used_by_users_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preferences" ADD CONSTRAINT "preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_users_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referee_id_users_id_fk" FOREIGN KEY ("referee_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaigns_status_starts_idx" ON "campaigns" USING btree ("status","starts_at");--> statement-breakpoint
CREATE INDEX "creatives_source_active_idx" ON "creatives" USING btree ("source","is_active");--> statement-breakpoint
CREATE INDEX "creatives_category_idx" ON "creatives" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "devices_user_machine_idx" ON "devices" USING btree ("user_id","machine_id_hash");--> statement-breakpoint
CREATE INDEX "earnings_user_created_idx" ON "earnings_ledger" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "impressions_device_created_idx" ON "impressions" USING btree ("device_id","created_at");--> statement-breakpoint
CREATE INDEX "payouts_user_idx" ON "payouts" USING btree ("user_id");--> statement-breakpoint
-- updated_at triggers for mutable tables
CREATE TRIGGER set_users_updated_at BEFORE UPDATE ON "users" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER set_advertisers_updated_at BEFORE UPDATE ON "advertisers" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER set_campaigns_updated_at BEFORE UPDATE ON "campaigns" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER set_creatives_updated_at BEFORE UPDATE ON "creatives" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER set_payouts_updated_at BEFORE UPDATE ON "payouts" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER set_preferences_updated_at BEFORE UPDATE ON "preferences" FOR EACH ROW EXECUTE FUNCTION set_updated_at();