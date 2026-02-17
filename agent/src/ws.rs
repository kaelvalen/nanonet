use tokio_tungstenite::{connect_async, tungstenite::Message};
use futures_util::{SinkExt, StreamExt};
use std::time::Duration;
use crate::config::Config;
use crate::error::{AgentError, Result};

pub async fn connect_websocket(config: &Config) -> Result<()> {
    let ws_url = format!("{}/ws/agent", config.backend_url);
    
    let mut delay = Duration::from_secs(1);
    
    loop {
        match connect_and_run(&ws_url, config).await {
            Ok(_) => {
                delay = Duration::from_secs(1);
            }
            Err(e) => {
                tracing::warn!(
                    "WS bağlantı hatası: {}; {}s sonra yeniden deneniyor",
                    e,
                    delay.as_secs()
                );
                tokio::time::sleep(delay).await;
                delay = (delay * 2).min(Duration::from_secs(32));
            }
        }
    }
}

async fn connect_and_run(ws_url: &str, config: &Config) -> Result<()> {
    let (ws_stream, _) = connect_async(ws_url)
        .await
        .map_err(|e| AgentError::WebSocketConnection(e.to_string()))?;

    tracing::info!("WebSocket bağlantısı kuruldu");

    let (mut write, mut read) = ws_stream.split();

    let ping_interval = tokio::time::interval(Duration::from_secs(30));
    tokio::pin!(ping_interval);

    loop {
        tokio::select! {
            _ = ping_interval.tick() => {
                write.send(Message::Ping(vec![])).await
                    .map_err(|e| AgentError::WebSocketConnection(e.to_string()))?;
            }
            msg = read.next() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        tracing::debug!("Mesaj alındı: {}", text);
                    }
                    Some(Ok(Message::Close(_))) => {
                        tracing::info!("WebSocket bağlantısı kapatıldı");
                        return Ok(());
                    }
                    Some(Err(e)) => {
                        return Err(AgentError::WebSocketConnection(e.to_string()));
                    }
                    None => {
                        return Err(AgentError::WebSocketConnection("Bağlantı koptu".to_string()));
                    }
                    _ => {}
                }
            }
        }
    }
}
