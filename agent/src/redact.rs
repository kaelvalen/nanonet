//! Hassas verilerin (token, parola, kimlik) operatör çıktılarından ve audit
//! log'larından maskelenmesi.
//!
//! Bu modül **best-effort** redaksiyon yapar — tüm secret'ları yakalayamaz,
//! ama yaygın desenleri (Bearer token, JSON `"token":"…"` / `"password":"…"`,
//! query string `?token=…&secret=…`, AWS access key biçimi) maskeler.
//!
//! Kullanım yeri:
//! - Komut audit log girişi (yapılandırmanın içinde token olabilir)
//! - Komut çıktısı/error string'i (env değişkenleri, curl çıktısı vs.)
//! - Trace/log mesajına geçirilen `payload` alanları
//!
//! ## Karar gerekçesi
//!
//! Tracing katmanına global filtre yazmak yerine fonksiyon-tabanlı redaksiyon
//! seçildi: log fields zaten tipli geçiyor (`Bearer ***` gibi), risk yüzeyi
//! çoğunlukla **payload string'leri**. Ayrıca redaksiyon fail-open olduğundan
//! global filtre tehlikeli (sessiz secret leak). Çağrı noktasından geçen
//! string'i bilinçli redact etmek daha öngörülebilir.

use once_cell::sync::Lazy;
use regex::Regex;

/// Maskelenmiş değerin yerine konacak placeholder.
pub const REDACTED: &str = "[REDACTED]";

// Yakalanan desenler (sırasıyla denenir):
//
// 1. `Bearer <token>` — RFC 6750 authorization header.
// 2. JSON: `"key":"value"` formatında token-benzeri alan adları.
// 3. URL query: `?token=value`, `&secret=value` vs.
// 4. AWS access key (AKIA...), 20 karakter.

static RE_BEARER: Lazy<Regex> = Lazy::new(|| {
    // Bearer token, durumsal: header değerinde veya log içinde geçebilir.
    Regex::new(r"(?i)(Bearer\s+)([A-Za-z0-9._\-]{6,})").unwrap()
});

static RE_JSON_FIELD: Lazy<Regex> = Lazy::new(|| {
    // "token": "abc", "password": "x", vb. Anahtar listesi sınırlı; false positive azaltılır.
    // (?i) case insensitive, anahtar adında.
    Regex::new(
        r#"(?i)("(?:agent_token|token|password|passwd|secret|api[_-]?key|authorization)"\s*:\s*")([^"]+)(")"#,
    )
    .unwrap()
});

static RE_QUERY_PARAM: Lazy<Regex> = Lazy::new(|| {
    // ?token=...&password=... gibi key=value içinden hassas anahtarları yakala.
    Regex::new(r"(?i)([?&](?:agent_token|token|password|passwd|secret|api[_-]?key)=)([^&\s#]+)")
        .unwrap()
});

static RE_AWS_KEY: Lazy<Regex> = Lazy::new(|| {
    // AKIA + 16 alfanumerik = 20 karakter total.
    Regex::new(r"\b(AKIA[0-9A-Z]{16})\b").unwrap()
});

/// Verilen string'in içinde tanınan secret desenlerini [`REDACTED`] ile değiştirir.
/// İdempotent: zaten redact edilmiş string'e tekrar uygulamak güvenli (no-op).
pub fn redact(input: &str) -> String {
    let s = RE_BEARER.replace_all(input, |caps: &regex::Captures| {
        format!("{}{}", &caps[1], REDACTED)
    });
    let s = RE_JSON_FIELD.replace_all(&s, |caps: &regex::Captures| {
        format!("{}{}{}", &caps[1], REDACTED, &caps[3])
    });
    let s = RE_QUERY_PARAM.replace_all(&s, |caps: &regex::Captures| {
        format!("{}{}", &caps[1], REDACTED)
    });
    let s = RE_AWS_KEY.replace_all(&s, REDACTED);
    s.into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redacts_bearer_token() {
        let r = redact("Authorization: Bearer abc.def-ghi_123");
        assert_eq!(r, format!("Authorization: Bearer {}", REDACTED));
        // Case-insensitive on `Bearer`.
        let r = redact("auth: bearer xxxxxxxx");
        assert!(r.contains(REDACTED));
    }

    #[test]
    fn redacts_json_token_fields() {
        let r = redact(r#"config: {"token":"sekret","name":"svc","password":"hunter2"}"#);
        assert!(r.contains(REDACTED));
        assert!(!r.contains("sekret"));
        assert!(!r.contains("hunter2"));
        // Plain (non-secret) field korunur.
        assert!(r.contains("\"name\":\"svc\""));
    }

    #[test]
    fn redacts_query_params() {
        let r = redact("https://api.example.com/x?token=abc123&user=foo&password=p");
        assert!(r.contains(REDACTED), "got: {r}");
        assert!(!r.contains("abc123"));
        assert!(!r.contains("password=p"));
        assert!(r.contains("user=foo"));
    }

    #[test]
    fn redacts_aws_access_keys() {
        let r = redact("AKIAIOSFODNN7EXAMPLE in env");
        assert_eq!(r, format!("{} in env", REDACTED));
    }

    #[test]
    fn passthrough_when_no_match() {
        assert_eq!(redact("plain text"), "plain text");
        assert_eq!(redact(""), "");
    }

    #[test]
    fn idempotent() {
        let s = "Bearer abcdef";
        let once = redact(s);
        let twice = redact(&once);
        assert_eq!(once, twice);
    }

    #[test]
    fn does_not_redact_short_bearer_like_strings() {
        // "Bearer ok" — 2 char token zayıf eşik (6+ gerekiyor).
        let r = redact("error: Bearer ok");
        assert_eq!(r, "error: Bearer ok");
    }
}
