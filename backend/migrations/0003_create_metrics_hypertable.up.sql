CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

CREATE TABLE IF NOT EXISTS metrics (
    time                TIMESTAMPTZ NOT NULL,
    service_id          UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    cpu_percent         FLOAT4,
    memory_used_mb      FLOAT4,
    latency_ms          FLOAT4,
    error_rate          FLOAT4 DEFAULT 0.0,
    status              VARCHAR(20) CHECK (status IN ('up','down','degraded')),
    disk_used_gb        FLOAT4,
    PRIMARY KEY (time, service_id)
);

SELECT create_hypertable('metrics', 'time', if_not_exists => TRUE);

SELECT add_retention_policy('metrics', INTERVAL '90 days', if_not_exists => TRUE);
