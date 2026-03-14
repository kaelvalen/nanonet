ALTER TABLE user_settings
    ADD COLUMN IF NOT EXISTS webhook_url        TEXT,
    ADD COLUMN IF NOT EXISTS webhook_secret     TEXT,
    ADD COLUMN IF NOT EXISTS slack_webhook_url  TEXT,
    ADD COLUMN IF NOT EXISTS notif_channels     TEXT[] NOT NULL DEFAULT '{}';
