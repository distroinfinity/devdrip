ALTER TABLE "preferences" ADD COLUMN "session_warmup_ms" integer NOT NULL DEFAULT 15000;--> statement-breakpoint
ALTER TABLE "preferences" ADD COLUMN "night_mode" boolean NOT NULL DEFAULT false;
