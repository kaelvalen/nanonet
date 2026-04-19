//! Mock backend altyapısının kendisinin smoke testi.
//!
//! Burada agent'ı çalıştırmak yerine doğrudan tungstenite WS client kullanıp
//! [`MockBackend`] yardımcılarının sözleştiği gibi davrandığını doğrularız.
//! Bu test agent'ın gerçek davranışını ölçmez; **mock altyapısı için**
//! regresyon koruması sağlar.

use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use tokio_tungstenite::{
    connect_async,
    tungstenite::{client::IntoClientRequest, http::HeaderValue, Message},
};

mod common;
use common::mock_backend::{MockBackend, ServerSend};

#[tokio::test]
async fn mock_backend_accepts_connection_and_passes_messages() {
    let backend = MockBackend::start().await;

    let url = format!("{}/ws/agent?service_id=svc-a", backend.ws_url());
    let (mut socket, _resp) = connect_async(&url).await.expect("dial");

    let mut conn = backend
        .next_connection(Duration::from_secs(2))
        .await
        .expect("backend should observe connection");
    assert_eq!(conn.service_id, "svc-a");
    assert_eq!(backend.connected_count(), 1);

    socket.send(Message::Text("hello".into())).await.unwrap();
    let received = tokio::time::timeout(Duration::from_secs(1), conn.incoming.recv())
        .await
        .expect("incoming timeout")
        .expect("channel closed");
    assert_eq!(received, "hello");

    conn.outgoing
        .send(ServerSend::Text("ping-from-server".into()))
        .unwrap();
    let server_msg = tokio::time::timeout(Duration::from_secs(1), socket.next())
        .await
        .expect("client read timeout")
        .expect("stream closed")
        .expect("ws error");
    assert!(matches!(server_msg, Message::Text(t) if t == "ping-from-server"));

    let _ = socket.close(None).await;
}

#[tokio::test]
async fn mock_backend_can_require_auth() {
    let backend = MockBackend::start().await;
    backend.require_auth(true);

    let url = format!("{}/ws/agent?service_id=svc-x", backend.ws_url());

    // Auth header'sız: 401
    let err = connect_async(&url).await.unwrap_err();
    assert!(
        format!("{}", err).contains("401") || format!("{:?}", err).contains("Unauthorized"),
        "auth header'sız 401 beklenir, geldi: {err}"
    );

    // Auth header ile: kabul edilmeli
    let mut req = url.into_client_request().unwrap();
    req.headers_mut().insert(
        "Authorization",
        HeaderValue::from_static("Bearer test-token"),
    );
    let (_socket, _) = connect_async(req).await.expect("with auth dial");

    let conn = backend
        .next_connection(Duration::from_secs(2))
        .await
        .expect("connection observed");
    assert_eq!(conn.auth_header.as_deref(), Some("Bearer test-token"));
}
