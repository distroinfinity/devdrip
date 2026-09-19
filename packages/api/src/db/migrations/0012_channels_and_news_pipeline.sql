CREATE TABLE "channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"default_on" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_subscriptions" (
	"user_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channel_subscriptions_user_id_channel_id_pk" PRIMARY KEY("user_id","channel_id")
);
--> statement-breakpoint
CREATE TABLE "news_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"key" text NOT NULL,
	"kind" text NOT NULL,
	"url" text NOT NULL,
	"half_life_hours" real DEFAULT 12 NOT NULL,
	"fetch_interval_min" integer DEFAULT 5 NOT NULL,
	"healthy" boolean DEFAULT true NOT NULL,
	"last_fetched_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news_items" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"headline" text NOT NULL,
	"url" text NOT NULL,
	"comments_url" text,
	"score" integer,
	"comments_count" integer,
	"published_at" timestamp with time zone NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "channel_subscriptions" ADD CONSTRAINT "channel_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_subscriptions" ADD CONSTRAINT "channel_subscriptions_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_sources" ADD CONSTRAINT "news_sources_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_items" ADD CONSTRAINT "news_items_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_items" ADD CONSTRAINT "news_items_source_id_news_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."news_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "channels_key_uq" ON "channels" USING btree ("key");--> statement-breakpoint
CREATE INDEX "channel_subscriptions_user_idx" ON "channel_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "news_sources_key_uq" ON "news_sources" USING btree ("key");--> statement-breakpoint
CREATE INDEX "news_items_channel_published_idx" ON "news_items" USING btree ("channel_id","published_at");--> statement-breakpoint
CREATE INDEX "news_items_published_idx" ON "news_items" USING btree ("published_at");
--> statement-breakpoint
-- Seed: 6 channels (Tech + Finance default-on; rest opt-in).
INSERT INTO "channels" ("key", "label", "default_on") VALUES
  ('tech',      'Tech',      true),
  ('finance',   'Finance',   true),
  ('crypto',    'Crypto',    false),
  ('ai-papers', 'AI Papers', false),
  ('design',    'Design',    false),
  ('gaming',    'Gaming',    false)
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint
-- Seed: default news sources. half_life_hours per spec §9.1
-- (6h HN, 24h RSS, 1h Reuters; reddit and ai sources tuned).
INSERT INTO "news_sources" ("channel_id", "key", "kind", "url", "half_life_hours", "fetch_interval_min")
SELECT c.id, s.key, s.kind, s.url, s.half_life_hours, s.fetch_interval_min
FROM "channels" c
JOIN (VALUES
  ('tech',      'hn-top',          'hn',     'https://hacker-news.firebaseio.com/v0/topstories.json', 6,  5),
  ('tech',      'techcrunch-rss',  'rss',    'https://techcrunch.com/feed/',                          24, 5),
  ('tech',      'theverge-rss',    'rss',    'https://www.theverge.com/rss/index.xml',                24, 5),
  ('tech',      'arstechnica-rss', 'rss',    'https://feeds.arstechnica.com/arstechnica/index',       24, 5),
  ('finance',   'bloomberg-rss',   'rss',    'https://feeds.bloomberg.com/markets/news.rss',          24, 5),
  ('finance',   'reuters-rss',     'rss',    'https://www.reutersagency.com/feed/?best-topics=business-finance&post_type=best',  1,  5),
  ('crypto',    'coindesk-rss',    'rss',    'https://www.coindesk.com/arc/outboundfeeds/rss/',       24, 5),
  ('crypto',    'reddit-crypto',   'reddit', 'https://www.reddit.com/r/cryptocurrency/top.json?t=day', 12, 5),
  ('ai-papers', 'reddit-ml',       'reddit', 'https://www.reddit.com/r/MachineLearning/top.json?t=day', 24, 30),
  ('design',    'smashing-rss',    'rss',    'https://www.smashingmagazine.com/feed/',                72, 60),
  ('gaming',    'polygon-rss',     'rss',    'https://www.polygon.com/rss/index.xml',                 24, 60)
) AS s(channel_key, key, kind, url, half_life_hours, fetch_interval_min)
ON c.key = s.channel_key
ON CONFLICT ("key") DO NOTHING;