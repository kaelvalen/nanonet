-- Synthetic probes: server-initiated HTTP/TCP checks for endpoints we want to
-- monitor without an agent (third-party APIs, public URLs, etc).
CREATE TABLE IF NOT EXISTS probes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            VARCHAR(120) NOT NULL,
    kind            VARCHAR(10)  NOT NULL DEFAULT 'http', -- http | tcp
    target          VARCHAR(500) NOT NULL,                -- URL for http, host:port for tcp
    method          VARCHAR(10)  NOT NULL DEFAULT 'GET',  -- HTTP method
    expected_status INTEGER      NOT NULL DEFAULT 200,
    body_contains   TEXT,                                  -- optional substring assertion
    interval_seconds INTEGER     NOT NULL DEFAULT 60 CHECK (interval_seconds BETWEEN 30 AND 3600),
    timeout_seconds  INTEGER     NOT NULL DEFAULT 10 CHECK (timeout_seconds BETWEEN 1 AND 60),
    enabled         BOOLEAN      NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    -- Mutable runtime state — updated by the runner. Kept on the same row to
    -- avoid an extra "current state" table for what is effectively a singleton.
    last_run_at     TIMESTAMPTZ,
    last_status     VARCHAR(10),                           -- up | down | degraded
    last_latency_ms INTEGER,
    last_error      TEXT,
    consecutive_failures INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_probes_user    ON probes(user_id);
CREATE INDEX IF NOT EXISTS idx_probes_enabled ON probes(enabled) WHERE enabled = true;

-- Per-execution log retained for short horizon (used by the UI for the trend chart).
CREATE TABLE IF NOT EXISTS probe_runs (
    id          BIGSERIAL PRIMARY KEY,
    probe_id    UUID NOT NULL REFERENCES probes(id) ON DELETE CASCADE,
    ran_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status      VARCHAR(10) NOT NULL,
    latency_ms  INTEGER NOT NULL,
    http_status INTEGER,
    error       TEXT
);

CREATE INDEX IF NOT EXISTS idx_probe_runs_probe ON probe_runs(probe_id, ran_at DESC);
