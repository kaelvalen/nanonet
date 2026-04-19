//! Periyodik sistem + uygulama metrik toplama task'ı.
//!
//! Tek bir `tokio::interval` döngüsü her `poll_interval` saniyede bir:
//! 1. sysinfo'dan CPU/mem/disk/net snapshot alır,
//! 2. opsiyonel hedef sürecin metriklerini ekler,
//! 3. opsiyonel uygulama `/metrics` endpoint'inden CPU/mem çeker,
//! 4. servis health endpoint'ini yoklar,
//! 5. tek bir `metrics` JSON mesajı üretip WS kanalına gönderir,
//! 6. WS bağlı değilse mesajı [`MetricBuffer`]'a alır.
//!
//! Hata oranı kayan pencere ile tutulur — `error_rate_window` checks.

use std::collections::VecDeque;
use std::sync::Arc;
use std::time::Duration;

use chrono::Utc;
use reqwest::Client;
use serde_json::json;
use sysinfo::{Disks, Networks, System};
use tokio::sync::watch;

use crate::config::Config;
use crate::error::{AgentError, Result};
use crate::state::AppState;
use crate::ws::OutgoingTx;
use crate::{health, metrics, VERSION};

/// HTTP istemcisi inşa edilirken kullanılan timeout.
const HTTP_TIMEOUT: Duration = Duration::from_secs(5);

/// Metric task'ını çalıştırır. Shutdown sinyali gelene kadar döner.
///
/// Tek bir hata kaynağı vardır: HTTP istemcisinin oluşturulamaması — bu durum
/// `AgentError::Startup` olarak yukarı taşınır ve agent başlatılmaz.
pub async fn run(
    config: Config,
    state: Arc<AppState>,
    ws_tx: OutgoingTx,
    mut shutdown_rx: watch::Receiver<bool>,
) -> Result<()> {
    let http_client = Client::builder()
        .timeout(HTTP_TIMEOUT)
        .user_agent(format!("nanonet-agent/{}", VERSION))
        .build()
        .map_err(|e| AgentError::Startup(format!("HTTP client oluşturulamadı: {}", e)))?;

    let mut sys = System::new_all();
    let mut disks = Disks::new_with_refreshed_list();
    let mut networks = Networks::new_with_refreshed_list();
    let mut prev_disk_snap = metrics::DiskIOSnapshot::default();
    let mut last_tick = std::time::Instant::now();

    let health_url = config.health_url();
    let service_id = config.service_id.clone();
    let error_window_size = config.error_rate_window.max(1);
    let app_metrics_url = config.metrics_endpoint.clone();
    let process_target = config.process.clone();

    // CPU kullanımı için iki ölçüm noktası gerekli.
    sys.refresh_cpu_usage();
    tokio::time::sleep(Duration::from_secs(1)).await;

    let mut interval = tokio::time::interval(Duration::from_secs(config.poll_interval));

    // Hata oranı için kayan pencere.
    let mut error_window: VecDeque<bool> = VecDeque::with_capacity(error_window_size);

    loop {
        tokio::select! {
            _ = interval.tick() => {},
            _ = shutdown_rx.changed() => {
                tracing::info!("Metrics task kapatılıyor (shutdown sinyali)");
                break;
            }
        }

        let elapsed = last_tick.elapsed().as_secs_f64();
        last_tick = std::time::Instant::now();
        let (mut snapshot, new_disk_snap) = metrics::collect_system(
            &mut sys,
            &mut disks,
            &mut networks,
            &prev_disk_snap,
            elapsed,
        );
        prev_disk_snap = new_disk_snap;

        // Process snapshot — yalnızca hedef tanımlıysa pahalı refresh'i yap.
        let process_metrics = if let Some(target) = process_target.as_deref() {
            sys.refresh_processes();
            metrics::collect_process(&sys, target)
        } else {
            None
        };

        if let Some(ref url) = app_metrics_url {
            metrics::fetch_app_metrics(&http_client, &mut snapshot, url).await;
        }

        let net_rx_mb = snapshot.net_rx_bytes as f64 / 1024.0 / 1024.0;
        let net_tx_mb = snapshot.net_tx_bytes as f64 / 1024.0 / 1024.0;

        let health_result = health::check_health(&http_client, &health_url).await;

        // Hata penceresi güncelle.
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

        let restarts = state
            .restart_count
            .load(std::sync::atomic::Ordering::Relaxed);

        tracing::debug!(
            cpu = snapshot.cpu_percent,
            mem_mb = snapshot.memory_used_mb,
            status = %health_result.status,
            latency_ms = health_result.latency_ms,
            error_rate = error_rate,
            ws_connected = state.is_ws_connected(),
            "Metrik"
        );

        let mut message = json!({
            "type": "metrics",
            "agent_id": state.agent_id,
            "agent_version": VERSION,
            "service_id": service_id,
            "timestamp": Utc::now().to_rfc3339(),
            "system": {
                "cpu_percent": snapshot.cpu_percent,
                "memory_used_mb": snapshot.memory_used_mb,
                "memory_total_mb": snapshot.memory_total_mb,
                "disk_used_gb": snapshot.disk_used_gb,
                "disk_total_gb": snapshot.disk_total_gb,
                "net_rx_mb": net_rx_mb,
                "net_tx_mb": net_tx_mb,
                "disk_read_bytes_sec": snapshot.disk_read_bytes_sec,
                "disk_write_bytes_sec": snapshot.disk_write_bytes_sec,
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
                "uptime_seconds": state.uptime_secs(),
                "restart_count": restarts,
            }
        });

        let labels = config.label_map();
        if !labels.is_empty() {
            if let Some(obj) = message.as_object_mut() {
                obj.insert("labels".to_string(), json!(labels));
            }
        }

        if let Some(ref pm) = process_metrics {
            if let Some(obj) = message.as_object_mut() {
                obj.insert(
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
        }

        let msg_str = message.to_string();

        if state.is_ws_connected() {
            if let Err(e) = ws_tx.send(msg_str.clone()).await {
                tracing::warn!(
                    "Metrik WS kanalına gönderilemedi: {} — buffer'a alınıyor",
                    e
                );
                state.buffer.push(msg_str).await;
            }
        } else {
            state.buffer.push(msg_str).await;
            let buf_len = state.buffer.len().await;
            if buf_len % 10 == 0 {
                tracing::info!(
                    buffered = buf_len,
                    dropped = state.buffer.dropped_count(),
                    "WS bağlantısız — metrikler biriktiriliyor"
                );
            }
        }
    }

    Ok(())
}
