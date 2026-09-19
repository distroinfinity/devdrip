ALTER TABLE "preferences" ALTER COLUMN "max_per_hour" SET DEFAULT 9999;--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "max_per_day" SET DEFAULT 99999;--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "session_warmup_ms" SET DEFAULT 0;