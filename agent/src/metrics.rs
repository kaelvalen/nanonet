use serde::{Deserialize, Serialize};
use sysinfo::{Disks, System};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricSnapshot {
    pub cpu_percent: f32,
    pub memory_used_mb: f32,
    pub disk_used_gb: f32,
}

pub fn collect(sys: &mut System, disks: &mut Disks) -> MetricSnapshot {
    sys.refresh_cpu_usage();
    sys.refresh_memory();
    disks.refresh_list();

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
    }
}
