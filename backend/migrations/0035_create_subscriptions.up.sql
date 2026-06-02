-- Plans: tier definitions with feature limits
CREATE TABLE plans (
    id                  VARCHAR(20) PRIMARY KEY,          -- 'free', 'pro', 'enterprise'
    name                VARCHAR(60)  NOT NULL,
    tier                INTEGER      NOT NULL DEFAULT 0,  -- 0=free, 1=pro, 2=enterprise
    price_monthly_usd   NUMERIC(8,2) NOT NULL DEFAULT 0,
    max_services        INTEGER      NOT NULL DEFAULT 3,
    max_agents          INTEGER      NOT NULL DEFAULT 3,
    max_probes          INTEGER      NOT NULL DEFAULT 5,
    max_alert_rules     INTEGER      NOT NULL DEFAULT 10,
    ai_tokens_monthly   BIGINT       NOT NULL DEFAULT 0,  -- 0 = disabled
    metric_retention_days INTEGER    NOT NULL DEFAULT 7,
    log_retention_days  INTEGER      NOT NULL DEFAULT 3,
    k8s_enabled         BOOLEAN      NOT NULL DEFAULT FALSE,
    slo_enabled         BOOLEAN      NOT NULL DEFAULT FALSE,
    runbooks_enabled    BOOLEAN      NOT NULL DEFAULT FALSE,
    team_members        INTEGER      NOT NULL DEFAULT 1,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Subscriptions: one active subscription per user
CREATE TABLE subscriptions (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id             VARCHAR(20)  NOT NULL REFERENCES plans(id),
    status              VARCHAR(20)  NOT NULL DEFAULT 'active', -- active, canceled, past_due, trialing
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end   TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN     NOT NULL DEFAULT FALSE,
    stripe_customer_id  VARCHAR(60),
    stripe_subscription_id VARCHAR(60),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Add plan_tier to users for fast middleware checks (denormalised)
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_tier INTEGER NOT NULL DEFAULT 0;

-- Seed default plans
INSERT INTO plans (id, name, tier, price_monthly_usd, max_services, max_agents, max_probes, max_alert_rules, ai_tokens_monthly, metric_retention_days, log_retention_days, k8s_enabled, slo_enabled, runbooks_enabled, team_members) VALUES
('free',       'Free',       0,  0,     3,  3,  5,  10,        0,        7,   3,  FALSE, FALSE, FALSE, 1),
('pro',        'Pro',        1,  19,    20, 20, 25, 100,  2000000,       30,  14,  TRUE,  TRUE,  TRUE,  5),
('enterprise', 'Enterprise', 2,  99,   999, 999, 999, 999, 20000000,    90,  90,  TRUE,  TRUE,  TRUE,  999)
ON CONFLICT (id) DO NOTHING;

-- Give all existing users the free plan subscription
INSERT INTO subscriptions (user_id, plan_id, status, current_period_start)
SELECT id, 'free', 'active', NOW()
FROM users
WHERE id NOT IN (SELECT user_id FROM subscriptions)
ON CONFLICT (user_id) DO NOTHING;

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
