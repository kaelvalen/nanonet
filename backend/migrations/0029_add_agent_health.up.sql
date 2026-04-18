-- Persist last-known agent metadata so the dashboard can flag stale agents and
-- so the heartbeat policy task knows when to fire an alert.
ALTER TABLE services
    ADD COLUMN IF NOT EXISTS agent_version            VARCHAR(40),
    ADD COLUMN IF NOT EXISTS agent_last_heartbeat_at  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS agent_status             VARCHAR(20) NOT NULL DEFAULT 'unknown';

-- agent_releases is the published "latest agent version" per channel. The CLI
-- agent polls /api/v1/agents/release on a slow timer and shows a "new version
-- available" banner when its CARGO_PKG_VERSION lags behind.
CREATE TABLE IF NOT EXISTS agent_releases (
    channel       VARCHAR(20) PRIMARY KEY,            -- "stable" | "beta"
    version       VARCHAR(40) NOT NULL,
    download_url  TEXT,
    notes         TEXT,
    sha256        VARCHAR(64),
    published_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO agent_releases (channel, version, notes)
VALUES ('stable', '0.1.0', 'Initial release')
ON CONFLICT (channel) DO NOTHING;
