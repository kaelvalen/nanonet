ALTER TABLE command_logs
    DROP CONSTRAINT IF EXISTS command_logs_action_check;

ALTER TABLE command_logs
    ADD CONSTRAINT command_logs_action_check
    CHECK (action IN ('restart','stop','ping'));

ALTER TABLE command_logs
    DROP COLUMN IF EXISTS output;
