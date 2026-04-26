-- 0006_world_identity.sql
-- World Chain identity + payout settlement schema.

-- users: identity columns. wallet_address column already exists from earlier
-- (originally scoped for Base Sepolia, never populated). Reused for World Wallet.
ALTER TABLE "users"
  ADD COLUMN "nullifier_hash" NUMERIC(78,0),
  ADD COLUMN "verification_level" VARCHAR(16),
  ADD COLUMN "signed_up_at" TIMESTAMPTZ;
--> statement-breakpoint
ALTER TABLE "users"
  ADD CONSTRAINT "users_nullifier_hash_unique" UNIQUE ("nullifier_hash");
--> statement-breakpoint

-- payouts: settlement & idempotency. 3-step idempotency_key migration so we
-- don't trip on existing pending rows in any environment.
ALTER TABLE "payouts"
  ADD COLUMN "tx_block_number" BIGINT,
  ADD COLUMN "idempotency_key" UUID,
  ADD COLUMN "retry_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "last_retry_at" TIMESTAMPTZ,
  ADD COLUMN "scheduled_for_week" DATE;
--> statement-breakpoint
UPDATE "payouts" SET "idempotency_key" = gen_random_uuid() WHERE "idempotency_key" IS NULL;
--> statement-breakpoint
ALTER TABLE "payouts"
  ALTER COLUMN "idempotency_key" SET NOT NULL,
  ALTER COLUMN "idempotency_key" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
CREATE UNIQUE INDEX "payouts_idempotency_key_unique" ON "payouts" ("idempotency_key");
--> statement-breakpoint
CREATE UNIQUE INDEX "payouts_user_week_unique" ON "payouts" ("user_id", "scheduled_for_week");
--> statement-breakpoint

-- Hot scan path for the settlement worker (PR3). Partial index avoids touching
-- the cold tail of confirmed/failed rows.
CREATE INDEX "payouts_status_created_idx" ON "payouts" ("status", "created_at")
  WHERE "status" IN ('pending', 'processing');
--> statement-breakpoint

-- new tables
CREATE TABLE "cli_pair_sessions" (
  "code" TEXT PRIMARY KEY,
  "user_id" UUID REFERENCES "users"("id") ON DELETE CASCADE,
  "status" VARCHAR(20) NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "completed_at" TIMESTAMPTZ
);
--> statement-breakpoint
CREATE INDEX "cli_pair_sessions_status_idx" ON "cli_pair_sessions" ("status", "expires_at");
--> statement-breakpoint

CREATE TABLE "nullifiers" (
  "nullifier" NUMERIC(78,0) NOT NULL,
  "action" TEXT NOT NULL,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "verified_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY ("nullifier", "action")
);
