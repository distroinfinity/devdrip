-- github oauth stores a hashed device secret on the device row, but the column
-- drifted out of an earlier migration so prod devices never got it. add it
-- (nullable text, matching the drizzle schema text("device_secret_hash")).
ALTER TABLE devices ADD COLUMN IF NOT EXISTS device_secret_hash text;
