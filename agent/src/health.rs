use reqwest::Client;
use std::time::{Duration, Instant};

/// Latency above this threshold marks the service as degraded even if HTTP 2xx
const DEGRADED_LATENCY_MS: f32 = 2000.0;

pub struct HealthResult {
    pub status: String,
    pub latency_ms: f32,
    pub http_status: Option<u16>,
    /// true if this check should count toward the error rate
    pub is_error: bool,
}

pub async fn check_health(client: &Client, url: &str) -> HealthResult {
    let start = Instant::now();

    match client
        .get(url)
        .timeout(Duration::from_secs(5))
        .send()
        .await
    {
        Ok(response) => {
            let latency_ms = start.elapsed().as_secs_f32() * 1000.0;
            let status_code = response.status();
            let http_code = status_code.as_u16();

            let (status, is_error) = if status_code.is_success() && latency_ms < DEGRADED_LATENCY_MS {
                ("up", false)
            } else if status_code.is_success() {
                // Slow response — degraded but not an error
                ("degraded", false)
            } else if status_code.is_server_error() {
                // 5xx — degraded and count as error
                ("degraded", true)
            } else {
                // 4xx/3xx — degraded, not an error (service is reachable)
                ("degraded", false)
            };

            tracing::debug!(
                url,
                http_status = http_code,
                latency_ms,
                status,
                "health check"
            );

            HealthResult {
                status: status.to_string(),
                latency_ms,
                http_status: Some(http_code),
                is_error,
            }
        }
        Err(e) => {
            tracing::warn!(url, error = %e, "health check failed");
            HealthResult {
                status: "down".to_string(),
                latency_ms: 0.0,
                http_status: None,
                is_error: true,
            }
        }
    }
}
