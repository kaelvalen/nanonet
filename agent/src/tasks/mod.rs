//! Uzun ömürlü tokio task'larının orkestrasyonu.
//!
//! `main.rs`'i ince tutmak için her bağımsız döngü kendi modülüne yerleştirilir:
//!
//! - [`metrics`]   — periyodik sistem & uygulama metrik toplama
//! - [`heartbeat`] — backend için hafif liveness sinyali
//! - [`deps`]      — outbound TCP bağımlılık keşfi
//! - [`signal`]    — SIGTERM/SIGINT dinleyicisi (graceful shutdown)
//!
//! Tüm task'lar `Arc<AppState>` ve `tokio::sync::watch::Receiver<bool>`
//! shutdown sinyalini paylaşır.

pub mod deps;
pub mod heartbeat;
pub mod metrics;
pub mod signal;
