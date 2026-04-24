ALTER TABLE "impressions" ADD COLUMN "delivery_jti" varchar(36);--> statement-breakpoint
CREATE UNIQUE INDEX "impressions_delivery_jti_idx" ON "impressions" USING btree ("delivery_jti");--> statement-breakpoint
CREATE INDEX "impressions_source_created_idx" ON "impressions" USING btree ("source","created_at");--> statement-breakpoint
CREATE INDEX "clicks_created_idx" ON "clicks" USING btree ("created_at");