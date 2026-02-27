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
use tokio::sync::watch;

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
    match &config.metrics_endpoint {
        Some(url) => tracing::info!("  App metrics:   {}", url),
        None => tracing::info!("  App metrics:   (yok — NANONET_METRICS_ENDPOINT ile etkinleştir)"),
    }
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

    // Graceful shutdown kanalı
    let (shutdown_tx, mut shutdown_rx) = watch::channel(false);
    let shutdown_rx_ws = shutdown_tx.subscribe();

    // WebSocket task — bağlanma, yeniden bağlanma döngüsü
    let ws_config = config.clone();
    let ws_restart_count = Arc::clone(&restart_count);
    let ws_task = tokio::spawn(async move {
        ws::run(&ws_config, ws_rx, ws_restart_count).await;
    });

    // Metrik toplama task
    let metrics_config = config.clone();
    let metrics_restart_count = Arc::clone(&restart_count);
    let mut metrics_shutdown_rx = shutdown_tx.subscribe();
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
        let app_metrics_url = metrics_config.metrics_endpoint.clone();

        // CPU kullanımı için iki ölçüm noktası gerekli
        sys.refresh_cpu_usage();
        tokio::time::sleep(Duration::from_secs(1)).await;

        let mut interval =
            tokio::time::interval(Duration::from_secs(metrics_config.poll_interval));
        let start_time = std::time::Instant::now();

        // Hata oranı için kayan pencere (true = hatalı istek)
        let mut error_window: VecDeque<bool> = VecDeque::with_capacity(error_window_size);

        loop {
            tokio::select! {
                _ = interval.tick() => {},
                _ = metrics_shutdown_rx.changed() => {
                    tracing::info!("Metrics task kapatılıyor (shutdown sinyali)");
                    break;
                }
            }

            let mut snapshot = metrics::collect_system(&mut sys, &mut disks);

            // Servis /metrics endpoint'i varsa uygulama metriklerini çek
            if let Some(ref url) = app_metrics_url {
                metrics::fetch_app_metrics(&http_client, &mut snapshot, url).await;
            }

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
                app_cpu = ?snapshot.app_cpu_percent,
                app_mem_mb = ?snapshot.app_memory_used_mb,
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
                "agent_version": env!("CARGO_PKG_VERSION"),
                "service_id": service_id,
                "timestamp": Utc::now().to_rfc3339(),
                "system": {
                    "cpu_percent": snapshot.cpu_percent,
                    "memory_used_mb": snapshot.memory_used_mb,
                    "disk_used_gb": snapshot.disk_used_gb,
                },
                "app": {
                    "cpu_percent": snapshot.app_cpu_percent,
                    "memory_used_mb": snapshot.app_memory_used_mb,
                },
                "service": {
                    "status": health.status,
                    "latency_ms": health.latency_ms,
                    "http_status": health.http_status,
                    "error_rate": error_rate,
                },
                "process": {
                    "pid": std::process::id(),
                    "uptime_seconds": uptime_secs,
                    "restart_count": restarts,
                }
            });

            if let Err(e) = ws_tx.send(message.to_string()).await {
                tracing::warn!("Metrik WS kanalına gönderilemedi: {}", e);
            }
        }
    });

    // Sinyal dinleyici task
    let signal_task = tokio::spawn(async move {
        #[cfg(unix)]
        {
            use tokio::signal::unix::{signal, SignalKind};
            let mut sigterm = signal(SignalKind::terminate()).expect("SIGTERM handler kurulamadı");
            let mut sigint  = signal(SignalKind::interrupt()).expect("SIGINT handler kurulamadı");
            tokio::select! {
                _ = sigterm.recv() => tracing::info!("SIGTERM alındı, kapatılıyor..."),
                _ = sigint.recv()  => tracing::info!("SIGINT alındı, kapatılıyor..."),
            }
        }
        #[cfg(not(unix))]
        {
            tokio::signal::ctrl_c().await.expect("Ctrl+C handler kurulamadı");
            tracing::info!("Ctrl+C alındı, kapatılıyor...");
        }
        let _ = shutdown_tx.send(true);
    });

    // shutdown_rx_ws kullanılmıyor şimdilik (ws::run kendi kopma mantığı ile)
    drop(shutdown_rx_ws);

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
        _ = signal_task => {
            tracing::info!("Agent temiz şekilde kapatıldı.");
        }
        _ = shutdown_rx.changed() => {
            tracing::info!("Shutdown sinyali alındı, agent kapatılıyor.");
        }
    }

    Ok(())
}
