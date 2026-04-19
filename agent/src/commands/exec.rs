//! `exec` komutu — operatörün servise dair tanılayıcı kabuk komutları.
//!
//! Backend'in gönderdiği `command` payload'undaki ilk anahtar kelime
//! (`status`, `health`, `ps`, `mem`, `cpu`, `connections`, `logs`, `env`,
//! `uptime`, `disk`, `netstat`, `metrics`, `pid`, `proc`, `help`) belirli bir
//! shell şablonuna eşlenir. Operatör keyfi shell çalıştıramaz; yalnızca bu
//! eşlenmiş şablonlar çalışır.
//!
//! ## Tasarım notları
//!
//! - Şablonlar `host`, `port`, `health_url`, `metrics_url` ile parametrelenir.
//! - Tüm host introspection adımları docker container fallback ile yazılmıştır
//!   (servis container içindeyse PID lookup `ss` ile başarısız olur).
//! - Hassas env değişkenleri `grep -v -iE` ile süzülür.

use crate::commands::runner::run_shell;
use crate::commands::types::IncomingCommand;
use crate::commands::validation::validate_safe_input;
use crate::config::Config;

/// `exec` aksiyonunun varsayılan timeout'u.
pub const DEFAULT_EXEC_TIMEOUT: u64 = 30;

pub async fn run(cmd: &IncomingCommand, config: &Config) -> Result<Option<String>, String> {
    let raw = match cmd.command.as_deref() {
        Some(c) if !c.trim().is_empty() => c.trim().to_string(),
        _ => return Err("exec: command alanı eksik".to_string()),
    };

    if let Err(e) = validate_safe_input(&raw) {
        tracing::warn!("[{}] exec komutu reddedildi: {}", cmd.command_id, e);
        return Err(format!("güvenlik hatası: {}", e));
    }

    let timeout = cmd.timeout_sec.unwrap_or(DEFAULT_EXEC_TIMEOUT);

    let shell_cmd = build_service_command(&raw, config)?;

    tracing::info!(
        "[{}] exec çalıştırılıyor: '{}' → `{}` (timeout: {}s)",
        cmd.command_id,
        raw,
        shell_cmd,
        timeout
    );
    run_shell(&shell_cmd, timeout).await
}

/// Kullanıcının girdiği kısa komutu servise özgü shell komutuna dönüştürür.
///
/// Desteklenen anahtarlar:
///   status, health, metrics, ps/proc, pid, mem/memory, cpu, connections,
///   logs, env, uptime, disk, netstat, help
pub fn build_service_command(input: &str, config: &Config) -> Result<String, String> {
    let keyword = input.split_whitespace().next().unwrap_or("").to_lowercase();
    let host = &config.host;
    let port = config.port;
    let health_url = config.health_url();
    let metrics_url = config.metrics_endpoint.as_deref().unwrap_or("").to_string();

    // Servisin portunu dinleyen PID'i bul — yalnızca host process'leri için
    // geçerli. Container'da çalışan servisler için PID boş döner; komutlar
    // buna göre fallback uygular.
    let pid_lookup = format!(
        "ss -tlnp 'sport = :{port}' 2>/dev/null | awk 'NR>1{{print}}' | \
         grep -oP 'pid=\\K[0-9]+' | head -1"
    );

    // Container tespiti: portu dinleyen docker container.
    let docker_lookup = format!(
        "docker ps --format '{{{{.ID}}}} {{{{.Ports}}}}' 2>/dev/null | \
         grep ':{port}->' | awk '{{{{print $1}}}}' | head -1"
    );

    let cmd = match keyword.as_str() {
        "help" => {
            return Ok(HELP_TEXT.to_string());
        }

        "status" => format!(
            "CODE=$(curl -so /dev/null -w '%{{http_code}}' --connect-timeout 3 '{health_url}' 2>/dev/null); \
             echo \"host={host}  port={port}  endpoint={health_url}\"; \
             if [ \"$CODE\" = '200' ]; then echo \"durum=UP  http=$CODE\"; \
             elif [ -z \"$CODE\" ] || [ \"$CODE\" = '000' ]; then echo \"durum=DOWN  (bağlantı reddedildi)\"; \
             else echo \"durum=DEGRADED  http=$CODE\"; fi"
        ),

        "health" => format!(
            "curl -sf --connect-timeout 5 '{health_url}' 2>/dev/null \
             || echo '(health endpoint yanıt vermedi)'"
        ),

        "metrics" => {
            if metrics_url.is_empty() {
                return Err(
                    "metrics endpoint yapılandırılmamış (NANONET_METRICS_ENDPOINT)".to_string(),
                );
            }
            format!(
                "curl -sf --connect-timeout 5 '{metrics_url}' 2>/dev/null \
                 || echo '(metrics endpoint yanıt vermedi)'"
            )
        }

        "ps" | "proc" => format!(
            "PID=$({pid_lookup}); \
             CID=$({docker_lookup}); \
             if [ -n \"$PID\" ]; then \
               ps -p \"$PID\" -o pid,ppid,user,%cpu,%mem,vsz,rss,stat,start,time,cmd 2>/dev/null; \
             elif [ -n \"$CID\" ]; then \
               echo \"--- Container: $CID ---\"; \
               docker stats --no-stream --format \
                 'ID={{{{.ID}}}}  Name={{{{.Name}}}}  CPU={{{{.CPUPerc}}}}  Mem={{{{.MemUsage}}}}  Net={{{{.NetIO}}}}  PIDs={{{{.PIDs}}}}' \
                 \"$CID\" 2>/dev/null; \
               echo; docker top \"$CID\" 2>/dev/null | head -10; \
             else \
               echo \"host={host}:{port} (port erişilebilirlik kontrolü)\"; \
               curl -so /dev/null -w 'http=%{{http_code}}  time=%{{time_total}}s\\n' \
                 --connect-timeout 3 '{health_url}' 2>/dev/null \
                 || echo 'servis yanıt vermiyor'; \
             fi"
        ),

        "pid" => format!(
            "PID=$({pid_lookup}); \
             CID=$({docker_lookup}); \
             if [ -n \"$PID\" ]; then \
               echo \"PID=$PID\"; \
               cat /proc/$PID/cmdline 2>/dev/null | tr '\\0' ' '; echo; \
             elif [ -n \"$CID\" ]; then \
               echo \"container=$CID\"; \
               docker inspect --format 'image={{{{.Config.Image}}}}  state={{{{.State.Status}}}}  pid={{{{.State.Pid}}}}  started={{{{.State.StartedAt}}}}' \"$CID\" 2>/dev/null; \
             else \
               echo 'host process bulunamadı, docker container da tespit edilemedi'; \
               echo 'not: servis uzak host veya farkli network namespace icerisinde calisiyor olabilir'; \
             fi"
        ),

        "mem" | "memory" => format!(
            "PID=$({pid_lookup}); \
             CID=$({docker_lookup}); \
             if [ -n \"$PID\" ]; then \
               echo \"--- Servis Process Belleği (PID=$PID) ---\"; \
               cat /proc/$PID/status 2>/dev/null | grep -E 'VmRSS|VmSize|VmPeak|VmSwap' || true; \
             elif [ -n \"$CID\" ]; then \
               echo \"--- Container Belleği ($CID) ---\"; \
               docker stats --no-stream --format \
                 'bellek={{{{.MemUsage}}}}  limit={{{{.MemPerc}}}}' \"$CID\" 2>/dev/null; \
             else \
               echo \"--- Servis Yanıt Durumu ---\"; \
               curl -so /dev/null -w 'http=%{{http_code}}  yanıt=%{{time_total}}s\\n' \
                 --connect-timeout 3 '{health_url}' 2>/dev/null \
                 || echo '(servis yanıt vermiyor)'; \
             fi; \
             echo; \
             echo '--- Host Bellek ---'; \
             free -h 2>/dev/null || cat /proc/meminfo | grep -E '^Mem|^Swap' | head -6"
        ),

        "cpu" => format!(
            "PID=$({pid_lookup}); \
             CID=$({docker_lookup}); \
             if [ -n \"$PID\" ]; then \
               echo \"--- Servis Process CPU (PID=$PID) ---\"; \
               ps -p \"$PID\" -o pid,%cpu,%mem,vsz,rss,time,cmd 2>/dev/null; \
             elif [ -n \"$CID\" ]; then \
               echo \"--- Container CPU ($CID) ---\"; \
               docker stats --no-stream --format \
                 'cpu={{{{.CPUPerc}}}}  mem={{{{.MemUsage}}}}  net={{{{.NetIO}}}}  pids={{{{.PIDs}}}}' \"$CID\" 2>/dev/null; \
             else \
               echo \"--- Servis Yanıt Süresi ---\"; \
               curl -so /dev/null -w 'http=%{{http_code}}  yanıt=%{{time_total}}s\\n' \
                 --connect-timeout 3 '{health_url}' 2>/dev/null \
                 || echo '(servis yanıt vermiyor)'; \
             fi; \
             echo; \
             echo '--- Host CPU Yükü ---'; \
             uptime"
        ),

        "connections" => format!(
            "echo '--- Port {port} Bağlantıları ---'; \
             ss -tn 2>/dev/null | grep ':{port}' \
             || netstat -tn 2>/dev/null | grep ':{port}' \
             || echo '(bağlantı bulunamadı)'; \
             echo; \
             echo '--- Bağlantı Özeti ---'; \
             ss -tn 2>/dev/null | grep ':{port}' | awk '{{print $1}}' | sort | uniq -c | sort -rn \
             || echo '(veri yok)'"
        ),

        "netstat" => format!(
            "echo '--- Port {port} Dinleme Durumu ---'; \
             ss -tlnp 2>/dev/null | grep ':{port}' || echo '(host namespace icerisinde dinlenmiyor - muhtemelen container)'; \
             echo; \
             echo '--- Aktif Bağlantılar ---'; \
             ss -tn 2>/dev/null | grep ':{port}' | head -20 || echo '(bağlantı yok)'; \
             echo; \
             echo '--- Container Port Mapping ---'; \
             docker ps --format '{{{{.Names}}}}  {{{{.Ports}}}}' 2>/dev/null | grep ':{port}' || echo '(docker container bulunamadı)'"
        ),

        "logs" => format!(
            "CID=$({docker_lookup}); \
             if [ -n \"$CID\" ]; then \
               echo \"--- Container Logları ($CID) ---\"; \
               docker logs --tail 50 \"$CID\" 2>&1; \
             else \
               journalctl -n 50 --no-pager 2>/dev/null \
               || ([ -f /var/log/syslog ] && tail -50 /var/log/syslog) \
               || ([ -f /var/log/messages ] && tail -50 /var/log/messages) \
               || echo 'log kaynağı bulunamadı'; \
             fi"
        ),

        "env" => format!(
            "PID=$({pid_lookup}); \
             CID=$({docker_lookup}); \
             if [ -n \"$PID\" ]; then \
               echo \"--- Process Ortam Değişkenleri (PID=$PID) ---\"; \
               cat /proc/$PID/environ 2>/dev/null | tr '\\0' '\\n' \
               | grep -v -iE 'TOKEN|SECRET|KEY|PASS|CREDENTIAL' \
               || echo '(erişim reddedildi)'; \
             elif [ -n \"$CID\" ]; then \
               echo \"--- Container Ortam Değişkenleri ($CID) ---\"; \
               docker inspect --format '{{{{range .Config.Env}}}}{{{{.}}}}\\n{{{{end}}}}' \"$CID\" 2>/dev/null \
               | grep -v -iE 'TOKEN|SECRET|KEY|PASS|CREDENTIAL' \
               || echo '(erişim reddedildi)'; \
             else \
               echo 'process veya container bulunamadı'; \
             fi"
        ),

        "uptime" => format!(
            "echo '--- Host Uptime ---'; uptime; \
             echo; \
             echo '--- Servis Yanıt Süresi ({health_url}) ---'; \
             TIME=$(curl -so /dev/null -w '%{{time_total}}' --connect-timeout 3 '{health_url}' 2>/dev/null); \
             CODE=$(curl -so /dev/null -w '%{{http_code}}' --connect-timeout 3 '{health_url}' 2>/dev/null); \
             if [ -n \"$TIME\" ] && [ \"$CODE\" != '000' ] && [ -n \"$CODE\" ]; then \
               echo \"http=$CODE  yanıt=${{TIME}}s\"; \
             else echo '(bağlantı kurulamadı)'; fi"
        ),

        "disk" => "echo '--- Disk Kullanımı ---'; \
             df -h / 2>/dev/null; \
             echo; \
             echo '--- Inode Kullanımı ---'; \
             df -i / 2>/dev/null | head -3"
            .to_string(),

        _ => {
            return Err(format!(
                "bilinmeyen komut: '{input}'\nKullanılabilir komutlar: \
                 status, health, metrics, ps, pid, mem, cpu, connections, \
                 logs, env, uptime, disk, netstat, help"
            ));
        }
    };

    Ok(cmd)
}

const HELP_TEXT: &str = "echo 'Kullanılabilir komutlar:\n\
       status      — health endpoint durumu\n\
       health      — health endpoint yanıtı\n\
       metrics     — /metrics çıktısı\n\
       ps | proc   — servise ait process / container\n\
       pid         — process ID veya container ID\n\
       mem         — bellek kullanımı\n\
       cpu         — CPU kullanımı\n\
       connections — aktif bağlantı sayısı\n\
       logs        — son 50 sistem logu\n\
       env         — process / container ortam değişkenleri\n\
       uptime      — host uptime + port yanıt süresi\n\
       disk        — disk kullanımı\n\
       netstat     — port ağ durumu\n\
       help        — bu liste'";

#[cfg(test)]
mod tests {
    use super::*;
    use clap::Parser;

    fn cfg() -> Config {
        Config::parse_from([
            "nanonet-agent",
            "--backend",
            "ws://localhost:8080",
            "--service-id",
            "00000000-0000-0000-0000-000000000000",
            "--host",
            "127.0.0.1",
            "--port",
            "9000",
        ])
    }

    #[test]
    fn help_returns_template() {
        let s = build_service_command("help", &cfg()).unwrap();
        assert!(s.contains("Kullanılabilir komutlar"));
    }

    #[test]
    fn status_includes_health_url() {
        let s = build_service_command("status", &cfg()).unwrap();
        assert!(s.contains("http://127.0.0.1:9000/health"));
    }

    #[test]
    fn metrics_requires_endpoint_config() {
        let err = build_service_command("metrics", &cfg()).unwrap_err();
        assert!(err.contains("NANONET_METRICS_ENDPOINT"));
    }

    #[test]
    fn metrics_uses_configured_endpoint() {
        let mut c = cfg();
        c.metrics_endpoint = Some("http://app:8000/metrics".into());
        let s = build_service_command("metrics", &c).unwrap();
        assert!(s.contains("http://app:8000/metrics"));
    }

    #[test]
    fn unknown_keyword_is_rejected_with_help_hint() {
        let err = build_service_command("foobar", &cfg()).unwrap_err();
        assert!(err.contains("bilinmeyen komut"));
        assert!(err.contains("status"));
    }

    #[test]
    fn case_insensitive_keyword() {
        let s = build_service_command("STATUS", &cfg()).unwrap();
        assert!(s.contains("durum="));
    }

    #[test]
    fn extra_arguments_after_keyword_are_ignored() {
        // Sadece ilk kelime keyword olarak alınır.
        let s = build_service_command("ps something", &cfg()).unwrap();
        assert!(s.contains("ps -p"));
    }
}
