-- Notification channels: per-user destinations (slack, discord, webhook, email, pagerduty).
-- A channel can be enabled/disabled and gated to specific severities and/or specific services.
CREATE TABLE IF NOT EXISTS notification_channels (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    type            VARCHAR(20)  NOT NULL CHECK (type IN ('slack','discord','webhook','email','pagerduty')),
    enabled         BOOLEAN      NOT NULL DEFAULT true,

    -- Generic channel config; shape depends on `type`:
    --   slack/discord/webhook → { "url": "...", "secret": "..." (optional HMAC) }
    --   email                 → { "to": "user@example.com" }
    --   pagerduty             → { "routing_key": "..." }
    config          JSONB        NOT NULL DEFAULT '{}'::jsonb,

    -- Routing filters
    severities      TEXT[]       NOT NULL DEFAULT ARRAY['warn','crit'],   -- info|warn|crit
    service_ids     UUID[]       NOT NULL DEFAULT '{}',                    -- empty = all services

    -- Deduplication / rate limiting
    cooldown_sec    INTEGER      NOT NULL DEFAULT 300 CHECK (cooldown_sec >= 0),

    last_used_at    TIMESTAMPTZ,
    last_error      TEXT,
    last_error_at   TIMESTAMPTZ,

    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_channels_user      ON notification_channels(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_channels_enabled   ON notification_channels(enabled) WHERE enabled = true;

-- Delivery log for observability + UI history.
CREATE TABLE IF NOT EXISTS notification_deliveries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id      UUID NOT NULL REFERENCES notification_channels(id) ON DELETE CASCADE,
    alert_id        UUID,    -- nullable: incident notifications, test sends, etc.
    service_id      UUID,
    status          VARCHAR(20) NOT NULL CHECK (status IN ('success','failed','skipped_cooldown','skipped_filter')),
    http_status     INTEGER,
    error           TEXT,
    duration_ms     INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_deliv_channel_time ON notification_deliveries(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_deliv_alert        ON notification_deliveries(alert_id) WHERE alert_id IS NOT NULL;
