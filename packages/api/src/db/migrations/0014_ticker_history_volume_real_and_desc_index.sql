DROP INDEX "ticker_history_symbol_date_idx";--> statement-breakpoint
ALTER TABLE "ticker_history" ALTER COLUMN "volume" SET DATA TYPE real;--> statement-breakpoint
CREATE INDEX "ticker_history_symbol_date_idx" ON "ticker_history" USING btree ("symbol","date" desc);