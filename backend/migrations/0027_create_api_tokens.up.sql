-- Personal API tokens. Each token is shown to the user exactly once at create
-- time; we only store the SHA-256 of the secret. The "prefix" (first 12 chars
-- of the secret, including the "nn_" sentinel) lets the user identify a token
-- without exposing it.
CREATE TABLE IF NOT EXISTS api_tokens (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name          VARCHAR(120) NOT NULL,
    prefix        VARCHAR(20)  NOT NULL,            -- e.g. "nn_a1b2c3d4"
    token_hash    CHAR(64)     NOT NULL UNIQUE,     -- sha256 hex of full secret
    scopes        TEXT[]       NOT NULL DEFAULT '{}',
    last_used_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    expires_at    TIMESTAMPTZ,
    revoked_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_tokens_user      ON api_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_api_tokens_hash      ON api_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_api_tokens_active    ON api_tokens(user_id) WHERE revoked_at IS NULL;
