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
        .timeout(Duration::from_secs(10))
        .send()
        .await
    {
        Ok(response) => {
            let latency_ms = start.elapsed().as_secs_f32() * 1000.0;
            let status_code = response.status();
            let http_code = status_code.as_u16();

            let (status, is_error) = if status_code.is_success() && latency_ms < DEGRADED_LATENCY_MS
            {
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

#[cfg(test)]
mod tests {
    use super::*;
    use axum::response::IntoResponse;
    use axum::{routing::get, Router};
    use std::net::SocketAddr;
    use std::sync::atomic::{AtomicU32, Ordering};
    use std::sync::Arc;
    use std::time::Duration;
    use tokio::net::TcpListener;

    /// Verilen handler ile loopback üzerinde geçici HTTP sunucusu kurar.
    /// Sunucu task'ı testin sonunda otomatik temizlenir.
    async fn start_test_server<F, Fut>(handler: F) -> SocketAddr
    where
        F: Fn() -> Fut + Send + Sync + Clone + 'static,
        Fut: std::future::Future<Output = axum::response::Response> + Send + 'static,
    {
        let app = Router::new().route("/health", get(move || handler.clone()()));
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move {
            let _ = axum::serve(listener, app).await;
        });
        // Başlama için kısa uyku.
        tokio::time::sleep(Duration::from_millis(20)).await;
        addr
    }

    fn client() -> Client {
        // Yavaş yanıt testleri için client timeout uzun tutulur; check_health
        // zaten her isteğe per-request 10s timeout uygular.
        Client::builder()
            .timeout(Duration::from_secs(15))
            .build()
            .unwrap()
    }

    #[tokio::test]
    async fn returns_up_for_2xx_fast() {
        let addr = start_test_server(|| async { "ok".into_response() }).await;
        let url = format!("http://{}/health", addr);
        let r = check_health(&client(), &url).await;
        assert_eq!(r.status, "up");
        assert!(!r.is_error);
        assert_eq!(r.http_status, Some(200));
    }

    #[tokio::test]
    async fn returns_degraded_with_error_for_5xx() {
        let addr = start_test_server(|| async {
            (axum::http::StatusCode::INTERNAL_SERVER_ERROR, "boom").into_response()
        })
        .await;
        let url = format!("http://{}/health", addr);
        let r = check_health(&client(), &url).await;
        assert_eq!(r.status, "degraded");
        assert!(r.is_error, "5xx hata olarak sayılmalı");
        assert_eq!(r.http_status, Some(500));
    }

    #[tokio::test]
    async fn returns_degraded_without_error_for_4xx() {
        let addr = start_test_server(|| async {
            (axum::http::StatusCode::NOT_FOUND, "nope").into_response()
        })
        .await;
        let url = format!("http://{}/health", addr);
        let r = check_health(&client(), &url).await;
        assert_eq!(r.status, "degraded");
        assert!(!r.is_error, "4xx hata sayılmamalı");
        assert_eq!(r.http_status, Some(404));
    }

    #[tokio::test]
    async fn returns_down_when_unreachable() {
        // Port 1: TCP RST garanti.
        let r = check_health(&client(), "http://127.0.0.1:1/health").await;
        assert_eq!(r.status, "down");
        assert!(r.is_error);
        assert!(r.http_status.is_none());
    }

    #[tokio::test]
    async fn slow_2xx_marked_degraded() {
        // İlk istek normal, sonraki 2.1 saniye sonra cevap verir.
        let counter = Arc::new(AtomicU32::new(0));
        let counter_handler = Arc::clone(&counter);
        let addr = start_test_server(move || {
            let n = counter_handler.fetch_add(1, Ordering::Relaxed);
            async move {
                if n == 0 {
                    "fast".into_response()
                } else {
                    tokio::time::sleep(Duration::from_millis(2100)).await;
                    "slow".into_response()
                }
            }
        })
        .await;
        let url = format!("http://{}/health", addr);
        // Birinci çağrı uyumadan döner; warm-up ölçümü.
        let _ = check_health(&client(), &url).await;
        let r = check_health(&client(), &url).await;
        assert_eq!(r.http_status, Some(200));
        assert_eq!(r.status, "degraded", "yavaş 2xx degraded olmalı");
        assert!(!r.is_error);
    }
}
