CREATE TABLE IF NOT EXISTS agent_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(64) NOT NULL UNIQUE,
    name        VARCHAR(100) NOT NULL DEFAULT '',
    last_used_at TIMESTAMPTZ,
    revoked_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agent_tokens_user_id   ON agent_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_tokens_hash      ON agent_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_agent_tokens_revoked   ON agent_tokens(revoked_at) WHERE revoked_at IS NULL;
