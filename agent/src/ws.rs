use futures_util::{SinkExt, StreamExt};
use std::time::Duration;
use tokio::sync::mpsc;
use tokio_tungstenite::{connect_async, tungstenite::Message};

use crate::commands;
use crate::config::Config;
use crate::error::AgentError;

/// Outgoing message to send over WebSocket
pub type OutgoingTx = mpsc::UnboundedSender<String>;
pub type OutgoingRx = mpsc::UnboundedReceiver<String>;

/// Create channel for sending messages to the WebSocket
pub fn channel() -> (OutgoingTx, OutgoingRx) {
    mpsc::unbounded_channel()
}

/// Main reconnect loop — never returns unless fatal
pub async fn run(config: &Config, mut outgoing_rx: OutgoingRx) -> ! {
    let ws_url = config.ws_url();
    let mut delay = Duration::from_secs(1);

    loop {
        tracing::info!("WebSocket bağlantısı deneniyor: {}", config.backend);

        match connect_and_run(&ws_url, &mut outgoing_rx).await {
            Ok(()) => {
                tracing::info!("WebSocket bağlantısı kapandı, yeniden bağlanılıyor");
                delay = Duration::from_secs(1);
            }
            Err(e) => {
                tracing::warn!(
                    "WS bağlantı hatası: {}; {}s sonra yeniden deneniyor",
                    e,
                    delay.as_secs()
                );
            }
        }

        tokio::time::sleep(delay).await;
        delay = (delay * 2).min(Duration::from_secs(32));
    }
}

async fn connect_and_run(
    ws_url: &str,
    outgoing_rx: &mut OutgoingRx,
) -> Result<(), AgentError> {
    let (ws_stream, _) = connect_async(ws_url)
        .await
        .map_err(|e| AgentError::WebSocketConnection(e.to_string()))?;

    tracing::info!("WebSocket bağlantısı kuruldu");

    let (mut sink, mut stream) = ws_stream.split();

    let mut ping_interval = tokio::time::interval(Duration::from_secs(30));
    ping_interval.tick().await; // skip first immediate tick

    loop {
        tokio::select! {
            // Heartbeat ping
            _ = ping_interval.tick() => {
                sink.send(Message::Ping(vec![]))
                    .await
                    .map_err(|e| AgentError::WebSocketConnection(e.to_string()))?;
                tracing::debug!("Ping gönderildi");
            }

            // Outgoing messages (metrics etc.)
            Some(msg) = outgoing_rx.recv() => {
                sink.send(Message::Text(msg))
                    .await
                    .map_err(|e| AgentError::WebSocketConnection(e.to_string()))?;
            }

            // Incoming messages (commands from backend)
            msg = stream.next() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        handle_incoming(&text, &mut sink).await;
                    }
                    Some(Ok(Message::Pong(_))) => {
                        tracing::debug!("Pong alındı");
                    }
                    Some(Ok(Message::Close(_))) => {
                        tracing::info!("WebSocket kapatıldı (sunucu)");
                        return Ok(());
                    }
                    Some(Err(e)) => {
                        return Err(AgentError::WebSocketConnection(e.to_string()));
                    }
                    None => {
                        return Err(AgentError::WebSocketConnection(
                            "Bağlantı koptu".to_string(),
                        ));
                    }
                    _ => {}
                }
            }
        }
    }
}

async fn handle_incoming<S>(text: &str, sink: &mut S)
where
    S: SinkExt<Message> + Unpin,
    S::Error: std::fmt::Display,
{
    // Try to parse as a command
    let parsed: Result<serde_json::Value, _> = serde_json::from_str(text);
    let value = match parsed {
        Ok(v) => v,
        Err(e) => {
            tracing::warn!("Mesaj parse edilemedi: {} — {}", e, text);
            return;
        }
    };

    let msg_type = value.get("type").and_then(|v| v.as_str()).unwrap_or("");

    if msg_type != "command" {
        tracing::debug!("Bilinmeyen mesaj tipi: {}", msg_type);
        return;
    }

    let cmd: commands::IncomingCommand = match serde_json::from_value(value) {
        Ok(c) => c,
        Err(e) => {
            tracing::warn!("Komut parse edilemedi: {}", e);
            return;
        }
    };

    tracing::info!("Komut alındı: {} ({})", cmd.action, cmd.command_id);

    // Send ACK
    let ack = cmd.ack_json();
    if let Err(e) = sink.send(Message::Text(ack)).await {
        tracing::error!("ACK gönderilemedi: {}", e);
    }

    // Execute command
    let (success, error) = match commands::execute(&cmd).await {
        Ok(()) => (true, None),
        Err(e) => {
            tracing::error!("Komut başarısız: {}", e);
            (false, Some(e))
        }
    };

    // Send result
    let result = cmd.result_json(success, error);
    if let Err(e) = sink.send(Message::Text(result)).await {
        tracing::error!("Sonuç gönderilemedi: {}", e);
    }
}
