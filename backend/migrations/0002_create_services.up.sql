CREATE TABLE IF NOT EXISTS services (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                VARCHAR(100) NOT NULL,
    host                VARCHAR(255) NOT NULL,
    port                INTEGER NOT NULL CHECK (port > 0 AND port <= 65535),
    health_endpoint     VARCHAR(255) NOT NULL DEFAULT '/health',
    poll_interval_sec   INTEGER NOT NULL DEFAULT 10 CHECK (poll_interval_sec >= 5),
    status              VARCHAR(20) NOT NULL DEFAULT 'unknown'
                        CHECK (status IN ('up','down','degraded','unknown')),
    agent_id            UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_services_user_id ON services(user_id);
CREATE INDEX IF NOT EXISTS idx_services_status  ON services(status);
