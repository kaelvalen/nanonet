CREATE TABLE service_alert_rules (
    service_id            UUID    PRIMARY KEY REFERENCES services(id) ON DELETE CASCADE,
    cpu_threshold         FLOAT4  NOT NULL DEFAULT 80,
    memory_threshold_mb   FLOAT4  NOT NULL DEFAULT 2048,
    latency_threshold_ms  FLOAT4  NOT NULL DEFAULT 1000,
    error_rate_threshold  FLOAT4  NOT NULL DEFAULT 5,
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
