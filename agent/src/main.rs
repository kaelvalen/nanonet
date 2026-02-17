mod commands;
mod config;
mod error;
mod health;
mod metrics;
mod ws;

use chrono::Utc;
use clap::Parser;
use config::Config;
use reqwest::Client;
use serde_json::json;
use std::collections::VecDeque;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use sysinfo::{Disks, System};

#[tokio::main]
async fn main() -> error::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "nanonet_agent=info".into()),
        )
        .init();

    let config = Config::parse();

    tracing::info!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    tracing::info!("  NanoNet Agent v{}", env!("CARGO_PKG_VERSION"));
    tracing::info!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    tracing::info!("  Backend:       {}", config.backend);
    tracing::info!("  Service ID:    {}", config.service_id);
    tracing::info!("  Health URL:    {}", config.health_url());
    tracing::info!("  Poll interval: {}s", config.poll_interval);
    tracing::info!("  Error window:  {} checks", config.error_rate_window);
    match &config.restart_cmd {
        Some(cmd) => tracing::info!("  Restart cmd:   {}", cmd),
        None => tracing::warn!("  Restart cmd:   (yapılandırılmamış — NANONET_RESTART_CMD)"),
    }
    match &config.stop_cmd {
        Some(cmd) => tracing::info!("  Stop cmd:      {}", cmd),
        None => tracing::warn!("  Stop cmd:      (yapılandırılmamış — NANONET_STOP_CMD)"),
    }

    let agent_id = uuid::Uuid::new_v4().to_string();
    tracing::info!("  Agent ID:      {}", agent_id);
    tracing::info!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    let (ws_tx, ws_rx) = ws::channel();

    // restart/stop komutlarından güncellenen paylaşımlı sayaç
    let restart_count = Arc::new(AtomicU64::new(0));

    // WebSocket task — bağlanma, yeniden bağlanma döngüsü
    let ws_config = config.clone();
    let ws_restart_count = Arc::clone(&restart_count);
    let ws_task = tokio::spawn(async move {
        ws::run(&ws_config, ws_rx, ws_restart_count).await;
    });

    // Metrik toplama task
    let metrics_config = config.clone();
    let metrics_restart_count = Arc::clone(&restart_count);
    let metrics_task = tokio::spawn(async move {
        let mut sys = System::new();
        let mut disks = Disks::new_with_refreshed_list();

        let http_client = Client::builder()
            .timeout(Duration::from_secs(5))
            .user_agent(format!("nanonet-agent/{}", env!("CARGO_PKG_VERSION")))
            .build()
            .expect("HTTP client oluşturulamadı");

        let health_url = metrics_config.health_url();
        let service_id = metrics_config.service_id.clone();
        let error_window_size = metrics_config.error_rate_window.max(1);

        // CPU kullanımı için iki ölçüm noktası gerekli
        sys.refresh_cpu_usage();
        tokio::time::sleep(Duration::from_secs(1)).await;

        let mut interval =
            tokio::time::interval(Duration::from_secs(metrics_config.poll_interval));
        let start_time = std::time::Instant::now();

        // Hata oranı için kayan pencere (true = hatalı istek)
        let mut error_window: VecDeque<bool> = VecDeque::with_capacity(error_window_size);

        loop {
            interval.tick().await;

            let snapshot = metrics::collect(&mut sys, &mut disks);
            let health = health::check_health(&http_client, &health_url).await;

            // Kayan hata penceresi güncelle
            error_window.push_back(health.is_error);
            if error_window.len() > error_window_size {
                error_window.pop_front();
            }

            let error_rate: f32 = if error_window.is_empty() {
                0.0
            } else {
                let errors = error_window.iter().filter(|&&e| e).count();
                (errors as f32 / error_window.len() as f32) * 100.0
            };

            let restarts = metrics_restart_count.load(Ordering::Relaxed);
            let uptime_secs = start_time.elapsed().as_secs();

            tracing::debug!(
                cpu = snapshot.cpu_percent,
                mem_mb = snapshot.memory_used_mb,
                disk_gb = snapshot.disk_used_gb,
                status = %health.status,
                latency_ms = health.latency_ms,
                error_rate = error_rate,
                restarts = restarts,
                uptime_secs = uptime_secs,
                "Metrik"
            );

            let message = json!({
                "type": "metrics",
                "agent_id": agent_id,
                "service_id": service_id,
                "timestamp": Utc::now().to_rfc3339(),
                "system": {
                    "cpu_percent": snapshot.cpu_percent,
                    "memory_used_mb": snapshot.memory_used_mb,
                    "disk_used_gb": snapshot.disk_used_gb,
                },
                "service": {
                    "status": health.status,
                    "latency_ms": health.latency_ms,
                    "error_rate": error_rate,
                },
                "process": {
                    "pid": std::process::id(),
                    "uptime_seconds": uptime_secs,
                    "restart_count": restarts,
                }
            });

            if let Err(e) = ws_tx.send(message.to_string()) {
                tracing::warn!("Metrik WS kanalına gönderilemedi: {}", e);
            }
        }
    });

    tokio::select! {
        result = ws_task => {
            if let Err(e) = result {
                tracing::error!("WebSocket task hatası: {}", e);
            }
        }
        result = metrics_task => {
            if let Err(e) = result {
                tracing::error!("Metrics task hatası: {}", e);
            }
        }
    }

    Ok(())
}
