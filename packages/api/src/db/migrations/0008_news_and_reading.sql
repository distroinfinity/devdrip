CREATE TABLE "news_impressions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"news_id" text NOT NULL,
	"source" text NOT NULL,
	"duration_ms" integer NOT NULL,
	"result" text NOT NULL,
	"opened_url" boolean DEFAULT false NOT NULL,
	"saved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reading_list_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"news_id" text NOT NULL,
	"source" text NOT NULL,
	"headline" text NOT NULL,
	"url" text NOT NULL,
	"score" integer NOT NULL,
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "preferences" ADD COLUMN "channel_mode" text DEFAULT 'mix' NOT NULL;--> statement-breakpoint
ALTER TABLE "preferences" ADD COLUMN "news_topics" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "news_impressions" ADD CONSTRAINT "news_impressions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_impressions" ADD CONSTRAINT "news_impressions_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_list_items" ADD CONSTRAINT "reading_list_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "news_impressions_user_id_idx" ON "news_impressions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "news_impressions_user_created_at_idx" ON "news_impressions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "reading_user_saved_idx" ON "reading_list_items" USING btree ("user_id","saved_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reading_user_news_unique" ON "reading_list_items" USING btree ("user_id","news_id");