use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Deserialize)]
pub struct IncomingCommand {
    pub command_id: String,
    pub action: String,
    #[serde(default)]
    pub payload: Value,
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
}

impl IncomingCommand {
    pub fn ack_json(&self) -> String {
        serde_json::to_string(&CommandAck {
            msg_type: "ack".to_string(),
            command_id: self.command_id.clone(),
        })
        .unwrap_or_default()
    }

    pub fn result_json(&self, success: bool, error: Option<String>) -> String {
        serde_json::to_string(&CommandResult {
            msg_type: "result".to_string(),
            command_id: self.command_id.clone(),
            status: if success { "success" } else { "failed" }.to_string(),
            error,
        })
        .unwrap_or_default()
    }
}

pub async fn execute(cmd: &IncomingCommand) -> Result<(), String> {
    match cmd.action.as_str() {
        "ping" => {
            tracing::info!("[{}] Ping komutu alındı", cmd.command_id);
            Ok(())
        }
        "restart" => {
            let timeout = cmd
                .payload
                .get("timeout_sec")
                .and_then(|v| v.as_u64())
                .unwrap_or(30);
            tracing::info!(
                "[{}] Restart komutu alındı (timeout: {}s)",
                cmd.command_id,
                timeout
            );
            // SAFETY: Production'da burada process yönetimi yapılır.
            // MVP için sadece log + başarılı döner.
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            tracing::info!("[{}] Restart tamamlandı", cmd.command_id);
            Ok(())
        }
        "stop" => {
            let graceful = cmd
                .payload
                .get("graceful")
                .and_then(|v| v.as_bool())
                .unwrap_or(true);
            tracing::info!(
                "[{}] Stop komutu alındı (graceful: {})",
                cmd.command_id,
                graceful
            );
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            tracing::info!("[{}] Stop tamamlandı", cmd.command_id);
            Ok(())
        }
        other => {
            tracing::warn!("[{}] Bilinmeyen komut: {}", cmd.command_id, other);
            Err(format!("bilinmeyen komut: {}", other))
        }
    }
}
