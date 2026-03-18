use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use sysinfo::{Disks, Networks, System};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricSnapshot {
    pub cpu_percent: f32,
    pub memory_used_mb: f32,
    pub memory_total_mb: f32,
    pub disk_used_gb: f32,
    pub disk_total_gb: f32,
    /// Kümülatif ağ: toplam gelen bayt (fark hesabı üst katmanda yapılır)
    pub net_rx_bytes: u64,
    /// Kümülatif ağ: toplam giden bayt
    pub net_tx_bytes: u64,
    /// Disk okuma (bayt/s)
    pub disk_read_bytes_sec: f64,
    /// Disk yazma (bayt/s)
    pub disk_write_bytes_sec: f64,
    /// Servis /metrics endpoint'inden alınan uygulama seviyesi CPU (varsa)
    pub app_cpu_percent: Option<f32>,
    /// Servis /metrics endpoint'inden alınan uygulama seviyesi bellek (varsa)
    pub app_memory_used_mb: Option<f32>,
}

/// Process-level metrikler (hedef süreç izleme)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessMetrics {
    pub pid: u32,
    pub name: String,
    pub cpu_percent: f32,
    pub memory_mb: f32,
    pub status: String,
}

/// Servis /metrics endpoint'inin beklenen yanıt şeması
#[derive(Debug, Deserialize)]
struct AppMetricsResponse {
    cpu_percent: Option<f32>,
    memory_used_mb: Option<f32>,
}

/// Disk I/O snapshot — iki ölçüm noktası arasındaki fark için.
#[derive(Debug, Clone, Default)]
pub struct DiskIOSnapshot {
    pub read_bytes: u64,
    pub write_bytes: u64,
}

/// Sistem metriklerini toplar (sysinfo)
pub fn collect_system(
    sys: &mut System,
    disks: &mut Disks,
    networks: &mut Networks,
    prev_disk: &DiskIOSnapshot,
    elapsed_secs: f64,
) -> (MetricSnapshot, DiskIOSnapshot) {
    sys.refresh_cpu_usage();
    sys.refresh_memory();
    disks.refresh();
    networks.refresh();

    let cpus = sys.cpus();
    let cpu_percent = if cpus.is_empty() {
        0.0
    } else {
        cpus.iter().map(|c| c.cpu_usage()).sum::<f32>() / cpus.len() as f32
    };

    let memory_used_mb = sys.used_memory() as f32 / 1024.0 / 1024.0;
    let memory_total_mb = sys.total_memory() as f32 / 1024.0 / 1024.0;

    let (disk_used, disk_total) = disks.iter().fold((0u64, 0u64), |(used, total), d| {
        (
            used + d.total_space().saturating_sub(d.available_space()),
            total + d.total_space(),
        )
    });
    let disk_used_gb = disk_used as f32 / 1024.0 / 1024.0 / 1024.0;
    let disk_total_gb = disk_total as f32 / 1024.0 / 1024.0 / 1024.0;

    // Disk I/O — /proc/diskstats (önce), yoksa 0
    let (cur_read, cur_write) = read_proc_diskstats();
    let elapsed = elapsed_secs.max(0.001);
    let disk_read_bytes_sec = (cur_read.saturating_sub(prev_disk.read_bytes)) as f64 / elapsed;
    let disk_write_bytes_sec = (cur_write.saturating_sub(prev_disk.write_bytes)) as f64 / elapsed;
    let new_disk_snap = DiskIOSnapshot {
        read_bytes: cur_read,
        write_bytes: cur_write,
    };

    // Network bytes (cumulative, tüm arayüzler)
    let (net_rx, net_tx) = networks.iter().fold((0u64, 0u64), |(rx, tx), (_, data)| {
        (rx + data.total_received(), tx + data.total_transmitted())
    });

    let snapshot = MetricSnapshot {
        cpu_percent,
        memory_used_mb,
        memory_total_mb,
        disk_used_gb,
        disk_total_gb,
        net_rx_bytes: net_rx,
        net_tx_bytes: net_tx,
        disk_read_bytes_sec,
        disk_write_bytes_sec,
        app_cpu_percent: None,
        app_memory_used_mb: None,
    };
    (snapshot, new_disk_snap)
}

/// Hedef süreci PID veya isim ile bulup metriklerini toplar.
pub fn collect_process(sys: &System, target: &str) -> Option<ProcessMetrics> {
    // Önce PID olarak dene
    if let Ok(pid_num) = target.parse::<u32>() {
        let pid = sysinfo::Pid::from(pid_num as usize);
        return sys.process(pid).map(process_to_metrics);
    }

    // İsim ile arama — en çok CPU kullanan eşleşen süreci seç
    let target_lower = target.to_lowercase();
    sys.processes()
        .values()
        .filter(|p| {
            let name = p.name().to_string().to_lowercase();
            let cmd = p
                .cmd()
                .iter()
                .map(|c| c.to_string().to_lowercase())
                .collect::<Vec<_>>()
                .join(" ");
            name.contains(&target_lower) || cmd.contains(&target_lower)
        })
        .max_by(|a, b| {
            a.cpu_usage()
                .partial_cmp(&b.cpu_usage())
                .unwrap_or(std::cmp::Ordering::Equal)
        })
        .map(process_to_metrics)
}

fn process_to_metrics(p: &sysinfo::Process) -> ProcessMetrics {
    let status_str = format!("{:?}", p.status());
    ProcessMetrics {
        pid: p.pid().as_u32(),
        name: p.name().to_string(),
        cpu_percent: p.cpu_usage(),
        memory_mb: p.memory() as f32 / 1024.0 / 1024.0,
        status: status_str,
    }
}

/// /proc/diskstats'tan tüm disk aygıtlarının kümülatif okuma/yazma baytlarını toplar.
/// Dosya yoksa (Linux dışı) (0, 0) döner.
///
/// /proc/diskstats formatı:
///   alan[2]  = aygıt adı
///   alan[5]  = toplam sektör okuma (1 sektör = 512 bayt)
///   alan[9]  = toplam sektör yazma
fn read_proc_diskstats() -> (u64, u64) {
    let content = match std::fs::read_to_string("/proc/diskstats") {
        Ok(c) => c,
        Err(_) => return (0, 0),
    };

    let mut total_read: u64 = 0;
    let mut total_write: u64 = 0;

    for line in content.lines() {
        let fields: Vec<&str> = line.split_whitespace().collect();
        if fields.len() < 14 {
            continue;
        }
        // Yalnızca ana disk aygıtlarını say (partition'ları at)
        // Partition'lar genellikle sayısal sonek taşır: sda1, nvme0n1p1 vb.
        let dev_name = fields[2];
        if dev_name
            .chars()
            .last()
            .map(|c| c.is_ascii_digit())
            .unwrap_or(false)
        {
            // Olası NVMe aygıt formatı: nvme0n1 (partition değil)
            // Alan[2] içeren 'p' varsa partition say.
            if dev_name.contains('p') && dev_name[dev_name.rfind('p').unwrap()..].len() > 1 {
                continue; // nvme0n1p1 gibi partition
            }
        }

        let sectors_read = fields[5].parse::<u64>().unwrap_or(0);
        let sectors_write = fields[9].parse::<u64>().unwrap_or(0);
        total_read += sectors_read * 512;
        total_write += sectors_write * 512;
    }

    (total_read, total_write)
}

/// Servis /metrics endpoint'inden uygulama metriklerini çeker ve snapshot'a ekler
pub async fn fetch_app_metrics(client: &Client, snapshot: &mut MetricSnapshot, metrics_url: &str) {
    match client
        .get(metrics_url)
        .timeout(Duration::from_secs(3))
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => match resp.json::<AppMetricsResponse>().await {
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
        },
        Ok(resp) => {
            tracing::debug!(url = metrics_url, status = %resp.status(), "app metrics non-2xx");
        }
        Err(e) => {
            tracing::debug!(url = metrics_url, error = %e, "app metrics fetch hatası");
        }
    }
}
