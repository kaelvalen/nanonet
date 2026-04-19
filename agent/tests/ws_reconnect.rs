//! WS reconnect davranışı için integration testleri.
//!
//! Sunucu agent'ı kapattığında agent'ın yeniden bağlandığını ve graceful
//! shutdown sinyali geldiğinde temiz çıktığını doğrular.
//!
//! `#[ignore]` değil — CI'da varsayılan olarak çalışmaları beklenir; ama
//! ağ veya zamanlama yüzünden flake olursa `--include-ignored` ile çalıştırılır.

use std::sync::Arc;
use std::time::Duration;

use clap::Parser;
use nanonet_agent::buffer::MetricBuffer;
use nanonet_agent::config::Config;
use nanonet_agent::state::AppState;
use nanonet_agent::ws;
use tokio::sync::watch;

mod common;
use common::mock_backend::{MockBackend, ServerSend};

/// `MockBackend`'e bağlanmak üzere minimal bir `Config` üretir.
fn config_for(backend: &MockBackend) -> Config {
    Config::parse_from([
        "nanonet-agent",
        "--backend",
        &backend.ws_url(),
        "--service-id",
        "svc-test",
    ])
}

/// Verilen yardımcılarla agent WS task'ını background'a alır.
fn spawn_ws_task(
    config: Config,
    state: Arc<AppState>,
) -> (
    tokio::task::JoinHandle<()>,
    watch::Sender<bool>,
    ws::OutgoingTx,
) {
    let (out_tx, out_rx) = ws::channel();
    let (sd_tx, sd_rx) = watch::channel(false);
    let state_clone = Arc::clone(&state);
    let handle = tokio::spawn(async move {
        ws::run(&config, out_rx, state_clone, sd_rx).await;
    });
    (handle, sd_tx, out_tx)
}

#[tokio::test]
async fn agent_connects_then_reconnects_after_server_close() {
    let backend = MockBackend::start().await;
    let config = config_for(&backend);
    let state = AppState::new("agent-rc-1".to_string(), MetricBuffer::new(16));
    let (handle, shutdown, _outgoing) = spawn_ws_task(config, Arc::clone(&state));

    // İlk bağlantı.
    let conn1 = backend
        .next_connection(Duration::from_secs(5))
        .await
        .expect("agent ilk denemede bağlanmalı");
    assert_eq!(conn1.service_id, "svc-test");
    assert_eq!(backend.connected_count(), 1);

    // Bağlantı sayacı kontrolü için biraz bekle (state aynı task içinde set edilir).
    tokio::time::sleep(Duration::from_millis(50)).await;
    assert!(state.is_ws_connected(), "WS bağlandığında flag set edilir");
    assert_eq!(
        state
            .ws_reconnects
            .load(std::sync::atomic::Ordering::Relaxed),
        1
    );

    // Sunucu bağlantıyı düzgünce kapatır → agent yeniden denemeli.
    conn1
        .outgoing
        .send(ServerSend::Close)
        .expect("close gönderilebilmeli");

    let conn2 = backend
        .next_connection(Duration::from_secs(5))
        .await
        .expect("agent yeniden bağlanmalı");
    assert_eq!(conn2.service_id, "svc-test");
    assert_eq!(backend.connected_count(), 2);

    tokio::time::sleep(Duration::from_millis(50)).await;
    assert!(state.is_ws_connected());
    assert_eq!(
        state
            .ws_reconnects
            .load(std::sync::atomic::Ordering::Relaxed),
        2,
        "her başarılı handshake reconnect sayacını artırır"
    );

    // Graceful shutdown.
    shutdown.send(true).unwrap();
    tokio::time::timeout(Duration::from_secs(3), handle)
        .await
        .expect("WS task shutdown sinyali sonrası bitirmeli")
        .expect("task panicked");

    assert!(!state.is_ws_connected(), "shutdown sonrası flag temizlenir");
}

#[tokio::test]
async fn agent_exits_cleanly_on_shutdown_signal_without_server_traffic() {
    let backend = MockBackend::start().await;
    let config = config_for(&backend);
    let state = AppState::new("agent-rc-2".to_string(), MetricBuffer::new(16));
    let (handle, shutdown, _outgoing) = spawn_ws_task(config, Arc::clone(&state));

    // Agent'ın bağlanmasını bekle.
    let _conn = backend
        .next_connection(Duration::from_secs(5))
        .await
        .expect("agent bağlanmalı");

    // Trafik göndermeden direkt shutdown.
    shutdown.send(true).unwrap();
    tokio::time::timeout(Duration::from_secs(3), handle)
        .await
        .expect("WS task shutdown sinyali sonrası bitirmeli")
        .expect("task panicked");
}
