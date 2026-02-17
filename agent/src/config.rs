use clap::Parser;

#[derive(Parser, Debug, Clone)]
#[command(name = "nanonet-agent")]
#[command(about = "NanoNet monitoring agent")]
pub struct Config {
    /// WebSocket backend URL (e.g. ws://localhost:8080)
    #[arg(long, env = "NANONET_BACKEND")]
    pub backend: String,

    /// Service UUID to monitor
    #[arg(long, env = "NANONET_SERVICE_ID")]
    pub service_id: String,

    /// JWT token for authentication
    #[arg(long, env = "NANONET_TOKEN")]
    pub token: String,

    /// Target service host for health checks
    #[arg(long, default_value = "localhost")]
    pub host: String,

    /// Target service port for health checks
    #[arg(long, default_value = "8080")]
    pub port: u16,

    /// Health check endpoint path
    #[arg(long, default_value = "/health")]
    pub health_endpoint: String,

    /// Metric collection interval in seconds
    #[arg(long, default_value = "10")]
    pub poll_interval: u64,
}

impl Config {
    pub fn health_url(&self) -> String {
        format!("http://{}:{}{}", self.host, self.port, self.health_endpoint)
    }

    pub fn ws_url(&self) -> String {
        format!(
            "{}/ws/agent?service_id={}&token={}",
            self.backend, self.service_id, self.token
        )
    }
}
