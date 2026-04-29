-- Performance indexes for command log history and in-flight queries.
-- Safe to run repeatedly (IF NOT EXISTS).

CREATE INDEX IF NOT EXISTS idx_command_logs_service_queued_at
    ON command_logs(service_id, queued_at DESC);

CREATE INDEX IF NOT EXISTS idx_command_logs_inflight
    ON command_logs(service_id, action, status, queued_at DESC);

CREATE INDEX IF NOT EXISTS idx_command_logs_status_queued_at
    ON command_logs(status, queued_at DESC);

