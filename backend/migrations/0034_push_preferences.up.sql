CREATE TABLE IF NOT EXISTS user_push_preferences (
    user_id      UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    enabled      BOOLEAN NOT NULL DEFAULT true,
    min_severity VARCHAR(10) NOT NULL DEFAULT 'warn' CHECK (min_severity IN ('info', 'warn', 'crit')),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
