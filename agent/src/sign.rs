//! Komut imzası doğrulama + nonce/replay koruma.
//!
//! ## Amaç
//!
//! Backend ile agent arasında WebSocket TLS olsa bile, tehdit modeli içinde
//! "yetkili bir backend hesabı ele geçirildi" senaryosu var. Komut imzalama,
//! kompromize edilmiş bir backend hesabının agent'a keyfi komut göndermesini
//! engellemek için ek bir savunma katmanı sağlar:
//!
//! - Komutu **signing key** ile imzalayan operatörün ayrı bir kanaldan
//!   yapılandırması gerekir (agent yan tarafta `--sign-secret`).
//! - Aynı komut iki kez oynatılamaz (`nonce` cache + TTL).
//! - HMAC karşılaştırması constant-time ([`hmac::Mac::verify_slice`]).
//!
//! ## Wire format
//!
//! Backend her komut çerçevesine iki opsiyonel alan ekleyebilir:
//!
//! ```json
//! {
//!   "command_id": "…",
//!   "action": "exec",
//!   "command": "free -m",
//!   "nonce": "550e8400-e29b-41d4-a716-446655440000",
//!   "signature": "<hex(hmac_sha256(secret, canonical))>"
//! }
//! ```
//!
//! Canonical (deterministik) imzalanan string:
//!
//! ```text
//! "{command_id}|{action}|{nonce}|{payload}"
//! ```
//!
//! `payload`, `command` alanı (yoksa boş string). Ek alanlar gelecekte
//! eklenirse format uyumlu kalsın diye `|` separator deterministik tutulur.
//!
//! ## Davranış
//!
//! - `Verifier` yapılandırılmamışsa (secret yok), `verify` her zaman `Ok(())`.
//! - Yapılandırılmışsa ve gelen komutta `signature`/`nonce` yoksa
//!   [`SignError::Missing`] döner.
//! - Yanlış imza → [`SignError::BadSignature`].
//! - TTL içinde tekrar görülen nonce → [`SignError::Replay`].
//!
//! Nonce cache hafıza sızdırmasın diye yazılırken **ve** periyodik bir
//! `prune` ile temizlenir (her doğrulamada eski entry'ler atılır).

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use hmac::{Hmac, Mac};
use sha2::Sha256;

/// Nonce cache için varsayılan TTL — backend ile saat farkı toleransı dahil.
pub const DEFAULT_NONCE_TTL: Duration = Duration::from_secs(300);

/// İmza doğrulama hataları.
#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum SignError {
    #[error("imza veya nonce alanı eksik (secret yapılandırılmış)")]
    Missing,
    #[error("imza geçersiz")]
    BadSignature,
    #[error("nonce daha önce kullanıldı (replay)")]
    Replay,
    #[error("imza alanı hex formatında değil: {0}")]
    BadHex(String),
}

type HmacSha256 = Hmac<Sha256>;

/// Opsiyonel HMAC doğrulayıcı + nonce cache. `Clone` ucuz (Arc bazlı).
#[derive(Clone)]
pub struct Verifier {
    inner: std::sync::Arc<VerifierInner>,
}

struct VerifierInner {
    secret: Vec<u8>,
    ttl: Duration,
    /// nonce → görüldüğü an. `Mutex<HashMap<...>>` — nonce cache'i her komut
    /// başına bir kez okunup yazıldığı için contention dert değil.
    seen: Mutex<HashMap<String, Instant>>,
}

impl Verifier {
    /// Yeni verifier yarat.
    pub fn new(secret: impl Into<Vec<u8>>, ttl: Duration) -> Self {
        Self {
            inner: std::sync::Arc::new(VerifierInner {
                secret: secret.into(),
                ttl,
                seen: Mutex::new(HashMap::new()),
            }),
        }
    }

    /// Konfigüre edilmiş nonce TTL'i.
    pub fn ttl(&self) -> Duration {
        self.inner.ttl
    }

    /// Verilen alanları doğrula.
    ///
    /// `payload` — varsa `command` alanı; yoksa boş string ver.
    pub fn verify(
        &self,
        command_id: &str,
        action: &str,
        nonce: Option<&str>,
        payload: Option<&str>,
        signature_hex: Option<&str>,
    ) -> Result<(), SignError> {
        let (Some(nonce), Some(sig)) = (nonce, signature_hex) else {
            return Err(SignError::Missing);
        };

        let provided = hex::decode(sig).map_err(|e| SignError::BadHex(e.to_string()))?;

        let canonical = canonical(command_id, action, nonce, payload.unwrap_or(""));
        let mut mac = HmacSha256::new_from_slice(&self.inner.secret).expect("HMAC key any-length");
        mac.update(canonical.as_bytes());
        // verify_slice constant-time karşılaştırma yapar.
        mac.verify_slice(&provided)
            .map_err(|_| SignError::BadSignature)?;

        // İmza doğrulandı; şimdi nonce'i cache'le. Aynı nonce TTL içinde
        // tekrar görülürse Replay döneriz.
        self.check_and_record_nonce(nonce)
    }

    fn check_and_record_nonce(&self, nonce: &str) -> Result<(), SignError> {
        let now = Instant::now();
        let mut seen = self.inner.seen.lock().unwrap();
        seen.retain(|_, ts| now.duration_since(*ts) < self.inner.ttl);
        if seen.contains_key(nonce) {
            return Err(SignError::Replay);
        }
        seen.insert(nonce.to_string(), now);
        Ok(())
    }
}

/// Verifier opsiyonel sarmalayıcısı: `None` ise tüm komutlar geçer (geriye
/// dönük uyum), `Some(...)` ise her komut imzalı olmak zorunda.
#[derive(Clone, Default)]
pub struct OptionalVerifier(Option<Verifier>);

impl OptionalVerifier {
    pub fn new(v: Option<Verifier>) -> Self {
        Self(v)
    }

    pub fn is_enforcing(&self) -> bool {
        self.0.is_some()
    }

    pub fn verify(
        &self,
        command_id: &str,
        action: &str,
        nonce: Option<&str>,
        payload: Option<&str>,
        signature_hex: Option<&str>,
    ) -> Result<(), SignError> {
        match self.0.as_ref() {
            Some(v) => v.verify(command_id, action, nonce, payload, signature_hex),
            None => Ok(()),
        }
    }
}

impl std::fmt::Debug for Verifier {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Verifier")
            .field("ttl", &self.inner.ttl)
            .field("secret", &"<redacted>")
            .finish()
    }
}

impl std::fmt::Debug for OptionalVerifier {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_tuple("OptionalVerifier").field(&self.0).finish()
    }
}

/// Canonical imza-altı string. Backend'in **birebir** aynısını üretmesi
/// gerekir; `|` ayraçları wire-format'ın parçası, asla değiştirme.
fn canonical(command_id: &str, action: &str, nonce: &str, payload: &str) -> String {
    format!("{command_id}|{action}|{nonce}|{payload}")
}

/// Test/operatör yardımcıları: verilen alanlar için doğru hex-imzayı üret.
/// **Backend** bu fonksiyonun mantıksal eşdeğerini implement etmeli.
pub fn sign_for_test(
    secret: &[u8],
    command_id: &str,
    action: &str,
    nonce: &str,
    payload: &str,
) -> String {
    let mut mac = HmacSha256::new_from_slice(secret).expect("HMAC key any-length");
    mac.update(canonical(command_id, action, nonce, payload).as_bytes());
    hex::encode(mac.finalize().into_bytes())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn v(secret: &str) -> Verifier {
        Verifier::new(secret.as_bytes().to_vec(), DEFAULT_NONCE_TTL)
    }

    #[test]
    fn verifies_valid_signature() {
        let secret = "topsecret";
        let cmd_id = "cmd-1";
        let action = "exec";
        let nonce = "n-1";
        let payload = "uptime";
        let sig = sign_for_test(secret.as_bytes(), cmd_id, action, nonce, payload);

        let verifier = v(secret);
        let res = verifier.verify(cmd_id, action, Some(nonce), Some(payload), Some(&sig));
        assert!(res.is_ok(), "geçerli imza kabul edilmeli: {:?}", res);
    }

    #[test]
    fn rejects_bad_signature() {
        let verifier = v("topsecret");
        let bad_sig = hex::encode([0u8; 32]);
        let res = verifier.verify("c", "exec", Some("n"), Some("p"), Some(&bad_sig));
        assert_eq!(res, Err(SignError::BadSignature));
    }

    #[test]
    fn rejects_missing_signature_or_nonce() {
        let verifier = v("topsecret");
        assert_eq!(
            verifier.verify("c", "exec", None, Some("p"), Some("deadbeef")),
            Err(SignError::Missing)
        );
        assert_eq!(
            verifier.verify("c", "exec", Some("n"), Some("p"), None),
            Err(SignError::Missing)
        );
    }

    #[test]
    fn rejects_replay_within_ttl() {
        let secret = "topsecret";
        let nonce = "n-replay";
        let sig = sign_for_test(secret.as_bytes(), "c", "ping", nonce, "");
        let verifier = v(secret);
        assert!(verifier
            .verify("c", "ping", Some(nonce), None, Some(&sig))
            .is_ok());
        assert_eq!(
            verifier.verify("c", "ping", Some(nonce), None, Some(&sig)),
            Err(SignError::Replay)
        );
    }

    #[test]
    fn rejects_bad_hex() {
        let verifier = v("topsecret");
        let res = verifier.verify("c", "ping", Some("n"), None, Some("zzzz"));
        assert!(matches!(res, Err(SignError::BadHex(_))));
    }

    #[test]
    fn nonce_evicted_after_ttl() {
        let secret = "topsecret";
        let nonce = "n-evict";
        let sig = sign_for_test(secret.as_bytes(), "c", "ping", nonce, "");
        // Çok kısa TTL ile çalış; doğrulama sonrası bekleyince nonce silinmeli.
        let verifier = Verifier::new(secret.as_bytes().to_vec(), Duration::from_millis(50));
        assert!(verifier
            .verify("c", "ping", Some(nonce), None, Some(&sig))
            .is_ok());
        std::thread::sleep(Duration::from_millis(80));
        // TTL dolduğu için aynı nonce tekrar kabul edilebilir olmalı.
        assert!(verifier
            .verify("c", "ping", Some(nonce), None, Some(&sig))
            .is_ok());
    }

    #[test]
    fn optional_verifier_passes_through_when_none() {
        let opt = OptionalVerifier::default();
        assert!(!opt.is_enforcing());
        assert!(opt.verify("c", "ping", None, None, None).is_ok());
    }

    #[test]
    fn optional_verifier_enforces_when_some() {
        let opt = OptionalVerifier::new(Some(v("s")));
        assert!(opt.is_enforcing());
        assert_eq!(
            opt.verify("c", "ping", None, None, None),
            Err(SignError::Missing)
        );
    }

    #[test]
    fn payload_change_invalidates_signature() {
        let secret = "topsecret";
        let sig = sign_for_test(secret.as_bytes(), "c", "exec", "n", "ls");
        let verifier = v(secret);
        let res = verifier.verify("c", "exec", Some("n"), Some("rm -rf /"), Some(&sig));
        assert_eq!(res, Err(SignError::BadSignature));
    }
}
