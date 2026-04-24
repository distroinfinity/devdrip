ALTER TABLE "creatives" ADD COLUMN "viewability_beacon_url" varchar(2048);--> statement-breakpoint
ALTER TABLE "impressions" ADD COLUMN "delivery_jti" varchar(36);--> statement-breakpoint
CREATE UNIQUE INDEX "creatives_source_ext_id_uniq" ON "creatives" USING btree ("source","external_creative_id") WHERE "creatives"."external_creative_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "impressions_source_created_idx" ON "impressions" USING btree ("source","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "impressions_delivery_jti_idx" ON "impressions" USING btree ("delivery_jti");