CREATE TABLE IF NOT EXISTS ai_insights (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id        UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    model           VARCHAR(50) NOT NULL,
    summary         TEXT NOT NULL,
    root_cause      TEXT,
    recommendations JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
