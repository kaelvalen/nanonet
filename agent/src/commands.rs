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
    /// exec komutu için çalıştırılacak shell komutu
    pub command: Option<String>,
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

/// Komutu çalıştırır. Başarılı olursa stdout çıktısını döner.
pub async fn execute(cmd: &IncomingCommand, config: &Config) -> Result<Option<String>, String> {
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
                        "[{}] Restart komutu çalıştırılıyor (timeout: {}s): {}",
                        cmd.command_id,
                        timeout,
                        restart_cmd
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
                        "[{}] Stop komutu çalıştırılıyor (graceful: {}): {}",
                        cmd.command_id,
                        graceful,
                        stop_cmd
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

        "exec" => match &cmd.command {
            Some(shell_cmd) => {
                tracing::info!("[{}] Exec: {}", cmd.command_id, shell_cmd);
                run_shell(shell_cmd, 60).await
            }
            None => Err("exec komutu için 'command' alanı gerekli".to_string()),
        },

        other => {
            tracing::warn!("[{}] Bilinmeyen komut: {}", cmd.command_id, other);
            Err(format!("bilinmeyen komut: {}", other))
        }
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
