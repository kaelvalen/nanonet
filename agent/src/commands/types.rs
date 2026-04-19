//! Komut wire-format tipleri (backend ↔ agent).
//!
//! Backend basit, düz JSON gönderir:
//! ```json
//! {
//!   "type": "command",
//!   "command_id": "uuid-...",
//!   "action": "restart",
//!   "timeout_sec": 30
//! }
//! ```
//!
//! Agent iki frame ile yanıt verir:
//! 1. Hemen: `{ "type": "ack", "command_id": "..." }`
//! 2. İş bitince: `{ "type": "result", "command_id": "...", "status": "success|failed", "error": "...", "output": "..." }`

use serde::{Deserialize, Serialize};

/// Backend'den gelen düz JSON komut yapısı.
#[derive(Debug, Deserialize)]
pub struct IncomingCommand {
    pub command_id: String,
    pub action: String,
    /// `restart` / `exec` için override timeout (saniye).
    pub timeout_sec: Option<u64>,
    /// `stop` için graceful flag.
    pub graceful: Option<bool>,
    /// `exec` için anahtar kelime payload'u.
    pub command: Option<String>,
    /// `scale` için instance sayısı.
    pub instances: Option<u32>,
    /// `scale` için load balancing stratejisi.
    pub strategy: Option<String>,
    /// HMAC imzası (hex). Agent'ta `--sign-secret` yapılandırılmışsa zorunlu.
    pub signature: Option<String>,
    /// Replay korumasında kullanılan tek seferlik nonce (UUID önerilir).
    pub nonce: Option<String>,
}

#[derive(Debug, Serialize)]
struct CommandAck {
    #[serde(rename = "type")]
    msg_type: &'static str,
    command_id: String,
}

#[derive(Debug, Serialize)]
struct CommandResult {
    #[serde(rename = "type")]
    msg_type: &'static str,
    command_id: String,
    status: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    output: Option<String>,
}

impl IncomingCommand {
    /// `ack` çerçevesini JSON string olarak üretir. Serialize hata vermez —
    /// her zaman aynı şekilli mesaj.
    pub fn ack_json(&self) -> String {
        serde_json::to_string(&CommandAck {
            msg_type: "ack",
            command_id: self.command_id.clone(),
        })
        .unwrap_or_default()
    }

    /// `result` çerçevesini JSON string olarak üretir.
    pub fn result_json(
        &self,
        success: bool,
        error: Option<String>,
        output: Option<String>,
    ) -> String {
        serde_json::to_string(&CommandResult {
            msg_type: "result",
            command_id: self.command_id.clone(),
            status: if success { "success" } else { "failed" },
            error,
            output,
        })
        .unwrap_or_default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dummy(id: &str, action: &str) -> IncomingCommand {
        IncomingCommand {
            command_id: id.into(),
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

    #[test]
    fn ack_shape() {
        let cmd = dummy("cmd-1", "restart");
        let s = cmd.ack_json();
        let v: serde_json::Value = serde_json::from_str(&s).unwrap();
        assert_eq!(v["type"], "ack");
        assert_eq!(v["command_id"], "cmd-1");
    }

    #[test]
    fn result_success_shape() {
        let cmd = dummy("cmd-2", "ping");
        let s = cmd.result_json(true, None, Some("pong".into()));
        let v: serde_json::Value = serde_json::from_str(&s).unwrap();
        assert_eq!(v["type"], "result");
        assert_eq!(v["status"], "success");
        assert_eq!(v["output"], "pong");
        assert!(v.get("error").is_none(), "error alanı atlanmış olmalı");
    }

    #[test]
    fn result_failure_shape() {
        let cmd = dummy("cmd-3", "restart");
        let s = cmd.result_json(false, Some("boom".into()), None);
        let v: serde_json::Value = serde_json::from_str(&s).unwrap();
        assert_eq!(v["status"], "failed");
        assert_eq!(v["error"], "boom");
        assert!(v.get("output").is_none());
    }

    #[test]
    fn parses_minimal_command() {
        let raw = r#"{"command_id":"x","action":"ping"}"#;
        let cmd: IncomingCommand = serde_json::from_str(raw).unwrap();
        assert_eq!(cmd.action, "ping");
    }

    #[test]
    fn parses_full_command() {
        let raw = r#"{
            "command_id":"y",
            "action":"scale",
            "instances":3,
            "strategy":"ip_hash",
            "timeout_sec":120
        }"#;
        let cmd: IncomingCommand = serde_json::from_str(raw).unwrap();
        assert_eq!(cmd.instances, Some(3));
        assert_eq!(cmd.strategy.as_deref(), Some("ip_hash"));
        assert_eq!(cmd.timeout_sec, Some(120));
    }
}
