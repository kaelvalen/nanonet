-- service_grants extends single-tenant ownership with role-based sharing.
-- The service.user_id column remains the authoritative owner; entries here
-- give additional users a scoped role (viewer | operator | admin).
CREATE TABLE IF NOT EXISTS service_grants (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id       UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    grantee_user_id  UUID NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    role             VARCHAR(20) NOT NULL CHECK (role IN ('viewer','operator','admin')),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE (service_id, grantee_user_id)
);

CREATE INDEX IF NOT EXISTS idx_service_grants_service ON service_grants(service_id);
CREATE INDEX IF NOT EXISTS idx_service_grants_grantee ON service_grants(grantee_user_id);
