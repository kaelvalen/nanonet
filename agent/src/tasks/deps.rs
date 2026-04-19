//! Outbound TCP bağımlılık keşfi task'ı.
//!
//! 60s aralıklarla [`crate::dependencies::discover`] çalıştırılır ve sonuç
//! backend'e iletilir. Backend tarafı dedup ve TTL uyguladığı için bir tick
//! atlanması zararsızdır.

use std::sync::Arc;
use std::time::Duration;

use chrono::Utc;
use serde_json::json;
use tokio::sync::watch;

use crate::config::Config;
use crate::dependencies;
use crate::state::AppState;
use crate::ws::OutgoingTx;

const DISCOVERY_INTERVAL: Duration = Duration::from_secs(60);

pub async fn run(
    config: Config,
    state: Arc<AppState>,
    ws_tx: OutgoingTx,
    mut shutdown_rx: watch::Receiver<bool>,
) {
    let mut interval = tokio::time::interval(DISCOVERY_INTERVAL);
    interval.tick().await; // ilk anlık tick'i atla

    loop {
        tokio::select! {
            _ = interval.tick() => {},
            _ = shutdown_rx.changed() => {
                tracing::debug!("Dependency task kapatılıyor");
                break;
            }
        }

        if !state.is_ws_connected() {
            continue;
        }

        let observations = dependencies::discover();
        if observations.is_empty() {
            continue;
        }

        let mut msg = json!({
            "type": "dependencies",
            "agent_id": state.agent_id,
            "service_id": config.service_id,
            "timestamp": Utc::now().to_rfc3339(),
            "dependencies": observations,
        });

        let labels = config.label_map();
        if !labels.is_empty() {
            if let Some(obj) = msg.as_object_mut() {
                obj.insert("labels".to_string(), json!(labels));
            }
        }

        if let Err(e) = ws_tx.send(msg.to_string()).await {
            tracing::debug!("Dependency mesajı gönderilemedi: {}", e);
        }
    }
}
