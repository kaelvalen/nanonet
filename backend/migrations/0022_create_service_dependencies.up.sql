-- Auto-discovered outbound network dependencies, populated by the agent's
-- /proc/net/tcp (or `ss`) scanner. Each row is a single (host, port) the
-- service was observed talking to. last_seen_at lets us age-out stale entries.
CREATE TABLE IF NOT EXISTS service_dependencies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id      UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    target_host     VARCHAR(255) NOT NULL,
    target_port     INTEGER NOT NULL CHECK (target_port BETWEEN 1 AND 65535),
    protocol        VARCHAR(10)  NOT NULL DEFAULT 'tcp',
    process_name    VARCHAR(120),
    -- "Resolved" by an operator: marks this row as part of the canonical
    -- service-map. Discovery still keeps updating last_seen_at.
    promoted        BOOLEAN      NOT NULL DEFAULT false,
    sample_count    INTEGER      NOT NULL DEFAULT 1,
    first_seen_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    last_seen_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT service_dependencies_unique UNIQUE (service_id, target_host, target_port, protocol)
);

CREATE INDEX IF NOT EXISTS idx_svc_deps_service        ON service_dependencies(service_id);
CREATE INDEX IF NOT EXISTS idx_svc_deps_last_seen      ON service_dependencies(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_svc_deps_promoted       ON service_dependencies(promoted) WHERE promoted = true;
