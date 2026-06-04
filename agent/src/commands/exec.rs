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

/// Kullanıcının girdiği kısa komutu servise özgü kabuk komutuna dönüştürür.
///
/// Desteklenen anahtarlar:
///   status, health, metrics, ps/proc, pid, mem/memory, cpu, connections,
///   logs, env, uptime, disk, netstat, help
///
/// Üretilen komut hedef platformun kabuk diliyle yazılır: Unix'te POSIX shell
/// (`ss`/`awk`/`curl`/`/proc`...), Windows'ta PowerShell (`Get-NetTCPConnection`,
/// `Get-Process`, `Invoke-WebRequest`, CIM). [`crate::commands::runner`] doğru
/// kabuğu seçer; bu fonksiyon yalnızca o kabuğa uygun gövdeyi üretir.
pub fn build_service_command(input: &str, config: &Config) -> Result<String, String> {
    #[cfg(windows)]
    {
        build_windows(input, config)
    }
    #[cfg(not(windows))]
    {
        build_unix(input, config)
    }
}

/// POSIX shell (`sh -c`) için tanılama şablonları.
#[cfg(not(windows))]
fn build_unix(input: &str, config: &Config) -> Result<String, String> {
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

#[cfg(not(windows))]
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

// ─────────────────────────────────────────────────────────────────────────────
// Windows (PowerShell) şablonları
// ─────────────────────────────────────────────────────────────────────────────

/// PowerShell (`powershell.exe -Command`) için tanılama şablonları.
///
/// Tasarım notları:
/// - Servisin portunu dinleyen PID `Get-NetTCPConnection` ile bulunur; bulunamazsa
///   komutlar health endpoint erişilebilirliğine fallback eder.
/// - Tüm literal çıktı **ASCII** tutulur: PowerShell 5.1'in yönlendirilmiş stdout
///   kodlaması UTF-8 olmadığından Türkçe özel karakterler mojibake'e dönüşür.
/// - Hassas env değişkenleri `-notmatch` ile süzülür.
/// - PowerShell'de `$pid` otomatik (salt-okunur) değişkendir; `$procId` kullanılır.
#[cfg(windows)]
fn build_windows(input: &str, config: &Config) -> Result<String, String> {
    let keyword = input.split_whitespace().next().unwrap_or("").to_lowercase();
    let metrics_url = config.metrics_endpoint.as_deref().unwrap_or("");

    let tmpl: &str = match keyword.as_str() {
        "help" => return Ok(HELP_TEXT_WIN.to_string()),
        "status" => STATUS_WIN,
        "health" => HEALTH_WIN,
        "metrics" => {
            if metrics_url.is_empty() {
                return Err(
                    "metrics endpoint yapılandırılmamış (NANONET_METRICS_ENDPOINT)".to_string(),
                );
            }
            METRICS_WIN
        }
        "ps" | "proc" => PS_WIN,
        "pid" => PID_WIN,
        "mem" | "memory" => MEM_WIN,
        "cpu" => CPU_WIN,
        "connections" => CONNECTIONS_WIN,
        "netstat" => NETSTAT_WIN,
        "logs" => LOGS_WIN,
        "env" => ENV_WIN,
        "uptime" => UPTIME_WIN,
        "disk" => DISK_WIN,
        _ => {
            return Err(format!(
                "bilinmeyen komut: '{input}'\nKullanılabilir komutlar: \
                 status, health, metrics, ps, pid, mem, cpu, connections, \
                 logs, env, uptime, disk, netstat, help"
            ));
        }
    };

    // Şablon placeholder'larını config değerleriyle doldur. host/port/url'ler
    // operatör tarafından yapılandırılır (güven sınırı içi); yine de tek-tırnak
    // bağlamlarına gömülür.
    let cmd = tmpl
        .replace("__HOST__", &config.host)
        .replace("__PORT__", &config.port.to_string())
        .replace("__HEALTH__", &config.health_url())
        .replace("__METRICS__", metrics_url);

    Ok(cmd)
}

#[cfg(windows)]
const STATUS_WIN: &str = r#"
try { $r = Invoke-WebRequest -Uri '__HEALTH__' -TimeoutSec 3 -UseBasicParsing; $code = [int]$r.StatusCode } catch { $code = [int]$_.Exception.Response.StatusCode }
Write-Output "host=__HOST__  port=__PORT__  endpoint=__HEALTH__"
if ($code -eq 200) { Write-Output "durum=UP  http=$code" } elseif (-not $code) { Write-Output "durum=DOWN  (baglanti reddedildi)" } else { Write-Output "durum=DEGRADED  http=$code" }
"#;

#[cfg(windows)]
const HEALTH_WIN: &str = r#"
try { (Invoke-WebRequest -Uri '__HEALTH__' -TimeoutSec 5 -UseBasicParsing).Content } catch { Write-Output '(health endpoint yanit vermedi)' }
"#;

#[cfg(windows)]
const METRICS_WIN: &str = r#"
try { (Invoke-WebRequest -Uri '__METRICS__' -TimeoutSec 5 -UseBasicParsing).Content } catch { Write-Output '(metrics endpoint yanit vermedi)' }
"#;

#[cfg(windows)]
const PS_WIN: &str = r#"
$procId = (Get-NetTCPConnection -LocalPort __PORT__ -State Listen -EA SilentlyContinue | Select-Object -First 1).OwningProcess
if ($procId) {
  (Get-Process -Id $procId -EA SilentlyContinue | Format-List Id, ProcessName, CPU, @{N='WS_MB';E={[math]::Round($_.WorkingSet64/1MB,1)}}, StartTime, Path | Out-String).Trim()
} else {
  Write-Output "host=__HOST__:__PORT__ (port erisilebilirlik kontrolu)"
  try { $sw=[Diagnostics.Stopwatch]::StartNew(); $r=Invoke-WebRequest -Uri '__HEALTH__' -TimeoutSec 3 -UseBasicParsing; $sw.Stop(); Write-Output ("http={0}  time={1}ms" -f [int]$r.StatusCode,$sw.ElapsedMilliseconds) } catch { Write-Output 'servis yanit vermiyor' }
}
"#;

#[cfg(windows)]
const PID_WIN: &str = r#"
$procId = (Get-NetTCPConnection -LocalPort __PORT__ -State Listen -EA SilentlyContinue | Select-Object -First 1).OwningProcess
if ($procId) {
  $p = Get-Process -Id $procId -EA SilentlyContinue
  Write-Output "PID=$procId"
  if ($p) { Write-Output ("name={0}  path={1}" -f $p.ProcessName, $p.Path) }
} else {
  Write-Output 'host process bulunamadi (port dinlenmiyor)'
  Write-Output 'not: servis uzak host veya farkli namespace icinde calisiyor olabilir'
}
"#;

#[cfg(windows)]
const MEM_WIN: &str = r#"
$procId = (Get-NetTCPConnection -LocalPort __PORT__ -State Listen -EA SilentlyContinue | Select-Object -First 1).OwningProcess
if ($procId) {
  $p = Get-Process -Id $procId -EA SilentlyContinue
  if ($p) { Write-Output "--- Servis Process Bellegi (PID=$procId) ---"; Write-Output ("WorkingSet={0:N1} MB  Private={1:N1} MB  Virtual={2:N1} MB" -f ($p.WorkingSet64/1MB),($p.PrivateMemorySize64/1MB),($p.VirtualMemorySize64/1MB)) }
} else {
  Write-Output '--- Servis Yanit Durumu ---'
  try { $r=Invoke-WebRequest -Uri '__HEALTH__' -TimeoutSec 3 -UseBasicParsing; Write-Output ("http={0}" -f [int]$r.StatusCode) } catch { Write-Output '(servis yanit vermiyor)' }
}
Write-Output ''
Write-Output '--- Host Bellek ---'
$os = Get-CimInstance Win32_OperatingSystem
Write-Output ("Toplam={0:N1} GB  Bos={1:N1} GB" -f ($os.TotalVisibleMemorySize/1MB),($os.FreePhysicalMemory/1MB))
"#;

#[cfg(windows)]
const CPU_WIN: &str = r#"
$procId = (Get-NetTCPConnection -LocalPort __PORT__ -State Listen -EA SilentlyContinue | Select-Object -First 1).OwningProcess
if ($procId) {
  $p = Get-Process -Id $procId -EA SilentlyContinue
  if ($p) { Write-Output "--- Servis Process CPU (PID=$procId) ---"; Write-Output ("CPU(s)={0}  Threads={1}  WS={2:N1} MB" -f $p.CPU,$p.Threads.Count,($p.WorkingSet64/1MB)) }
} else {
  Write-Output '--- Servis Yanit Suresi ---'
  try { $sw=[Diagnostics.Stopwatch]::StartNew(); $r=Invoke-WebRequest -Uri '__HEALTH__' -TimeoutSec 3 -UseBasicParsing; $sw.Stop(); Write-Output ("http={0}  yanit={1}ms" -f [int]$r.StatusCode,$sw.ElapsedMilliseconds) } catch { Write-Output '(servis yanit vermiyor)' }
}
Write-Output ''
Write-Output '--- Host CPU Yuku ---'
Write-Output ("CPU Kullanim= {0}%" -f (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average)
"#;

#[cfg(windows)]
const CONNECTIONS_WIN: &str = r#"
Write-Output '--- Port __PORT__ Baglantilari ---'
$c = Get-NetTCPConnection -LocalPort __PORT__ -EA SilentlyContinue
if ($c) { ($c | Format-Table -AutoSize LocalAddress,LocalPort,RemoteAddress,RemotePort,State | Out-String).Trim() } else { Write-Output '(baglanti bulunamadi)' }
Write-Output ''
Write-Output '--- Baglanti Ozeti ---'
if ($c) { $c | Group-Object State | ForEach-Object { Write-Output ("{0}  {1}" -f $_.Count, $_.Name) } } else { Write-Output '(veri yok)' }
"#;

#[cfg(windows)]
const NETSTAT_WIN: &str = r#"
Write-Output '--- Port __PORT__ Dinleme Durumu ---'
$l = Get-NetTCPConnection -LocalPort __PORT__ -State Listen -EA SilentlyContinue
if ($l) { ($l | Format-Table -AutoSize LocalAddress,LocalPort,State,OwningProcess | Out-String).Trim() } else { Write-Output '(host uzerinde dinlenmiyor)' }
Write-Output ''
Write-Output '--- Aktif Baglantilar ---'
$a = Get-NetTCPConnection -LocalPort __PORT__ -EA SilentlyContinue | Select-Object -First 20
if ($a) { ($a | Format-Table -AutoSize LocalAddress,LocalPort,RemoteAddress,RemotePort,State | Out-String).Trim() } else { Write-Output '(baglanti yok)' }
"#;

#[cfg(windows)]
const LOGS_WIN: &str = r#"
try { (Get-WinEvent -LogName Application -MaxEvents 50 -EA Stop | Select-Object TimeCreated, LevelDisplayName, ProviderName, Message | Format-Table -AutoSize -Wrap | Out-String).Trim() } catch { Write-Output 'log kaynagi bulunamadi (Event Log erisimi yok)' }
"#;

#[cfg(windows)]
const ENV_WIN: &str = r#"
Write-Output '--- Ortam Degiskenleri (agent process kapsami) ---'
Write-Output 'not: Windows''ta hedef process''in ortami dogrudan okunamaz; liste agent kapsamidir'
Get-ChildItem Env: | Where-Object { $_.Name -notmatch 'TOKEN|SECRET|KEY|PASS|CREDENTIAL' } | Sort-Object Name | ForEach-Object { Write-Output ("{0}={1}" -f $_.Name, $_.Value) }
"#;

#[cfg(windows)]
const UPTIME_WIN: &str = r#"
Write-Output '--- Host Uptime ---'
$os = Get-CimInstance Win32_OperatingSystem
$up = (Get-Date) - $os.LastBootUpTime
Write-Output ("Uptime= {0}g {1}s {2}d" -f $up.Days, $up.Hours, $up.Minutes)
Write-Output ''
Write-Output '--- Servis Yanit Suresi (__HEALTH__) ---'
try { $sw=[Diagnostics.Stopwatch]::StartNew(); $r=Invoke-WebRequest -Uri '__HEALTH__' -TimeoutSec 3 -UseBasicParsing; $sw.Stop(); Write-Output ("http={0}  yanit={1}ms" -f [int]$r.StatusCode,$sw.ElapsedMilliseconds) } catch { Write-Output '(baglanti kurulamadi)' }
"#;

#[cfg(windows)]
const DISK_WIN: &str = r#"
Write-Output '--- Disk Kullanimi ---'
Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Used -ne $null } | ForEach-Object { Write-Output ("{0}:  Kullanilan={1:N1} GB  Bos={2:N1} GB" -f $_.Name, ($_.Used/1GB), ($_.Free/1GB)) }
"#;

#[cfg(windows)]
const HELP_TEXT_WIN: &str = "Write-Output \"Kullanilabilir komutlar:`n\
       status      - health endpoint durumu`n\
       health      - health endpoint yaniti`n\
       metrics     - /metrics ciktisi`n\
       ps | proc   - servise ait process`n\
       pid         - process ID`n\
       mem         - bellek kullanimi`n\
       cpu         - CPU kullanimi`n\
       connections - aktif baglanti sayisi`n\
       logs        - son 50 Event Log kaydi`n\
       env         - ortam degiskenleri (agent kapsami)`n\
       uptime      - host uptime + port yanit suresi`n\
       disk        - disk kullanimi`n\
       netstat     - port ag durumu`n\
       help        - bu liste\"";

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
        // Unix "Kullanılabilir", Windows "Kullanilabilir" — ortak "komutlar".
        assert!(s.contains("komutlar"));
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

    #[cfg(not(windows))]
    #[test]
    fn extra_arguments_after_keyword_are_ignored() {
        // Sadece ilk kelime keyword olarak alınır.
        let s = build_service_command("ps something", &cfg()).unwrap();
        assert!(s.contains("ps -p"));
    }

    #[cfg(windows)]
    #[test]
    fn extra_arguments_after_keyword_are_ignored_win() {
        // Sadece ilk kelime keyword olarak alınır; Windows'ta Get-Process üretir.
        let s = build_service_command("ps something", &cfg()).unwrap();
        assert!(s.contains("Get-Process"));
    }

    #[cfg(windows)]
    #[test]
    fn windows_port_is_substituted() {
        // Placeholder'lar gerçekten dolduruluyor mu? (__PORT__ kalmamalı)
        let s = build_service_command("netstat", &cfg()).unwrap();
        assert!(s.contains("LocalPort 9000"));
        assert!(!s.contains("__PORT__"));
    }
}
