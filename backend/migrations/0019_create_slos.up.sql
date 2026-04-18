-- SLO definitions: per-service objectives that turn raw metrics into a
-- compliance-grade signal (e.g. "99.9% availability over a rolling 30 days").
CREATE TABLE IF NOT EXISTS slos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id      UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    name            VARCHAR(120) NOT NULL,

    -- Indicator: which metric drives the SLI calculation
    --   availability  → status='up' / total samples
    --   latency       → samples below latency_threshold_ms / total samples
    --   error_rate    → samples with error_rate <= error_rate_threshold / total
    sli_type        VARCHAR(20) NOT NULL CHECK (sli_type IN ('availability','latency','error_rate')),
    threshold       DOUBLE PRECISION,                       -- ms for latency, % for error_rate

    -- Objective: target percentage (e.g. 99.9) and rolling window (days)
    target          DOUBLE PRECISION NOT NULL CHECK (target > 0 AND target < 100),
    window_days     INTEGER NOT NULL DEFAULT 30 CHECK (window_days BETWEEN 1 AND 90),

    enabled         BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_slos_user    ON slos(user_id);
CREATE INDEX IF NOT EXISTS idx_slos_service ON slos(service_id);
