use reqwest::Client;
use std::time::Duration;
use crate::error::Result;

pub async fn check_health(client: &Client, url: &str) -> Result<(String, f32)> {
    let start = std::time::Instant::now();
    
    match client.get(url).timeout(Duration::from_secs(5)).send().await {
        Ok(response) => {
            let latency_ms = start.elapsed().as_millis() as f32;
            let status = if response.status().is_success() {
                "up"
            } else {
                "degraded"
            };
            Ok((status.to_string(), latency_ms))
        }
        Err(_) => Ok(("down".to_string(), 0.0)),
    }
}
