CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Maintenance windows suppress alerting for the given service during the
-- specified interval. The exclusion constraint prevents overlapping windows
-- on the same service to avoid ambiguity in the suppression logic.
CREATE TABLE IF NOT EXISTS maintenance_windows (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID        NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    starts_at  TIMESTAMPTZ NOT NULL,
    ends_at    TIMESTAMPTZ NOT NULL,
    reason     TEXT,
    created_by UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT maintenance_windows_period_check
        CHECK (ends_at > starts_at),

    CONSTRAINT maintenance_windows_no_overlap
        EXCLUDE USING gist (
            service_id WITH =,
            tstzrange(starts_at, ends_at) WITH &&
        )
);

CREATE INDEX IF NOT EXISTS idx_maintenance_windows_service_ends
    ON maintenance_windows(service_id, ends_at);

CREATE INDEX IF NOT EXISTS idx_maintenance_windows_active
    ON maintenance_windows(service_id, starts_at, ends_at)
    WHERE ends_at > NOW();
