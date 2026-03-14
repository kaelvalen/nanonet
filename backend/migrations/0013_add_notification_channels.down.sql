ALTER TABLE user_settings
    DROP COLUMN IF EXISTS webhook_url,
    DROP COLUMN IF EXISTS webhook_secret,
    DROP COLUMN IF EXISTS slack_webhook_url,
    DROP COLUMN IF EXISTS notif_channels;
