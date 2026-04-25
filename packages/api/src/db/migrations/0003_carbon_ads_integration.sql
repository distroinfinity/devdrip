ALTER TABLE "creatives" ADD COLUMN "viewability_beacon_url" varchar(2048);
--> statement-breakpoint
CREATE UNIQUE INDEX "creatives_source_ext_id_uniq" ON "creatives" ("source", "external_creative_id") WHERE "external_creative_id" IS NOT NULL;
