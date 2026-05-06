use std::fmt;
use std::path::Path;

use clap::Parser;
use secrecy::{ExposeSecret, SecretString};

/// CLI/env yapılandırması.
///
/// **Güvenlik notu**: token alanları clap tarafından `String` olarak okunup
/// `from_args()` içinde `SecretString` sarmalına alınır. `Debug` impl'ı
/// secret alanları "[REDACTED]" olarak gösterir; `tracing::debug!("{:?}",
/// config)` gibi bir kullanım bile bu yüzden token sızdırmaz.
///
/// **Token kaynak öncelik sırası** (`load_secrets` içinde uygulanır):
///   1. `--agent-token-file <path>` (önerilen — argv'de leak yok)
///   2. `--token-file <path>`
///   3. `--agent-token` / `NANONET_AGENT_TOKEN`
///   4. `--token` / `NANONET_TOKEN`  (legacy user-token; uyarı verilir)
#[derive(Parser, Clone)]
#[command(name = "nanonet-agent")]
#[command(about = "NanoNet monitoring agent v0.2")]
pub struct Config {
    #[arg(long, env = "NANONET_BACKEND")]
    pub backend: String,

    #[arg(long, env = "NANONET_SERVICE_ID")]
    pub service_id: String,

    /// Kimlik doğrulama için kullanıcı access token'ı (legacy, geçici).
    ///
    /// Komut satırında geçirilirse `ps`/`/proc/<pid>/cmdline` üstünden
    /// sızar. Üretimde **`--agent-token-file`** ya da `NANONET_AGENT_TOKEN`
    /// env tercih edilmelidir.
    #[arg(long, env = "NANONET_TOKEN", hide_env_values = true)]
    pub token: Option<String>,

    /// Agent için uzun ömürlü token (önerilen). Yine **dosyaya** veya
    /// **env**'e yazmak en güvenlisi; CLI argv'sinde leak olur.
    #[arg(long, env = "NANONET_AGENT_TOKEN", hide_env_values = true)]
    pub agent_token: Option<String>,

    /// Token'ı bir dosyadan oku (içerik trim edilir, ilk satır kullanılır).
    /// `--token` ile aynı semantikte, fakat argv'de görünmez.
    #[arg(long, env = "NANONET_TOKEN_FILE")]
    pub token_file: Option<String>,

    /// Agent token'ı bir dosyadan oku. Dosya `chmod 600` önerilir.
    #[arg(long, env = "NANONET_AGENT_TOKEN_FILE")]
    pub agent_token_file: Option<String>,

    #[arg(long, default_value = "localhost", env = "NANONET_HOST")]
    pub host: String,

    #[arg(long, default_value = "8080", env = "NANONET_PORT")]
    pub port: u16,

    #[arg(long, default_value = "/health", env = "NANONET_HEALTH_ENDPOINT")]
    pub health_endpoint: String,

    #[arg(long, default_value = "10", env = "NANONET_POLL_INTERVAL")]
    pub poll_interval: u64,

    #[arg(long, env = "NANONET_RESTART_CMD")]
    pub restart_cmd: Option<String>,

    #[arg(long, env = "NANONET_STOP_CMD")]
    pub stop_cmd: Option<String>,

    #[arg(long, env = "NANONET_START_CMD")]
    pub start_cmd: Option<String>,

    #[arg(long, env = "NANONET_SCALE_CMD")]
    pub scale_cmd: Option<String>,

    #[arg(long, default_value = "20", env = "NANONET_ERROR_RATE_WINDOW")]
    pub error_rate_window: usize,

    #[arg(long, env = "NANONET_METRICS_ENDPOINT")]
    pub metrics_endpoint: Option<String>,

    #[arg(long, env = "NANONET_PROCESS")]
    pub process: Option<String>,

    #[arg(long, default_value = "0", env = "NANONET_AGENT_PORT")]
    pub agent_port: u16,

    #[arg(long, default_value = "120", env = "NANONET_BUFFER_SIZE")]
    pub buffer_size: usize,

    #[arg(long, default_value = "4", env = "NANONET_MAX_CONCURRENT_COMMANDS")]
    pub max_concurrent_commands: usize,

    #[arg(long, env = "NANONET_AUDIT_LOG_PATH")]
    pub audit_log_path: Option<String>,

    #[arg(long, env = "NANONET_AGENT_SIGN_SECRET", hide_env_values = true)]
    pub sign_secret: Option<String>,

    #[arg(long, default_value = "300", env = "NANONET_NONCE_TTL_SEC")]
    pub nonce_ttl_sec: u64,

    #[arg(long, env = "NANONET_LABELS", value_delimiter = ',')]
    pub labels: Vec<String>,

    #[arg(long, env = "NANONET_BUFFER_PERSIST_PATH")]
    pub buffer_persist_path: Option<String>,
}

/// `Config` derive'lı `Debug`'tan kaçınıyoruz: token alanları "[REDACTED]"
/// olarak yazılsın diye custom impl yazıyoruz. (`SecretString` zaten
/// otomatik redacted bir Debug sağlıyor; ama bu custom impl ham String
/// olarak tutulan diğer hassas alanlarda da güvenli davranışı garanti eder.)
impl fmt::Debug for Config {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let token_kind = self.token_present_kind();
        f.debug_struct("Config")
            .field("backend", &self.backend)
            .field("service_id", &self.service_id)
            .field("token_kind", &token_kind)
            .field("host", &self.host)
            .field("port", &self.port)
            .field("health_endpoint", &self.health_endpoint)
            .field("poll_interval", &self.poll_interval)
            .field("error_rate_window", &self.error_rate_window)
            .field("metrics_endpoint", &self.metrics_endpoint)
            .field("agent_port", &self.agent_port)
            .field("buffer_size", &self.buffer_size)
            .field("max_concurrent_commands", &self.max_concurrent_commands)
            .field("audit_log_path", &self.audit_log_path)
            .field("sign_secret_present", &self.sign_secret.is_some())
            .field("nonce_ttl_sec", &self.nonce_ttl_sec)
            .field("labels", &self.labels)
            .field("buffer_persist_path", &self.buffer_persist_path)
            .finish()
    }
}

impl Config {
    pub fn health_url(&self) -> String {
        format!("http://{}:{}{}", self.host, self.port, self.health_endpoint)
    }

    pub fn ws_url(&self) -> String {
        // Token URL'de taşınmaz — auth_header() kullan.
        format!("{}/ws/agent?service_id={}", self.backend, self.service_id)
    }

    /// Backend HTTP base URL (ws:// → http://, wss:// → https://)
    #[allow(dead_code)]
    pub fn http_base(&self) -> String {
        self.backend
            .replace("ws://", "http://")
            .replace("wss://", "https://")
    }

    /// Etkin token'ı `SecretString` olarak döner.
    ///
    /// Token kaynaklarını sıralı dener; *file* kaynakları leak'siz olduğu
    /// için önce gelir. Bir dosya verilmiş ama okunamıyorsa hata loglanır
    /// ve bir sonraki kaynağa fallback yapılır.
    pub fn effective_secret(&self) -> Option<SecretString> {
        if let Some(p) = &self.agent_token_file {
            if let Some(s) = read_token_file(p, "agent-token-file") {
                return Some(s);
            }
        }
        if let Some(p) = &self.token_file {
            if let Some(s) = read_token_file(p, "token-file") {
                return Some(s);
            }
        }
        if let Some(t) = self.agent_token.as_ref().filter(|s| !s.is_empty()) {
            return Some(SecretString::new(t.clone()));
        }
        if let Some(t) = self.token.as_ref().filter(|s| !s.is_empty()) {
            tracing::warn!(
                "Legacy --token / NANONET_TOKEN kullanılıyor. Üretimde --agent-token-file tercih edin."
            );
            return Some(SecretString::new(t.clone()));
        }
        None
    }

    /// Geri uyumluluk için: hangi token kaynağının bulunduğunu döner.
    fn token_present_kind(&self) -> &'static str {
        if self
            .agent_token_file
            .as_deref()
            .is_some_and(|s| !s.is_empty())
        {
            return "agent-token-file";
        }
        if self.token_file.as_deref().is_some_and(|s| !s.is_empty()) {
            return "token-file";
        }
        if self.agent_token.as_deref().is_some_and(|s| !s.is_empty()) {
            return "agent-token-env";
        }
        if self.token.as_deref().is_some_and(|s| !s.is_empty()) {
            return "user-token-env";
        }
        "none"
    }

    /// `effective_secret()` varsa "Bearer <secret>" üretir.
    pub fn auth_header(&self) -> Option<String> {
        self.effective_secret()
            .map(|s| format!("Bearer {}", s.expose_secret()))
    }

    /// Banner gibi yerlerde token'ın *varlığını* ifade etmek için kullanılır.
    pub fn has_token(&self) -> bool {
        self.effective_secret().is_some()
    }

    /// `--labels k=v,k2=v2` parse → sıralı (deterministik) anahtar/değer.
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

/// Token dosyasını okur, satır sonlarını ve etrafındaki boşlukları temizler.
/// Hata durumunda warn'la geçer (None döner) — başka bir kaynağa fallback
/// edilebilsin diye.
fn read_token_file(path: &str, label: &str) -> Option<SecretString> {
    let p = Path::new(path);
    match std::fs::read_to_string(p) {
        Ok(content) => {
            let trimmed = content.lines().next().unwrap_or("").trim();
            if trimmed.is_empty() {
                tracing::warn!(path, label, "Token dosyası boş");
                return None;
            }
            Some(SecretString::new(trimmed.to_string()))
        }
        Err(e) => {
            tracing::error!(path, label, error = %e, "Token dosyası okunamadı");
            None
        }
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
        assert!(!c.has_token());
    }

    #[test]
    fn token_file_takes_precedence_over_env() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("tok");
        std::fs::write(&path, "from-file\n").unwrap();
        let c = parse(&[
            "--backend",
            "ws://x",
            "--service-id",
            "s",
            "--token",
            "from-cli",
            "--token-file",
            path.to_str().unwrap(),
        ]);
        assert_eq!(c.auth_header().as_deref(), Some("Bearer from-file"));
    }

    #[test]
    fn agent_token_file_beats_token_file() {
        let dir = tempfile::tempdir().unwrap();
        let agent_path = dir.path().join("agent.tok");
        let user_path = dir.path().join("user.tok");
        std::fs::write(&agent_path, "agent-secret").unwrap();
        std::fs::write(&user_path, "user-secret").unwrap();
        let c = parse(&[
            "--backend",
            "ws://x",
            "--service-id",
            "s",
            "--agent-token-file",
            agent_path.to_str().unwrap(),
            "--token-file",
            user_path.to_str().unwrap(),
        ]);
        assert_eq!(c.auth_header().as_deref(), Some("Bearer agent-secret"));
    }

    #[test]
    fn debug_does_not_leak_token() {
        let c = parse(&[
            "--backend",
            "ws://x",
            "--service-id",
            "s",
            "--token",
            "supersecret-deadbeef",
            "--agent-token",
            "agent-deadbeef",
        ]);
        let dbg = format!("{c:?}");
        assert!(
            !dbg.contains("supersecret-deadbeef"),
            "Debug leaked legacy token: {dbg}"
        );
        assert!(
            !dbg.contains("agent-deadbeef"),
            "Debug leaked agent token: {dbg}"
        );
        assert!(
            dbg.contains("token_kind"),
            "Debug should mention which token kind was provided: {dbg}"
        );
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
