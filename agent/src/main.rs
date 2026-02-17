mod config;
mod error;
mod metrics;
mod health;
mod ws;
mod commands;

use clap::Parser;
use config::Config;
use sysinfo::System;
use reqwest::Client;
use std::time::Duration;

#[tokio::main]
async fn main() -> error::Result<()> {
    tracing_subscriber::fmt::init();

    let config = Config::parse();
    
    tracing::info!("NanoNet Agent başlatılıyor...");
    tracing::info!("Backend: {}", config.backend_url);
    tracing::info!("Service ID: {}", config.service_id);

    let mut sys = System::new_all();
    let client = Client::new();
    let health_url = format!("http://localhost:8080/health");

    let ws_task = tokio::spawn({
        let config = config.clone();
        async move {
            ws::connect_websocket(&config).await
        }
    });

    let metrics_task = tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(config.poll_interval_sec));
        
        loop {
            interval.tick().await;
            
            match metrics::collect(&mut sys).await {
                Ok(snapshot) => {
                    tracing::debug!(
                        "Metrik toplandı - CPU: {:.2}%, Memory: {:.2}MB, Disk: {:.2}GB",
                        snapshot.cpu_percent,
                        snapshot.memory_used_mb,
                        snapshot.disk_used_gb
                    );
                }
                Err(e) => {
                    tracing::error!("Metrik toplama hatası: {}", e);
                }
            }

            match health::check_health(&client, &health_url).await {
                Ok((status, latency)) => {
                    tracing::debug!("Health check - Status: {}, Latency: {:.2}ms", status, latency);
                }
                Err(e) => {
                    tracing::error!("Health check hatası: {}", e);
                }
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
