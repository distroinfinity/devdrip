-- M6: expand channelMode to 5 positions for ratio slider.
--   news    → news_only
--   markets → ticker_only
--   mix     → balanced

UPDATE preferences SET channel_mode = 'news_only' WHERE channel_mode = 'news';
UPDATE preferences SET channel_mode = 'ticker_only' WHERE channel_mode = 'markets';
UPDATE preferences SET channel_mode = 'balanced' WHERE channel_mode = 'mix';

-- enforce the new enum set
ALTER TABLE preferences DROP CONSTRAINT IF EXISTS preferences_channel_mode_check;
ALTER TABLE preferences ADD CONSTRAINT preferences_channel_mode_check
  CHECK (channel_mode IN ('news_only', 'news_heavy', 'balanced', 'ticker_heavy', 'ticker_only'));

-- update default for new inserts
ALTER TABLE preferences ALTER COLUMN channel_mode SET DEFAULT 'balanced';
