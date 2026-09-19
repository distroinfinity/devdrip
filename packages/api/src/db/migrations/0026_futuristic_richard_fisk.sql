CREATE TABLE "ad_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"brand" text NOT NULL,
	"line" text NOT NULL,
	"url" text NOT NULL,
	"bid_cpm" numeric(12, 6) NOT NULL,
	"status" text DEFAULT 'review' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ad_campaigns" ADD CONSTRAINT "ad_campaigns_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ad_campaigns_owner_idx" ON "ad_campaigns" USING btree ("owner_user_id","created_at");--> statement-breakpoint
CREATE INDEX "ad_campaigns_status_bid_idx" ON "ad_campaigns" USING btree ("status","bid_cpm");