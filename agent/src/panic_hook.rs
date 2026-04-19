//! Process panic hook.
//!
//! Panik düştüğünde:
//! 1. Tracing üzerinden yapılandırılmış log bas (raw stderr yerine)
//! 2. [`AppState::inc_panics`] çağırarak observability sayacını artır
//! 3. Önceki hook'u (tipik default) çağırarak backtrace'i koru
//!
//! Tek bir process boyunca yalnızca bir kez yüklenmelidir; testlerde
//! double-install güvenli (önceki hook chained).

use std::sync::Arc;

use crate::state::AppState;

/// Panic hook'u kurar. `state` paniklerde sayaç artırmak için klonlanır.
pub fn install(state: Arc<AppState>) {
    let prev = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        state.inc_panics();

        let location = info
            .location()
            .map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column()))
            .unwrap_or_else(|| "<unknown location>".to_string());

        // payload `&str` veya `String` olabilir; ikisini de çıkar.
        let payload = if let Some(s) = info.payload().downcast_ref::<&str>() {
            (*s).to_string()
        } else if let Some(s) = info.payload().downcast_ref::<String>() {
            s.clone()
        } else {
            "<non-string panic payload>".to_string()
        };

        tracing::error!(
            location = %location,
            payload = %payload,
            total_panics = state.panics.load(std::sync::atomic::Ordering::Relaxed),
            "Process panik oluştu"
        );

        // Önceki hook'u çağır → backtrace ve standart davranış korunur.
        prev(info);
    }));
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::buffer::MetricBuffer;
    use std::sync::atomic::Ordering;

    /// Hook'un sayacı artırdığını ayrı bir thread'de panik tetikleyerek doğrula.
    /// `panic::set_hook` global state olduğu için testler #[ignore] değildir
    /// ama serial olarak çalıştırılması gerekir; cargo test default
    /// paralelliğinde diğer panic-eden testler varsa flake olabilir. Bu
    /// nedenle hook'u dosya-local install ediyoruz.
    #[test]
    fn install_increments_panics_counter() {
        let state = AppState::new("panic-test".into(), MetricBuffer::new(1));
        let original = std::panic::take_hook();
        install(Arc::clone(&state));

        let result = std::panic::catch_unwind(|| {
            panic!("test panic");
        });
        assert!(result.is_err());
        assert_eq!(state.panics.load(Ordering::Relaxed), 1);

        // Hook'u geri yükle ki diğer testler etkilenmesin.
        std::panic::set_hook(original);
    }
}
