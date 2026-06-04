ALTER TABLE agent_tokens
    ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES services(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_agent_tokens_service_id ON agent_tokens(service_id);
