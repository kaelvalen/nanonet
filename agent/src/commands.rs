use serde::{Deserialize, Serialize};
use std::time::Duration;
use tokio::process::Command as TokioCommand;

use crate::config::Config;

/// Backend'den gelen düz JSON komut yapısı.
/// Backend şu formatı gönderiyor:
/// {"type":"command","command_id":"...","action":"restart","timeout_sec":30}
#[derive(Debug, Deserialize)]
pub struct IncomingCommand {
    pub command_id: String,
    pub action: String,
    /// restart komutu için (saniye)
    pub timeout_sec: Option<u64>,
    /// stop komutu için
    pub graceful: Option<bool>,
    /// exec komutu için shell komutu
    pub command: Option<String>,
    /// scale komutu için instance sayısı
    pub instances: Option<u32>,
    /// load balancing stratejisi
    pub strategy: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CommandAck {
    #[serde(rename = "type")]
    pub msg_type: String,
    pub command_id: String,
}

#[derive(Debug, Serialize)]
pub struct CommandResult {
    #[serde(rename = "type")]
    pub msg_type: String,
    pub command_id: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output: Option<String>,
}

impl IncomingCommand {
    pub fn ack_json(&self) -> String {
        serde_json::to_string(&CommandAck {
            msg_type: "ack".to_string(),
            command_id: self.command_id.clone(),
        })
        .unwrap_or_default()
    }

    pub fn result_json(
        &self,
        success: bool,
        error: Option<String>,
        output: Option<String>,
    ) -> String {
        serde_json::to_string(&CommandResult {
            msg_type: "result".to_string(),
            command_id: self.command_id.clone(),
            status: if success { "success" } else { "failed" }.to_string(),
            error,
            output,
        })
        .unwrap_or_default()
    }
}

/// İzin verilen komut listesi (allowlist). Bu liste dışında hiçbir komut çalıştırılmaz.
const ALLOWED_ACTIONS: &[&str] = &["ping", "restart", "stop", "start", "exec", "scale"];

/// Komutu çalıştırır. Yalnızca allowlist komutları kabul eder.
/// Arbitrary shell execution kesinlikle yasaktır.
pub async fn execute(cmd: &IncomingCommand, config: &Config) -> Result<Option<String>, String> {
    if !ALLOWED_ACTIONS.contains(&cmd.action.as_str()) {
        tracing::warn!(
            "[{}] Allowlist dışı komut reddedildi: {}",
            cmd.command_id,
            cmd.action
        );
        return Err(format!("izin verilmeyen komut: {}", cmd.action));
    }

    match cmd.action.as_str() {
        "ping" => {
            tracing::info!("[{}] Ping alındı", cmd.command_id);
            Ok(None)
        }

        "restart" => {
            let timeout = cmd.timeout_sec.unwrap_or(30);
            match &config.restart_cmd {
                Some(restart_cmd) => {
                    tracing::info!(
                        "[{}] Restart komutu çalıştırılıyor (timeout: {}s)",
                        cmd.command_id,
                        timeout,
                    );
                    run_shell(restart_cmd, timeout).await
                }
                None => {
                    tracing::warn!(
                        "[{}] restart_cmd yapılandırılmamış — NANONET_RESTART_CMD eksik",
                        cmd.command_id
                    );
                    Err("NANONET_RESTART_CMD yapılandırılmamış".to_string())
                }
            }
        }

        "stop" => {
            let graceful = cmd.graceful.unwrap_or(true);
            match &config.stop_cmd {
                Some(stop_cmd) => {
                    tracing::info!(
                        "[{}] Stop komutu çalıştırılıyor (graceful: {})",
                        cmd.command_id,
                        graceful,
                    );
                    run_shell(stop_cmd, 30).await
                }
                None => {
                    tracing::warn!(
                        "[{}] stop_cmd yapılandırılmamış — NANONET_STOP_CMD eksik",
                        cmd.command_id
                    );
                    Err("NANONET_STOP_CMD yapılandırılmamış".to_string())
                }
            }
        }

        "start" => match &config.start_cmd {
            Some(start_cmd) => {
                tracing::info!("[{}] Start komutu çalıştırılıyor", cmd.command_id);
                run_shell(start_cmd, 60).await
            }
            None => {
                tracing::warn!(
                    "[{}] start_cmd yapılandırılmamış — NANONET_START_CMD eksik",
                    cmd.command_id
                );
                Err("NANONET_START_CMD yapılandırılmamış".to_string())
            }
        },

        "exec" => {
            let raw = match &cmd.command {
                Some(c) if !c.trim().is_empty() => c.trim().to_string(),
                _ => return Err("exec: command alanı eksik".to_string()),
            };
            let timeout = cmd.timeout_sec.unwrap_or(30);

            let shell_cmd = build_service_command(&raw, config);
            let shell_cmd = match shell_cmd {
                Ok(s) => s,
                Err(e) => return Err(e),
            };

            tracing::info!(
                "[{}] exec çalıştırılıyor: '{}' → `{}` (timeout: {}s)",
                cmd.command_id, raw, shell_cmd, timeout
            );
            run_shell(&shell_cmd, timeout).await
        }

        "scale" => {
            let instances = cmd.instances.unwrap_or(1);
            let strategy = cmd.strategy.as_deref().unwrap_or("round_robin");

            // Validate strategy against allowlist to prevent shell injection
            const ALLOWED_STRATEGIES: &[&str] =
                &["round_robin", "least_conn", "ip_hash", "random", "weighted"];
            if !ALLOWED_STRATEGIES.contains(&strategy) {
                tracing::warn!(
                    "[{}] Geçersiz strateji reddedildi: {}",
                    cmd.command_id,
                    strategy
                );
                return Err(format!(
                    "geçersiz strateji: {} — izin verilenler: {:?}",
                    strategy, ALLOWED_STRATEGIES
                ));
            }

            tracing::info!(
                "[{}] scale: {} instance, strateji: {}",
                cmd.command_id,
                instances,
                strategy
            );
            match &config.scale_cmd {
                Some(scale_cmd) => {
                    let full_cmd = format!(
                        "INSTANCES={} STRATEGY={} {}",
                        instances, strategy, scale_cmd
                    );
                    run_shell(&full_cmd, 60).await
                }
                None => Ok(Some(format!(
                    "scale acknowledged: {} instance(s), strategy={}",
                    instances, strategy
                ))),
            }
        }

        _ => unreachable!("allowlist kontrolü yukarıda yapıldı"),
    }
}

/// Kullanıcının girdiği kısa komutu servise özgü shell komutuna dönüştürür.
///
/// Desteklenen komutlar:
///   status        — servisin health endpoint durumu
///   health        — health endpoint'e HTTP isteği (yanıt body)
///   metrics       — /metrics endpoint'ten ham çıktı (varsa)
///   ps / proc     — servisle aynı porta bağlı process'ler
///   pid           — servisi dinleyen process'in PID'i
///   mem / memory  — servisin process'inin bellek kullanımı
///   cpu           — servisin process'inin CPU kullanımı
///   connections   — servisin portuna açık bağlantılar
///   logs          — son 50 satır sistem logu
///   env           — servis process'inin ortam değişkenleri (PID üzerinden)
///   uptime        — host uptime + servisin port cevap süresi
///   disk          — host disk kullanımı (servis dosyalarının bulunduğu disk)
///   netstat       — servisin portundaki ağ durumu
///   help          — kullanılabilir komutlar listesi
fn build_service_command(input: &str, config: &Config) -> Result<String, String> {
    let keyword = input.split_whitespace().next().unwrap_or("").to_lowercase();
    let host = &config.host;
    let port = config.port;
    let health_url = config.health_url();
    let metrics_url = config
        .metrics_endpoint
        .as_deref()
        .unwrap_or("")
        .to_string();

    // Servisin portunu dinleyen PID'i bul — yalnızca host process'leri için geçerli.
    // Container'da çalışan servisler için PID boş döner; komutlar buna göre fallback uygular.
    let pid_lookup = format!(
        "ss -tlnp 'sport = :{port}' 2>/dev/null | awk 'NR>1{{print}}' | grep -oP 'pid=\\K[0-9]+' | head -1"
    );

    // Container tespiti: portu dinleyen docker container bul
    let docker_lookup = format!(
        "docker ps --format '{{{{.ID}}}} {{{{.Ports}}}}' 2>/dev/null | grep ':{port}->' | awk '{{{{print $1}}}}' | head -1"
    );

    let cmd = match keyword.as_str() {
        "help" => {
            return Ok(format!(
                "echo 'Kullanılabilir komutlar:\n\
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
                   help        — bu liste'"
            ));
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
                return Err("metrics endpoint yapılandırılmamış (NANONET_METRICS_ENDPOINT)".to_string());
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

        "disk" => format!(
            "echo '--- Disk Kullanımı ---'; \
             df -h / 2>/dev/null; \
             echo; \
             echo '--- Inode Kullanımı ---'; \
             df -i / 2>/dev/null | head -3"
        ),

        _ => {
            return Err(format!(
                "bilinmeyen komut: '{input}'\nKullanılabilir komutlar: status, health, metrics, ps, pid, mem, cpu, connections, logs, env, uptime, disk, netstat, help"
            ));
        }
    };

    Ok(cmd)
}

/// Belirtilen shell komutunu çalıştırır, stdout döner.
async fn run_shell(cmd: &str, timeout_sec: u64) -> Result<Option<String>, String> {
    let result = tokio::time::timeout(
        Duration::from_secs(timeout_sec),
        TokioCommand::new("sh").arg("-c").arg(cmd).output(),
    )
    .await;

    match result {
        Ok(Ok(out)) => {
            let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();

            if out.status.success() {
                let output = if stdout.is_empty() {
                    None
                } else {
                    Some(stdout)
                };
                Ok(output)
            } else {
                let msg = if !stderr.is_empty() {
                    stderr
                } else if !stdout.is_empty() {
                    stdout
                } else {
                    format!("exit kodu: {}", out.status)
                };
                Err(msg)
            }
        }
        Ok(Err(e)) => Err(format!("Komut başlatılamadı: {}", e)),
        Err(_) => Err(format!("Zaman aşımı ({}s)", timeout_sec)),
    }
}
