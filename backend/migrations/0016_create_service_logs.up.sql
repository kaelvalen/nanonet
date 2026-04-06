CREATE TABLE IF NOT EXISTS service_logs (
    time        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    id          UUID        NOT NULL DEFAULT gen_random_uuid(),
    service_id  UUID        NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    level       VARCHAR(10) NOT NULL DEFAULT 'info'
                CHECK (level IN ('debug','info','warn','error')),
    source      VARCHAR(50) NOT NULL DEFAULT 'agent'
                CHECK (source IN ('agent','system','k8s','health_check','command')),
    message     TEXT        NOT NULL,
    fields      JSONB,
    PRIMARY KEY (time, id)
);

SELECT create_hypertable('service_logs', 'time', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_service_logs_service_id ON service_logs(service_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_service_logs_level      ON service_logs(level, time DESC);
CREATE INDEX IF NOT EXISTS idx_service_logs_source     ON service_logs(source, time DESC);

SELECT add_retention_policy('service_logs', INTERVAL '30 days', if_not_exists => TRUE);
