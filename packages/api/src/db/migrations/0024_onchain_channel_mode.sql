-- add onchain_only to channel_mode check constraint
ALTER TABLE preferences DROP CONSTRAINT IF EXISTS preferences_channel_mode_check;
ALTER TABLE preferences ADD CONSTRAINT preferences_channel_mode_check
  CHECK (channel_mode IN ('news_only', 'news_heavy', 'balanced', 'ticker_heavy', 'ticker_only', 'onchain_only'));
