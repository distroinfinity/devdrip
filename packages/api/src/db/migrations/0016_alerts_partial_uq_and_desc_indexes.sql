DROP INDEX "alerts_user_symbol_uq";--> statement-breakpoint
DROP INDEX "alert_events_device_symbol_fired_idx";--> statement-breakpoint
DROP INDEX "alert_events_user_fired_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "alerts_user_global_uq" ON "alerts" USING btree ("user_id") WHERE "alerts"."symbol" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "alerts_user_symbol_uq" ON "alerts" USING btree ("user_id","symbol") WHERE "alerts"."symbol" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "alert_events_device_symbol_fired_idx" ON "alert_events" USING btree ("device_id","symbol","fired_at" desc);--> statement-breakpoint
CREATE INDEX "alert_events_user_fired_idx" ON "alert_events" USING btree ("user_id","fired_at" desc);