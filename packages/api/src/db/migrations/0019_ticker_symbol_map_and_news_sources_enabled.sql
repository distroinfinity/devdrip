-- M7: ticker_symbol_map (DB-managed) + news_sources.enabled column.

CREATE TABLE IF NOT EXISTS ticker_symbol_map (
  symbol TEXT PRIMARY KEY,
  asset_class TEXT NOT NULL CHECK (asset_class IN ('equity', 'crypto')),
  provider TEXT NOT NULL CHECK (provider IN ('finnhub', 'coingecko')),
  provider_id TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ticker_symbol_map_provider_idx ON ticker_symbol_map(provider);

INSERT INTO ticker_symbol_map (symbol, asset_class, provider, provider_id) VALUES
  ('BTC',   'crypto', 'coingecko', 'bitcoin'),
  ('ETH',   'crypto', 'coingecko', 'ethereum'),
  ('SOL',   'crypto', 'coingecko', 'solana'),
  ('ADA',   'crypto', 'coingecko', 'cardano'),
  ('XRP',   'crypto', 'coingecko', 'ripple'),
  ('DOGE',  'crypto', 'coingecko', 'dogecoin'),
  ('MATIC', 'crypto', 'coingecko', 'matic-network'),
  ('AVAX',  'crypto', 'coingecko', 'avalanche-2')
ON CONFLICT (symbol) DO NOTHING;

INSERT INTO ticker_symbol_map (symbol, asset_class, provider, provider_id) VALUES
  ('AAPL', 'equity', 'finnhub', 'AAPL'),
  ('NVDA', 'equity', 'finnhub', 'NVDA'),
  ('MSFT', 'equity', 'finnhub', 'MSFT'),
  ('GOOGL','equity', 'finnhub', 'GOOGL'),
  ('AMZN', 'equity', 'finnhub', 'AMZN'),
  ('META', 'equity', 'finnhub', 'META'),
  ('TSLA', 'equity', 'finnhub', 'TSLA')
ON CONFLICT (symbol) DO NOTHING;

ALTER TABLE news_sources ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;
