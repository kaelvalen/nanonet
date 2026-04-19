//! NanoNet izleme ajanı kütüphanesi.
//!
//! Bu crate iki target üretir:
//! - **Library** (`nanonet_agent`): tüm modüller (test edilebilir, embed edilebilir).
//! - **Binary** (`nanonet-agent`): `src/main.rs` içindeki ince entry point.
//!
//! ## Modül haritası
//!
//! - [`config`]   — CLI/env yapılandırması (clap)
//! - [`state`]    — paylaşılan çalışma zamanı durumu (`AppState`)
//! - [`error`]    — `AgentError` ve `Result` aliası
//! - [`buffer`]   — bağlantısız iken metrik biriktirici
//! - [`metrics`]  — sistem & process & uygulama metrik toplayıcıları
//! - [`health`]   — hedef servisin health endpoint kontrolü
//! - [`agent_health`] — agent'ın *kendi* health/status HTTP endpoint'i
//! - [`commands`] — backend'den gelen komutların allowlist'li yürütücüsü
//! - [`dependencies`] — outbound TCP bağımlılık keşfi
//! - [`ws`]       — WebSocket istemcisi (reconnect + jitter)
//! - [`tasks`]    — uzun ömürlü tokio task'larının orkestrasyonu
//!
//! Library yüzeyi *kasıtlı olarak* küçük tutulur: integration testler ve
//! gelecek embedding senaryoları için yeterli, fakat detaylar içeride kalır.

pub mod agent_health;
pub mod audit;
pub mod buffer;
pub mod commands;
pub mod config;
pub mod dependencies;
pub mod error;
pub mod health;
pub mod metrics;
pub mod panic_hook;
pub mod redact;
pub mod sign;
pub mod state;
pub mod tasks;
pub mod ws;

pub use config::Config;
pub use error::{AgentError, Result};
pub use state::AppState;

/// Crate sürümü — `Cargo.toml`'daki `package.version` ile aynı.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
