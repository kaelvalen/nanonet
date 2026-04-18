-- Per-user log retention (in days). NULL or absent = use platform default (30).
ALTER TABLE user_settings
    ADD COLUMN IF NOT EXISTS log_retention_days INTEGER
        CHECK (log_retention_days IS NULL OR (log_retention_days BETWEEN 1 AND 365));

-- Helpful for the global log-search endpoint.
CREATE INDEX IF NOT EXISTS idx_service_logs_time_service
    ON service_logs (time DESC, service_id);
