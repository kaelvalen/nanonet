use clap::Parser;

#[derive(Parser, Debug, Clone)]
#[command(name = "nanonet-agent")]
#[command(about = "NanoNet monitoring agent")]
pub struct Config {
    /// WebSocket backend URL (örn: ws://localhost:8080)
    #[arg(long, env = "NANONET_BACKEND")]
    pub backend: String,

    /// İzlenecek servisin UUID'si
    #[arg(long, env = "NANONET_SERVICE_ID")]
    pub service_id: String,

    /// Kimlik doğrulama için JWT token (user access token - geçici)
    #[arg(long, env = "NANONET_TOKEN")]
    pub token: Option<String>,

    /// Agent için özel uzun ömürlü token (önerilen)
    #[arg(long, env = "NANONET_AGENT_TOKEN")]
    pub agent_token: Option<String>,

    /// Health check için hedef host
    #[arg(long, default_value = "localhost", env = "NANONET_HOST")]
    pub host: String,

    /// Health check için hedef port
    #[arg(long, default_value = "8080", env = "NANONET_PORT")]
    pub port: u16,

    /// Health check endpoint yolu
    #[arg(long, default_value = "/health", env = "NANONET_HEALTH_ENDPOINT")]
    pub health_endpoint: String,

    /// Metrik toplama aralığı (saniye)
    #[arg(long, default_value = "10", env = "NANONET_POLL_INTERVAL")]
    pub poll_interval: u64,

    /// Servisi yeniden başlatmak için shell komutu
    /// Örn: "systemctl restart myapp" veya "pm2 restart myapp"
    #[arg(long, env = "NANONET_RESTART_CMD")]
    pub restart_cmd: Option<String>,

    /// Servisi durdurmak için shell komutu
    /// Örn: "systemctl stop myapp" veya "pm2 stop myapp"
    #[arg(long, env = "NANONET_STOP_CMD")]
    pub stop_cmd: Option<String>,

    /// Hata oranı hesabı için tutulacak health check sayısı
    #[arg(long, default_value = "20", env = "NANONET_ERROR_RATE_WINDOW")]
    pub error_rate_window: usize,

    /// İzlenen servisin /metrics endpoint'i (opsiyonel)
    /// Varsa cpu_percent ve memory_used_mb bu endpoint'ten alınır.
    /// Örn: http://localhost:8004/metrics
    #[arg(long, env = "NANONET_METRICS_ENDPOINT")]
    pub metrics_endpoint: Option<String>,
}

impl Config {
    pub fn health_url(&self) -> String {
        format!("http://{}:{}{}", self.host, self.port, self.health_endpoint)
    }

    pub fn ws_url(&self) -> String {
        let token = self.agent_token.clone()
            .or_else(|| self.token.clone())
            .unwrap_or_else(|| "no-token".to_string());
        
        format!(
            "{}/ws/agent?service_id={}&token={}",
            self.backend, self.service_id, token
        )
    }
}
