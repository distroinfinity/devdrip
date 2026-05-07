-- reuters retired their public RSS feed (and the agency wordpress redirects
-- to a 404). drop the seeded source row + any items so the worker stops
-- logging "rss reuters-rss 404" every interval. cascading FK on news_items.
DELETE FROM news_sources WHERE key = 'reuters-rss';
