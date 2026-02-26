CREATE TABLE IF NOT EXISTS user_settings (
    user_id             UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    notif_crit          BOOLEAN NOT NULL DEFAULT TRUE,
    notif_warn          BOOLEAN NOT NULL DEFAULT TRUE,
    notif_down          BOOLEAN NOT NULL DEFAULT TRUE,
    notif_ai            BOOLEAN NOT NULL DEFAULT FALSE,
    poll_interval_sec   INTEGER NOT NULL DEFAULT 10 CHECK (poll_interval_sec >= 5 AND poll_interval_sec <= 300),
    auto_recovery       BOOLEAN NOT NULL DEFAULT FALSE,
    ai_auto_analyze     BOOLEAN NOT NULL DEFAULT TRUE,
    ai_window_minutes   INTEGER NOT NULL DEFAULT 30 CHECK (ai_window_minutes >= 5 AND ai_window_minutes <= 1440),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
