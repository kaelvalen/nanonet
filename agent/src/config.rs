use clap::Parser;

#[derive(Parser, Debug, Clone)]
#[command(name = "nanonet-agent")]
#[command(about = "NanoNet monitoring agent v0.2")]
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
    #[arg(long, env = "NANONET_RESTART_CMD")]
    pub restart_cmd: Option<String>,

    /// Servisi durdurmak için shell komutu
    #[arg(long, env = "NANONET_STOP_CMD")]
    pub stop_cmd: Option<String>,

    /// Servisi başlatmak için shell komutu
    #[arg(long, env = "NANONET_START_CMD")]
    pub start_cmd: Option<String>,

    /// Scale komutu için shell komutu
    #[arg(long, env = "NANONET_SCALE_CMD")]
    pub scale_cmd: Option<String>,

    /// Hata oranı hesabı için tutulacak health check sayısı
    #[arg(long, default_value = "20", env = "NANONET_ERROR_RATE_WINDOW")]
    pub error_rate_window: usize,

    /// İzlenen servisin /metrics endpoint'i (opsiyonel)
    #[arg(long, env = "NANONET_METRICS_ENDPOINT")]
    pub metrics_endpoint: Option<String>,

    /// İzlenecek sürecin PID veya ismi (opsiyonel)
    /// Örn: "nginx" veya "12345"
    #[arg(long, env = "NANONET_PROCESS")]
    pub process: Option<String>,

    /// Agent health endpoint portu (0 = devre dışı)
    /// K8s liveness/readiness probe olarak kullanılabilir
    #[arg(long, default_value = "0", env = "NANONET_AGENT_PORT")]
    pub agent_port: u16,

    /// Bağlantı koptuğunda biriktirilebilecek max metrik sayısı
    #[arg(long, default_value = "120", env = "NANONET_BUFFER_SIZE")]
    pub buffer_size: usize,
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

    /// Backend HTTP base URL (ws:// → http://, wss:// → https://)
    #[allow(dead_code)]
    pub fn http_base(&self) -> String {
        self.backend
            .replace("ws://", "http://")
            .replace("wss://", "https://")
    }

    #[allow(dead_code)]
    pub fn effective_token(&self) -> Option<&str> {
        self.agent_token.as_deref().or(self.token.as_deref())
    }
}
