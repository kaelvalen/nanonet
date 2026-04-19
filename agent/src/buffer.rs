use std::collections::VecDeque;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::io::AsyncWriteExt;
use tokio::sync::Mutex;

/// Offline süresinde biriken metriklerin geçerlilik süresi (2 saat).
/// Bu süreden eski metrikler yeniden bağlanınca gönderilmez.
const BUFFER_TTL: Duration = Duration::from_secs(2 * 60 * 60);

/// Bağlantı koptuğunda metrikleri biriktiren thread-safe buffer.
/// WS bağlantısı geldiğinde drain ile tümünü gönderir (TTL geçmemişleri).
#[derive(Clone, Debug)]
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

    /// Buffer boş mu?
    pub async fn is_empty(&self) -> bool {
        self.inner.lock().await.is_empty()
    }

    /// Toplam drop edilen metrik sayısı.
    pub fn dropped_count(&self) -> u64 {
        self.dropped.load(Ordering::Relaxed)
    }

    /// Toplam buffer'a eklenen metrik sayısı.
    pub fn total_buffered(&self) -> u64 {
        self.total_buffered.load(Ordering::Relaxed)
    }

    /// Buffer içeriğini diskte snapshot olarak yazar.
    ///
    /// Format: her satırda bir mesaj. Mesajlar zaten compact JSON varsayılır;
    /// `\n` içeren mesajlar `\\n` olarak escape edilir (yüklerken geri çevrilir).
    /// Atomic write: `<path>.tmp` yazılır sonra `rename` ile yerine konur.
    /// `path` üst dizini yoksa oluşturulur.
    pub async fn save_to_disk(&self, path: &Path) -> std::io::Result<usize> {
        if let Some(parent) = path.parent() {
            if !parent.as_os_str().is_empty() {
                tokio::fs::create_dir_all(parent).await?;
            }
        }

        // Snapshot al (mutex'i kısa tut).
        let snapshot: Vec<String> = {
            let buf = self.inner.lock().await;
            buf.iter().map(|(_, m)| m.clone()).collect()
        };
        let count = snapshot.len();

        let tmp_path = path.with_extension("tmp");
        let mut f = tokio::fs::File::create(&tmp_path).await?;
        for msg in &snapshot {
            let escaped = msg.replace('\\', "\\\\").replace('\n', "\\n");
            f.write_all(escaped.as_bytes()).await?;
            f.write_all(b"\n").await?;
        }
        f.flush().await?;
        f.sync_data().await?;
        drop(f);

        tokio::fs::rename(&tmp_path, path).await?;
        Ok(count)
    }

    /// Snapshot dosyasını yükler ve mesajları buffer'ın **arkasına** ekler
    /// (FIFO sırası korunur). Mesajlar "şimdi" timestamp'iyle işaretlenir;
    /// disk üzerinde gerçek timestamp tutmuyoruz çünkü `Instant` monotonic.
    /// `max_size`'i aşan eski mesajlar normal `push` mantığıyla düşer.
    /// Dosya yoksa `Ok(0)` döner.
    pub async fn load_from_disk(&self, path: &Path) -> std::io::Result<usize> {
        let body = match tokio::fs::read_to_string(path).await {
            Ok(s) => s,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(0),
            Err(e) => return Err(e),
        };

        let mut count = 0usize;
        for line in body.lines() {
            if line.is_empty() {
                continue;
            }
            // Escape geri çevir.
            let unescaped = unescape_line(line);
            self.push(unescaped).await;
            count += 1;
        }
        Ok(count)
    }
}

/// `\\\\` → `\\`, `\\n` → `\n` reverse.
fn unescape_line(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\\' {
            match chars.next() {
                Some('n') => out.push('\n'),
                Some('\\') => out.push('\\'),
                Some(other) => {
                    out.push('\\');
                    out.push(other);
                }
                None => out.push('\\'),
            }
        } else {
            out.push(c);
        }
    }
    out
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

    #[tokio::test]
    async fn save_and_load_round_trip() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("buffer.snap");

        let buf = MetricBuffer::new(10);
        buf.push(r#"{"type":"metric","x":1}"#.into()).await;
        buf.push(r#"{"type":"metric","x":2}"#.into()).await;

        let saved = buf.save_to_disk(&path).await.unwrap();
        assert_eq!(saved, 2);
        assert!(path.exists());

        // Yeni buffer'a yükle.
        let buf2 = MetricBuffer::new(10);
        let loaded = buf2.load_from_disk(&path).await.unwrap();
        assert_eq!(loaded, 2);
        assert_eq!(buf2.len().await, 2);

        let drained = buf2.drain().await;
        assert_eq!(
            drained,
            vec![
                r#"{"type":"metric","x":1}"#.to_string(),
                r#"{"type":"metric","x":2}"#.to_string(),
            ],
            "FIFO sırası korunmalı"
        );
    }

    #[tokio::test]
    async fn load_returns_zero_when_file_missing() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("nope.snap");
        let buf = MetricBuffer::new(10);
        let n = buf.load_from_disk(&path).await.unwrap();
        assert_eq!(n, 0);
        assert_eq!(buf.len().await, 0);
    }

    #[tokio::test]
    async fn save_handles_messages_with_newlines_and_backslashes() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("escape.snap");

        let buf = MetricBuffer::new(10);
        buf.push("line1\nline2\\with\\back".into()).await;

        buf.save_to_disk(&path).await.unwrap();
        let buf2 = MetricBuffer::new(10);
        buf2.load_from_disk(&path).await.unwrap();
        let drained = buf2.drain().await;
        assert_eq!(drained, vec!["line1\nline2\\with\\back"]);
    }

    #[tokio::test]
    async fn load_respects_max_size_dropping_oldest() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("over.snap");

        // 5 mesajlı snapshot üret.
        let big = MetricBuffer::new(10);
        for i in 0..5u32 {
            big.push(i.to_string()).await;
        }
        big.save_to_disk(&path).await.unwrap();

        // Kapasitesi 3 olan buffer'a yükle: ilk 2 düşmeli.
        let small = MetricBuffer::new(3);
        small.load_from_disk(&path).await.unwrap();
        assert_eq!(small.len().await, 3);
        assert_eq!(small.dropped_count(), 2);
        let drained = small.drain().await;
        assert_eq!(drained, vec!["2", "3", "4"]);
    }
}
