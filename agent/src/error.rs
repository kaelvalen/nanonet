use thiserror::Error;

#[derive(Debug, Error)]
pub enum AgentError {
    #[error("WebSocket bağlantısı kurulamadı: {0}")]
    WebSocketConnection(String),

    #[error("Metrik toplanamadı: {0}")]
    MetricCollection(String),

    #[error("Health check hatası: {0}")]
    HealthCheck(String),

    #[error("Komut çalıştırılamadı: {action}: {reason}")]
    CommandExecution { action: String, reason: String },

    #[error("HTTP hatası: {0}")]
    Reqwest(#[from] reqwest::Error),

    #[error("Serde hatası: {0}")]
    Serde(#[from] serde_json::Error),

    #[error("IO hatası: {0}")]
    Io(#[from] std::io::Error),

    #[error("WebSocket protokol hatası: {0}")]
    Tungstenite(#[from] tokio_tungstenite::tungstenite::Error),
}

pub type Result<T> = std::result::Result<T, AgentError>;
