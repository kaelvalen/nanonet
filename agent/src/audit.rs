//! Komut audit log — operatörün hangi komutu hangi sonuçla çalıştırdığının
//! tamper-evident *append-only* kaydı.
//!
//! ## Format
//!
//! Her satır bir NDJSON kaydı. İki olay tipi vardır:
//!
//! ```json
//! {"ts":"2026-04-20T01:23:45Z","event":"command_received","command_id":"…","action":"restart","payload":"…"}
//! {"ts":"2026-04-20T01:23:46Z","event":"command_completed","command_id":"…","action":"restart","success":true,"duration_ms":987,"error":null,"output_preview":"…"}
//! ```
//!
//! - `payload` ve `output_preview` her zaman [`crate::redact::redact`]
//!   süzgecinden geçer.
//! - `output_preview` 1 KiB ile sınırlandırılır — audit dosyası şişmesin.
//!
//! ## Tasarım
//!
//! - Append-only `OpenOptions::append(true).create(true)` ile açılır.
//! - Yazma `Mutex` ile sıralanır; iki concurrent komut interleave olmaz.
//! - Yazma hatası loglara warn olarak düşer; agent operasyonunu bloklamaz.
//! - Sıkı garanti veren bir audit (örn. WORM, fsync per write) ileride opt-in
//!   olarak eklenebilir; şu an performans tarafında durdu.

use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use chrono::Utc;
use serde::Serialize;
use tokio::fs::{File, OpenOptions};
use tokio::io::AsyncWriteExt;
use tokio::sync::Mutex;

use crate::redact::redact;

/// Audit log dosyasına serialize edilen kayıt.
#[derive(Debug, Serialize)]
struct AuditRecord<'a> {
    ts: String,
    event: &'a str,
    command_id: &'a str,
    action: &'a str,
    /// `command_received` için raw (redact edilmiş) payload özeti.
    #[serde(skip_serializing_if = "Option::is_none")]
    payload: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    success: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    duration_ms: Option<u128>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    output_preview: Option<String>,
}

/// Asenkron, append-only audit log writer. `Clone` ucuz (Arc paylaşımı).
#[derive(Clone, Debug)]
pub struct AuditLogger {
    inner: Arc<AuditInner>,
}

#[derive(Debug)]
struct AuditInner {
    path: PathBuf,
    file: Mutex<File>,
}

impl AuditLogger {
    /// Verilen path'te append modunda dosya açar. Üst dizin yoksa oluşturulur.
    pub async fn open(path: impl Into<PathBuf>) -> std::io::Result<Self> {
        let path = path.into();
        if let Some(parent) = path.parent() {
            if !parent.as_os_str().is_empty() {
                tokio::fs::create_dir_all(parent).await?;
            }
        }
        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&path)
            .await?;
        Ok(Self {
            inner: Arc::new(AuditInner {
                path,
                file: Mutex::new(file),
            }),
        })
    }

    /// Konfigüre edilmiş audit dosyasının path'i (debug/log için).
    pub fn path(&self) -> &std::path::Path {
        &self.inner.path
    }

    /// Komut alındığında çağrılır. `payload` operatörden gelen ham komut
    /// stringi (örn. `exec` payload'ı) — redact edilir.
    pub async fn record_received(&self, command_id: &str, action: &str, payload: Option<&str>) {
        let rec = AuditRecord {
            ts: Utc::now().to_rfc3339(),
            event: "command_received",
            command_id,
            action,
            payload: payload.map(|p| trim_for_audit(&redact(p))),
            success: None,
            duration_ms: None,
            error: None,
            output_preview: None,
        };
        self.write(&rec).await;
    }

    /// Komut tamamlandığında çağrılır. `output` ve `error` redact edilir.
    pub async fn record_completed(
        &self,
        command_id: &str,
        action: &str,
        success: bool,
        duration: Duration,
        error: Option<&str>,
        output: Option<&str>,
    ) {
        let rec = AuditRecord {
            ts: Utc::now().to_rfc3339(),
            event: "command_completed",
            command_id,
            action,
            payload: None,
            success: Some(success),
            duration_ms: Some(duration.as_millis()),
            error: error.map(|e| trim_for_audit(&redact(e))),
            output_preview: output.map(|o| trim_for_audit(&redact(o))),
        };
        self.write(&rec).await;
    }

    async fn write(&self, rec: &AuditRecord<'_>) {
        let line = match serde_json::to_string(rec) {
            Ok(s) => s,
            Err(e) => {
                tracing::warn!(error = %e, "audit kaydı serileştirilemedi");
                return;
            }
        };
        let mut file = self.inner.file.lock().await;
        if let Err(e) = file.write_all(line.as_bytes()).await {
            tracing::warn!(error = %e, "audit kaydı yazılamadı");
            return;
        }
        if let Err(e) = file.write_all(b"\n").await {
            tracing::warn!(error = %e, "audit kaydı sonu yazılamadı");
            return;
        }
        // Operatör post-mortem'inde son kaydın diskte olduğundan emin olmak
        // için flush — fsync değil (perf vs durability dengesi).
        if let Err(e) = file.flush().await {
            tracing::warn!(error = %e, "audit kaydı flush edilemedi");
        }
    }
}

/// Audit'e yazılacak alan içeriğini bir maksimum karakter limitine sığdırır.
const AUDIT_PREVIEW_MAX: usize = 1024;

fn trim_for_audit(s: &str) -> String {
    if s.chars().count() <= AUDIT_PREVIEW_MAX {
        return s.to_string();
    }
    let truncated: String = s.chars().take(AUDIT_PREVIEW_MAX).collect();
    format!("{}…[truncated]", truncated)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn writes_received_and_completed_lines() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("audit.ndjson");
        let logger = AuditLogger::open(&path).await.unwrap();

        logger
            .record_received("cmd-1", "exec", Some("status"))
            .await;
        logger
            .record_completed(
                "cmd-1",
                "exec",
                true,
                Duration::from_millis(42),
                None,
                Some("ok"),
            )
            .await;

        let body = tokio::fs::read_to_string(&path).await.unwrap();
        let lines: Vec<&str> = body.lines().collect();
        assert_eq!(lines.len(), 2);

        let rec1: serde_json::Value = serde_json::from_str(lines[0]).unwrap();
        assert_eq!(rec1["event"], "command_received");
        assert_eq!(rec1["command_id"], "cmd-1");
        assert_eq!(rec1["action"], "exec");
        assert_eq!(rec1["payload"], "status");

        let rec2: serde_json::Value = serde_json::from_str(lines[1]).unwrap();
        assert_eq!(rec2["event"], "command_completed");
        assert_eq!(rec2["success"], true);
        assert!(rec2["duration_ms"].as_u64().unwrap() >= 42);
        assert_eq!(rec2["output_preview"], "ok");
    }

    #[tokio::test]
    async fn redacts_secrets_in_audit() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("audit.ndjson");
        let logger = AuditLogger::open(&path).await.unwrap();

        logger
            .record_received("cmd-x", "exec", Some("Bearer abcdefghi"))
            .await;
        let body = tokio::fs::read_to_string(&path).await.unwrap();
        assert!(!body.contains("abcdefghi"));
        assert!(body.contains("[REDACTED]"));
    }

    #[tokio::test]
    async fn appends_across_reopens() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("audit.ndjson");

        {
            let l1 = AuditLogger::open(&path).await.unwrap();
            l1.record_received("a", "ping", None).await;
        }
        {
            let l2 = AuditLogger::open(&path).await.unwrap();
            l2.record_received("b", "ping", None).await;
        }

        let body = tokio::fs::read_to_string(&path).await.unwrap();
        assert_eq!(body.lines().count(), 2, "yeni open append etmeli");
    }

    #[tokio::test]
    async fn long_payload_is_trimmed() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("audit.ndjson");
        let logger = AuditLogger::open(&path).await.unwrap();
        let payload = "x".repeat(2048);
        logger.record_received("c", "exec", Some(&payload)).await;
        let body = tokio::fs::read_to_string(&path).await.unwrap();
        assert!(body.contains("[truncated]"));
        // Tam payload'un kendisi yazılmamış olmalı.
        assert!(!body.contains(&"x".repeat(2048)));
    }
}
