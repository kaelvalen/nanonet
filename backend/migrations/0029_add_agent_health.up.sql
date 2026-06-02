-- Persist last-known agent metadata so the dashboard can flag stale agents
-- and so the heartbeat policy task knows when to fire an alert.
ALTER TABLE services
    ADD COLUMN IF NOT EXISTS agent_version           VARCHAR(40),
    ADD COLUMN IF NOT EXISTS agent_last_heartbeat_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS agent_status            VARCHAR(20) NOT NULL DEFAULT 'unknown';

-- Enforce valid values for existing + future rows.
-- The constraint is added only if it doesn't already exist.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'services_agent_status_check'
          AND conrelid = 'services'::regclass
    ) THEN
        ALTER TABLE services
            ADD CONSTRAINT services_agent_status_check
            CHECK (agent_status IN ('healthy', 'stale', 'down', 'unknown'));
    END IF;
END$$;

-- agent_releases: the published "latest agent version" per channel.
-- The CLI agent polls /api/v1/agents/release and shows an upgrade banner
-- when its CARGO_PKG_VERSION lags behind.
CREATE TABLE IF NOT EXISTS agent_releases (
    channel      VARCHAR(20) PRIMARY KEY,   -- 'stable' | 'beta'
    version      VARCHAR(40) NOT NULL,
    download_url TEXT,
    notes        TEXT,
    sha256       VARCHAR(64),
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT agent_releases_channel_check
        CHECK (channel IN ('stable', 'beta'))
);

INSERT INTO agent_releases (channel, version, notes)
VALUES ('stable', '0.1.0', 'Initial release')
ON CONFLICT (channel) DO UPDATE SET
    version      = EXCLUDED.version,
    notes        = EXCLUDED.notes,
    updated_at   = NOW();

CREATE INDEX IF NOT EXISTS idx_services_agent_status
    ON services(agent_status)
    WHERE agent_status != 'unknown';

CREATE INDEX IF NOT EXISTS idx_services_agent_heartbeat
    ON services(agent_last_heartbeat_at DESC)
    WHERE agent_last_heartbeat_at IS NOT NULL;
