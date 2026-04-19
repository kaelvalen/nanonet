//! Komut doğrulama (allowlist + shell injection koruması).
//!
//! Backend'den gelen tüm komutlar **önce** burada bayraklanır. Allowlist'te
//! olmayan herhangi bir action reddedilir; `exec` payload'larındaki ham komut
//! da [`validate_safe_input`] süzgecinden geçer.

use regex::Regex;
use std::sync::OnceLock;

/// İzin verilen action listesi.
///
/// Backend yanlışlıkla yeni bir action gönderse veya eski bir agent yeni bir
/// action ile karşılaşsa bile listenin dışındaki hiçbir komut çalışmaz.
pub const ALLOWED_ACTIONS: &[&str] = &["ping", "restart", "stop", "start", "exec", "scale"];

/// `scale` komutu için izin verilen load-balancing stratejileri.
pub const ALLOWED_STRATEGIES: &[&str] =
    &["round_robin", "least_conn", "ip_hash", "random", "weighted"];

/// İzin verilen karakterler: alfanumerik, boşluk/tab, `_`, `.`, `/`, `-`, `=`, `:`.
///
/// **Yasaklanan**: `;`, `|`, `||`, `&`, `&&`, `$`, backtick, `\`, tırnaklar,
/// `<`, `>`, `*`, `?`, `!`, `(`, `)`, `[`, `]`, `{`, `}`, `#`.
///
/// `&` Faz 3'te kaldırıldı: `cmd &` ile background process spawn ederek
/// agent'ın görmediği iş üretmek, `cmd1 && cmd2` ile zincirleme istismarı
/// engellenir.
fn safe_input_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"^[a-zA-Z0-9_./=\-: \t]+$").expect("safe_input_regex pattern is valid")
    })
}

/// Maksimum girdi uzunluğu (karakter cinsinden).
pub const MAX_INPUT_LEN: usize = 256;

/// Kullanıcı girdisini shell injection'a karşı doğrular.
///
/// Hata mesajı operatöre net ipucu verecek şekilde Türkçe yazılır; backend bu
/// mesajı `command result` çerçevesi içinde aynen iletir.
pub fn validate_safe_input(input: &str) -> Result<(), String> {
    if input.len() > MAX_INPUT_LEN {
        return Err(format!("input çok uzun (max {} karakter)", MAX_INPUT_LEN));
    }
    if !safe_input_regex().is_match(input) {
        return Err("input içerisinde yasak karakterler var. izin verilenler: \
             a-zA-Z0-9_./=\\-: <bosluk> <tab>"
            .to_string());
    }
    Ok(())
}

/// `action` allowlist'te mi?
pub fn is_allowed_action(action: &str) -> bool {
    ALLOWED_ACTIONS.contains(&action)
}

/// `strategy` allowlist'te mi?
pub fn is_allowed_strategy(strategy: &str) -> bool {
    ALLOWED_STRATEGIES.contains(&strategy)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allows_simple_keywords() {
        assert!(validate_safe_input("status").is_ok());
        assert!(validate_safe_input("ps proc").is_ok());
        assert!(validate_safe_input("logs").is_ok());
        assert!(validate_safe_input("path/to/file").is_ok());
        assert!(validate_safe_input("KEY=value").is_ok());
    }

    #[test]
    fn rejects_shell_metacharacters() {
        for bad in [
            "ls; rm -rf /",
            "echo `whoami`",
            "cat $HOME",
            "a | b",
            "a || b",
            "x > y",
            "x < y",
            "echo \"hello\"",
            "echo 'hi'",
            "(true)",
            "[ x ]",
            "{ x }",
            "wild*card",
            "tab\nnewline",
            "back\\slash",
            // Faz 3'te eklenenler:
            "cmd &",
            "a && b",
            "a & b & c",
        ] {
            assert!(
                validate_safe_input(bad).is_err(),
                "shell metakarakter geçirildi: {bad:?}"
            );
        }
    }

    #[test]
    fn rejects_too_long_input() {
        let s = "a".repeat(MAX_INPUT_LEN + 1);
        assert!(validate_safe_input(&s).is_err());
    }

    #[test]
    fn rejects_empty_after_trim_is_caller_responsibility() {
        // Boş string regex'e takılır (en az 1 karakter zorunlu).
        assert!(validate_safe_input("").is_err());
    }

    #[test]
    fn allowlist_membership() {
        assert!(is_allowed_action("restart"));
        assert!(is_allowed_action("ping"));
        assert!(!is_allowed_action("rm"));
        assert!(!is_allowed_action(""));

        assert!(is_allowed_strategy("round_robin"));
        assert!(is_allowed_strategy("ip_hash"));
        assert!(!is_allowed_strategy("eval"));
    }
}
