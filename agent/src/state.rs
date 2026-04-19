//! Paylaşılan agent çalışma zamanı durumu.
//!
//! Tüm task'ların ortak ihtiyaç duyduğu sayaçlar, bayraklar ve buffer'lar
//! [`AppState`] içinde toplanır. `Arc<AppState>` tüm task'lara klonlanarak
//! verilir — global static yerine açık DI tercih edilir; bu hem test edilebilirliği
//! hem de aynı süreçte birden fazla agent çalıştırmayı (ileride)
//! mümkün kılar.
//!
//! ## Tasarım notları
//!
//! - WS bağlantı bayrağı `AtomicBool` — kilit gerektirmez, hot path'te ucuzdur.
//! - Sayaçlar `AtomicU64` — sadece artar; `Relaxed` sıralama yeterli.
//! - `MetricBuffer` zaten içinde `Arc<Mutex<...>>` taşır; `Clone` ucuz.
//! - Geriye uyumluluk için `ws.rs` içindeki eski `pub static` ler şimdilik
//!   korunabilir; ancak tercih edilen yol [`AppState`] üzerinden okumaktır.

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::Semaphore;

use crate::audit::AuditLogger;
use crate::buffer::MetricBuffer;
use crate::sign::OptionalVerifier;

/// Eşzamanlı çalışabilen komut sayısı için makul varsayılan.
/// Operatörün aşırı paralel istekleri agent'ı dump etmesinin önüne geçer.
pub const DEFAULT_MAX_CONCURRENT_COMMANDS: usize = 4;

/// Agent çalışma zamanı boyunca paylaşılan ortak durum.
///
/// `Arc<AppState>` halinde her task'a klonlanarak verilir.
#[derive(Debug)]
pub struct AppState {
    /// Stable agent kimliği — `~/.nanonet/.agent_id.<service>` dosyasında saklanır.
    pub agent_id: String,

    /// Agent başlatma anı; uptime hesaplamaları için.
    pub start_time: Instant,

    /// WebSocket bağlantısı şu an aktif mi?
    pub ws_connected: AtomicBool,

    /// Şimdiye dek sunucuya başarıyla teslim edilmiş mesaj (metric/heartbeat/...) sayısı.
    pub metrics_sent: AtomicU64,

    /// Başarıyla işlenmiş komut sayısı.
    pub commands_handled: AtomicU64,

    /// Servis restart komutu kaç kez çalıştırıldı.
    pub restart_count: AtomicU64,

    /// WS reconnect denemesi sayısı (kümülatif).
    pub ws_reconnects: AtomicU64,

    /// Bağlantısızken metrikleri biriktiren tampon.
    pub buffer: MetricBuffer,

    /// Eşzamanlı komut çalıştırma sayısını sınırlayan semaphore.
    /// Permit sayısı dolarsa yeni komut acquire'da bekler — backend tarafında
    /// timeout düşeceği için "kuyruğa al, sonsuz bekleme" değil.
    pub command_semaphore: Arc<Semaphore>,

    /// Komut için permit alamayıp reddedilenlerin sayısı (saturation göstergesi).
    pub commands_rejected: AtomicU64,

    /// Process içinde yakalanmış panik sayısı. Panik hook tarafından artırılır.
    pub panics: AtomicU64,

    /// Opsiyonel komut audit log writer. `None` ise audit kaydı tutulmaz.
    pub audit: Option<AuditLogger>,

    /// HMAC komut imza doğrulayıcısı. Default `None` (imza zorunlu değil),
    /// startup'ta `--sign-secret` verilmişse `Some(verifier)` ile değiştirilir.
    pub verifier: OptionalVerifier,

    /// İmza doğrulamada başarısız olan komutların sayısı.
    pub commands_unverified: AtomicU64,
}

impl AppState {
    /// Yeni paylaşılan durum oluşturur ve `Arc` içine sarar.
    /// Komut paralelliği için [`DEFAULT_MAX_CONCURRENT_COMMANDS`] kullanılır.
    pub fn new(agent_id: String, buffer: MetricBuffer) -> Arc<Self> {
        Self::with_command_concurrency(agent_id, buffer, DEFAULT_MAX_CONCURRENT_COMMANDS)
    }

    /// Aynı [`new`] gibi ama eşzamanlı komut limiti açıkça ayarlanır.
    /// `max_concurrent == 0` verilirse 1'e yuvarlanır (tamamen kapalı semaphore
    /// hatalı yapılandırma olur).
    pub fn with_command_concurrency(
        agent_id: String,
        buffer: MetricBuffer,
        max_concurrent: usize,
    ) -> Arc<Self> {
        let max = max_concurrent.max(1);
        Arc::new(Self {
            agent_id,
            start_time: Instant::now(),
            ws_connected: AtomicBool::new(false),
            metrics_sent: AtomicU64::new(0),
            commands_handled: AtomicU64::new(0),
            restart_count: AtomicU64::new(0),
            ws_reconnects: AtomicU64::new(0),
            buffer,
            command_semaphore: Arc::new(Semaphore::new(max)),
            commands_rejected: AtomicU64::new(0),
            panics: AtomicU64::new(0),
            audit: None,
            verifier: OptionalVerifier::default(),
            commands_unverified: AtomicU64::new(0),
        })
    }

    /// Mevcut state'in shallow kopyasını alıp audit logger'ı set eder.
    ///
    /// Audit yapılandırması startup'ta async olarak ortaya çıktığı için
    /// builder-vari ayrı bir metoda taşındı: `AppState::new(...).with_audit(...)`
    /// şeklinde zincirlenebilir.
    pub fn with_audit(self: &Arc<Self>, audit: AuditLogger) -> Arc<Self> {
        Arc::new(Self {
            agent_id: self.agent_id.clone(),
            start_time: self.start_time,
            ws_connected: AtomicBool::new(self.is_ws_connected()),
            metrics_sent: AtomicU64::new(self.metrics_sent.load(Ordering::Relaxed)),
            commands_handled: AtomicU64::new(self.commands_handled.load(Ordering::Relaxed)),
            restart_count: AtomicU64::new(self.restart_count.load(Ordering::Relaxed)),
            ws_reconnects: AtomicU64::new(self.ws_reconnects.load(Ordering::Relaxed)),
            buffer: self.buffer.clone(),
            command_semaphore: Arc::clone(&self.command_semaphore),
            commands_rejected: AtomicU64::new(self.commands_rejected.load(Ordering::Relaxed)),
            panics: AtomicU64::new(self.panics.load(Ordering::Relaxed)),
            audit: Some(audit),
            verifier: self.verifier.clone(),
            commands_unverified: AtomicU64::new(self.commands_unverified.load(Ordering::Relaxed)),
        })
    }

    /// Aynı [`with_audit`] kalıbı: shallow copy + verifier set.
    pub fn with_verifier(self: &Arc<Self>, verifier: OptionalVerifier) -> Arc<Self> {
        Arc::new(Self {
            agent_id: self.agent_id.clone(),
            start_time: self.start_time,
            ws_connected: AtomicBool::new(self.is_ws_connected()),
            metrics_sent: AtomicU64::new(self.metrics_sent.load(Ordering::Relaxed)),
            commands_handled: AtomicU64::new(self.commands_handled.load(Ordering::Relaxed)),
            restart_count: AtomicU64::new(self.restart_count.load(Ordering::Relaxed)),
            ws_reconnects: AtomicU64::new(self.ws_reconnects.load(Ordering::Relaxed)),
            buffer: self.buffer.clone(),
            command_semaphore: Arc::clone(&self.command_semaphore),
            commands_rejected: AtomicU64::new(self.commands_rejected.load(Ordering::Relaxed)),
            panics: AtomicU64::new(self.panics.load(Ordering::Relaxed)),
            audit: self.audit.clone(),
            verifier,
            commands_unverified: AtomicU64::new(self.commands_unverified.load(Ordering::Relaxed)),
        })
    }

    /// WS bağlantı durumunu okur (Relaxed).
    #[inline]
    pub fn is_ws_connected(&self) -> bool {
        self.ws_connected.load(Ordering::Relaxed)
    }

    /// WS bağlantı durumunu yazar (Relaxed).
    #[inline]
    pub fn set_ws_connected(&self, v: bool) {
        self.ws_connected.store(v, Ordering::Relaxed);
    }

    /// Başarıyla teslim edilmiş bir mesaj olduğunu işaretler.
    #[inline]
    pub fn inc_metrics_sent(&self) {
        self.metrics_sent.fetch_add(1, Ordering::Relaxed);
    }

    /// Başarıyla işlenmiş bir komut olduğunu işaretler.
    #[inline]
    pub fn inc_commands_handled(&self) {
        self.commands_handled.fetch_add(1, Ordering::Relaxed);
    }

    /// Servis restart sayacını artırır ve yeni değeri döndürür.
    #[inline]
    pub fn inc_restart_count(&self) -> u64 {
        self.restart_count.fetch_add(1, Ordering::Relaxed) + 1
    }

    /// WS reconnect sayacını artırır.
    #[inline]
    pub fn inc_ws_reconnects(&self) {
        self.ws_reconnects.fetch_add(1, Ordering::Relaxed);
    }

    /// Saniye cinsinden agent uptime.
    #[inline]
    pub fn uptime_secs(&self) -> u64 {
        self.start_time.elapsed().as_secs()
    }

    /// Komut için permit reddedildiğinde sayacı artırır.
    #[inline]
    pub fn inc_commands_rejected(&self) {
        self.commands_rejected.fetch_add(1, Ordering::Relaxed);
    }

    /// Panik sayacını artırır. Panik hook tarafından çağrılır.
    #[inline]
    pub fn inc_panics(&self) {
        self.panics.fetch_add(1, Ordering::Relaxed);
    }

    /// İmza doğrulamada başarısız komut sayacını artırır.
    #[inline]
    pub fn inc_commands_unverified(&self) {
        self.commands_unverified.fetch_add(1, Ordering::Relaxed);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fresh_state() -> Arc<AppState> {
        AppState::new("test-agent".into(), MetricBuffer::new(16))
    }

    #[test]
    fn defaults_are_zero_and_disconnected() {
        let s = fresh_state();
        assert_eq!(s.agent_id, "test-agent");
        assert!(!s.is_ws_connected());
        assert_eq!(s.metrics_sent.load(Ordering::Relaxed), 0);
        assert_eq!(s.commands_handled.load(Ordering::Relaxed), 0);
        assert_eq!(s.restart_count.load(Ordering::Relaxed), 0);
        assert_eq!(s.ws_reconnects.load(Ordering::Relaxed), 0);
        assert_eq!(s.commands_rejected.load(Ordering::Relaxed), 0);
        // Default semaphore boyutu DEFAULT_MAX_CONCURRENT_COMMANDS.
        assert_eq!(
            s.command_semaphore.available_permits(),
            DEFAULT_MAX_CONCURRENT_COMMANDS
        );
    }

    #[test]
    fn with_command_concurrency_clamps_to_one() {
        let s = AppState::with_command_concurrency("a".into(), MetricBuffer::new(1), 0);
        assert_eq!(s.command_semaphore.available_permits(), 1);
    }

    #[tokio::test]
    async fn semaphore_blocks_when_exhausted() {
        let s = AppState::with_command_concurrency("a".into(), MetricBuffer::new(1), 1);
        let p1 = s.command_semaphore.clone().acquire_owned().await.unwrap();
        // İkinci acquire derhal başarılı olmamalı.
        let attempt = tokio::time::timeout(
            std::time::Duration::from_millis(50),
            s.command_semaphore.clone().acquire_owned(),
        )
        .await;
        assert!(attempt.is_err(), "permit dolu iken bekleme bekleniyordu");
        drop(p1);
        // Şimdi serbest.
        let _p2 = s.command_semaphore.clone().acquire_owned().await.unwrap();
    }

    #[test]
    fn ws_connected_toggle() {
        let s = fresh_state();
        s.set_ws_connected(true);
        assert!(s.is_ws_connected());
        s.set_ws_connected(false);
        assert!(!s.is_ws_connected());
    }

    #[test]
    fn counters_increment() {
        let s = fresh_state();
        s.inc_metrics_sent();
        s.inc_metrics_sent();
        s.inc_commands_handled();
        let r1 = s.inc_restart_count();
        let r2 = s.inc_restart_count();
        s.inc_ws_reconnects();

        assert_eq!(s.metrics_sent.load(Ordering::Relaxed), 2);
        assert_eq!(s.commands_handled.load(Ordering::Relaxed), 1);
        assert_eq!(r1, 1);
        assert_eq!(r2, 2);
        assert_eq!(s.restart_count.load(Ordering::Relaxed), 2);
        assert_eq!(s.ws_reconnects.load(Ordering::Relaxed), 1);
    }

    #[tokio::test]
    async fn buffer_is_shared_through_arc() {
        let s = fresh_state();
        s.buffer.push("hello".into()).await;
        // Aynı Arc'tan başka bir referansla okusak da görmeli
        let s2 = Arc::clone(&s);
        assert_eq!(s2.buffer.len().await, 1);
    }
}
