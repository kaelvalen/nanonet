use serde::{Deserialize, Serialize};
use crate::error::Result;

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum Command {
    Restart { timeout_sec: u64 },
    Stop { graceful: bool },
    Ping,
}

pub async fn execute_command(cmd: Command) -> Result<String> {
    match cmd {
        Command::Ping => Ok("pong".to_string()),
        Command::Restart { timeout_sec } => {
            tracing::info!("Restart komutu alındı (timeout: {}s)", timeout_sec);
            Ok("restart scheduled".to_string())
        }
        Command::Stop { graceful } => {
            tracing::info!("Stop komutu alındı (graceful: {})", graceful);
            Ok("stop scheduled".to_string())
        }
    }
}
