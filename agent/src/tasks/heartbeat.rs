//! Hafif heartbeat task'ı.
//!
//! Backend her servis için `agent_last_heartbeat_at` alanını izler ve agent'ı
//! "stale" / "down" olarak işaretler. Düzenli metric akışına ek olarak 30s'de
//! bir explicit `heartbeat` mesajı atılır — böylece metric örnekleme durdurulsa
//! bile (örn. health probe devre dışı) liveness bilgisi devam eder.

use std::sync::Arc;
use std::time::Duration;

use chrono::Utc;
use serde_json::json;
use tokio::sync::watch;

use crate::config::Config;
use crate::state::AppState;
use crate::ws::OutgoingTx;
use crate::VERSION;

const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(30);

/// Heartbeat task'ını çalıştırır. Shutdown sinyali gelene dek döner.
pub async fn run(
    config: Config,
    state: Arc<AppState>,
    ws_tx: OutgoingTx,
    mut shutdown_rx: watch::Receiver<bool>,
) {
    let mut interval = tokio::time::interval(HEARTBEAT_INTERVAL);
    interval.tick().await; // ilk anlık tick'i atla

    loop {
        tokio::select! {
            _ = interval.tick() => {},
            _ = shutdown_rx.changed() => {
                tracing::debug!("Heartbeat task kapatılıyor");
                break;
            }
        }

        if !state.is_ws_connected() {
            // Bağlantı yokken heartbeat atmanın anlamı yok; reconnect olduğunda
            // buffered metric'ler zaten liveness sinyali sağlar.
            continue;
        }

        let mut msg = json!({
            "type": "heartbeat",
            "agent_id": state.agent_id,
            "agent_version": VERSION,
            "service_id": config.service_id,
            "timestamp": Utc::now().to_rfc3339(),
            "uptime_seconds": state.uptime_secs(),
        });

        let labels = config.label_map();
        if !labels.is_empty() {
            if let Some(obj) = msg.as_object_mut() {
                obj.insert("labels".to_string(), json!(labels));
            }
        }

        if let Err(e) = ws_tx.send(msg.to_string()).await {
            tracing::debug!("Heartbeat gönderilemedi: {}", e);
        }
    }
}
