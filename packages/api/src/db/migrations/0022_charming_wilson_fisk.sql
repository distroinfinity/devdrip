-- additive: track the CLI version reported per device (nullable, online).
-- NOTE: drizzle-kit also proposed dropping orphan tables (magic_link_tokens,
-- ticker_quotes, ticker_history) and several legacy users columns due to
-- pre-existing schema drift. Those destructive statements were intentionally
-- removed — this migration is additive-only.
ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "cli_version" varchar(32);
