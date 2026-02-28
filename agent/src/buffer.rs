use std::collections::VecDeque;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::sync::Mutex;

/// Bağlantı koptuğunda metrikleri biriktiren thread-safe buffer.
/// WS bağlantısı geldiğinde drain ile tümünü gönderir.
#[derive(Clone)]
pub struct MetricBuffer {
    inner: Arc<Mutex<VecDeque<String>>>,
    max_size: usize,
    dropped: Arc<AtomicU64>,
    total_buffered: Arc<AtomicU64>,
}

impl MetricBuffer {
    pub fn new(max_size: usize) -> Self {
        Self {
            inner: Arc::new(Mutex::new(VecDeque::with_capacity(max_size))),
            max_size,
            dropped: Arc::new(AtomicU64::new(0)),
            total_buffered: Arc::new(AtomicU64::new(0)),
        }
    }

    /// Metrik mesajını buffer'a ekler.
    /// Buffer doluysa en eski metriği atar.
    pub async fn push(&self, msg: String) {
        let mut buf = self.inner.lock().await;
        if buf.len() >= self.max_size {
            buf.pop_front();
            self.dropped.fetch_add(1, Ordering::Relaxed);
        }
        buf.push_back(msg);
        self.total_buffered.fetch_add(1, Ordering::Relaxed);
    }

    /// Buffer'daki tüm metrikleri alır (FIFO sırasıyla).
    pub async fn drain(&self) -> Vec<String> {
        let mut buf = self.inner.lock().await;
        buf.drain(..).collect()
    }

    /// Buffer'daki mevcut metrik sayısı.
    pub async fn len(&self) -> usize {
        self.inner.lock().await.len()
    }

    /// Toplam drop edilen metrik sayısı.
    pub fn dropped_count(&self) -> u64 {
        self.dropped.load(Ordering::Relaxed)
    }

    /// Toplam buffer'a eklenen metrik sayısı.
    pub fn total_buffered(&self) -> u64 {
        self.total_buffered.load(Ordering::Relaxed)
    }
}
