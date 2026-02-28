use futures_util::{SinkExt, StreamExt};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{mpsc, watch};
use tokio_tungstenite::{connect_async, tungstenite::Message};

use crate::buffer::MetricBuffer;
use crate::commands;
use crate::config::Config;
use crate::error::AgentError;

/// Max backoff delay in seconds
const MAX_BACKOFF_SECS: u64 = 32;
/// Jitter range in milliseconds
const JITTER_MAX_MS: u64 = 1000;

const OUTGOING_CHANNEL_CAPACITY: usize = 64;

pub type OutgoingTx = mpsc::Sender<String>;
pub type OutgoingRx = mpsc::Receiver<String>;

/// Paylaşılan WS bağlantı durumu
pub static WS_CONNECTED: AtomicBool = AtomicBool::new(false);
/// Toplam gönderilen metrik sayısı
pub static METRICS_SENT: AtomicU64 = AtomicU64::new(0);
/// Toplam başarılı komut sayısı
pub static COMMANDS_HANDLED: AtomicU64 = AtomicU64::new(0);

pub fn channel() -> (OutgoingTx, OutgoingRx) {
    mpsc::channel(OUTGOING_CHANNEL_CAPACITY)
}

/// Ana yeniden bağlanma döngüsü — shutdown sinyali gelene kadar çalışır.
pub async fn run(
    config: &Config,
    mut outgoing_rx: OutgoingRx,
    restart_count: Arc<AtomicU64>,
    buffer: MetricBuffer,
    mut shutdown_rx: watch::Receiver<bool>,
) {
    let ws_url = config.ws_url();
    let mut delay_secs: u64 = 1;
    let mut attempt: u32 = 0;

    loop {
        // Shutdown kontrolü
        if *shutdown_rx.borrow() {
            tracing::info!("WS task shutdown sinyali aldı — çıkılıyor");
            break;
        }

        attempt += 1;
        tracing::info!(attempt, "WS bağlantı denemesi");

        match connect_and_run(
            &ws_url,
            &mut outgoing_rx,
            config,
            Arc::clone(&restart_count),
            &buffer,
            &mut shutdown_rx,
        )
        .await
        {
            Ok(ShutdownReason::ServerClose) => {
                tracing::info!("WS sunucu tarafından kapatıldı — hemen yeniden bağlanılıyor");
                delay_secs = 1;
                attempt = 0;
            }
            Ok(ShutdownReason::Graceful) => {
                tracing::info!("WS graceful shutdown — çıkılıyor");
                break;
            }
            Err(e) => {
                WS_CONNECTED.store(false, Ordering::Relaxed);

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
                    "WS bağlantı hatası — yeniden denenecek"
                );

                // Bekleme sırasında shutdown kontrolü
                tokio::select! {
                    _ = tokio::time::sleep(sleep) => {},
                    _ = shutdown_rx.changed() => {
                        tracing::info!("Bekleme sırasında shutdown sinyali — çıkılıyor");
                        break;
                    }
                }

                delay_secs = (delay_secs * 2).min(MAX_BACKOFF_SECS);
            }
        }
    }

    WS_CONNECTED.store(false, Ordering::Relaxed);
}

enum ShutdownReason {
    ServerClose,
    Graceful,
}

async fn connect_and_run(
    ws_url: &str,
    outgoing_rx: &mut OutgoingRx,
    config: &Config,
    restart_count: Arc<AtomicU64>,
    buffer: &MetricBuffer,
    shutdown_rx: &mut watch::Receiver<bool>,
) -> Result<ShutdownReason, AgentError> {
    let (ws_stream, _) = connect_async(ws_url)
        .await
        .map_err(|e| AgentError::WebSocketConnection(e.to_string()))?;

    tracing::info!("WebSocket bağlantısı kuruldu ✓");
    WS_CONNECTED.store(true, Ordering::Relaxed);

    let (mut sink, mut stream) = ws_stream.split();

    // Buffer'daki birikmiş metrikleri gönder
    let buffered = buffer.drain().await;
    if !buffered.is_empty() {
        tracing::info!(
            count = buffered.len(),
            "Buffer'daki birikmiş metrikler gönderiliyor"
        );
        for msg in buffered {
            if let Err(e) = sink.send(Message::Text(msg)).await {
                tracing::warn!("Buffer metriği gönderilemedi: {}", e);
                // İlk hata — bağlantı kopmuş, çık
                WS_CONNECTED.store(false, Ordering::Relaxed);
                return Err(AgentError::WebSocketConnection(e.to_string()));
            }
            METRICS_SENT.fetch_add(1, Ordering::Relaxed);
        }
    }

    let mut ping_interval = tokio::time::interval(Duration::from_secs(30));
    ping_interval.tick().await; // ilk tick'i atla
    loop {
        tokio::select! {
            // Shutdown sinyali
            _ = shutdown_rx.changed() => {
                tracing::info!("WS loop shutdown sinyali aldı");
                let _ = sink.close().await;
                return Ok(ShutdownReason::Graceful);
            }

            // Heartbeat ping
            _ = ping_interval.tick() => {
                match sink.send(Message::Ping(vec![0x4E, 0x4E])).await {
                    Ok(_) => {
                        tracing::debug!("Heartbeat ping gönderildi");
                    }
                    Err(e) => {
                        WS_CONNECTED.store(false, Ordering::Relaxed);
                        return Err(AgentError::WebSocketConnection(format!("Ping hatası: {}", e)));
                    }
                }
            }

            // Outgoing metrics
            Some(msg) = outgoing_rx.recv() => {
                match sink.send(Message::Text(msg)).await {
                    Ok(_) => {
                        METRICS_SENT.fetch_add(1, Ordering::Relaxed);
                    }
                    Err(e) => {
                        WS_CONNECTED.store(false, Ordering::Relaxed);
                        return Err(AgentError::WebSocketConnection(e.to_string()));
                    }
                }
            }

            // Incoming messages
            msg = stream.next() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        handle_incoming(&text, &mut sink, config, Arc::clone(&restart_count)).await;
                    }
                    Some(Ok(Message::Pong(_))) => {
                        tracing::debug!("Pong alındı ✓");
                    }
                    Some(Ok(Message::Close(_))) => {
                        tracing::info!("WebSocket sunucu tarafından kapatıldı");
                        WS_CONNECTED.store(false, Ordering::Relaxed);
                        return Ok(ShutdownReason::ServerClose);
                    }
                    Some(Err(e)) => {
                        WS_CONNECTED.store(false, Ordering::Relaxed);
                        return Err(AgentError::WebSocketConnection(e.to_string()));
                    }
                    None => {
                        WS_CONNECTED.store(false, Ordering::Relaxed);
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
            tracing::warn!(error = %e, "Mesaj parse edilemedi");
            return;
        }
    };

    let msg_type = value.get("type").and_then(|v| v.as_str()).unwrap_or("");

    if msg_type != "command" {
        tracing::debug!(msg_type, "Bilinmeyen mesaj tipi");
        return;
    }

    let cmd: commands::IncomingCommand = match serde_json::from_value(value) {
        Ok(c) => c,
        Err(e) => {
            tracing::warn!(error = %e, "Komut parse edilemedi");
            return;
        }
    };

    tracing::info!(
        action = %cmd.action,
        command_id = %cmd.command_id,
        "Komut alındı"
    );

    // ACK gönder
    let ack = cmd.ack_json();
    if let Err(e) = sink.send(Message::Text(ack)).await {
        tracing::error!(error = %e, "ACK gönderilemedi");
        return;
    }

    let is_restart = cmd.action == "restart";

    // Komutu çalıştır
    let (success, error, output) = match commands::execute(&cmd, config).await {
        Ok(out) => {
            if is_restart {
                restart_count.fetch_add(1, Ordering::Relaxed);
                tracing::info!(
                    total = restart_count.load(Ordering::Relaxed),
                    "Restart tamamlandı"
                );
            }
            COMMANDS_HANDLED.fetch_add(1, Ordering::Relaxed);
            (true, None, out)
        }
        Err(e) => {
            tracing::error!(action = %cmd.action, error = %e, "Komut başarısız");
            (false, Some(e), None)
        }
    };

    // Sonucu gönder
    let result = cmd.result_json(success, error, output);
    if let Err(e) = sink.send(Message::Text(result)).await {
        tracing::error!(error = %e, "Komut sonucu gönderilemedi");
    }
}
