-- Runbooks: alert-triggered automation. When an alert matching (service_id?,
-- alert_type, min_severity) fires, the engine dispatches `action` to the
-- agent (restart/exec/scale/…). Rate-limited per runbook to avoid loops.
CREATE TABLE IF NOT EXISTS runbooks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            VARCHAR(120) NOT NULL,
    -- Match filters; service_id NULL = applies to every service the user owns.
    service_id      UUID REFERENCES services(id) ON DELETE CASCADE,
    alert_type      VARCHAR(40)  NOT NULL,                  -- e.g. high_cpu, downtime, *
    min_severity    VARCHAR(10)  NOT NULL DEFAULT 'warn',   -- info | warn | crit
    -- Action handed to the agent via WS.
    action          VARCHAR(30)  NOT NULL,                  -- restart | stop | start | exec | scale | webhook
    args            JSONB        NOT NULL DEFAULT '{}'::jsonb,
    enabled         BOOLEAN      NOT NULL DEFAULT true,
    -- Per-runbook throttle so a flapping alert can't restart 600x/hour.
    cooldown_seconds INTEGER     NOT NULL DEFAULT 600 CHECK (cooldown_seconds BETWEEN 0 AND 86400),
    max_per_hour    INTEGER      NOT NULL DEFAULT 6 CHECK (max_per_hour BETWEEN 1 AND 60),
    last_fired_at   TIMESTAMPTZ,
    fire_count      BIGINT       NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_runbooks_user_match
    ON runbooks(user_id, alert_type, enabled);
CREATE INDEX IF NOT EXISTS idx_runbooks_service
    ON runbooks(service_id) WHERE service_id IS NOT NULL;

-- Audit log of every runbook firing — also used for the "max per hour" check.
CREATE TABLE IF NOT EXISTS runbook_fires (
    id          BIGSERIAL PRIMARY KEY,
    runbook_id  UUID NOT NULL REFERENCES runbooks(id) ON DELETE CASCADE,
    service_id  UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    alert_id    UUID,
    fired_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status      VARCHAR(20) NOT NULL,                       -- dispatched | skipped_cooldown | skipped_rate | failed
    note        TEXT
);

CREATE INDEX IF NOT EXISTS idx_runbook_fires_runbook ON runbook_fires(runbook_id, fired_at DESC);
