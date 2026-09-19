CREATE TABLE "ad_impressions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"delivery_id" uuid NOT NULL,
	"ad_id" text NOT NULL,
	"source" text NOT NULL,
	"advertiser" text NOT NULL,
	"headline" text NOT NULL,
	"target_url" text NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"result" text DEFAULT 'pending' NOT NULL,
	"clicked" boolean DEFAULT false NOT NULL,
	"clicked_at" timestamp with time zone,
	"cpm_rate" numeric(12, 6) NOT NULL,
	"earned_amount" numeric(12, 6) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "preferences" ADD COLUMN "enabled_feeds" text[] DEFAULT '{"ads"}' NOT NULL;--> statement-breakpoint
ALTER TABLE "ad_impressions" ADD CONSTRAINT "ad_impressions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_impressions" ADD CONSTRAINT "ad_impressions_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ad_impressions_delivery_uq" ON "ad_impressions" USING btree ("delivery_id");--> statement-breakpoint
CREATE INDEX "ad_impressions_user_created_idx" ON "ad_impressions" USING btree ("user_id","created_at");