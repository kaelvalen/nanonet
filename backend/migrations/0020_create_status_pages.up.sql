-- Public, read-only status pages (think status.example.com).
-- One row = one public page. Each page exposes a curated subset of the
-- owner's services via a stable, unauthenticated URL.
CREATE TABLE IF NOT EXISTS status_pages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    slug        VARCHAR(64) NOT NULL UNIQUE,
    title       VARCHAR(120) NOT NULL,
    description TEXT,
    service_ids UUID[] NOT NULL DEFAULT '{}',
    enabled     BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT status_pages_slug_chk CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$')
);

CREATE INDEX IF NOT EXISTS idx_status_pages_user    ON status_pages(user_id);
CREATE INDEX IF NOT EXISTS idx_status_pages_enabled ON status_pages(enabled) WHERE enabled = true;
