-- Required for gen_random_uuid() if not already loaded.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Plans: tier definitions with feature limits.
CREATE TABLE IF NOT EXISTS plans (
    id                    VARCHAR(20)  PRIMARY KEY,
    name                  VARCHAR(60)  NOT NULL,
    tier                  INTEGER      NOT NULL DEFAULT 0,      -- 0=free 1=pro 2=enterprise
    price_monthly_usd     NUMERIC(8,2) NOT NULL DEFAULT 0,

    max_services          INTEGER      NOT NULL DEFAULT 3,
    max_agents            INTEGER      NOT NULL DEFAULT 3,
    max_probes            INTEGER      NOT NULL DEFAULT 5,
    max_alert_rules       INTEGER      NOT NULL DEFAULT 10,

    ai_tokens_monthly     BIGINT       NOT NULL DEFAULT 0,      -- 0 = feature disabled

    metric_retention_days INTEGER      NOT NULL DEFAULT 7,
    log_retention_days    INTEGER      NOT NULL DEFAULT 3,

    k8s_enabled           BOOLEAN      NOT NULL DEFAULT FALSE,
    slo_enabled           BOOLEAN      NOT NULL DEFAULT FALSE,
    runbooks_enabled      BOOLEAN      NOT NULL DEFAULT FALSE,

    team_members          INTEGER      NOT NULL DEFAULT 1,

    created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT plans_tier_check
        CHECK (tier IN (0, 1, 2)),

    CONSTRAINT plans_price_non_negative_check
        CHECK (price_monthly_usd >= 0),

    CONSTRAINT plans_limits_non_negative_check
        CHECK (
            max_services          >= 0 AND
            max_agents            >= 0 AND
            max_probes            >= 0 AND
            max_alert_rules       >= 0 AND
            ai_tokens_monthly     >= 0 AND
            metric_retention_days >= 0 AND
            log_retention_days    >= 0 AND
            team_members          >= 1
        )
);

-- Subscriptions: one live subscription per user.
CREATE TABLE IF NOT EXISTS subscriptions (
    id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id                UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id                VARCHAR(20) NOT NULL REFERENCES plans(id),

    status                 VARCHAR(20) NOT NULL DEFAULT 'active',

    current_period_start   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end     TIMESTAMPTZ,

    cancel_at_period_end   BOOLEAN     NOT NULL DEFAULT FALSE,

    stripe_customer_id     VARCHAR(60),
    stripe_subscription_id VARCHAR(60),

    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT subscriptions_status_check
        CHECK (status IN ('active', 'canceled', 'past_due', 'trialing')),

    CONSTRAINT subscriptions_period_check
        CHECK (
            current_period_end IS NULL OR
            current_period_end > current_period_start
        )
);

-- One live (non-canceled) subscription per user. Canceled rows are kept for
-- billing history; only active/past_due/trialing rows are constrained.
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_one_live_per_user
    ON subscriptions(user_id)
    WHERE status IN ('active', 'past_due', 'trialing');

CREATE INDEX IF NOT EXISTS idx_subscriptions_plan
    ON subscriptions(plan_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status
    ON subscriptions(status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription
    ON subscriptions(stripe_subscription_id)
    WHERE stripe_subscription_id IS NOT NULL;

-- Denormalized plan tier on users for fast middleware checks.
-- App logic (ChangePlan) must keep this in sync with subscriptions.plan_id → plans.tier.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS plan_tier INTEGER NOT NULL DEFAULT 0;

-- Seed default plans. ON CONFLICT DO UPDATE ensures plan limits stay current
-- across re-runs (e.g. if defaults change after the initial migration).
INSERT INTO plans (
    id, name, tier, price_monthly_usd,
    max_services, max_agents, max_probes, max_alert_rules,
    ai_tokens_monthly, metric_retention_days, log_retention_days,
    k8s_enabled, slo_enabled, runbooks_enabled, team_members
) VALUES
    ('free',       'Free',       0,  0,   3,   3,   5,   10,        0,  7,  3, FALSE, FALSE, FALSE,   1),
    ('pro',        'Pro',        1, 19,  20,  20,  25,  100,  2000000, 30, 14, TRUE,  TRUE,  TRUE,    5),
    ('enterprise', 'Enterprise', 2, 99, 999, 999, 999,  999, 20000000, 90, 90, TRUE,  TRUE,  TRUE,  999)
ON CONFLICT (id) DO UPDATE SET
    name                  = EXCLUDED.name,
    tier                  = EXCLUDED.tier,
    price_monthly_usd     = EXCLUDED.price_monthly_usd,
    max_services          = EXCLUDED.max_services,
    max_agents            = EXCLUDED.max_agents,
    max_probes            = EXCLUDED.max_probes,
    max_alert_rules       = EXCLUDED.max_alert_rules,
    ai_tokens_monthly     = EXCLUDED.ai_tokens_monthly,
    metric_retention_days = EXCLUDED.metric_retention_days,
    log_retention_days    = EXCLUDED.log_retention_days,
    k8s_enabled           = EXCLUDED.k8s_enabled,
    slo_enabled           = EXCLUDED.slo_enabled,
    runbooks_enabled      = EXCLUDED.runbooks_enabled,
    team_members          = EXCLUDED.team_members;

-- Provision free plan for every existing user that has no live subscription.
INSERT INTO subscriptions (user_id, plan_id, status, current_period_start)
SELECT
    u.id,
    'free',
    'active',
    NOW()
FROM users u
WHERE NOT EXISTS (
    SELECT 1
    FROM subscriptions s
    WHERE s.user_id = u.id
      AND s.status IN ('active', 'past_due', 'trialing')
);

-- Backfill denormalized plan_tier for users that already have a subscription.
UPDATE users u
SET    plan_tier = p.tier
FROM   subscriptions s
JOIN   plans         p ON p.id = s.plan_id
WHERE  s.user_id = u.id
  AND  s.status  IN ('active', 'past_due', 'trialing');
