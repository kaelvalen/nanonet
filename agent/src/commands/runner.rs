//! Shell komutu çalıştırıcı.
//!
//! Komut çıktısı (stdout) operatöre döndürülür; başarısız ise stderr
//! kullanılır. Komutlar platforma göre seçilen bir kabukla çalışır:
//! Unix'te `sh -c`, Windows'ta `powershell.exe -NoProfile -NonInteractive
//! -Command`. `timeout_sec` aşımında process zorla iptal edilir.
//!
//! Bunun pratik sonucu: yaşam döngüsü komutları (`NANONET_RESTART_CMD` vb.)
//! ve `exec` tanılama şablonları hedef platformun kabuk diliyle yazılmalıdır.
//! [`crate::commands::exec`] şablonları `#[cfg]` ile her platforma ayrı verir.
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

/// Platforma uygun kabuğu hazırlar: Unix'te `sh -c`, Windows'ta PowerShell.
///
/// Windows'ta `-NoProfile` profil yükleme gecikmesini ve kullanıcı profilinin
/// yan etkilerini engeller; `-NonInteractive` herhangi bir prompt'un agent'ı
/// bloklamamasını garanti eder. Komut tek bir argüman olarak `-Command`'a
/// geçer — script dosyası olmadığı için ExecutionPolicy bunu kısıtlamaz.
#[cfg(windows)]
fn shell_command(cmd: &str) -> TokioCommand {
    let mut c = TokioCommand::new("powershell.exe");
    c.arg("-NoProfile")
        .arg("-NonInteractive")
        .arg("-Command")
        .arg(cmd);
    c
}

#[cfg(not(windows))]
fn shell_command(cmd: &str) -> TokioCommand {
    let mut c = TokioCommand::new("sh");
    c.arg("-c").arg(cmd);
    c
}

/// Belirtilen komutu platforma uygun kabukla çalıştırır.
pub async fn run_shell(cmd: &str, timeout_sec: u64) -> Result<Option<String>, String> {
    let result = tokio::time::timeout(
        Duration::from_secs(timeout_sec),
        shell_command(cmd).output(),
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

    // ── Platform-bağımsız: timeout ───────────────────────────────────
    #[tokio::test]
    async fn enforces_timeout() {
        // Unix'te `sleep`, Windows'ta `Start-Sleep` 5sn bekler; 1sn timeout vurur.
        let cmd = if cfg!(windows) {
            "Start-Sleep -Seconds 5"
        } else {
            "sleep 5"
        };
        let err = run_shell(cmd, 1).await.unwrap_err();
        assert!(err.to_lowercase().contains("zaman"));
    }

    // ── Unix (sh) davranışı ───────────────────────────────────────────
    #[cfg(unix)]
    #[tokio::test]
    async fn returns_stdout_on_success() {
        let out = run_shell("echo hello", 5).await.unwrap();
        assert_eq!(out.as_deref(), Some("hello"));
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn returns_none_when_output_empty() {
        let out = run_shell("true", 5).await.unwrap();
        assert!(out.is_none());
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn returns_stderr_on_failure() {
        let err = run_shell("echo boom 1>&2; exit 7", 5).await.unwrap_err();
        assert!(err.contains("boom"), "stderr çıktısı dönmeli, geldi: {err}");
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn returns_exit_code_when_no_output() {
        let err = run_shell("exit 42", 5).await.unwrap_err();
        assert!(err.contains("42"), "exit kodu dönmeli, geldi: {err}");
    }

    // ── Windows (PowerShell) davranışı ────────────────────────────────
    #[cfg(windows)]
    #[tokio::test]
    async fn returns_stdout_on_success_win() {
        let out = run_shell("Write-Output hello", 15).await.unwrap();
        assert_eq!(out.as_deref(), Some("hello"));
    }

    #[cfg(windows)]
    #[tokio::test]
    async fn returns_none_when_output_empty_win() {
        let out = run_shell("exit 0", 15).await.unwrap();
        assert!(out.is_none());
    }

    #[cfg(windows)]
    #[tokio::test]
    async fn returns_stderr_on_failure_win() {
        let err = run_shell("[Console]::Error.WriteLine('boom'); exit 7", 15)
            .await
            .unwrap_err();
        assert!(err.contains("boom"), "stderr çıktısı dönmeli, geldi: {err}");
    }

    #[cfg(windows)]
    #[tokio::test]
    async fn returns_exit_code_when_no_output_win() {
        let err = run_shell("exit 42", 15).await.unwrap_err();
        assert!(err.contains("42"), "exit kodu dönmeli, geldi: {err}");
    }

    #[cfg(unix)]
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

    #[cfg(unix)]
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
