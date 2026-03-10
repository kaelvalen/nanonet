CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE maintenance_windows (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID        NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    starts_at  TIMESTAMPTZ NOT NULL,
    ends_at    TIMESTAMPTZ NOT NULL,
    reason     TEXT,
    created_by UUID        REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT no_overlap EXCLUDE USING gist (
        service_id WITH =,
        tstzrange(starts_at, ends_at) WITH &&
    )
);

CREATE INDEX ON maintenance_windows(service_id, ends_at);
