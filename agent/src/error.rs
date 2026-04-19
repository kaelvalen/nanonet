use thiserror::Error;

/// Agent çalışma zamanı boyunca üretilebilen tüm hata türleri.
///
/// Yeni varyant eklerken: kullanıcıya görünür mesaj net olmalı; alt-hata
/// detayını sarmalamak için `#[from]` veya `String` formatı tercih edilir.
#[derive(Debug, Error)]
#[allow(dead_code)]
pub enum AgentError {
    /// WebSocket handshake/transport seviyesinde başarısızlık.
    #[error("WebSocket bağlantısı kurulamadı: {0}")]
    WebSocketConnection(String),

    /// Sistem/process metrik toplama sırasında oluşan hata.
    #[error("Metrik toplanamadı: {0}")]
    MetricCollection(String),

    /// Hedef servisin health endpoint'ine erişim hatası.
    #[error("Health check hatası: {0}")]
    HealthCheck(String),

    /// Allowlist'teki bir komutun çalışması sırasında oluşan hata.
    #[error("Komut çalıştırılamadı: {action}: {reason}")]
    CommandExecution { action: String, reason: String },

    /// Configuration parse / validate hatası (env, CLI veya dosya).
    #[error("Yapılandırma hatası: {0}")]
    Config(String),

    /// Başlatma sırasında oluşan ve agent'ın hayatta kalmasını engelleyen hata
    /// (örn. agent_health portu bind edilemedi).
    #[error("Başlatma hatası: {0}")]
    Startup(String),

    /// HTTP istemci üzerinden yapılan istek başarısız oldu.
    #[error("HTTP hatası: {0}")]
    Reqwest(#[from] reqwest::Error),

    /// JSON serialize / deserialize hatası.
    #[error("Serde hatası: {0}")]
    Serde(#[from] serde_json::Error),

    /// Genel I/O hatası (fs, network, vb.).
    #[error("IO hatası: {0}")]
    Io(#[from] std::io::Error),

    /// Tungstenite WebSocket protokol hatası.
    #[error("WebSocket protokol hatası: {0}")]
    Tungstenite(#[from] Box<tokio_tungstenite::tungstenite::Error>),
}

pub type Result<T> = std::result::Result<T, AgentError>;
