ALTER TABLE command_logs
    ADD COLUMN IF NOT EXISTS error_message TEXT;
