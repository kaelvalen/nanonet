use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use sysinfo::{Disks, System};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricSnapshot {
    pub cpu_percent: f32,
    pub memory_used_mb: f32,
    pub disk_used_gb: f32,
    /// Servis /metrics endpoint'inden alınan uygulama seviyesi CPU (varsa)
    pub app_cpu_percent: Option<f32>,
    /// Servis /metrics endpoint'inden alınan uygulama seviyesi bellek (varsa)
    pub app_memory_used_mb: Option<f32>,
}

/// Servis /metrics endpoint'inin beklenen yanıt şeması
#[derive(Debug, Deserialize)]
struct AppMetricsResponse {
    cpu_percent: Option<f32>,
    memory_used_mb: Option<f32>,
}

/// Sistem metriklerini toplar (sysinfo)
pub fn collect_system(sys: &mut System, disks: &mut Disks) -> MetricSnapshot {
    sys.refresh_cpu_usage();
    sys.refresh_memory();
    disks.refresh();

    let cpus = sys.cpus();
    let cpu_percent = if cpus.is_empty() {
        0.0
    } else {
        cpus.iter().map(|c| c.cpu_usage()).sum::<f32>() / cpus.len() as f32
    };

    let memory_used_mb = sys.used_memory() as f32 / 1024.0 / 1024.0;

    let disk_used_gb: f32 = disks
        .iter()
        .map(|d| (d.total_space().saturating_sub(d.available_space())) as f32)
        .sum::<f32>()
        / 1024.0
        / 1024.0
        / 1024.0;

    MetricSnapshot {
        cpu_percent,
        memory_used_mb,
        disk_used_gb,
        app_cpu_percent: None,
        app_memory_used_mb: None,
    }
}

/// Servis /metrics endpoint'inden uygulama metriklerini çeker ve snapshot'a ekler
pub async fn fetch_app_metrics(
    client: &Client,
    snapshot: &mut MetricSnapshot,
    metrics_url: &str,
) {
    match client
        .get(metrics_url)
        .timeout(Duration::from_secs(3))
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => {
            match resp.json::<AppMetricsResponse>().await {
                Ok(app) => {
                    if let Some(cpu) = app.cpu_percent {
                        snapshot.app_cpu_percent = Some(cpu);
                    }
                    if let Some(mem) = app.memory_used_mb {
                        snapshot.app_memory_used_mb = Some(mem);
                    }
                    tracing::debug!(
                        url = metrics_url,
                        app_cpu = ?snapshot.app_cpu_percent,
                        app_mem_mb = ?snapshot.app_memory_used_mb,
                        "app metrics fetched"
                    );
                }
                Err(e) => {
                    tracing::debug!(url = metrics_url, error = %e, "app metrics parse hatası");
                }
            }
        }
        Ok(resp) => {
            tracing::debug!(url = metrics_url, status = %resp.status(), "app metrics non-2xx");
        }
        Err(e) => {
            tracing::debug!(url = metrics_url, error = %e, "app metrics fetch hatası");
        }
    }
}

