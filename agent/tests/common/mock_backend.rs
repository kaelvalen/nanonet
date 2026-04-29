//! Minimal axum WebSocket sunucusu — agent integration testleri için.
//!
//! Test akışı:
//! 1. [`MockBackend::start`] ephemeral bir port'a bind eder ve background'da
//!    çalışmaya başlar.
//! 2. Test, agent'ı `ws://127.0.0.1:<port>` ile yapılandırır.
//! 3. Sunucu her bağlanan agent'ı [`Connection`] olarak kanal üzerinden
//!    teslim eder; testler bu connection üzerinden:
//!    - Agent'ın gönderdiği frame'leri okuyabilir,
//!    - Komut frame'leri itebilir,
//!    - Bağlantıyı zorla kapatabilir.
//!
//! Sunucu **kasıtlı olarak**:
//! - Authorization header'ını doğrulamaz (testler isterlerse kendileri
//!   `with_auth_check` ile bunu açabilir),
//! - State tutmaz,
//! - WS subprotocol pazarlığı yapmaz.

use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        ConnectInfo, Query, State,
    },
    http::HeaderMap,
    response::IntoResponse,
    routing::get,
    Router,
};
use serde::Deserialize;
use tokio::net::TcpListener;
use tokio::sync::{mpsc, Mutex};
use tokio::task::JoinHandle;

#[derive(Clone)]
pub struct MockBackend {
    pub addr: SocketAddr,
    pub port: u16,
    /// Yeni bağlantılar buradan teslim edilir.
    pub connections: Arc<Mutex<mpsc::UnboundedReceiver<Connection>>>,
    /// Bağlanan agent sayacı (kümülatif).
    pub connected_count: Arc<std::sync::atomic::AtomicU64>,
    /// Server task handle — drop edildiğinde sunucu kapanır.
    _server: Arc<JoinHandle<()>>,
    /// Auth header doğrulama kapalı/açık.
    expect_auth: Arc<std::sync::atomic::AtomicBool>,
}

#[derive(Clone)]
struct AppState {
    tx: mpsc::UnboundedSender<Connection>,
    connected_count: Arc<std::sync::atomic::AtomicU64>,
    expect_auth: Arc<std::sync::atomic::AtomicBool>,
}

/// Aktif bir agent ↔ backend WS bağlantısı. Test, gönderilen frame'leri okur
/// ve cevap olarak komutlar itebilir.
pub struct Connection {
    pub service_id: String,
    pub remote: SocketAddr,
    /// Agent'tan gelen text frame'ler.
    pub incoming: mpsc::UnboundedReceiver<String>,
    /// Agent'a text frame göndermek için.
    pub outgoing: mpsc::UnboundedSender<ServerSend>,
    pub auth_header: Option<String>,
}

/// Sunucudan agent'a iletilebilen sinyal türleri.
#[derive(Debug)]
pub enum ServerSend {
    /// Düz text frame.
    Text(String),
    /// Bağlantıyı düzgünce kapat.
    Close,
}

#[derive(Debug, Deserialize)]
struct AgentQuery {
    service_id: Option<String>,
}

impl MockBackend {
    /// Loopback üzerinde rastgele bir porta bind eder ve sunucuyu başlatır.
    pub async fn start() -> Self {
        let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind");
        let addr = listener.local_addr().expect("local_addr");
        let port = addr.port();

        let (conn_tx, conn_rx) = mpsc::unbounded_channel::<Connection>();
        let connected_count = Arc::new(std::sync::atomic::AtomicU64::new(0));
        let expect_auth = Arc::new(std::sync::atomic::AtomicBool::new(false));

        let state = AppState {
            tx: conn_tx,
            connected_count: Arc::clone(&connected_count),
            expect_auth: Arc::clone(&expect_auth),
        };

        let app = Router::new()
            .route("/ws/agent", get(ws_handler))
            .with_state(state);

        let server = tokio::spawn(async move {
            let _ = axum::serve(
                listener,
                app.into_make_service_with_connect_info::<SocketAddr>(),
            )
            .await;
        });

        // Sunucunun gerçekten dinlediğinden emin ol — küçük bir uyku.
        tokio::time::sleep(Duration::from_millis(20)).await;

        Self {
            addr,
            port,
            connections: Arc::new(Mutex::new(conn_rx)),
            connected_count,
            _server: Arc::new(server),
            expect_auth,
        }
    }

    /// `ws://127.0.0.1:<port>` formatında base URL.
    pub fn ws_url(&self) -> String {
        format!("ws://127.0.0.1:{}", self.port)
    }

    /// Bir sonraki gelen agent bağlantısını bekler. `timeout` aşılırsa `None`.
    pub async fn next_connection(&self, timeout: Duration) -> Option<Connection> {
        let mut rx = self.connections.lock().await;
        tokio::time::timeout(timeout, rx.recv())
            .await
            .ok()
            .flatten()
    }

    /// Auth header doğrulamasını aç/kapa. Açıkken Authorization header'ı yoksa
    /// 401 döner.
    pub fn require_auth(&self, on: bool) {
        self.expect_auth
            .store(on, std::sync::atomic::Ordering::Relaxed);
    }

    pub fn connected_count(&self) -> u64 {
        self.connected_count
            .load(std::sync::atomic::Ordering::Relaxed)
    }
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    Query(q): Query<AgentQuery>,
    ConnectInfo(remote): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let auth_header = headers
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    if state.expect_auth.load(std::sync::atomic::Ordering::Relaxed) && auth_header.is_none() {
        return axum::http::StatusCode::UNAUTHORIZED.into_response();
    }

    let service_id = q.service_id.unwrap_or_default();
    let tx = state.tx.clone();
    let counter = Arc::clone(&state.connected_count);

    ws.on_upgrade(move |socket| async move {
        counter.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        handle_socket(socket, service_id, remote, auth_header, tx).await;
    })
}

async fn handle_socket(
    mut socket: WebSocket,
    service_id: String,
    remote: SocketAddr,
    auth_header: Option<String>,
    conn_tx: mpsc::UnboundedSender<Connection>,
) {
    let (in_tx, in_rx) = mpsc::unbounded_channel::<String>();
    let (out_tx, mut out_rx) = mpsc::unbounded_channel::<ServerSend>();

    if conn_tx
        .send(Connection {
            service_id,
            remote,
            incoming: in_rx,
            outgoing: out_tx,
            auth_header,
        })
        .is_err()
    {
        // Test alıcısı düştü — bağlantıyı kapat.
        let _ = socket.close().await;
        return;
    }

    loop {
        tokio::select! {
            outgoing = out_rx.recv() => {
                match outgoing {
                    Some(ServerSend::Text(t)) => {
                        if socket.send(Message::Text(t)).await.is_err() {
                            break;
                        }
                    }
                    Some(ServerSend::Close) | None => {
                        let _ = socket.close().await;
                        break;
                    }
                }
            }
            incoming = socket.recv() => {
                match incoming {
                    Some(Ok(Message::Text(t))) => {
                        if in_tx.send(t).is_err() {
                            break;
                        }
                    }
                    Some(Ok(Message::Ping(p))) => {
                        if socket.send(Message::Pong(p)).await.is_err() {
                            break;
                        }
                    }
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Err(_)) => break,
                    _ => {}
                }
            }
        }
    }
}
