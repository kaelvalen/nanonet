-- Per-service alert thresholds. One row per service; created lazily when
-- the user first customises any threshold. Absence = platform defaults apply.
CREATE TABLE IF NOT EXISTS service_alert_rules (
    service_id            UUID   PRIMARY KEY REFERENCES services(id) ON DELETE CASCADE,
    cpu_threshold         FLOAT4 NOT NULL DEFAULT 80,
    memory_threshold_mb   FLOAT4 NOT NULL DEFAULT 2048,
    latency_threshold_ms  FLOAT4 NOT NULL DEFAULT 1000,
    error_rate_threshold  FLOAT4 NOT NULL DEFAULT 5,
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT service_alert_rules_cpu_check        CHECK (cpu_threshold        BETWEEN 0 AND 100),
    CONSTRAINT service_alert_rules_error_rate_check CHECK (error_rate_threshold BETWEEN 0 AND 100),
    CONSTRAINT service_alert_rules_memory_check     CHECK (memory_threshold_mb  > 0),
    CONSTRAINT service_alert_rules_latency_check    CHECK (latency_threshold_ms > 0)
);
