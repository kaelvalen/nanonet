DROP TABLE IF EXISTS agent_releases;
ALTER TABLE services
    DROP COLUMN IF EXISTS agent_status,
    DROP COLUMN IF EXISTS agent_last_heartbeat_at,
    DROP COLUMN IF EXISTS agent_version;
