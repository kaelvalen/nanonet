//! Komut akışının uçtan uca davranışı.
//!
//! - Sunucu agent'a `command` frame'i gönderir.
//! - Agent önce `ack`, sonra `result` frame'i göndermelidir.
//! - `commands_handled` sayacı artmalıdır.
//! - Allowlist dışı komutlar agent tarafında reddedilip `failed` sonuç döner.

use std::sync::Arc;
use std::time::Duration;

use clap::Parser;
use nanonet_agent::buffer::MetricBuffer;
use nanonet_agent::config::Config;
use nanonet_agent::state::AppState;
use nanonet_agent::ws;
use serde_json::json;
use tokio::sync::watch;

mod common;
use common::mock_backend::{MockBackend, ServerSend};

fn config_for(backend: &MockBackend) -> Config {
    Config::parse_from([
        "nanonet-agent",
        "--backend",
        &backend.ws_url(),
        "--service-id",
        "svc-cmd",
    ])
}

/// Bir text frame'i parse eder ve `type` alanını döndürür. Hata mesajları
/// debug için saklanır.
fn parse_type(raw: &str) -> (String, serde_json::Value) {
    let v: serde_json::Value =
        serde_json::from_str(raw).unwrap_or_else(|e| panic!("parse failed for `{raw}`: {e}"));
    let t = v
        .get("type")
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string();
    (t, v)
}

/// Mock backend'in `incoming` kanalından `type` alanı `ack` veya `result`
/// olan frame'leri filtreleyerek toplar. Diğer mesajlar (heartbeat vs.) atlanır.
async fn collect_command_responses(
    incoming: &mut tokio::sync::mpsc::UnboundedReceiver<String>,
    expected: usize,
    timeout: Duration,
) -> Vec<(String, serde_json::Value)> {
    let mut out = Vec::with_capacity(expected);
    let deadline = tokio::time::Instant::now() + timeout;
    while out.len() < expected {
        let remaining = deadline.saturating_duration_since(tokio::time::Instant::now());
        if remaining.is_zero() {
            break;
        }
        match tokio::time::timeout(remaining, incoming.recv()).await {
            Ok(Some(raw)) => {
                let (ty, v) = parse_type(&raw);
                if ty == "ack" || ty == "result" {
                    out.push((ty, v));
                }
            }
            _ => break,
        }
    }
    out
}

#[tokio::test]
async fn ping_command_yields_ack_and_success_result() {
    let backend = MockBackend::start().await;
    let config = config_for(&backend);
    let state = AppState::new("agent-cmd-1".to_string(), MetricBuffer::new(8));

    let (out_tx, out_rx) = ws::channel();
    let (sd_tx, sd_rx) = watch::channel(false);
    let state_clone = Arc::clone(&state);
    let handle = tokio::spawn(async move {
        ws::run(&config, out_rx, state_clone, sd_rx).await;
    });
    drop(out_tx);

    let mut conn = backend
        .next_connection(Duration::from_secs(5))
        .await
        .expect("agent bağlanmalı");

    // Sunucu komutu yolla.
    let cmd = json!({
        "type": "command",
        "command_id": "cmd-ping-1",
        "action": "ping",
    });
    conn.outgoing
        .send(ServerSend::Text(cmd.to_string()))
        .unwrap();

    let frames = collect_command_responses(&mut conn.incoming, 2, Duration::from_secs(3)).await;
    assert_eq!(
        frames.len(),
        2,
        "ack + result bekleniyordu, geldi: {frames:?}"
    );

    assert_eq!(frames[0].0, "ack");
    assert_eq!(frames[0].1["command_id"], "cmd-ping-1");

    assert_eq!(frames[1].0, "result");
    assert_eq!(frames[1].1["command_id"], "cmd-ping-1");
    assert_eq!(frames[1].1["status"], "success");

    // commands_handled artmış olmalı (state task'ı tarafından güncellenir).
    tokio::time::sleep(Duration::from_millis(50)).await;
    assert_eq!(
        state
            .commands_handled
            .load(std::sync::atomic::Ordering::Relaxed),
        1
    );

    sd_tx.send(true).unwrap();
    let _ = tokio::time::timeout(Duration::from_secs(3), handle).await;
}

#[tokio::test]
async fn unknown_action_is_rejected_with_failed_result() {
    let backend = MockBackend::start().await;
    let config = config_for(&backend);
    let state = AppState::new("agent-cmd-2".to_string(), MetricBuffer::new(8));

    let (out_tx, out_rx) = ws::channel();
    let (sd_tx, sd_rx) = watch::channel(false);
    let state_clone = Arc::clone(&state);
    let handle = tokio::spawn(async move {
        ws::run(&config, out_rx, state_clone, sd_rx).await;
    });
    drop(out_tx);

    let mut conn = backend
        .next_connection(Duration::from_secs(5))
        .await
        .expect("agent bağlanmalı");

    let cmd = json!({
        "type": "command",
        "command_id": "cmd-bad",
        "action": "rm-rf-slash",
    });
    conn.outgoing
        .send(ServerSend::Text(cmd.to_string()))
        .unwrap();

    let frames = collect_command_responses(&mut conn.incoming, 2, Duration::from_secs(3)).await;
    assert_eq!(frames.len(), 2, "geldi: {frames:?}");
    assert_eq!(frames[0].0, "ack");
    assert_eq!(frames[1].0, "result");
    assert_eq!(frames[1].1["status"], "failed");
    assert!(
        frames[1].1["error"].as_str().is_some(),
        "hatalı komut için error alanı dolu olmalı"
    );

    // Reddedilen komut commands_handled sayılmaz (success path'te artar).
    tokio::time::sleep(Duration::from_millis(50)).await;
    assert_eq!(
        state
            .commands_handled
            .load(std::sync::atomic::Ordering::Relaxed),
        0
    );

    sd_tx.send(true).unwrap();
    let _ = tokio::time::timeout(Duration::from_secs(3), handle).await;
}

#[tokio::test]
async fn malformed_json_is_ignored_silently() {
    // Agent malformed mesaj alırsa hiçbir frame yollamaz ama sayaçlar değişmez.
    let backend = MockBackend::start().await;
    let config = config_for(&backend);
    let state = AppState::new("agent-cmd-3".to_string(), MetricBuffer::new(8));

    let (out_tx, out_rx) = ws::channel();
    let (sd_tx, sd_rx) = watch::channel(false);
    let state_clone = Arc::clone(&state);
    let handle = tokio::spawn(async move {
        ws::run(&config, out_rx, state_clone, sd_rx).await;
    });
    drop(out_tx);

    let mut conn = backend
        .next_connection(Duration::from_secs(5))
        .await
        .expect("agent bağlanmalı");

    conn.outgoing
        .send(ServerSend::Text("{not-json".into()))
        .unwrap();

    // Kısa bir süre bekle ve hiçbir ack/result frame'i gelmediğini doğrula.
    let frames = collect_command_responses(&mut conn.incoming, 1, Duration::from_millis(400)).await;
    assert!(
        frames.is_empty(),
        "malformed mesaja ack/result çıkmamalı, geldi: {frames:?}"
    );
    assert_eq!(
        state
            .commands_handled
            .load(std::sync::atomic::Ordering::Relaxed),
        0
    );

    sd_tx.send(true).unwrap();
    let _ = tokio::time::timeout(Duration::from_secs(3), handle).await;
}
