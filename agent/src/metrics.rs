use serde::{Deserialize, Serialize};
use sysinfo::System;
use crate::error::Result;

#[derive(Debug, Serialize, Deserialize)]
pub struct MetricSnapshot {
    pub cpu_percent: f32,
    pub memory_used_mb: f32,
    pub disk_used_gb: f32,
}

pub async fn collect(sys: &mut System) -> Result<MetricSnapshot> {
    sys.refresh_cpu();
    sys.refresh_memory();

    let cpu_percent = sys.global_cpu_info().cpu_usage();
    let memory_used_mb = sys.used_memory() as f32 / 1024.0 / 1024.0;
    let disk_used_gb = 0.0;

    Ok(MetricSnapshot {
        cpu_percent,
        memory_used_mb,
        disk_used_gb,
    })
}
