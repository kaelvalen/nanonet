use reqwest::Client;
use std::time::{Duration, Instant};

pub struct HealthResult {
    pub status: String,
    pub latency_ms: f32,
    /// true ise hata sayacına ekle (5xx veya bağlantı hatası)
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

            let (status, is_error) = if status_code.is_success() {
                ("up", false)
            } else if status_code.is_server_error() {
                // 5xx → degraded ve hata olarak say
                ("degraded", true)
            } else {
                // 4xx, 3xx → degraded ama hata sayma (servis ayakta, içerik sorunu)
                ("degraded", false)
            };

            HealthResult {
                status: status.to_string(),
                latency_ms,
                is_error,
            }
        }
        Err(_) => HealthResult {
            status: "down".to_string(),
            latency_ms: 0.0,
            is_error: true,
        },
    }
}
