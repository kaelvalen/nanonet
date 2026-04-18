-- Incidents group multiple alerts on the same service that occur within a
-- short window, so operators see one item per real-world failure instead of
-- a dozen disjoint rows. The `incident_alerts` join is many-to-many because
-- a single alert may be re-attached if it spans an existing incident.
CREATE TABLE IF NOT EXISTS incidents (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    service_id  UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    title       VARCHAR(200) NOT NULL,
    severity    VARCHAR(10)  NOT NULL,                -- info | warn | crit
    summary     TEXT,                                 -- editable one-liner
    postmortem  TEXT,                                 -- editable markdown
    started_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incidents_user        ON incidents(user_id);
CREATE INDEX IF NOT EXISTS idx_incidents_service     ON incidents(service_id);
CREATE INDEX IF NOT EXISTS idx_incidents_open
    ON incidents(service_id, started_at DESC)
    WHERE resolved_at IS NULL;

CREATE TABLE IF NOT EXISTS incident_alerts (
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    alert_id    UUID NOT NULL REFERENCES alerts(id)    ON DELETE CASCADE,
    PRIMARY KEY (incident_id, alert_id)
);
CREATE INDEX IF NOT EXISTS idx_incident_alerts_alert ON incident_alerts(alert_id);
