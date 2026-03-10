use std::collections::VecDeque;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

/// Offline süresinde biriken metriklerin geçerlilik süresi (2 saat).
/// Bu süreden eski metrikler yeniden bağlanınca gönderilmez.
const BUFFER_TTL: Duration = Duration::from_secs(2 * 60 * 60);

/// Bağlantı koptuğunda metrikleri biriktiren thread-safe buffer.
/// WS bağlantısı geldiğinde drain ile tümünü gönderir (TTL geçmemişleri).
#[derive(Clone)]
pub struct MetricBuffer {
    inner: Arc<Mutex<VecDeque<(Instant, String)>>>,
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
        buf.push_back((Instant::now(), msg));
        self.total_buffered.fetch_add(1, Ordering::Relaxed);
    }

    /// Buffer'daki tüm geçerli metrikleri alır (FIFO sırasıyla).
    /// TTL süresi dolmuş (2 saatten eski) metrikler atılır.
    pub async fn drain(&self) -> Vec<String> {
        let mut buf = self.inner.lock().await;
        let now = Instant::now();
        buf.drain(..)
            .filter(|(ts, _)| now.duration_since(*ts) < BUFFER_TTL)
            .map(|(_, msg)| msg)
            .collect()
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
