//! Backend'den gelen komutların allowlist tabanlı yürütücüsü.
//!
//! Bu modül beş alt modüle bölünmüştür — her biri tek bir sorumluluğa sahip:
//!
//! - [`types`]      — wire-format (`IncomingCommand`, ack/result JSON üreticileri)
//! - [`validation`] — allowlist + shell injection süzgeci
//! - [`runner`]     — `sh -c` ile timeout'lu komut çalıştırıcı
//! - [`lifecycle`]  — restart / stop / start / scale / ping handler'ları
//! - [`exec`]       — `exec` keyword dispatcher + servis tanılayıcı şablonlar
//!
//! Tek dış kapı [`execute`] fonksiyonudur. WS layer (`crate::ws`) yalnızca bu
//! fonksiyonu çağırır — alt modüller dışarıya görünmez tutulabilir, fakat
//! testler kolay olsun diye public bırakıldı.

pub mod exec;
pub mod lifecycle;
pub mod runner;
pub mod types;
pub mod validation;

pub use types::IncomingCommand;
use validation::is_allowed_action;

use crate::config::Config;

/// Tek giriş noktası — tüm action'lar buradan dispatch edilir.
///
/// Allowlist dışı bir action gelirse erken reddedilir; aksi takdirde
/// ilgili alt modülün handler'ı çağırılır.
pub async fn execute(cmd: &IncomingCommand, config: &Config) -> Result<Option<String>, String> {
    if !is_allowed_action(&cmd.action) {
        tracing::warn!(
            "[{}] Allowlist dışı komut reddedildi: {}",
            cmd.command_id,
            cmd.action
        );
        return Err(format!("izin verilmeyen komut: {}", cmd.action));
    }

    match cmd.action.as_str() {
        "ping" => lifecycle::ping(cmd),
        "restart" => lifecycle::restart(cmd, config).await,
        "stop" => lifecycle::stop(cmd, config).await,
        "start" => lifecycle::start(cmd, config).await,
        "scale" => lifecycle::scale(cmd, config).await,
        "exec" => exec::run(cmd, config).await,
        _ => unreachable!("allowlist kontrolü yukarıda yapıldı"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use clap::Parser;

    fn cfg() -> Config {
        Config::parse_from([
            "nanonet-agent",
            "--backend",
            "ws://localhost:8080",
            "--service-id",
            "00000000-0000-0000-0000-000000000000",
        ])
    }

    fn cmd(action: &str) -> IncomingCommand {
        IncomingCommand {
            command_id: "test".into(),
            action: action.into(),
            timeout_sec: None,
            graceful: None,
            command: None,
            instances: None,
            strategy: None,
            signature: None,
            nonce: None,
        }
    }

    #[tokio::test]
    async fn rejects_action_outside_allowlist() {
        let err = execute(&cmd("rm"), &cfg()).await.unwrap_err();
        assert!(err.contains("izin verilmeyen"));
    }

    #[tokio::test]
    async fn ping_is_noop_success() {
        let out = execute(&cmd("ping"), &cfg()).await.unwrap();
        assert!(out.is_none());
    }

    #[tokio::test]
    async fn restart_without_config_fails_with_hint() {
        let err = execute(&cmd("restart"), &cfg()).await.unwrap_err();
        assert!(err.contains("NANONET_RESTART_CMD"));
    }

    #[tokio::test]
    async fn scale_without_scale_cmd_returns_acknowledgement() {
        let mut c = cmd("scale");
        c.instances = Some(2);
        let out = execute(&c, &cfg()).await.unwrap().unwrap();
        assert!(out.contains("scale acknowledged"));
        assert!(out.contains("2 instance"));
    }

    #[tokio::test]
    async fn scale_rejects_invalid_strategy() {
        let mut c = cmd("scale");
        c.strategy = Some("eval".into());
        let err = execute(&c, &cfg()).await.unwrap_err();
        assert!(err.contains("geçersiz strateji"));
    }

    #[tokio::test]
    async fn exec_requires_payload() {
        let err = execute(&cmd("exec"), &cfg()).await.unwrap_err();
        assert!(err.contains("command alanı eksik"));
    }

    #[tokio::test]
    async fn exec_rejects_unsafe_payload() {
        let mut c = cmd("exec");
        c.command = Some("ls; rm -rf /".into());
        let err = execute(&c, &cfg()).await.unwrap_err();
        assert!(err.to_lowercase().contains("güvenlik"));
    }
}
