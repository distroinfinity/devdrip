CREATE TABLE "watchlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watchlist_tickers" (
	"watchlist_id" uuid NOT NULL,
	"symbol" text NOT NULL,
	"asset_class" text NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watchlist_tickers_watchlist_id_symbol_pk" PRIMARY KEY("watchlist_id","symbol")
);
--> statement-breakpoint
CREATE TABLE "ticker_quotes" (
	"symbol" text PRIMARY KEY NOT NULL,
	"asset_class" text NOT NULL,
	"price" real NOT NULL,
	"change_pct" real NOT NULL,
	"prev_close" real NOT NULL,
	"last_provider" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stale" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticker_history" (
	"symbol" text NOT NULL,
	"date" date NOT NULL,
	"open" real NOT NULL,
	"high" real NOT NULL,
	"low" real NOT NULL,
	"close" real NOT NULL,
	"volume" integer,
	CONSTRAINT "ticker_history_symbol_date_pk" PRIMARY KEY("symbol","date")
);
--> statement-breakpoint
ALTER TABLE "watchlists" ADD CONSTRAINT "watchlists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_tickers" ADD CONSTRAINT "watchlist_tickers_watchlist_id_watchlists_id_fk" FOREIGN KEY ("watchlist_id") REFERENCES "public"."watchlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "watchlists_user_name_uq" ON "watchlists" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "watchlists_user_idx" ON "watchlists" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "watchlist_tickers_symbol_idx" ON "watchlist_tickers" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "ticker_quotes_fetched_at_idx" ON "ticker_quotes" USING btree ("fetched_at");--> statement-breakpoint
CREATE INDEX "ticker_history_symbol_date_idx" ON "ticker_history" USING btree ("symbol","date");