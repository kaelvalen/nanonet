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

    /// Aynı anda çalışabilecek maksimum komut sayısı (semaphore).
    /// Operatörün paralel `exec` saldırısına karşı throttling. 0 verilirse 1'e
    /// yuvarlanır.
    #[arg(long, default_value = "4", env = "NANONET_MAX_CONCURRENT_COMMANDS")]
    pub max_concurrent_commands: usize,

    /// Komut audit log NDJSON dosya yolu. Verilirse her gelen komut ve sonucu
    /// (redact edilmiş) bu dosyaya append edilir.
    #[arg(long, env = "NANONET_AUDIT_LOG_PATH")]
    pub audit_log_path: Option<String>,

    /// Komut HMAC imzalama için paylaşılan secret. Verilirse agent her gelen
    /// komutta `signature` ve `nonce` alanlarının dolu ve geçerli olmasını
    /// zorunlu kılar (replay koruması nonce cache ile sağlanır).
    #[arg(long, env = "NANONET_AGENT_SIGN_SECRET", hide_env_values = true)]
    pub sign_secret: Option<String>,

    /// Nonce cache'inin TTL'i (saniye). `sign_secret` ile birlikte etkili.
    #[arg(long, default_value = "300", env = "NANONET_NONCE_TTL_SEC")]
    pub nonce_ttl_sec: u64,

    /// Agent metric/heartbeat/dependency mesajlarına eklenecek statik etiketler.
    /// Birden fazla `key=value` virgül ile ayrılır.
    /// Örn: `--labels region=eu-west,role=db,tier=prod`.
    /// Anahtar/değer trim'lenir, boş anahtarlar yok sayılır.
    #[arg(long, env = "NANONET_LABELS", value_delimiter = ',')]
    pub labels: Vec<String>,

    /// Metrik buffer'ını süreç restart'larında korumak için snapshot dosyası.
    ///
    /// Verilirse:
    /// - Startup'ta dosya okunur ve metrikler buffer'a yüklenir.
    /// - Graceful shutdown sonunda buffer dosyaya yazılır.
    ///
    /// Verilmezse persist devre dışı (önceki davranış).
    #[arg(long, env = "NANONET_BUFFER_PERSIST_PATH")]
    pub buffer_persist_path: Option<String>,
}

impl Config {
    pub fn health_url(&self) -> String {
        format!("http://{}:{}{}", self.host, self.port, self.health_endpoint)
    }

    pub fn ws_url(&self) -> String {
        // Token URL'de taşınmaz — auth_header() kullan.
        format!("{}/ws/agent?service_id={}", self.backend, self.service_id)
    }

    /// WebSocket handshake Authorization header değeri.
    pub fn auth_header(&self) -> Option<String> {
        self.agent_token
            .as_deref()
            .or(self.token.as_deref())
            .map(|t| format!("Bearer {}", t))
    }

    /// Backend HTTP base URL (ws:// → http://, wss:// → https://)
    #[allow(dead_code)]
    pub fn http_base(&self) -> String {
        self.backend
            .replace("ws://", "http://")
            .replace("wss://", "https://")
    }

    pub fn effective_token(&self) -> Option<&str> {
        self.agent_token.as_deref().or(self.token.as_deref())
    }

    /// `--labels k=v,k2=v2` parse → sıralı (deterministik) anahtar/değer.
    /// Geçersiz girişler (eksik `=`, boş key) sessizce atlanır.
    pub fn label_map(&self) -> std::collections::BTreeMap<String, String> {
        let mut out = std::collections::BTreeMap::new();
        for raw in &self.labels {
            for part in raw.split(',') {
                let part = part.trim();
                if part.is_empty() {
                    continue;
                }
                let Some((k, v)) = part.split_once('=') else {
                    continue;
                };
                let k = k.trim();
                let v = v.trim();
                if k.is_empty() {
                    continue;
                }
                out.insert(k.to_string(), v.to_string());
            }
        }
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(args: &[&str]) -> Config {
        let mut full = vec!["nanonet-agent"];
        full.extend_from_slice(args);
        Config::parse_from(full)
    }

    fn minimal() -> Config {
        parse(&[
            "--backend",
            "ws://localhost:8080",
            "--service-id",
            "00000000-0000-0000-0000-000000000000",
        ])
    }

    #[test]
    fn defaults_are_sane() {
        let c = minimal();
        assert_eq!(c.host, "localhost");
        assert_eq!(c.port, 8080);
        assert_eq!(c.health_endpoint, "/health");
        assert_eq!(c.poll_interval, 10);
        assert_eq!(c.error_rate_window, 20);
        assert_eq!(c.buffer_size, 120);
        assert_eq!(c.agent_port, 0);
    }

    #[test]
    fn health_url_concatenation() {
        let c = parse(&[
            "--backend",
            "ws://localhost:8080",
            "--service-id",
            "x",
            "--host",
            "10.0.0.1",
            "--port",
            "9000",
            "--health-endpoint",
            "/healthz",
        ]);
        assert_eq!(c.health_url(), "http://10.0.0.1:9000/healthz");
    }

    #[test]
    fn ws_url_excludes_token() {
        let c = parse(&[
            "--backend",
            "wss://api.example.com",
            "--service-id",
            "abc",
            "--token",
            "supersecret",
        ]);
        let url = c.ws_url();
        assert!(url.starts_with("wss://api.example.com/ws/agent?service_id=abc"));
        assert!(!url.contains("supersecret"));
    }

    #[test]
    fn auth_header_prefers_agent_token() {
        let c = parse(&[
            "--backend",
            "ws://x",
            "--service-id",
            "s",
            "--token",
            "user-tok",
            "--agent-token",
            "agent-tok",
        ]);
        assert_eq!(c.auth_header().as_deref(), Some("Bearer agent-tok"));
        assert_eq!(c.effective_token(), Some("agent-tok"));
    }

    #[test]
    fn auth_header_falls_back_to_user_token() {
        let c = parse(&[
            "--backend",
            "ws://x",
            "--service-id",
            "s",
            "--token",
            "user-tok",
        ]);
        assert_eq!(c.auth_header().as_deref(), Some("Bearer user-tok"));
    }

    #[test]
    fn auth_header_none_when_no_token() {
        let c = minimal();
        assert!(c.auth_header().is_none());
        assert!(c.effective_token().is_none());
    }

    #[test]
    fn labels_parse_basic_pairs() {
        let c = parse(&[
            "--backend",
            "ws://x",
            "--service-id",
            "s",
            "--labels",
            "region=eu",
            "--labels",
            "role=db,tier=prod",
        ]);
        let m = c.label_map();
        assert_eq!(m.get("region").map(String::as_str), Some("eu"));
        assert_eq!(m.get("role").map(String::as_str), Some("db"));
        assert_eq!(m.get("tier").map(String::as_str), Some("prod"));
        assert_eq!(m.len(), 3);
    }

    #[test]
    fn labels_skip_invalid_entries() {
        let c = parse(&[
            "--backend",
            "ws://x",
            "--service-id",
            "s",
            "--labels",
            "noequals,=novalue,key=value, , trim_me = yes ",
        ]);
        let m = c.label_map();
        assert_eq!(m.get("key").map(String::as_str), Some("value"));
        assert_eq!(m.get("trim_me").map(String::as_str), Some("yes"));
        // 2 geçerli, 3 atılmış (`noequals` eksik =, `=novalue` boş key, `" "` boş).
        assert_eq!(m.len(), 2);
    }

    #[test]
    fn http_base_strips_ws_scheme() {
        let c = parse(&["--backend", "ws://localhost:8080", "--service-id", "s"]);
        assert_eq!(c.http_base(), "http://localhost:8080");

        let c = parse(&["--backend", "wss://api.example.com", "--service-id", "s"]);
        assert_eq!(c.http_base(), "https://api.example.com");
    }
}
