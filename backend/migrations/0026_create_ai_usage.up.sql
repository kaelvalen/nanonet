-- AI usage ledger: every Claude call appends one row. Drives the monthly
-- budget guard and the per-user cost dashboard.
CREATE TABLE IF NOT EXISTS ai_usage (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id      UUID REFERENCES services(id) ON DELETE SET NULL,
    model           VARCHAR(60)  NOT NULL,           -- e.g. claude-3-5-haiku-20241022
    kind            VARCHAR(40)  NOT NULL DEFAULT 'analysis',  -- analysis | report | other
    input_tokens    INTEGER      NOT NULL DEFAULT 0,
    output_tokens   INTEGER      NOT NULL DEFAULT 0,
    cost_usd        NUMERIC(12,6) NOT NULL DEFAULT 0,
    cache_hit       BOOLEAN      NOT NULL DEFAULT false,
    latency_ms      INTEGER      NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- (user_id, created_at) covers both "recent calls" and "this-month spend"
-- queries since the latter is just a range scan with WHERE created_at >= ...
-- An expression index on date_trunc('month', created_at) cannot be used
-- because date_trunc(text, timestamptz) is STABLE, not IMMUTABLE.
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_time
    ON ai_usage(user_id, created_at DESC);

-- Per-user monthly budget (USD). NULL = unlimited.
ALTER TABLE user_settings
    ADD COLUMN IF NOT EXISTS ai_monthly_budget_usd NUMERIC(10,2)
        CHECK (ai_monthly_budget_usd IS NULL OR ai_monthly_budget_usd >= 0);

-- Prompt cache: identical (model, prompt_hash) within TTL returns the saved
-- result to avoid re-billing. Soft cache — tiny rows, only the last hit per key.
CREATE TABLE IF NOT EXISTS ai_prompt_cache (
    prompt_hash     CHAR(64) PRIMARY KEY,             -- SHA-256 hex
    model           VARCHAR(60) NOT NULL,
    response_json   TEXT        NOT NULL,
    input_tokens    INTEGER     NOT NULL DEFAULT 0,
    output_tokens   INTEGER     NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_prompt_cache_expiry ON ai_prompt_cache(expires_at);
