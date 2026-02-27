use serde::{Deserialize, Serialize};
use std::time::Duration;
use tokio::process::Command as TokioCommand;

use crate::config::Config;

/// Backend'den gelen düz JSON komut yapısı.
/// Backend şu formatı gönderiyor:
/// {"type":"command","command_id":"...","action":"restart","timeout_sec":30}
#[derive(Debug, Deserialize)]
pub struct IncomingCommand {
    pub command_id: String,
    pub action: String,
    /// restart komutu için (saniye)
    pub timeout_sec: Option<u64>,
    /// stop komutu için
    pub graceful: Option<bool>,
    /// exec komutu için shell komutu
    pub command: Option<String>,
    /// scale komutu için instance sayısı
    pub instances: Option<u32>,
    /// load balancing stratejisi
    pub strategy: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CommandAck {
    #[serde(rename = "type")]
    pub msg_type: String,
    pub command_id: String,
}

#[derive(Debug, Serialize)]
pub struct CommandResult {
    #[serde(rename = "type")]
    pub msg_type: String,
    pub command_id: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output: Option<String>,
}

impl IncomingCommand {
    pub fn ack_json(&self) -> String {
        serde_json::to_string(&CommandAck {
            msg_type: "ack".to_string(),
            command_id: self.command_id.clone(),
        })
        .unwrap_or_default()
    }

    pub fn result_json(&self, success: bool, error: Option<String>, output: Option<String>) -> String {
        serde_json::to_string(&CommandResult {
            msg_type: "result".to_string(),
            command_id: self.command_id.clone(),
            status: if success { "success" } else { "failed" }.to_string(),
            error,
            output,
        })
        .unwrap_or_default()
    }
}

/// İzin verilen komut listesi (allowlist). Bu liste dışında hiçbir komut çalıştırılmaz.
const ALLOWED_ACTIONS: &[&str] = &["ping", "restart", "stop", "start", "exec", "scale"];

/// Komutu çalıştırır. Yalnızca allowlist komutları kabul eder.
/// Arbitrary shell execution kesinlikle yasaktır.
pub async fn execute(cmd: &IncomingCommand, config: &Config) -> Result<Option<String>, String> {
    if !ALLOWED_ACTIONS.contains(&cmd.action.as_str()) {
        tracing::warn!(
            "[{}] Allowlist dışı komut reddedildi: {}",
            cmd.command_id,
            cmd.action
        );
        return Err(format!("izin verilmeyen komut: {}", cmd.action));
    }

    match cmd.action.as_str() {
        "ping" => {
            tracing::info!("[{}] Ping alındı", cmd.command_id);
            Ok(None)
        }

        "restart" => {
            let timeout = cmd.timeout_sec.unwrap_or(30);
            match &config.restart_cmd {
                Some(restart_cmd) => {
                    tracing::info!(
                        "[{}] Restart komutu çalıştırılıyor (timeout: {}s)",
                        cmd.command_id,
                        timeout,
                    );
                    run_shell(restart_cmd, timeout).await
                }
                None => {
                    tracing::warn!(
                        "[{}] restart_cmd yapılandırılmamış — NANONET_RESTART_CMD eksik",
                        cmd.command_id
                    );
                    Err("NANONET_RESTART_CMD yapılandırılmamış".to_string())
                }
            }
        }

        "stop" => {
            let graceful = cmd.graceful.unwrap_or(true);
            match &config.stop_cmd {
                Some(stop_cmd) => {
                    tracing::info!(
                        "[{}] Stop komutu çalıştırılıyor (graceful: {})",
                        cmd.command_id,
                        graceful,
                    );
                    run_shell(stop_cmd, 30).await
                }
                None => {
                    tracing::warn!(
                        "[{}] stop_cmd yapılandırılmamış — NANONET_STOP_CMD eksik",
                        cmd.command_id
                    );
                    Err("NANONET_STOP_CMD yapılandırılmamış".to_string())
                }
            }
        }

        "start" => {
            match &config.start_cmd {
                Some(start_cmd) => {
                    tracing::info!("[{}] Start komutu çalıştırılıyor", cmd.command_id);
                    run_shell(start_cmd, 60).await
                }
                None => {
                    tracing::warn!(
                        "[{}] start_cmd yapılandırılmamış — NANONET_START_CMD eksik",
                        cmd.command_id
                    );
                    Err("NANONET_START_CMD yapılandırılmamış".to_string())
                }
            }
        }

        "exec" => {
            let shell_cmd = match &cmd.command {
                Some(c) if !c.trim().is_empty() => c.clone(),
                _ => return Err("exec: command alanı eksik".to_string()),
            };
            let timeout = cmd.timeout_sec.unwrap_or(30);
            tracing::info!(
                "[{}] exec çalıştırılıyor (timeout: {}s): {}",
                cmd.command_id, timeout, shell_cmd
            );
            run_shell(&shell_cmd, timeout).await
        }

        "scale" => {
            let instances = cmd.instances.unwrap_or(1);
            let strategy = cmd.strategy.as_deref().unwrap_or("round_robin");
            tracing::info!(
                "[{}] scale: {} instance, strateji: {}",
                cmd.command_id, instances, strategy
            );
            match &config.scale_cmd {
                Some(scale_cmd) => {
                    let full_cmd = format!(
                        "INSTANCES={} STRATEGY={} {}",
                        instances, strategy, scale_cmd
                    );
                    run_shell(&full_cmd, 60).await
                }
                None => {
                    Ok(Some(format!(
                        "scale acknowledged: {} instance(s), strategy={}",
                        instances, strategy
                    )))
                }
            }
        }

        _ => unreachable!("allowlist kontrolü yukarıda yapıldı"),
    }
}

/// Belirtilen shell komutunu çalıştırır, stdout döner.
async fn run_shell(cmd: &str, timeout_sec: u64) -> Result<Option<String>, String> {
    let result = tokio::time::timeout(
        Duration::from_secs(timeout_sec),
        TokioCommand::new("sh").arg("-c").arg(cmd).output(),
    )
    .await;

    match result {
        Ok(Ok(out)) => {
            let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();

            if out.status.success() {
                let output = if stdout.is_empty() { None } else { Some(stdout) };
                Ok(output)
            } else {
                let msg = if !stderr.is_empty() {
                    stderr
                } else if !stdout.is_empty() {
                    stdout
                } else {
                    format!("exit kodu: {}", out.status)
                };
                Err(msg)
            }
        }
        Ok(Err(e)) => Err(format!("Komut başlatılamadı: {}", e)),
        Err(_) => Err(format!("Zaman aşımı ({}s)", timeout_sec)),
    }
}
