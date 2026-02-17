use reqwest::Client;
use std::time::{Duration, Instant};

pub struct HealthResult {
    pub status: String,
    pub latency_ms: f32,
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
            let status = if response.status().is_success() {
                "up"
            } else {
                "degraded"
            };
            HealthResult {
                status: status.to_string(),
                latency_ms,
            }
        }
        Err(_) => HealthResult {
            status: "down".to_string(),
            latency_ms: 0.0,
        },
    }
}
