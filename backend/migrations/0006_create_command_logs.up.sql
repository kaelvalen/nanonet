CREATE TABLE IF NOT EXISTS command_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id      UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    command_id      VARCHAR(100) NOT NULL,
    action          VARCHAR(50) NOT NULL CHECK (action IN ('restart','stop','ping')),
    status          VARCHAR(20) NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued','received','success','failed','timeout')),
    payload         JSONB,
    queued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    duration_ms     INTEGER
);

CREATE INDEX IF NOT EXISTS idx_command_logs_service_id ON command_logs(service_id);
CREATE INDEX IF NOT EXISTS idx_command_logs_user_id ON command_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_command_logs_command_id ON command_logs(command_id);
