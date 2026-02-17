CREATE TABLE IF NOT EXISTS alerts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id      UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    type            VARCHAR(50) NOT NULL,
    severity        VARCHAR(10) NOT NULL CHECK (severity IN ('info','warn','crit')),
    message         TEXT NOT NULL,
    triggered_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_alerts_service_id ON alerts(service_id);
CREATE INDEX IF NOT EXISTS idx_alerts_resolved   ON alerts(resolved_at)
    WHERE resolved_at IS NULL;
