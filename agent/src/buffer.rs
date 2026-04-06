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

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_push_and_len() {
        let buf = MetricBuffer::new(10);
        assert_eq!(buf.len().await, 0);

        buf.push("msg1".to_string()).await;
        buf.push("msg2".to_string()).await;
        assert_eq!(buf.len().await, 2);
    }

    #[tokio::test]
    async fn test_drain_returns_all_messages() {
        let buf = MetricBuffer::new(10);
        buf.push("a".to_string()).await;
        buf.push("b".to_string()).await;
        buf.push("c".to_string()).await;

        let msgs = buf.drain().await;
        assert_eq!(msgs, vec!["a", "b", "c"]);
        assert_eq!(buf.len().await, 0, "drain sonrası buffer boş olmalı");
    }

    #[tokio::test]
    async fn test_max_size_drops_oldest() {
        let buf = MetricBuffer::new(3);
        buf.push("1".to_string()).await;
        buf.push("2".to_string()).await;
        buf.push("3".to_string()).await;
        buf.push("4".to_string()).await; // "1" düşmeli

        let msgs = buf.drain().await;
        assert_eq!(msgs, vec!["2", "3", "4"]);
        assert_eq!(buf.dropped_count(), 1);
    }

    #[tokio::test]
    async fn test_dropped_count_increments() {
        let buf = MetricBuffer::new(2);
        buf.push("a".to_string()).await;
        buf.push("b".to_string()).await;
        assert_eq!(buf.dropped_count(), 0);

        buf.push("c".to_string()).await;
        assert_eq!(buf.dropped_count(), 1);

        buf.push("d".to_string()).await;
        assert_eq!(buf.dropped_count(), 2);
    }

    #[tokio::test]
    async fn test_total_buffered_counts_all_pushes() {
        let buf = MetricBuffer::new(5);
        buf.push("x".to_string()).await;
        buf.push("y".to_string()).await;
        buf.push("z".to_string()).await;
        assert_eq!(buf.total_buffered(), 3);
    }

    #[tokio::test]
    async fn test_drain_empty_buffer() {
        let buf = MetricBuffer::new(10);
        let msgs = buf.drain().await;
        assert!(msgs.is_empty());
    }

    #[tokio::test]
    async fn test_drain_is_fifo() {
        let buf = MetricBuffer::new(100);
        for i in 0..5u32 {
            buf.push(i.to_string()).await;
        }
        let msgs = buf.drain().await;
        assert_eq!(msgs, vec!["0", "1", "2", "3", "4"]);
    }

    #[tokio::test]
    async fn test_clone_shares_state() {
        let buf = MetricBuffer::new(10);
        let buf2 = buf.clone();

        buf.push("shared".to_string()).await;
        assert_eq!(buf2.len().await, 1, "clone aynı dahili state'i paylaşmalı");
    }

    #[tokio::test]
    async fn test_total_buffered_includes_dropped() {
        let buf = MetricBuffer::new(2);
        // 4 push, 2 dropped
        for i in 0..4u32 {
            buf.push(i.to_string()).await;
        }
        assert_eq!(
            buf.total_buffered(),
            4,
            "drop edilen mesajlar da toplama sayılmalı"
        );
        assert_eq!(buf.dropped_count(), 2);
    }
}
