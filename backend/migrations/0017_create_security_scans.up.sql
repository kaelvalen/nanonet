CREATE TABLE IF NOT EXISTS security_scans (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id        UUID        NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    scanned_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tls_enabled       BOOLEAN     NOT NULL DEFAULT false,
    tls_valid         BOOLEAN     NOT NULL DEFAULT false,
    tls_expiry        TIMESTAMPTZ,
    tls_days_left     INT,
    tls_issuer        TEXT        NOT NULL DEFAULT '',
    tls_version       TEXT        NOT NULL DEFAULT '',
    missing_headers   JSONB       NOT NULL DEFAULT '[]',
    server_header     TEXT        NOT NULL DEFAULT '',
    redirect_to_https BOOLEAN     NOT NULL DEFAULT false,
    risk_score        FLOAT       NOT NULL DEFAULT 0,
    findings          JSONB       NOT NULL DEFAULT '[]',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_scans_service_id ON security_scans(service_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_scans_scanned_at ON security_scans(scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_scans_risk       ON security_scans(risk_score DESC);
