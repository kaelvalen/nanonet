use futures_util::{SinkExt, StreamExt};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc;
use tokio_tungstenite::{connect_async, tungstenite::Message};

use crate::commands;
use crate::config::Config;
use crate::error::AgentError;

/// Max backoff delay in seconds
const MAX_BACKOFF_SECS: u64 = 32;
/// Jitter range in milliseconds (0..JITTER_MAX_MS)
const JITTER_MAX_MS: u64 = 1000;

const OUTGOING_CHANNEL_CAPACITY: usize = 64;

pub type OutgoingTx = mpsc::Sender<String>;
pub type OutgoingRx = mpsc::Receiver<String>;

pub fn channel() -> (OutgoingTx, OutgoingRx) {
    mpsc::channel(OUTGOING_CHANNEL_CAPACITY)
}

/// Ana yeniden bağlanma döngüsü — asla sonlanmaz.
pub async fn run(config: &Config, mut outgoing_rx: OutgoingRx, restart_count: Arc<AtomicU64>) -> ! {
    let ws_url = config.ws_url();
    let mut delay_secs: u64 = 1;
    let mut attempt: u32 = 0;

    loop {
        attempt += 1;
        tracing::info!(attempt, url = %config.backend, "WS connection attempt");

        match connect_and_run(&ws_url, &mut outgoing_rx, config, Arc::clone(&restart_count)).await {
            Ok(()) => {
                tracing::info!("WS connection closed cleanly — reconnecting immediately");
                delay_secs = 1;
                attempt = 0;
            }
            Err(e) => {
                let jitter_ms = (std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .subsec_millis() as u64)
                    % JITTER_MAX_MS;
                let sleep = Duration::from_millis(delay_secs * 1000 + jitter_ms);
                tracing::warn!(
                    attempt,
                    error = %e,
                    retry_in_ms = sleep.as_millis(),
                    "WS connection failed — will retry"
                );
                tokio::time::sleep(sleep).await;
                delay_secs = (delay_secs * 2).min(MAX_BACKOFF_SECS);
            }
        }
    }
}

async fn connect_and_run(
    ws_url: &str,
    outgoing_rx: &mut OutgoingRx,
    config: &Config,
    restart_count: Arc<AtomicU64>,
) -> Result<(), AgentError> {
    let (ws_stream, _) = connect_async(ws_url)
        .await
        .map_err(|e| AgentError::WebSocketConnection(e.to_string()))?;

    tracing::info!("WebSocket bağlantısı kuruldu");

    let (mut sink, mut stream) = ws_stream.split();

    let mut ping_interval = tokio::time::interval(Duration::from_secs(30));
    ping_interval.tick().await; // ilk anında tick'i atla

    loop {
        tokio::select! {
            _ = ping_interval.tick() => {
                sink.send(Message::Ping(vec![]))
                    .await
                    .map_err(|e| AgentError::WebSocketConnection(e.to_string()))?;
                tracing::debug!("Heartbeat ping gönderildi");
            }

            Some(msg) = outgoing_rx.recv() => {
                sink.send(Message::Text(msg))
                    .await
                    .map_err(|e| AgentError::WebSocketConnection(e.to_string()))?;
            }

            msg = stream.next() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        handle_incoming(&text, &mut sink, config, Arc::clone(&restart_count)).await;
                    }
                    Some(Ok(Message::Pong(_))) => {
                        tracing::debug!("Pong alındı");
                    }
                    Some(Ok(Message::Close(_))) => {
                        tracing::info!("WebSocket sunucu tarafından kapatıldı");
                        return Ok(());
                    }
                    Some(Err(e)) => {
                        return Err(AgentError::WebSocketConnection(e.to_string()));
                    }
                    None => {
                        return Err(AgentError::WebSocketConnection(
                            "Bağlantı beklenmedik şekilde kapandı".to_string(),
                        ));
                    }
                    _ => {}
                }
            }
        }
    }
}

async fn handle_incoming<S>(
    text: &str,
    sink: &mut S,
    config: &Config,
    restart_count: Arc<AtomicU64>,
) where
    S: SinkExt<Message> + Unpin,
    S::Error: std::fmt::Display,
{
    let value: serde_json::Value = match serde_json::from_str(text) {
        Ok(v) => v,
        Err(e) => {
            tracing::warn!("Mesaj parse edilemedi: {} — {}", e, text);
            return;
        }
    };

    let msg_type = value.get("type").and_then(|v| v.as_str()).unwrap_or("");

    if msg_type != "command" {
        tracing::debug!("Bilinmeyen mesaj tipi görmezden gelindi: {}", msg_type);
        return;
    }

    let cmd: commands::IncomingCommand = match serde_json::from_value(value) {
        Ok(c) => c,
        Err(e) => {
            tracing::warn!("Komut parse edilemedi: {}", e);
            return;
        }
    };

    tracing::info!(
        "Komut alındı: action={} command_id={}",
        cmd.action,
        cmd.command_id
    );

    // ACK gönder — backend komutun ulaştığını bilsin
    let ack = cmd.ack_json();
    if let Err(e) = sink.send(Message::Text(ack)).await {
        tracing::error!("ACK gönderilemedi: {}", e);
        return;
    }

    let is_restart = cmd.action == "restart";

    // Komutu çalıştır
    let (success, error, output) = match commands::execute(&cmd, config).await {
        Ok(out) => {
            if is_restart {
                restart_count.fetch_add(1, Ordering::Relaxed);
                tracing::info!("Restart tamamlandı, toplam: {}", restart_count.load(Ordering::Relaxed));
            }
            (true, None, out)
        }
        Err(e) => {
            tracing::error!("Komut başarısız [{}]: {}", cmd.action, e);
            (false, Some(e), None)
        }
    };

    // Sonucu gönder
    let result = cmd.result_json(success, error, output);
    if let Err(e) = sink.send(Message::Text(result)).await {
        tracing::error!("Komut sonucu gönderilemedi: {}", e);
    }
}
