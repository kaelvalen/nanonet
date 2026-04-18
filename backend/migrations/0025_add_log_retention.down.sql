DROP INDEX IF EXISTS idx_service_logs_time_service;
ALTER TABLE user_settings DROP COLUMN IF EXISTS log_retention_days;
