//! Servis yaşam döngüsü komutları: restart, stop, start, scale, ping.
//!
//! Her komut yapılandırılmış bir shell template'i ile çalıştırılır
//! (`Config::restart_cmd`, `stop_cmd`, vb.). Yapılandırılmamış komut
//! reddedilir; varsayılan timeout'lar aksiyona göre seçilir.

use crate::commands::runner::run_shell;
use crate::commands::types::IncomingCommand;
use crate::commands::validation::{is_allowed_strategy, ALLOWED_STRATEGIES};
use crate::config::Config;

/// Restart aksiyonunun varsayılan timeout'u (saniye).
pub const DEFAULT_RESTART_TIMEOUT: u64 = 30;
/// Stop / start aksiyonlarının varsayılan timeout'u.
pub const DEFAULT_STOP_TIMEOUT: u64 = 30;
pub const DEFAULT_START_TIMEOUT: u64 = 60;
pub const DEFAULT_SCALE_TIMEOUT: u64 = 60;

/// `ping` — yalnızca log atıp `Ok(None)` döner.
pub fn ping(cmd: &IncomingCommand) -> Result<Option<String>, String> {
    tracing::info!("[{}] Ping alındı", cmd.command_id);
    Ok(None)
}

pub async fn restart(cmd: &IncomingCommand, config: &Config) -> Result<Option<String>, String> {
    let timeout = cmd.timeout_sec.unwrap_or(DEFAULT_RESTART_TIMEOUT);
    let restart_cmd = config.restart_cmd.as_deref().ok_or_else(|| {
        tracing::warn!(
            "[{}] restart_cmd yapılandırılmamış — NANONET_RESTART_CMD eksik",
            cmd.command_id
        );
        "NANONET_RESTART_CMD yapılandırılmamış".to_string()
    })?;
    tracing::info!(
        "[{}] Restart komutu çalıştırılıyor (timeout: {}s)",
        cmd.command_id,
        timeout,
    );
    run_shell(restart_cmd, timeout).await
}

pub async fn stop(cmd: &IncomingCommand, config: &Config) -> Result<Option<String>, String> {
    let graceful = cmd.graceful.unwrap_or(true);
    let stop_cmd = config.stop_cmd.as_deref().ok_or_else(|| {
        tracing::warn!(
            "[{}] stop_cmd yapılandırılmamış — NANONET_STOP_CMD eksik",
            cmd.command_id
        );
        "NANONET_STOP_CMD yapılandırılmamış".to_string()
    })?;
    tracing::info!(
        "[{}] Stop komutu çalıştırılıyor (graceful: {})",
        cmd.command_id,
        graceful,
    );
    run_shell(stop_cmd, DEFAULT_STOP_TIMEOUT).await
}

pub async fn start(cmd: &IncomingCommand, config: &Config) -> Result<Option<String>, String> {
    let start_cmd = config.start_cmd.as_deref().ok_or_else(|| {
        tracing::warn!(
            "[{}] start_cmd yapılandırılmamış — NANONET_START_CMD eksik",
            cmd.command_id
        );
        "NANONET_START_CMD yapılandırılmamış".to_string()
    })?;
    tracing::info!("[{}] Start komutu çalıştırılıyor", cmd.command_id);
    run_shell(start_cmd, DEFAULT_START_TIMEOUT).await
}

pub async fn scale(cmd: &IncomingCommand, config: &Config) -> Result<Option<String>, String> {
    let instances = cmd.instances.unwrap_or(1);
    let strategy = cmd.strategy.as_deref().unwrap_or("round_robin");

    if !is_allowed_strategy(strategy) {
        tracing::warn!(
            "[{}] Geçersiz strateji reddedildi: {}",
            cmd.command_id,
            strategy
        );
        return Err(format!(
            "geçersiz strateji: {} — izin verilenler: {:?}",
            strategy, ALLOWED_STRATEGIES
        ));
    }

    tracing::info!(
        "[{}] scale: {} instance, strateji: {}",
        cmd.command_id,
        instances,
        strategy
    );

    match config.scale_cmd.as_deref() {
        Some(scale_cmd) => {
            let full_cmd = format!(
                "INSTANCES={} STRATEGY={} {}",
                instances, strategy, scale_cmd
            );
            run_shell(&full_cmd, DEFAULT_SCALE_TIMEOUT).await
        }
        None => Ok(Some(format!(
            "scale acknowledged: {} instance(s), strategy={}",
            instances, strategy
        ))),
    }
}
