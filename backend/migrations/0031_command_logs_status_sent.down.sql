ALTER TABLE command_logs
    DROP CONSTRAINT IF EXISTS command_logs_status_check;

ALTER TABLE command_logs
    ADD CONSTRAINT command_logs_status_check
    CHECK (status IN ('queued', 'received', 'success', 'failed', 'timeout'));
