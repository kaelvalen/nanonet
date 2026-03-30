ALTER TABLE user_settings
    ADD COLUMN IF NOT EXISTS service_map JSONB;
