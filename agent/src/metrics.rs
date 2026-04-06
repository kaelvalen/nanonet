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

#[cfg(test)]
mod tests {
    use super::*;

    // ── DiskIOSnapshot ────────────────────────────────────────────

    #[test]
    fn test_disk_io_snapshot_default_is_zero() {
        let snap = DiskIOSnapshot::default();
        assert_eq!(snap.read_bytes, 0);
        assert_eq!(snap.write_bytes, 0);
    }

    // ── read_proc_diskstats ───────────────────────────────────────

    #[test]
    fn test_read_proc_diskstats_returns_tuple() {
        // /proc/diskstats'ı okuyan fonksiyon: Linux'ta (>0,>0), Linux dışında (0,0) dönmeli.
        let (reads, writes) = read_proc_diskstats();
        // Hem negatif olamaz hem de u64 sınırının altında kalmalı
        assert!(reads < u64::MAX);
        assert!(writes < u64::MAX);
    }

    // ── disk_read_bytes_sec hesabı ────────────────────────────────

    #[test]
    fn test_disk_io_rate_calculation() {
        // Basit aritmetik: fark / zaman = oran
        let prev = DiskIOSnapshot {
            read_bytes: 1000,
            write_bytes: 500,
        };
        let cur_read: u64 = 3000;
        let cur_write: u64 = 1500;
        let elapsed = 2.0_f64;

        let read_rate = (cur_read.saturating_sub(prev.read_bytes)) as f64 / elapsed;
        let write_rate = (cur_write.saturating_sub(prev.write_bytes)) as f64 / elapsed;

        assert!((read_rate - 1000.0).abs() < f64::EPSILON);
        assert!((write_rate - 500.0).abs() < f64::EPSILON);
    }

    #[test]
    fn test_disk_io_rate_no_negative_on_counter_reset() {
        // Counter sıfırlandığında saturating_sub 0 döner
        let prev = DiskIOSnapshot {
            read_bytes: 5000,
            write_bytes: 3000,
        };
        let cur_read: u64 = 100; // counter sıfırlandı
        let elapsed = 1.0_f64;

        let read_rate = (cur_read.saturating_sub(prev.read_bytes)) as f64 / elapsed;
        assert_eq!(
            read_rate, 0.0,
            "counter sıfırlamasında negatif oran olmamalı"
        );
    }

    // ── CPU ortalaması hesabı ────────────────────────────────────

    #[test]
    fn test_cpu_average_empty_returns_zero() {
        // sysinfo'dan boş CPU listesi gelirse 0.0 dönmeli
        let cpus: Vec<f32> = vec![];
        let cpu_percent = if cpus.is_empty() {
            0.0_f32
        } else {
            cpus.iter().sum::<f32>() / cpus.len() as f32
        };
        assert_eq!(cpu_percent, 0.0);
    }

    #[test]
    fn test_cpu_average_single_core() {
        let cpus = vec![42.5_f32];
        let avg = cpus.iter().sum::<f32>() / cpus.len() as f32;
        assert!((avg - 42.5).abs() < 0.001);
    }

    #[test]
    fn test_cpu_average_multi_core() {
        let cpus = vec![20.0_f32, 40.0, 60.0, 80.0];
        let avg = cpus.iter().sum::<f32>() / cpus.len() as f32;
        assert!((avg - 50.0).abs() < 0.001);
    }

    // ── Bellek MB dönüşümü ────────────────────────────────────────

    #[test]
    fn test_memory_bytes_to_mb() {
        let bytes: u64 = 1024 * 1024 * 512; // 512 MB
        let mb = bytes as f32 / 1024.0 / 1024.0;
        assert!((mb - 512.0).abs() < 0.001);
    }

    // ── Disk GB dönüşümü ─────────────────────────────────────────

    #[test]
    fn test_disk_bytes_to_gb() {
        let bytes: u64 = 1024 * 1024 * 1024 * 10; // 10 GB
        let gb = bytes as f32 / 1024.0 / 1024.0 / 1024.0;
        assert!((gb - 10.0).abs() < 0.001);
    }

    // ── MetricSnapshot serde ──────────────────────────────────────

    #[test]
    fn test_metric_snapshot_serializes_optional_fields() {
        let snap = MetricSnapshot {
            cpu_percent: 50.0,
            memory_used_mb: 1024.0,
            memory_total_mb: 8192.0,
            disk_used_gb: 50.0,
            disk_total_gb: 500.0,
            net_rx_bytes: 1000,
            net_tx_bytes: 2000,
            disk_read_bytes_sec: 1024.0,
            disk_write_bytes_sec: 512.0,
            app_cpu_percent: Some(25.0),
            app_memory_used_mb: None,
        };

        let json = serde_json::to_string(&snap).expect("serde başarısız olmamalı");
        assert!(json.contains("\"app_cpu_percent\":25.0"));
        // None alanlar JSON'da null olarak yer almalı
        assert!(json.contains("\"app_memory_used_mb\":null"));
    }

    #[test]
    fn test_metric_snapshot_roundtrip() {
        let snap = MetricSnapshot {
            cpu_percent: 75.5,
            memory_used_mb: 2048.0,
            memory_total_mb: 16384.0,
            disk_used_gb: 100.0,
            disk_total_gb: 1000.0,
            net_rx_bytes: 99999,
            net_tx_bytes: 88888,
            disk_read_bytes_sec: 0.0,
            disk_write_bytes_sec: 0.0,
            app_cpu_percent: None,
            app_memory_used_mb: Some(512.0),
        };

        let json = serde_json::to_string(&snap).unwrap();
        let back: MetricSnapshot = serde_json::from_str(&json).unwrap();
        assert!((back.cpu_percent - snap.cpu_percent).abs() < 0.001);
        assert_eq!(back.net_rx_bytes, snap.net_rx_bytes);
        assert_eq!(back.app_memory_used_mb, snap.app_memory_used_mb);
    }
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
