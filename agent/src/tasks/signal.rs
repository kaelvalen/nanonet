//! İşletim sistemi sinyal dinleyicisi (graceful shutdown).
//!
//! - Unix: `SIGTERM` veya `SIGINT` alındığında shutdown sinyali yayınlanır.
//! - Windows / diğer: yalnızca Ctrl+C dinlenir.
//!
//! Sinyal handler'larının kurulumu kritik olduğu için **kurulum** hataları
//! [`AgentError::Startup`] olarak rapor edilir; agent başlatılamaz.

use tokio::sync::watch;

use crate::error::{AgentError, Result};

/// Sinyal beklemeye başlar; geldiğinde `shutdown_tx`'e `true` yayar.
///
/// Hata yalnızca handler kurulumu başarısız olursa döner.
pub async fn wait_and_signal(shutdown_tx: watch::Sender<bool>) -> Result<()> {
    #[cfg(unix)]
    {
        use tokio::signal::unix::{signal, SignalKind};
        let mut sigterm = signal(SignalKind::terminate())
            .map_err(|e| AgentError::Startup(format!("SIGTERM handler kurulamadı: {}", e)))?;
        let mut sigint = signal(SignalKind::interrupt())
            .map_err(|e| AgentError::Startup(format!("SIGINT handler kurulamadı: {}", e)))?;

        tokio::select! {
            _ = sigterm.recv() => tracing::info!("SIGTERM alındı, kapatılıyor..."),
            _ = sigint.recv()  => tracing::info!("SIGINT alındı, kapatılıyor..."),
        }
    }
    #[cfg(not(unix))]
    {
        tokio::signal::ctrl_c()
            .await
            .map_err(|e| AgentError::Startup(format!("Ctrl+C handler kurulamadı: {}", e)))?;
        tracing::info!("Ctrl+C alındı, kapatılıyor...");
    }

    let _ = shutdown_tx.send(true);
    Ok(())
}
