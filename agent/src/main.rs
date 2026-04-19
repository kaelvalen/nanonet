//! NanoNet agent binary entry point.
//!
//! `main.rs` kasıtlı olarak ince tutulur: tüm gerçek mantık `lib.rs` ve
//! `tasks/` altındaki modüllerdedir; burada yapılan işler:
//!
//! 1. Logging başlat (text veya JSON)
//! 2. CLI/env yapılandırmasını parse et
//! 3. Banner yazdır
//! 4. Stable agent_id'yi oku/üret
//! 5. Paylaşılan [`AppState`] oluştur
//! 6. WS task'ı, metric, heartbeat, dependency, agent_health, signal
//!    task'larını spawn et
//! 7. Graceful shutdown'a kadar bekle, final istatistikleri bas

use std::sync::Arc;

use clap::Parser;
use tokio::sync::watch;

use nanonet_agent::buffer::MetricBuffer;
use nanonet_agent::error::{AgentError, Result};
use nanonet_agent::tasks;
use nanonet_agent::{agent_health, ws};
use nanonet_agent::{AppState, Config, VERSION};

#[tokio::main]
async fn main() -> Result<()> {
    init_logging();

    let config = Config::parse();
    print_banner(&config);

    let agent_id = load_or_create_agent_id(&config);
    tracing::info!("  Agent ID:      {}", agent_id);
    tracing::info!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    let buffer = MetricBuffer::new(config.buffer_size);

    // Persist dosyası varsa önceki snapshot'ı yükle.
    if let Some(path) = config.buffer_persist_path.as_deref() {
        match buffer.load_from_disk(std::path::Path::new(path)).await {
            Ok(0) => tracing::info!(path, "Buffer snapshot bulunamadı, temiz başlanıyor"),
            Ok(n) => tracing::info!(path, count = n, "Buffer snapshot yüklendi"),
            Err(e) => tracing::warn!(path, error = %e, "Buffer snapshot yüklenemedi"),
        }
    }

    let mut state =
        AppState::with_command_concurrency(agent_id, buffer, config.max_concurrent_commands);

    // Audit logger varsa state'i bununla genişlet. Hata varsa warn'la geç —
    // audit eksikliği agent'ı bloklamamalı.
    if let Some(path) = config.audit_log_path.as_deref() {
        match nanonet_agent::audit::AuditLogger::open(path).await {
            Ok(audit) => {
                tracing::info!(path, "Audit log açıldı");
                state = state.with_audit(audit);
            }
            Err(e) => {
                tracing::warn!(path, error = %e, "Audit log açılamadı, audit kapalı");
            }
        }
    }

    // HMAC komut imzalama secret'ı verilmişse zorunlu doğrulamayı devreye al.
    if let Some(secret) = config.sign_secret.as_deref() {
        let ttl = std::time::Duration::from_secs(config.nonce_ttl_sec.max(1));
        let verifier = nanonet_agent::sign::Verifier::new(secret.as_bytes().to_vec(), ttl);
        state = state.with_verifier(nanonet_agent::sign::OptionalVerifier::new(Some(verifier)));
        tracing::info!(
            ttl_sec = config.nonce_ttl_sec,
            "Komut HMAC imza doğrulaması zorunlu"
        );
    }

    // Panik hook'u state oluşturulduktan sonra kuruyoruz; observability sayacı
    // ilk paniği bile yakalayabilsin diye spawnlardan önce.
    nanonet_agent::panic_hook::install(Arc::clone(&state));

    let (ws_tx, ws_rx) = ws::channel();
    let (shutdown_tx, _) = watch::channel(false);

    // ── WebSocket istemcisi ────────────────────────────────────────
    let ws_task = tokio::spawn({
        let config = config.clone();
        let state = Arc::clone(&state);
        let shutdown_rx = shutdown_tx.subscribe();
        async move { ws::run(&config, ws_rx, state, shutdown_rx).await }
    });

    // ── Agent kendi health endpoint'i ──────────────────────────────
    let agent_health_task = tokio::spawn({
        let port = config.agent_port;
        let state = Arc::clone(&state);
        async move {
            if let Err(e) = agent_health::serve(port, state).await {
                tracing::error!(error = %e, "agent health server başlatılamadı");
            }
        }
    });

    // ── Periyodik metric toplayıcı ─────────────────────────────────
    let metrics_task = tokio::spawn({
        let config = config.clone();
        let state = Arc::clone(&state);
        let ws_tx = ws_tx.clone();
        let shutdown_rx = shutdown_tx.subscribe();
        async move {
            if let Err(e) = tasks::metrics::run(config, state, ws_tx, shutdown_rx).await {
                tracing::error!(error = %e, "metrics task hatası");
            }
        }
    });

    // ── Heartbeat ──────────────────────────────────────────────────
    let _heartbeat_task = tokio::spawn({
        let config = config.clone();
        let state = Arc::clone(&state);
        let ws_tx = ws_tx.clone();
        let shutdown_rx = shutdown_tx.subscribe();
        async move { tasks::heartbeat::run(config, state, ws_tx, shutdown_rx).await }
    });

    // ── Dependency keşfi ───────────────────────────────────────────
    let _deps_task = tokio::spawn({
        let config = config.clone();
        let state = Arc::clone(&state);
        let ws_tx = ws_tx.clone();
        let shutdown_rx = shutdown_tx.subscribe();
        async move { tasks::deps::run(config, state, ws_tx, shutdown_rx).await }
    });

    // ── Sinyal dinleyici ──────────────────────────────────────────
    let signal_task = tokio::spawn(async move {
        if let Err(e) = tasks::signal::wait_and_signal(shutdown_tx).await {
            tracing::error!(error = %e, "sinyal dinleyici hatası");
        }
    });

    // ── Ana bekleme: aşağıdakilerden hangisi önce biterse çıkılır ──
    tokio::select! {
        result = ws_task => {
            if let Err(e) = result {
                tracing::error!("WebSocket task panic: {}", e);
            }
        }
        result = metrics_task => {
            if let Err(e) = result {
                tracing::error!("Metrics task panic: {}", e);
            }
        }
        result = agent_health_task => {
            if let Err(e) = result {
                tracing::error!("Agent health task panic: {}", e);
            }
        }
        _ = signal_task => {
            tracing::info!("Agent temiz şekilde kapatıldı.");
        }
    }

    // Shutdown sırasında buffer'ı diske yaz (yapılandırılmışsa).
    if let Some(path) = config.buffer_persist_path.as_deref() {
        match state.buffer.save_to_disk(std::path::Path::new(path)).await {
            Ok(n) => tracing::info!(path, count = n, "Buffer snapshot diske yazıldı"),
            Err(e) => tracing::warn!(path, error = %e, "Buffer snapshot yazılamadı"),
        }
    }

    print_final_stats(&state);
    Ok(())
}

/// Tracing subscriber'ı `NANONET_LOG_JSON=1` env'i varsa JSON olarak,
/// yoksa metin olarak başlatır.
fn init_logging() {
    let json_logs = std::env::var("NANONET_LOG_JSON").is_ok();
    let env_filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| "nanonet_agent=info".into());

    if json_logs {
        tracing_subscriber::fmt()
            .json()
            .flatten_event(true)
            .with_env_filter(env_filter)
            .init();
    } else {
        tracing_subscriber::fmt().with_env_filter(env_filter).init();
    }
}

/// Başlangıçta operatöre kullanılan ayarları net şekilde gösterir.
fn print_banner(config: &Config) {
    tracing::info!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    tracing::info!("  NanoNet Agent v{}", VERSION);
    tracing::info!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    tracing::info!("  Backend:       {}", config.backend);
    tracing::info!("  Service ID:    {}", config.service_id);
    tracing::info!("  WS URL:        {}", config.ws_url());
    tracing::info!(
        "  Auth:          {}",
        if config.effective_token().is_some() {
            "Bearer ***"
        } else {
            "(yok — NANONET_AGENT_TOKEN veya NANONET_TOKEN gerekli)"
        }
    );
    tracing::info!("  Health URL:    {}", config.health_url());
    tracing::info!("  Poll interval: {}s", config.poll_interval);
    tracing::info!("  Error window:  {} checks", config.error_rate_window);
    tracing::info!("  Buffer size:   {} metrics", config.buffer_size);
    tracing::info!(
        "  Cmd parallel:  {} (max concurrent commands)",
        config.max_concurrent_commands.max(1)
    );

    match &config.metrics_endpoint {
        Some(url) => tracing::info!("  App metrics:   {}", url),
        None => tracing::info!("  App metrics:   (yok)"),
    }
    match &config.process {
        Some(p) => tracing::info!("  Process watch: {}", p),
        None => tracing::info!("  Process watch: (yok)"),
    }
    match &config.restart_cmd {
        Some(cmd) => tracing::info!("  Restart cmd:   {}", cmd),
        None => tracing::warn!("  Restart cmd:   (yapılandırılmamış)"),
    }
    match &config.stop_cmd {
        Some(cmd) => tracing::info!("  Stop cmd:      {}", cmd),
        None => tracing::warn!("  Stop cmd:      (yapılandırılmamış)"),
    }
    if config.agent_port > 0 {
        tracing::info!("  Agent port:    {}", config.agent_port);
    }
    match &config.buffer_persist_path {
        Some(path) => tracing::info!("  Buffer file:   {}", path),
        None => tracing::info!("  Buffer file:   (yok — kapatma sonrası buffer kaybedilir)"),
    }
    match &config.audit_log_path {
        Some(path) => tracing::info!("  Audit log:     {}", path),
        None => tracing::info!("  Audit log:     (yok)"),
    }
    let labels = config.label_map();
    if labels.is_empty() {
        tracing::info!("  Labels:        (yok)");
    } else {
        let summary = labels
            .iter()
            .map(|(k, v)| format!("{k}={v}"))
            .collect::<Vec<_>>()
            .join(",");
        tracing::info!("  Labels:        {}", summary);
    }
    if config.sign_secret.is_some() {
        tracing::info!(
            "  Cmd signing:   ENFORCED (HMAC-SHA256, nonce TTL {}s)",
            config.nonce_ttl_sec
        );
    } else {
        tracing::info!("  Cmd signing:   (yok — komutlar imzasız kabul edilir)");
    }
}

/// Kapatıldığında özet istatistikleri yazdırır — operatör için kolay bir
/// post-mortem.
fn print_final_stats(state: &Arc<AppState>) {
    use std::sync::atomic::Ordering;
    tracing::info!(
        metrics_sent = state.metrics_sent.load(Ordering::Relaxed),
        commands_handled = state.commands_handled.load(Ordering::Relaxed),
        metrics_dropped = state.buffer.dropped_count(),
        ws_reconnects = state.ws_reconnects.load(Ordering::Relaxed),
        restart_count = state.restart_count.load(Ordering::Relaxed),
        uptime_secs = state.uptime_secs(),
        "Agent kapatıldı — final istatistikleri"
    );
}

/// Stable agent kimliği oluşturur ya da daha önce oluşturulanı yükler.
///
/// Dosya konumu:
/// - `$HOME/.nanonet/.agent_id.<service_id>` (varsa)
/// - aksi halde `/var/lib/nanonet/.agent_id.<service_id>`
///
/// Yazma/okuma hataları log'a düşürülür ama agent başlatılmasına engel olmaz —
/// kötü senaryoda her açılışta yeni UUID üretiriz.
fn load_or_create_agent_id(config: &Config) -> String {
    let state_dir = std::env::var("HOME")
        .map(|h| format!("{}/.nanonet", h))
        .unwrap_or_else(|_| "/var/lib/nanonet".to_string());

    if let Err(e) = std::fs::create_dir_all(&state_dir) {
        tracing::warn!("Agent state dizini oluşturulamadı ({}): {}", state_dir, e);
    }

    let id_file = format!("{}/.agent_id.{}", state_dir, config.service_id);
    if let Ok(content) = std::fs::read_to_string(&id_file) {
        let trimmed = content.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }

    let new_id = uuid::Uuid::new_v4().to_string();
    if let Err(e) = std::fs::write(&id_file, &new_id) {
        tracing::warn!("Agent ID kaydedilemedi ({}): {}", id_file, e);
    }

    new_id
}

// `AgentError`'ı main'in dönüş tipi olarak kullanmak için işaretle.
#[allow(dead_code)]
const _: fn() = || {
    fn _assert_error() -> std::result::Result<(), AgentError> {
        Ok(())
    }
};
