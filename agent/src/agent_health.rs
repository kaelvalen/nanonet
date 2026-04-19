//! Agent'ın *kendi* HTTP health endpoint'i.
//!
//! Kubernetes liveness/readiness probe veya operatör debug'ı için
//! `/health` ve `/status` route'larını sunar. Tüm sayaçlar [`AppState`]
//! üzerinden okunur.
//!
//! ## Endpoint'ler
//!
//! - `GET /health` — minimal "ok|degraded" yanıtı (probe için ideal)
//! - `GET /status` — buffer/metrik/komut sayaçları dahil ayrıntılı durum
//!
//! `port == 0` ise endpoint hiç açılmaz (default).

use axum::{
    http::{header, StatusCode},
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use serde_json::json;
use std::net::SocketAddr;
use std::sync::Arc;

use crate::error::{AgentError, Result};
use crate::state::AppState;
use crate::VERSION;

/// Agent health server'ını başlatır. `port == 0` ise hiç bind etmez.
///
/// Hata yalnızca bind aşamasında üretilir; `axum::serve` döngüsündeki çalışma
/// zamanı hataları log'a yazılır ve `Ok(())` döner (process'i düşürmek istemiyoruz).
pub async fn serve(port: u16, state: Arc<AppState>) -> Result<()> {
    if port == 0 {
        return Ok(());
    }

    let app = Router::new()
        .route(
            "/health",
            get({
                let state = Arc::clone(&state);
                move || health_handler(Arc::clone(&state))
            }),
        )
        .route(
            "/status",
            get({
                let state = Arc::clone(&state);
                move || status_handler(Arc::clone(&state))
            }),
        )
        .route(
            "/metrics",
            get({
                let state = Arc::clone(&state);
                move || metrics_handler(Arc::clone(&state))
            }),
        );

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("Agent health endpoint: http://0.0.0.0:{}/health", port);

    let listener = tokio::net::TcpListener::bind(addr).await.map_err(|e| {
        AgentError::Startup(format!(
            "Agent health portu bind edilemedi ({}): {}",
            addr, e
        ))
    })?;

    if let Err(e) = axum::serve(listener, app).await {
        tracing::error!(error = %e, "Agent health server hatası");
    }
    Ok(())
}

async fn health_handler(state: Arc<AppState>) -> Json<serde_json::Value> {
    let connected = state.is_ws_connected();
    Json(json!({
        "status": if connected { "ok" } else { "degraded" },
        "agent_version": VERSION,
        "agent_id": state.agent_id,
        "ws_connected": connected,
        "uptime_seconds": state.uptime_secs(),
    }))
}

async fn status_handler(state: Arc<AppState>) -> Json<serde_json::Value> {
    let connected = state.is_ws_connected();
    let buf_len = state.buffer.len().await;
    Json(json!({
        "status": if connected { "ok" } else { "degraded" },
        "agent_version": VERSION,
        "agent_id": state.agent_id,
        "ws_connected": connected,
        "uptime_seconds": state.uptime_secs(),
        "metrics": {
            "sent": state.metrics_sent.load(std::sync::atomic::Ordering::Relaxed),
            "buffered": buf_len,
            "dropped": state.buffer.dropped_count(),
            "total_buffered": state.buffer.total_buffered(),
        },
        "commands": {
            "handled": state.commands_handled.load(std::sync::atomic::Ordering::Relaxed),
            "rejected": state.commands_rejected.load(std::sync::atomic::Ordering::Relaxed),
            "unverified": state.commands_unverified.load(std::sync::atomic::Ordering::Relaxed),
            "concurrency_available": state.command_semaphore.available_permits(),
            "signing_enforced": state.verifier.is_enforcing(),
        },
        "restarts": state.restart_count.load(std::sync::atomic::Ordering::Relaxed),
        "ws_reconnects": state.ws_reconnects.load(std::sync::atomic::Ordering::Relaxed),
        "panics": state.panics.load(std::sync::atomic::Ordering::Relaxed),
    }))
}

/// Prometheus exposition format çıktısı (`text/plain; version=0.0.4`).
///
/// Tüm metrikler `nanonet_agent_*` prefix'i ile servis edilir; agent_id ve
/// version `info` metriği üzerinden label olarak verilir, böylece sayaçların
/// kendisi sade tutulur (yüksek-cardinality label yok).
async fn metrics_handler(state: Arc<AppState>) -> impl IntoResponse {
    use std::fmt::Write;
    use std::sync::atomic::Ordering::Relaxed;

    let connected = state.is_ws_connected();
    let buf_len = state.buffer.len().await;

    let mut out = String::with_capacity(2048);

    let _ = writeln!(out, "# HELP nanonet_agent_info Build / runtime info.");
    let _ = writeln!(out, "# TYPE nanonet_agent_info gauge");
    let _ = writeln!(
        out,
        "nanonet_agent_info{{agent_id=\"{}\",version=\"{}\"}} 1",
        prom_label(&state.agent_id),
        prom_label(VERSION)
    );

    write_gauge(
        &mut out,
        "nanonet_agent_uptime_seconds",
        "Agent uptime in seconds.",
        state.uptime_secs() as f64,
    );
    write_gauge(
        &mut out,
        "nanonet_agent_ws_connected",
        "WS bağlantısı aktif mi (1/0).",
        if connected { 1.0 } else { 0.0 },
    );
    write_gauge(
        &mut out,
        "nanonet_agent_signing_enforced",
        "Komut HMAC imzalama zorunlu mu (1/0).",
        if state.verifier.is_enforcing() {
            1.0
        } else {
            0.0
        },
    );

    write_counter(
        &mut out,
        "nanonet_agent_metrics_sent_total",
        "Backend'e başarıyla teslim edilmiş mesaj sayısı.",
        state.metrics_sent.load(Relaxed),
    );
    write_counter(
        &mut out,
        "nanonet_agent_metrics_dropped_total",
        "Buffer overflow nedeniyle düşürülen metrik sayısı.",
        state.buffer.dropped_count(),
    );
    write_counter(
        &mut out,
        "nanonet_agent_metrics_buffered_total",
        "Şimdiye kadar buffer'a yazılan toplam metrik sayısı.",
        state.buffer.total_buffered(),
    );
    write_gauge(
        &mut out,
        "nanonet_agent_metrics_buffer_current",
        "Buffer'da bekleyen metrik sayısı.",
        buf_len as f64,
    );

    write_counter(
        &mut out,
        "nanonet_agent_commands_handled_total",
        "Başarıyla işlenmiş komut sayısı.",
        state.commands_handled.load(Relaxed),
    );
    write_counter(
        &mut out,
        "nanonet_agent_commands_rejected_total",
        "Permit alamadığı için reddedilen komut sayısı.",
        state.commands_rejected.load(Relaxed),
    );
    write_counter(
        &mut out,
        "nanonet_agent_commands_unverified_total",
        "İmza doğrulamada başarısız komut sayısı.",
        state.commands_unverified.load(Relaxed),
    );
    write_gauge(
        &mut out,
        "nanonet_agent_command_concurrency_available",
        "Anlık olarak müsait komut permit sayısı.",
        state.command_semaphore.available_permits() as f64,
    );

    write_counter(
        &mut out,
        "nanonet_agent_restarts_total",
        "Servis restart komutu kaç kez çalıştı.",
        state.restart_count.load(Relaxed),
    );
    write_counter(
        &mut out,
        "nanonet_agent_ws_reconnects_total",
        "WS reconnect denemesi (kümülatif).",
        state.ws_reconnects.load(Relaxed),
    );
    write_counter(
        &mut out,
        "nanonet_agent_panics_total",
        "Process içinde yakalanmış panik sayısı.",
        state.panics.load(Relaxed),
    );

    (
        StatusCode::OK,
        [(header::CONTENT_TYPE, "text/plain; version=0.0.4")],
        out,
    )
}

fn write_counter(out: &mut String, name: &str, help: &str, value: u64) {
    use std::fmt::Write;
    let _ = writeln!(out, "# HELP {name} {help}");
    let _ = writeln!(out, "# TYPE {name} counter");
    let _ = writeln!(out, "{name} {value}");
}

fn write_gauge(out: &mut String, name: &str, help: &str, value: f64) {
    use std::fmt::Write;
    let _ = writeln!(out, "# HELP {name} {help}");
    let _ = writeln!(out, "# TYPE {name} gauge");
    let _ = writeln!(out, "{name} {value}");
}

/// Prometheus label value escape (newline, backslash, double quote).
fn prom_label(v: &str) -> String {
    v.replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::buffer::MetricBuffer;
    use std::sync::atomic::Ordering;

    fn test_state() -> Arc<AppState> {
        AppState::new("agent-test".to_string(), MetricBuffer::new(10))
    }

    #[tokio::test]
    async fn health_reports_degraded_when_disconnected() {
        let state = test_state();
        let Json(v) = health_handler(Arc::clone(&state)).await;
        assert_eq!(v["status"], "degraded");
        assert_eq!(v["ws_connected"], false);
        assert_eq!(v["agent_version"], VERSION);
        assert_eq!(v["agent_id"], "agent-test");
        assert!(v["uptime_seconds"].is_number());
    }

    #[tokio::test]
    async fn health_reports_ok_when_connected() {
        let state = test_state();
        state.set_ws_connected(true);
        let Json(v) = health_handler(state).await;
        assert_eq!(v["status"], "ok");
        assert_eq!(v["ws_connected"], true);
    }

    #[tokio::test]
    async fn status_includes_all_counters() {
        let state = test_state();
        state.metrics_sent.store(7, Ordering::Relaxed);
        state.commands_handled.store(3, Ordering::Relaxed);
        state.restart_count.store(2, Ordering::Relaxed);
        state.ws_reconnects.store(5, Ordering::Relaxed);

        let Json(v) = status_handler(state).await;
        assert_eq!(v["metrics"]["sent"], 7);
        assert_eq!(v["metrics"]["buffered"], 0);
        assert_eq!(v["commands"]["handled"], 3);
        assert_eq!(v["commands"]["rejected"], 0);
        assert!(v["commands"]["concurrency_available"].is_number());
        assert_eq!(v["restarts"], 2);
        assert_eq!(v["ws_reconnects"], 5);
    }

    #[tokio::test]
    async fn metrics_emits_prometheus_text() {
        let state = test_state();
        state.metrics_sent.store(11, Ordering::Relaxed);
        state.commands_handled.store(2, Ordering::Relaxed);
        state.set_ws_connected(true);

        let response = metrics_handler(state).await.into_response();
        assert_eq!(response.status(), StatusCode::OK);
        let ct = response
            .headers()
            .get(header::CONTENT_TYPE)
            .map(|v| v.to_str().unwrap().to_string())
            .unwrap_or_default();
        assert!(ct.starts_with("text/plain"), "ct = {}", ct);

        let body = axum::body::to_bytes(response.into_body(), 64 * 1024)
            .await
            .unwrap();
        let text = String::from_utf8(body.to_vec()).unwrap();

        assert!(text.contains("nanonet_agent_info{"));
        assert!(text.contains("nanonet_agent_metrics_sent_total 11"));
        assert!(text.contains("nanonet_agent_commands_handled_total 2"));
        assert!(text.contains("nanonet_agent_ws_connected 1"));
        // Counter ve gauge tip annotations bulunmalı.
        assert!(text.contains("# TYPE nanonet_agent_metrics_sent_total counter"));
        assert!(text.contains("# TYPE nanonet_agent_ws_connected gauge"));
    }

    #[test]
    fn prom_label_escapes_specials() {
        assert_eq!(prom_label("simple"), "simple");
        assert_eq!(prom_label(r#"has "quote""#), r#"has \"quote\""#);
        assert_eq!(prom_label("back\\slash"), "back\\\\slash");
        assert_eq!(prom_label("line1\nline2"), "line1\\nline2");
    }

    #[tokio::test]
    async fn serve_with_port_zero_returns_immediately() {
        let state = test_state();
        // port=0 → bind etmez, hemen Ok döner.
        let res = tokio::time::timeout(std::time::Duration::from_millis(200), serve(0, state))
            .await
            .expect("port 0 ile serve hızlıca dönmeli");
        assert!(res.is_ok());
    }
}
