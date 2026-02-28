use axum::{routing::get, Json, Router};
use serde_json::json;
use std::net::SocketAddr;
use std::sync::atomic::Ordering;
use std::time::Instant;

use crate::buffer::MetricBuffer;
use crate::ws;

/// Agent'ın kendi health endpoint'i.
/// K8s liveness/readiness probe, monitoring veya debug amaçlı.
///
/// GET /health  → agent durumu
/// GET /status  → detaylı istatistikler
pub async fn serve(port: u16, start_time: Instant, buffer: MetricBuffer) {
    if port == 0 {
        return;
    }

    let app = Router::new()
        .route("/health", get({
            let buffer = buffer.clone();
            move || health_handler(start_time, buffer.clone())
        }))
        .route("/status", get({
            let buffer = buffer.clone();
            move || status_handler(start_time, buffer.clone())
        }));

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("Agent health endpoint: http://0.0.0.0:{}/health", port);

    if let Err(e) = axum::serve(
        tokio::net::TcpListener::bind(addr).await.expect("Agent port bind edilemedi"),
        app,
    )
    .await
    {
        tracing::error!(error = %e, "Agent health server hatası");
    }
}

async fn health_handler(start_time: Instant, _buffer: MetricBuffer) -> Json<serde_json::Value> {
    let connected = ws::WS_CONNECTED.load(Ordering::Relaxed);
    Json(json!({
        "status": if connected { "ok" } else { "degraded" },
        "agent_version": env!("CARGO_PKG_VERSION"),
        "ws_connected": connected,
        "uptime_seconds": start_time.elapsed().as_secs(),
    }))
}

async fn status_handler(start_time: Instant, buffer: MetricBuffer) -> Json<serde_json::Value> {
    let connected = ws::WS_CONNECTED.load(Ordering::Relaxed);
    let buf_len = buffer.len().await;
    Json(json!({
        "status": if connected { "ok" } else { "degraded" },
        "agent_version": env!("CARGO_PKG_VERSION"),
        "ws_connected": connected,
        "uptime_seconds": start_time.elapsed().as_secs(),
        "metrics": {
            "sent": ws::METRICS_SENT.load(Ordering::Relaxed),
            "buffered": buf_len,
            "dropped": buffer.dropped_count(),
            "total_buffered": buffer.total_buffered(),
        },
        "commands": {
            "handled": ws::COMMANDS_HANDLED.load(Ordering::Relaxed),
        }
    }))
}
