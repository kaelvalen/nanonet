use thiserror::Error;

#[derive(Debug, Error)]
pub enum AgentError {
    #[error("WebSocket bağlantısı kurulamadı: {0}")]
    WebSocketConnection(String),

    #[error("Metrik toplanamadı: {0}")]
    MetricCollection(String),

    #[error("Komut çalıştırılamadı: {action}: {reason}")]
    CommandExecution { action: String, reason: String },

    #[error("Serde hatası: {0}")]
    Serde(#[from] serde_json::Error),

    #[error("IO hatası: {0}")]
    Io(#[from] std::io::Error),
}

pub type Result<T> = std::result::Result<T, AgentError>;
