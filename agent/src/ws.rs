//! WebSocket istemcisi — backend ile çift yönlü mesajlaşma + reconnect döngüsü.
//!
//! ## Yaşam döngüsü
//!
//! 1. [`run`] dış döngüsü: shutdown sinyali gelene dek bağlanmayı dener.
//! 2. Her başarılı bağlantı [`connect_and_run`] tarafından sürdürülür:
//!    - Buffer'da bekleyen metrikler önce gönderilir.
//!    - 30s aralıklarla heartbeat ping atılır.
//!    - `outgoing_rx` üzerinden gelen mesajlar sunucuya iletilir.
//!    - Sunucudan gelen `command` mesajları [`commands::execute`] ile çalıştırılır.
//! 3. Hata sonrası exponential backoff (max 32s) + jitter (≤1s).
//!
//! Tüm sayaçlar ve bağlantı durumu artık [`AppState`] üzerinden okunur/yazılır;
//! eski `pub static AtomicBool` ler kaldırılmıştır.

use futures_util::{SinkExt, StreamExt};
use rand::Rng;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{mpsc, watch};
use tokio_tungstenite::{
    connect_async_with_config,
    tungstenite::{client::IntoClientRequest, http::HeaderValue, Message},
};

use crate::buffer::MetricBuffer;
use crate::commands;
use crate::config::Config;
use crate::error::AgentError;
use crate::state::AppState;

/// Max backoff delay in seconds.
const MAX_BACKOFF_SECS: u64 = 32;
/// Jitter range in milliseconds.
const JITTER_MAX_MS: u64 = 1000;
/// Outgoing channel buffer size — küçük tutulur ki sırt basıncı erken hissedilsin.
const OUTGOING_CHANNEL_CAPACITY: usize = 64;
/// Bağlantının "stable" sayılması için minimum açık kalma süresi.
/// Bu eşiği geçen bir bağlantı koptuğunda backoff sayacı sıfırlanır;
/// böylece uzun stabil bağlantıdan sonra olan transient hatalar agresif backoff'a
/// takılmaz.
const STABLE_CONNECTION_THRESHOLD: Duration = Duration::from_secs(60);

pub type OutgoingTx = mpsc::Sender<String>;
pub type OutgoingRx = mpsc::Receiver<String>;

/// (sender, receiver) çiftini hazırlar — main task tarafından çağrılır.
pub fn channel() -> (OutgoingTx, OutgoingRx) {
    mpsc::channel(OUTGOING_CHANNEL_CAPACITY)
}

/// Ana yeniden bağlanma döngüsü — shutdown sinyali gelene kadar çalışır.
pub async fn run(
    config: &Config,
    mut outgoing_rx: OutgoingRx,
    state: Arc<AppState>,
    mut shutdown_rx: watch::Receiver<bool>,
) {
    let ws_url = config.ws_url();
    let mut delay_secs: u64 = 1;
    let mut attempt: u32 = 0;

    loop {
        if *shutdown_rx.borrow() {
            tracing::info!("WS task shutdown sinyali aldı — çıkılıyor");
            break;
        }

        attempt += 1;
        tracing::info!(attempt, "WS bağlantı denemesi");

        match connect_and_run(
            &ws_url,
            &mut outgoing_rx,
            config,
            Arc::clone(&state),
            &mut shutdown_rx,
        )
        .await
        {
            ConnectionOutcome::Shutdown(ShutdownReason::ServerClose) => {
                tracing::info!("WS sunucu tarafından kapatıldı — hemen yeniden bağlanılıyor");
                delay_secs = 1;
                attempt = 0;
            }
            ConnectionOutcome::Shutdown(ShutdownReason::Graceful) => {
                tracing::info!("WS graceful shutdown — çıkılıyor");
                break;
            }
            ConnectionOutcome::Failed { error, stable_for } => {
                state.set_ws_connected(false);

                // Stabil kalmış bir bağlantı koptuysa backoff'u sıfırla.
                // (Geçici ağ glitch'lerinde dakikalarca beklemekten kaçınırız.)
                if stable_for >= STABLE_CONNECTION_THRESHOLD {
                    tracing::info!(
                        stable_secs = stable_for.as_secs(),
                        "Stabil bağlantı koptu; backoff sıfırlanıyor"
                    );
                    delay_secs = 1;
                    attempt = 0;
                }

                let jitter_ms = rand::thread_rng().gen_range(0..JITTER_MAX_MS);
                let sleep = Duration::from_millis(delay_secs * 1000 + jitter_ms);

                tracing::warn!(
                    attempt,
                    error = %error,
                    retry_in_ms = sleep.as_millis(),
                    "WS bağlantı hatası — yeniden denenecek"
                );

                tokio::select! {
                    _ = tokio::time::sleep(sleep) => {},
                    _ = shutdown_rx.changed() => {
                        tracing::info!("Bekleme sırasında shutdown sinyali — çıkılıyor");
                        break;
                    }
                }

                delay_secs = (delay_secs * 2).min(MAX_BACKOFF_SECS);
            }
        }
    }

    state.set_ws_connected(false);
}

enum ShutdownReason {
    ServerClose,
    Graceful,
}

/// `connect_and_run`'ın ya temiz çıkış ya da hata + bağlantının ne kadar
/// stabil kaldığını birlikte taşıyan dönüş tipi.
enum ConnectionOutcome {
    Shutdown(ShutdownReason),
    Failed {
        error: AgentError,
        /// Handshake'ten kopuşa kadar geçen süre. Handshake bile başarısızsa
        /// `Duration::ZERO`.
        stable_for: Duration,
    },
}

async fn connect_and_run(
    ws_url: &str,
    outgoing_rx: &mut OutgoingRx,
    config: &Config,
    state: Arc<AppState>,
    shutdown_rx: &mut watch::Receiver<bool>,
) -> ConnectionOutcome {
    // Handshake öncesi hatalar `stable_for = 0` olarak raporlanır.
    let request = match build_request(ws_url, config) {
        Ok(r) => r,
        Err(e) => {
            return ConnectionOutcome::Failed {
                error: e,
                stable_for: Duration::ZERO,
            }
        }
    };

    let connect_fut = connect_async_with_config(request, None, false);
    let ws_stream = match tokio::time::timeout(Duration::from_secs(30), connect_fut).await {
        Err(_) => {
            return ConnectionOutcome::Failed {
                error: AgentError::WebSocketConnection("Bağlantı zaman aşımı (30s)".to_string()),
                stable_for: Duration::ZERO,
            }
        }
        Ok(Err(e)) => {
            return ConnectionOutcome::Failed {
                error: AgentError::WebSocketConnection(e.to_string()),
                stable_for: Duration::ZERO,
            }
        }
        Ok(Ok((s, _))) => s,
    };

    tracing::info!("WebSocket bağlantısı kuruldu ✓");
    state.set_ws_connected(true);
    state.inc_ws_reconnects();
    let connected_at = std::time::Instant::now();

    let (mut sink, mut stream) = ws_stream.split();

    // Bağlantı kurulduktan sonra üretilen herhangi bir hatayı `stable_for` ile
    // sarıp döndüren küçük yardımcı.
    macro_rules! fail {
        ($err:expr) => {
            return ConnectionOutcome::Failed {
                error: $err,
                stable_for: connected_at.elapsed(),
            }
        };
    }

    // Buffer'daki birikmiş metrikleri gönder.
    if let Err(e) = flush_buffer(&state.buffer, &mut sink, &state).await {
        fail!(e);
    }

    let mut ping_interval = tokio::time::interval(Duration::from_secs(30));
    ping_interval.tick().await; // ilk tick'i atla
    loop {
        tokio::select! {
            _ = shutdown_rx.changed() => {
                tracing::info!("WS loop shutdown sinyali aldı");
                let _ = sink.close().await;
                return ConnectionOutcome::Shutdown(ShutdownReason::Graceful);
            }

            _ = ping_interval.tick() => {
                if let Err(e) = sink.send(Message::Ping(vec![0x4E, 0x4E])).await {
                    state.set_ws_connected(false);
                    fail!(AgentError::WebSocketConnection(format!("Ping hatası: {}", e)));
                }
                tracing::debug!("Heartbeat ping gönderildi");
            }

            Some(msg) = outgoing_rx.recv() => {
                if let Err(e) = sink.send(Message::Text(msg)).await {
                    state.set_ws_connected(false);
                    fail!(AgentError::WebSocketConnection(e.to_string()));
                }
                state.inc_metrics_sent();
            }

            msg = stream.next() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        handle_incoming(&text, &mut sink, config, Arc::clone(&state)).await;
                    }
                    Some(Ok(Message::Pong(_))) => {
                        tracing::debug!("Pong alındı ✓");
                    }
                    Some(Ok(Message::Close(_))) => {
                        tracing::info!("WebSocket sunucu tarafından kapatıldı");
                        state.set_ws_connected(false);
                        return ConnectionOutcome::Shutdown(ShutdownReason::ServerClose);
                    }
                    Some(Err(e)) => {
                        state.set_ws_connected(false);
                        fail!(AgentError::WebSocketConnection(e.to_string()));
                    }
                    None => {
                        state.set_ws_connected(false);
                        fail!(AgentError::WebSocketConnection(
                            "Bağlantı beklenmedik şekilde kapandı".to_string(),
                        ));
                    }
                    _ => {}
                }
            }
        }
    }
}

/// `ws_url` ve config'ten Authorization header'ı eklenmiş bir client request üretir.
fn build_request(
    ws_url: &str,
    config: &Config,
) -> Result<tokio_tungstenite::tungstenite::handshake::client::Request, AgentError> {
    let mut request = ws_url
        .into_client_request()
        .map_err(|e| AgentError::WebSocketConnection(format!("URL parse hatası: {}", e)))?;

    if let Some(auth) = config.auth_header() {
        request.headers_mut().insert(
            "Authorization",
            HeaderValue::from_str(&auth)
                .map_err(|e| AgentError::WebSocketConnection(format!("Geçersiz token: {}", e)))?,
        );
    }
    Ok(request)
}

/// Buffer'daki birikmiş metrikleri WS'e drain eder. İlk hatada bağlantı koptu
/// kabul edilir.
async fn flush_buffer<S>(
    buffer: &MetricBuffer,
    sink: &mut S,
    state: &Arc<AppState>,
) -> Result<(), AgentError>
where
    S: SinkExt<Message> + Unpin,
    S::Error: std::fmt::Display,
{
    let buffered = buffer.drain().await;
    if buffered.is_empty() {
        return Ok(());
    }
    tracing::info!(
        count = buffered.len(),
        "Buffer'daki birikmiş metrikler gönderiliyor"
    );
    for msg in buffered {
        if let Err(e) = sink.send(Message::Text(msg)).await {
            tracing::warn!("Buffer metriği gönderilemedi: {}", e);
            state.set_ws_connected(false);
            return Err(AgentError::WebSocketConnection(e.to_string()));
        }
        state.inc_metrics_sent();
    }
    Ok(())
}

async fn handle_incoming<S>(text: &str, sink: &mut S, config: &Config, state: Arc<AppState>)
where
    S: SinkExt<Message> + Unpin,
    S::Error: std::fmt::Display,
{
    let value: serde_json::Value = match serde_json::from_str(text) {
        Ok(v) => v,
        Err(e) => {
            tracing::warn!(error = %e, "Mesaj parse edilemedi");
            return;
        }
    };

    let msg_type = value.get("type").and_then(|v| v.as_str()).unwrap_or("");

    if msg_type != "command" {
        tracing::debug!(msg_type, "Bilinmeyen mesaj tipi");
        return;
    }

    let cmd: commands::IncomingCommand = match serde_json::from_value(value) {
        Ok(c) => c,
        Err(e) => {
            tracing::warn!(error = %e, "Komut parse edilemedi");
            return;
        }
    };

    tracing::info!(
        action = %cmd.action,
        command_id = %cmd.command_id,
        signed = state.verifier.is_enforcing(),
        "Komut alındı"
    );

    // Audit: alındı kaydı (varsa).
    if let Some(audit) = state.audit.as_ref() {
        audit
            .record_received(&cmd.command_id, &cmd.action, cmd.command.as_deref())
            .await;
    }

    // İmza doğrulama (yapılandırılmışsa). Başarısız ise komutu çalıştırmadan
    // önce reddederiz: ack zaten gönderilmediği için backend de timeout'a
    // düşmez; result frame'i ile failed sebebini bildiririz.
    if let Err(sign_err) = state.verifier.verify(
        &cmd.command_id,
        &cmd.action,
        cmd.nonce.as_deref(),
        cmd.command.as_deref(),
        cmd.signature.as_deref(),
    ) {
        state.inc_commands_unverified();
        tracing::warn!(
            action = %cmd.action,
            command_id = %cmd.command_id,
            error = %sign_err,
            "İmza doğrulanamadı, komut reddedildi"
        );
        let err_str = format!("imza doğrulanamadı: {sign_err}");
        if let Some(audit) = state.audit.as_ref() {
            audit
                .record_completed(
                    &cmd.command_id,
                    &cmd.action,
                    false,
                    Duration::from_millis(0),
                    Some(&err_str),
                    None,
                )
                .await;
        }
        let result = cmd.result_json(false, Some(err_str), None);
        if let Err(e) = sink.send(Message::Text(result)).await {
            tracing::error!(error = %e, "İmza-red sonucu gönderilemedi");
        }
        return;
    }

    // ACK gönder.
    let ack = cmd.ack_json();
    if let Err(e) = sink.send(Message::Text(ack)).await {
        tracing::error!(error = %e, "ACK gönderilemedi");
        return;
    }

    // Eşzamanlı komut limiti için permit al. Permit alınana kadar bekleriz —
    // kuyruk overflow'unda backend'in komut timeout'u zaten devreye girer.
    // `try_acquire` ile dolu olduğunda hızlı reddetmek de mümkün ama mevcut
    // kullanıcı deneyimi (operatör tek terminalden işliyor) için kuyruğa alma
    // daha sezgisel.
    let _permit = match Arc::clone(&state.command_semaphore).acquire_owned().await {
        Ok(p) => p,
        Err(_) => {
            // Semaphore kapatılmış (yalnızca shutdown senaryosunda olur).
            state.inc_commands_rejected();
            let result = cmd.result_json(
                false,
                Some("agent shutdown sırasında komut kabul edilmiyor".to_string()),
                None,
            );
            let _ = sink.send(Message::Text(result)).await;
            return;
        }
    };

    let is_restart = cmd.action == "restart";

    let started_at = std::time::Instant::now();
    let (success, error, output) = match commands::execute(&cmd, config).await {
        Ok(out) => {
            if is_restart {
                let total = state.inc_restart_count();
                tracing::info!(total, "Restart tamamlandı");
            }
            state.inc_commands_handled();
            (true, None, out)
        }
        Err(e) => {
            tracing::error!(action = %cmd.action, error = %e, "Komut başarısız");
            (false, Some(e), None)
        }
    };
    let duration = started_at.elapsed();

    if let Some(audit) = state.audit.as_ref() {
        audit
            .record_completed(
                &cmd.command_id,
                &cmd.action,
                success,
                duration,
                error.as_deref(),
                output.as_deref(),
            )
            .await;
    }

    let result = cmd.result_json(success, error, output);
    if let Err(e) = sink.send(Message::Text(result)).await {
        tracing::error!(error = %e, "Komut sonucu gönderilemedi");
    }
}
