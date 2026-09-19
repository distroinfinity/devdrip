-- 0010 anonymous device: relax users.email; add devices.device_secret_hash.
-- Foundation for spec §6.4 anonymous-first auth: anon users have null email/github_id
-- until a M2 magic-link flow sets them.

--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "device_secret_hash" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "devices_device_secret_hash_unique"
  ON "devices" ("device_secret_hash")
  WHERE "device_secret_hash" IS NOT NULL;
