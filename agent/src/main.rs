mod agent_health;
mod buffer;
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

use buffer::MetricBuffer;

#[tokio::main]
async fn main() -> error::Result<()> {
    // ─── Structured Logging ───
    // NANONET_LOG_JSON=1 ile JSON log formatı aktifleşir
    let json_logs = std::env::var("NANONET_LOG_JSON").is_ok();
    let env_filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| "nanonet_agent=info".into());

    if json_logs {
        tracing_subscriber::fmt()
            .json()
            .flatten_event(true)
            .with_env_filter(env_filter)
            .init();
    } else {
        tracing_subscriber::fmt()
            .with_env_filter(env_filter)
            .init();
    }

    let config = Config::parse();

    tracing::info!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    tracing::info!("  NanoNet Agent v{}", env!("CARGO_PKG_VERSION"));
    tracing::info!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    tracing::info!("  Backend:       {}", config.backend);
    tracing::info!("  Service ID:    {}", config.service_id);
    tracing::info!("  Health URL:    {}", config.health_url());
    tracing::info!("  Poll interval: {}s", config.poll_interval);
    tracing::info!("  Error window:  {} checks", config.error_rate_window);
    tracing::info!("  Buffer size:   {} metrics", config.buffer_size);

    match &config.metrics_endpoint {
        Some(url) => tracing::info!("  App metrics:   {}", url),
        None => tracing::info!("  App metrics:   (yok)"),
    }
    match &config.process {
        Some(p) => tracing::info!("  Process watch: {}", p),
        None => tracing::info!("  Process watch: (yok)"),
    }
    match &config.restart_cmd {
        Some(cmd) => tracing::info!("  Restart cmd:   {}", cmd),
        None => tracing::warn!("  Restart cmd:   (yapılandırılmamış)"),
    }
    match &config.stop_cmd {
        Some(cmd) => tracing::info!("  Stop cmd:      {}", cmd),
        None => tracing::warn!("  Stop cmd:      (yapılandırılmamış)"),
    }
    if config.agent_port > 0 {
        tracing::info!("  Agent port:    {}", config.agent_port);
    }

    let agent_id = uuid::Uuid::new_v4().to_string();
    tracing::info!("  Agent ID:      {}", agent_id);
    tracing::info!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    let start_time = std::time::Instant::now();

    // ─── Channels & Shared State ───
    let (ws_tx, ws_rx) = ws::channel();
    let restart_count = Arc::new(AtomicU64::new(0));
    let metric_buffer = MetricBuffer::new(config.buffer_size);

    // Graceful shutdown kanalı
    let (shutdown_tx, _) = watch::channel(false);
    let shutdown_rx_ws = shutdown_tx.subscribe();
    let mut shutdown_rx_metrics = shutdown_tx.subscribe();

    // ─── WebSocket Task ───
    let ws_config = config.clone();
    let ws_restart_count = Arc::clone(&restart_count);
    let ws_buffer = metric_buffer.clone();
    let ws_task = tokio::spawn(async move {
        ws::run(&ws_config, ws_rx, ws_restart_count, ws_buffer, shutdown_rx_ws).await;
    });

    // ─── Agent Health Endpoint ───
    let health_port = config.agent_port;
    let health_buffer = metric_buffer.clone();
    let _health_task = tokio::spawn(async move {
        agent_health::serve(health_port, start_time, health_buffer).await;
    });

    // ─── Metrik Toplama Task ───
    let metrics_config = config.clone();
    let metrics_restart_count = Arc::clone(&restart_count);
    let metrics_buffer = metric_buffer.clone();
    let metrics_task = tokio::spawn(async move {
        let mut sys = System::new_all();
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
        let process_target = metrics_config.process.clone();

        // CPU kullanımı için iki ölçüm noktası gerekli
        sys.refresh_cpu_usage();
        tokio::time::sleep(Duration::from_secs(1)).await;

        let mut interval =
            tokio::time::interval(Duration::from_secs(metrics_config.poll_interval));
        let agent_start = std::time::Instant::now();

        // Hata oranı için kayan pencere
        let mut error_window: VecDeque<bool> = VecDeque::with_capacity(error_window_size);

        loop {
            tokio::select! {
                _ = interval.tick() => {},
                _ = shutdown_rx_metrics.changed() => {
                    tracing::info!("Metrics task kapatılıyor (shutdown sinyali)");
                    break;
                }
            }

            // Sistem metrikleri
            let mut snapshot = metrics::collect_system(&mut sys, &mut disks);

            // Per-process metrikleri
            sys.refresh_processes();
            let process_metrics = process_target
                .as_deref()
                .and_then(|t| metrics::collect_process(&sys, t));

            // App metrics endpoint
            if let Some(ref url) = app_metrics_url {
                metrics::fetch_app_metrics(&http_client, &mut snapshot, url).await;
            }

            // Health check
            let health_result = health::check_health(&http_client, &health_url).await;

            // Hata penceresi güncelle
            error_window.push_back(health_result.is_error);
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
            let uptime_secs = agent_start.elapsed().as_secs();

            tracing::debug!(
                cpu = snapshot.cpu_percent,
                mem_mb = snapshot.memory_used_mb,
                status = %health_result.status,
                latency_ms = health_result.latency_ms,
                error_rate = error_rate,
                ws_connected = ws::WS_CONNECTED.load(Ordering::Relaxed),
                "Metrik"
            );

            // Mesaj oluştur
            let mut message = json!({
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
                    "status": health_result.status,
                    "latency_ms": health_result.latency_ms,
                    "http_status": health_result.http_status,
                    "error_rate": error_rate,
                },
                "process": {
                    "pid": std::process::id(),
                    "uptime_seconds": uptime_secs,
                    "restart_count": restarts,
                }
            });

            // Process-level metrikler varsa ekle
            if let Some(ref pm) = process_metrics {
                message.as_object_mut().unwrap().insert(
                    "target_process".to_string(),
                    json!({
                        "pid": pm.pid,
                        "name": pm.name,
                        "cpu_percent": pm.cpu_percent,
                        "memory_mb": pm.memory_mb,
                        "status": pm.status,
                    }),
                );
            }

            let msg_str = message.to_string();

            // WS bağlıysa doğrudan gönder, değilse buffer'a ekle
            if ws::WS_CONNECTED.load(Ordering::Relaxed) {
                if let Err(e) = ws_tx.send(msg_str.clone()).await {
                    tracing::warn!("Metrik WS kanalına gönderilemedi: {} — buffer'a alınıyor", e);
                    metrics_buffer.push(msg_str).await;
                }
            } else {
                metrics_buffer.push(msg_str).await;
                let buf_len = metrics_buffer.len().await;
                if buf_len % 10 == 0 {
                    tracing::info!(
                        buffered = buf_len,
                        dropped = metrics_buffer.dropped_count(),
                        "WS bağlantısız — metrikler biriktiriliyor"
                    );
                }
            }
        }
    });

    // ─── Sinyal Dinleyici ───
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

    // ─── Ana Bekleme ───
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
    }

    // Final istatistikleri
    tracing::info!(
        metrics_sent = ws::METRICS_SENT.load(Ordering::Relaxed),
        commands_handled = ws::COMMANDS_HANDLED.load(Ordering::Relaxed),
        metrics_dropped = metric_buffer.dropped_count(),
        uptime_secs = start_time.elapsed().as_secs(),
        "Agent kapatıldı — final istatistikleri"
    );

    Ok(())
}
