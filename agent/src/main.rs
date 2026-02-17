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

    tracing::info!("NanoNet Agent v{}", env!("CARGO_PKG_VERSION"));
    tracing::info!("Backend:    {}", config.backend);
    tracing::info!("Service ID: {}", config.service_id);
    tracing::info!("Health URL: {}", config.health_url());
    tracing::info!("Poll:       {}s", config.poll_interval);

    let agent_id = uuid::Uuid::new_v4().to_string();
    tracing::info!("Agent ID:   {}", agent_id);

    // Channel for sending messages to WebSocket
    let (ws_tx, ws_rx) = ws::channel();

    // Spawn WebSocket task (reconnect loop, never returns)
    let ws_config = config.clone();
    let ws_task = tokio::spawn(async move {
        ws::run(&ws_config, ws_rx).await;
    });

    // Metrics + health collection loop
    let metrics_task = tokio::spawn(async move {
        let mut sys = System::new();
        let mut disks = Disks::new_with_refreshed_list();
        let http_client = Client::new();
        let health_url = config.health_url();
        let service_id = config.service_id.clone();

        // Initial CPU refresh needs two data points
        sys.refresh_cpu_usage();
        tokio::time::sleep(Duration::from_secs(1)).await;

        let mut interval = tokio::time::interval(Duration::from_secs(config.poll_interval));
        let mut restart_count: u64 = 0;
        let start_time = std::time::Instant::now();

        loop {
            interval.tick().await;

            // Collect system metrics
            let snapshot = metrics::collect(&mut sys, &mut disks);

            // Health check
            let health = health::check_health(&http_client, &health_url).await;

            tracing::debug!(
                "CPU: {:.1}% | Mem: {:.0}MB | Disk: {:.1}GB | Status: {} | Latency: {:.1}ms",
                snapshot.cpu_percent,
                snapshot.memory_used_mb,
                snapshot.disk_used_gb,
                health.status,
                health.latency_ms,
            );

            // Build metric push message matching backend expected format
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
                    "error_rate": 0.0,
                },
                "process": {
                    "pid": std::process::id(),
                    "uptime_seconds": start_time.elapsed().as_secs(),
                    "restart_count": restart_count,
                }
            });

            if let Err(e) = ws_tx.send(message.to_string()) {
                tracing::warn!("Metrik WS kanalına gönderilemedi: {}", e);
            }

            // Track restart count from command results (placeholder)
            let _ = restart_count;
            restart_count = 0; // reset each tick for MVP
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
