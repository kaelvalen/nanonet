//! Shell komutu çalıştırıcı.
//!
//! Komut çıktısı (stdout) operatöre döndürülür; başarısız ise stderr
//! kullanılır. Tüm komutlar `sh -c` üzerinden çalışır — şu an POSIX shell
//! varsayımıyla — ve `timeout_sec` aşımında zorla iptal edilir.
//!
//! ## Hata stratejisi
//!
//! - `Ok(Some(stdout))` — başarılı, çıktı var
//! - `Ok(None)`         — başarılı, çıktı boş
//! - `Err(msg)`         — exit ≠ 0 veya başlatma hatası veya timeout
//!
//! ## Çıktı limiti
//!
//! Bir komutun çıktısı (`stdout`/`stderr`) [`MAX_OUTPUT_BYTES`] sınırını aşarsa
//! son 64 KiB tutulur ve çıktının üstüne kesilme bilgisi eklenir. Bunun amacı
//! WS frame'lerinin patlamasını ve operatöre devasa dump göndermeyi önlemek.
//! `du -ah /` gibi yanlışlıkla salınmış komutlar agent'ı çökertmemeli.

use std::time::Duration;
use tokio::process::Command as TokioCommand;

use crate::redact::redact;

/// Operatör çıktıları için hard cap. Bu sınırı geçen her output tail tutulur.
pub const MAX_OUTPUT_BYTES: usize = 64 * 1024;

/// Belirtilen shell komutunu `sh -c` ile çalıştırır.
pub async fn run_shell(cmd: &str, timeout_sec: u64) -> Result<Option<String>, String> {
    let result = tokio::time::timeout(
        Duration::from_secs(timeout_sec),
        TokioCommand::new("sh").arg("-c").arg(cmd).output(),
    )
    .await;

    match result {
        Ok(Ok(out)) => {
            let stdout = sanitize_stream(&out.stdout);
            let stderr = sanitize_stream(&out.stderr);

            if out.status.success() {
                let output = if stdout.is_empty() {
                    None
                } else {
                    Some(stdout)
                };
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

/// Bir process çıktısını lossy UTF-8'e çevirir, trim eder, boyutu cap'ler ve
/// bilinen secret desenlerini [`redact`] eder. Operatöre dönecek son string
/// budur — backend'e ham geçmez.
///
/// Cap aşılırsa **son** [`MAX_OUTPUT_BYTES`] byte tutulur (kuyruk genelde daha
/// teşhise yararlıdır), başına bir uyarı satırı eklenir.
fn sanitize_stream(bytes: &[u8]) -> String {
    let raw = if bytes.len() <= MAX_OUTPUT_BYTES {
        String::from_utf8_lossy(bytes).trim().to_string()
    } else {
        let tail = &bytes[bytes.len() - MAX_OUTPUT_BYTES..];
        let suffix = String::from_utf8_lossy(tail);
        let trimmed_suffix = match suffix.find('\n') {
            Some(idx) if idx + 1 < suffix.len() => &suffix[idx + 1..],
            _ => &suffix[..],
        };
        let truncated_bytes = bytes.len() - MAX_OUTPUT_BYTES;
        format!(
            "[output truncated: {} byte kesildi, son {} byte gösteriliyor]\n{}",
            truncated_bytes,
            MAX_OUTPUT_BYTES,
            trimmed_suffix.trim_end()
        )
    };

    redact(&raw)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn returns_stdout_on_success() {
        let out = run_shell("echo hello", 5).await.unwrap();
        assert_eq!(out.as_deref(), Some("hello"));
    }

    #[tokio::test]
    async fn returns_none_when_output_empty() {
        let out = run_shell("true", 5).await.unwrap();
        assert!(out.is_none());
    }

    #[tokio::test]
    async fn returns_stderr_on_failure() {
        let err = run_shell("echo boom 1>&2; exit 7", 5).await.unwrap_err();
        assert!(err.contains("boom"), "stderr çıktısı dönmeli, geldi: {err}");
    }

    #[tokio::test]
    async fn returns_exit_code_when_no_output() {
        let err = run_shell("exit 42", 5).await.unwrap_err();
        assert!(err.contains("42"), "exit kodu dönmeli, geldi: {err}");
    }

    #[tokio::test]
    async fn enforces_timeout() {
        let err = run_shell("sleep 5", 1).await.unwrap_err();
        assert!(err.to_lowercase().contains("zaman"));
    }

    #[tokio::test]
    async fn caps_large_stdout_to_max_output_bytes() {
        // 256 KiB üretip 64 KiB'lik tail tutulmasını doğrula.
        // `printf '%.0s' x` taşınabilir değil; dd kullanırız.
        let cmd = "dd if=/dev/zero bs=1024 count=256 2>/dev/null | tr '\\0' a";
        let out = run_shell(cmd, 10).await.unwrap().expect("output");
        assert!(
            out.starts_with("[output truncated"),
            "uyarı önekli olmalı, geldi: {}",
            &out[..80.min(out.len())]
        );
        // Önek satırı + içerik ≤ MAX_OUTPUT_BYTES + ~120 (uyarı satırı uzunluğu).
        assert!(
            out.len() <= MAX_OUTPUT_BYTES + 200,
            "kesilmiş çıktı çok uzun: {}",
            out.len()
        );
    }

    #[tokio::test]
    async fn caps_large_stderr_too() {
        let cmd = "dd if=/dev/zero bs=1024 count=128 2>/dev/null | tr '\\0' b 1>&2; exit 1";
        let err = run_shell(cmd, 10).await.unwrap_err();
        assert!(
            err.starts_with("[output truncated"),
            "stderr de cap'lenmeli"
        );
        assert!(err.len() <= MAX_OUTPUT_BYTES + 200);
    }

    #[test]
    fn sanitize_stream_passes_small_input_through() {
        let s = sanitize_stream(b"  hello\n");
        assert_eq!(s, "hello");
    }

    #[test]
    fn sanitize_stream_truncates_oversized_input() {
        let big = vec![b'x'; MAX_OUTPUT_BYTES * 2];
        let s = sanitize_stream(&big);
        assert!(s.starts_with("[output truncated"));
        assert!(s.len() <= MAX_OUTPUT_BYTES + 200);
        assert!(s.ends_with("xxx"));
    }

    #[test]
    fn sanitize_stream_redacts_bearer_tokens_in_output() {
        let s = sanitize_stream(b"server replied: Authorization: Bearer abcdef0123456");
        assert!(!s.contains("abcdef0123456"));
        assert!(s.contains("[REDACTED]"));
    }
}
