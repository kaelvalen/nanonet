//! Integration testler için ortak yardımcılar.
//!
//! `mock_backend` modülü minimal bir axum tabanlı WebSocket sunucusu sağlar;
//! agent (veya doğrudan WS client) bu sunucuya bağlanıp protokol davranışını
//! doğrulayabilir.

#![allow(dead_code)]

pub mod mock_backend;
