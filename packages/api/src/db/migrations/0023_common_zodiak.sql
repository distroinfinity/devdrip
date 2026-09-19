CREATE TABLE "onchain_pools" (
	"pool_id" text PRIMARY KEY NOT NULL,
	"chain_id" integer NOT NULL,
	"hook_address" text NOT NULL,
	"label" text NOT NULL,
	"token0" text NOT NULL,
	"token1" text NOT NULL,
	"token0_decimals" integer DEFAULT 18 NOT NULL,
	"token1_decimals" integer DEFAULT 18 NOT NULL,
	"tick_spacing" integer NOT NULL,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onchain_positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"chain_id" integer NOT NULL,
	"pool_id" text NOT NULL,
	"position_token_id" text,
	"tick_lower" integer NOT NULL,
	"tick_upper" integer NOT NULL,
	"wallet_address" text NOT NULL,
	"label" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onchain_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"device_id" uuid,
	"position_id" uuid,
	"type" text NOT NULL,
	"payload" jsonb,
	"fired_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "onchain_positions" ADD CONSTRAINT "onchain_positions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onchain_events" ADD CONSTRAINT "onchain_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "onchain_positions_user_idx" ON "onchain_positions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "onchain_events_device_type_idx" ON "onchain_events" USING btree ("device_id","type","fired_at");