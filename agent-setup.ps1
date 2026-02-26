#Requires -Version 5.1
<#
.SYNOPSIS
    NanoNet Agent Setup — Windows Kurulum Sihirbazı

.DESCRIPTION
    NanoNet agent'ını Windows sistemlere kurar ve yapılandırır.
    Desteklenen: Windows 10/11, Windows Server 2019+, ARM64

.PARAMETER Backend
    Backend URL'i (varsayılan: http://localhost:8080)

.PARAMETER EnvFile
    .env dosya yolu (varsayılan: script dizini\.env)

.PARAMETER DownloadBinary
    GitHub Releases'tan binary indir

.PARAMETER Version
    Binary sürümü (varsayılan: latest)

.PARAMETER InstallDir
    Binary kurulum dizini (varsayılan: $env:LOCALAPPDATA\NanoNet\bin)

.PARAMETER NoColor
    Renksiz çıktı

.EXAMPLE
    .\agent-setup.ps1
    .\agent-setup.ps1 -Backend http://myserver:8080 -DownloadBinary
    .\agent-setup.ps1 -Backend http://myserver:8080 -Version v1.2.3
#>

[CmdletBinding()]
param(
    [string]$Backend      = "http://localhost:8080",
    [string]$EnvFile      = "",
    [switch]$DownloadBinary,
    [string]$Version      = "latest",
    [string]$InstallDir   = "",
    [switch]$NoColor
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Renk yardımcıları ─────────────────────────────────────────────────────────
function Write-Info    { param([string]$Msg) Write-Host "  $Msg" -ForegroundColor $(if ($NoColor) { 'White' } else { 'Cyan' }) }
function Write-Success { param([string]$Msg) Write-Host "✔ $Msg" -ForegroundColor $(if ($NoColor) { 'White' } else { 'Green' }) }
function Write-Warn    { param([string]$Msg) Write-Host "⚠ $Msg" -ForegroundColor $(if ($NoColor) { 'White' } else { 'Yellow' }) }
function Write-Step    { param([string]$Msg) Write-Host "`n$Msg" -ForegroundColor $(if ($NoColor) { 'White' } else { 'White' }) -BackgroundColor $(if ($NoColor) { 'Black' } else { 'DarkBlue' }) }
function Write-Err     {
    param([string]$Msg)
    Write-Host "✖ $Msg" -ForegroundColor Red
    exit 1
}

# ── Platform tespiti ──────────────────────────────────────────────────────────
function Get-Platform {
    $arch = [System.Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture
    switch ($arch) {
        'X64'   { return "x86_64-pc-windows-msvc" }
        'Arm64' { return "aarch64-pc-windows-msvc" }
        default { Write-Err "Desteklenmeyen mimari: $arch" }
    }
}

function Get-OSInfo {
    $os = [System.Environment]::OSVersion
    $isWsl = $false
    # WSL içinde mi?
    if (Test-Path "/proc/version") {
        $wslCheck = Get-Content "/proc/version" -ErrorAction SilentlyContinue
        if ($wslCheck -match "microsoft|WSL") { $isWsl = $true }
    }
    return @{
        Version = $os.VersionString
        IsWsl   = $isWsl
        Arch    = [System.Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture.ToString()
    }
}

# ── Bağımlılık kontrolü ───────────────────────────────────────────────────────
function Assert-Command {
    param([string]$Cmd, [string]$InstallHint)
    if (-not (Get-Command $Cmd -ErrorAction SilentlyContinue)) {
        Write-Err "'$Cmd' bulunamadı.`nKurmak için: $InstallHint"
    }
}

function Install-Jq {
    Write-Info "jq indiriliyor..."
    $jqUrl = "https://github.com/stedolan/jq/releases/latest/download/jq-win64.exe"
    $jqPath = "$env:LOCALAPPDATA\NanoNet\bin\jq.exe"
    New-Item -ItemType Directory -Force -Path (Split-Path $jqPath) | Out-Null
    try {
        Invoke-WebRequest -Uri $jqUrl -OutFile $jqPath -UseBasicParsing
        $env:PATH = "$env:LOCALAPPDATA\NanoNet\bin;$env:PATH"
        Write-Success "jq kuruldu: $jqPath"
    } catch {
        Write-Warn "jq indirilemedi. Devam ediliyor (JSON parse manuel yapılacak)..."
    }
}

# ── HTTP yardımcıları ─────────────────────────────────────────────────────────
function Invoke-Api {
    param(
        [string]$Url,
        [string]$Method = "GET",
        [hashtable]$Headers = @{},
        [object]$Body = $null,
        [int]$TimeoutSec = 10
    )
    $Headers["Content-Type"] = "application/json"
    $params = @{
        Uri             = $Url
        Method          = $Method
        Headers         = $Headers
        TimeoutSec      = $TimeoutSec
        UseBasicParsing = $true
    }
    if ($Body) {
        $params.Body = ($Body | ConvertTo-Json -Compress)
    }
    try {
        $resp = Invoke-WebRequest @params
        return ($resp.Content | ConvertFrom-Json)
    } catch [System.Net.WebException] {
        $statusCode = [int]$_.Exception.Response.StatusCode
        $errBody = ""
        try {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $errBody = $reader.ReadToEnd() | ConvertFrom-Json
        } catch {}
        return @{ StatusCode = $statusCode; Error = $errBody }
    }
}

# ── .env okuma/yazma ──────────────────────────────────────────────────────────
function Read-EnvFile {
    param([string]$Path)
    $result = @{}
    if (Test-Path $Path) {
        Get-Content $Path | ForEach-Object {
            if ($_ -match '^([^#=]+)=(.*)$') {
                $result[$Matches[1].Trim()] = $Matches[2].Trim().Trim('"').Trim("'")
            }
        }
    }
    return $result
}

function Update-EnvFile {
    param([string]$Path, [string]$Key, [string]$Value)
    if (-not (Test-Path $Path)) { return }
    $content = Get-Content $Path -Raw
    if ($content -match "(?m)^$Key=") {
        $content = $content -replace "(?m)^$Key=.*", "$Key=$Value"
    } else {
        $content += "`n$Key=$Value"
    }
    Set-Content -Path $Path -Value $content -NoNewline
}

# ── Binary indirme + checksum ─────────────────────────────────────────────────
function Install-AgentBinary {
    param([string]$Ver, [string]$Dir)
    $repo    = "kaelvalen/nanonet"
    $target  = Get-Platform
    $binName = "nanonet-agent.exe"

    Write-Info "Binary indiriliyor ($target, $Ver)..."

    # Latest tag al
    if ($Ver -eq "latest") {
        try {
            $release = Invoke-RestMethod "https://api.github.com/repos/$repo/releases/latest" -TimeoutSec 10
            $Ver = $release.tag_name
        } catch {
            Write-Warn "GitHub release tag alınamadı. Sürüm belirtin: -Version v1.0.0"
            return $false
        }
    }

    $baseUrl  = "https://github.com/$repo/releases/download/$Ver"
    $archive  = "nanonet-agent-$target.zip"
    $tmpDir   = Join-Path $env:TEMP "nanonet-setup-$(Get-Random)"
    New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null

    try {
        # Binary indir
        $archivePath = Join-Path $tmpDir $archive
        Write-Info "İndiriliyor: $baseUrl/$archive"
        Invoke-WebRequest "$baseUrl/$archive" -OutFile $archivePath -UseBasicParsing

        # Checksum doğrula
        $checksumUrl = "$baseUrl/$archive.sha256"
        try {
            $checksumFile = Join-Path $tmpDir "$archive.sha256"
            Invoke-WebRequest $checksumUrl -OutFile $checksumFile -UseBasicParsing
            $expected = (Get-Content $checksumFile).Split(' ')[0].ToLower()
            $actual   = (Get-FileHash $archivePath -Algorithm SHA256).Hash.ToLower()
            if ($expected -ne $actual) {
                Remove-Item $tmpDir -Recurse -Force
                Write-Err "Checksum doğrulaması başarısız!`n  Beklenen: $expected`n  Gerçek:   $actual"
            }
            Write-Success "Checksum doğrulandı"
        } catch {
            Write-Warn "Checksum dosyası bulunamadı — doğrulama atlandı"
        }

        # Arşivi aç
        Expand-Archive -Path $archivePath -DestinationPath $tmpDir -Force

        # Kur
        New-Item -ItemType Directory -Force -Path $Dir | Out-Null
        $dest = Join-Path $Dir $binName
        Move-Item (Join-Path $tmpDir $binName) $dest -Force

        Write-Success "Binary kuruldu: $dest"

        # PATH'e ekle (kullanıcı düzeyinde)
        $userPath = [System.Environment]::GetEnvironmentVariable("PATH", "User")
        if ($userPath -notlike "*$Dir*") {
            [System.Environment]::SetEnvironmentVariable("PATH", "$Dir;$userPath", "User")
            $env:PATH = "$Dir;$env:PATH"
            Write-Info "PATH güncellendi (yeni terminalde aktif olur)"
        }

        return $true
    } catch {
        Write-Warn "Binary indirme hatası: $_"
        return $false
    } finally {
        Remove-Item $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# ── Ana akış ─────────────────────────────────────────────────────────────────

# Varsayılan değerler
if (-not $InstallDir) { $InstallDir = "$env:LOCALAPPDATA\NanoNet\bin" }
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $EnvFile)    { $EnvFile = Join-Path $ScriptDir ".env" }

$osInfo  = Get-OSInfo
$platform = Get-Platform

Write-Host ""
Write-Host "╔════════════════════════════════════════════╗" -ForegroundColor $(if ($NoColor) { 'White' } else { 'Cyan' })
Write-Host "║     NanoNet Agent Setup  —  v2  (Windows) ║" -ForegroundColor $(if ($NoColor) { 'White' } else { 'Cyan' })
Write-Host "╚════════════════════════════════════════════╝" -ForegroundColor $(if ($NoColor) { 'White' } else { 'Cyan' })
Write-Host ""
Write-Host "  Platform  : Windows / $($osInfo.Arch)" -ForegroundColor DarkGray
if ($osInfo.IsWsl) { Write-Host "  Ortam     : WSL" -ForegroundColor DarkGray }
Write-Host "  Backend   : $Backend" -ForegroundColor DarkGray
Write-Host "  .env      : $EnvFile" -ForegroundColor DarkGray
Write-Host "  Target    : $platform" -ForegroundColor DarkGray
Write-Host ""

# ── Adım 1: Bağımlılıklar ────────────────────────────────────────────────────
Write-Step " 1/5  Bağımlılıklar kontrol ediliyor... "

# jq yoksa indir
if (-not (Get-Command "jq" -ErrorAction SilentlyContinue)) {
    Install-Jq
}
Write-Success "Bağımlılıklar hazır"

# ── Adım 2: Backend bağlantısı ───────────────────────────────────────────────
Write-Step " 2/5  Backend bağlantısı kontrol ediliyor... "
try {
    $health = Invoke-RestMethod "$Backend/health" -TimeoutSec 5 -UseBasicParsing
    if (-not $health.status) {
        Write-Err "Bu bir NanoNet backend değil ($Backend).`n  Yanlış port? Varsayılan: 8080`n  Örnek: .\agent-setup.ps1 -Backend http://localhost:8080"
    }
    Write-Success "Backend çalışıyor ($($health.status))"
} catch {
    Write-Err "Backend'e ulaşılamıyor: $Backend`n  Stack'i başlattığınızdan emin olun: docker compose up -d`n  Hata: $_"
}

# ── Adım 3: Kimlik doğrulama ─────────────────────────────────────────────────
Write-Step " 3/5  Kimlik doğrulama... "

$envVars            = Read-EnvFile $EnvFile
$cachedAccessToken  = $envVars["ACCESS_TOKEN"]
$cachedAgentToken   = $envVars["AGENT_TOKEN"]
$cachedEmail        = $envVars["AGENT_EMAIL"]
$accessToken        = ""

if ($cachedAccessToken) {
    Write-Info "Kayıtlı token test ediliyor$(if ($cachedEmail) { " ($cachedEmail)" })..."
    try {
        $testResp = Invoke-RestMethod "$Backend/api/v1/services" `
            -Headers @{ Authorization = "Bearer $cachedAccessToken" } `
            -TimeoutSec 5 -UseBasicParsing
        if ($testResp.success) {
            Write-Success "Token geçerli — giriş atlanıyor"
            $accessToken = $cachedAccessToken
        }
    } catch {
        Write-Warn "Token geçersiz veya süresi dolmuş, yeniden giriş gerekiyor"
    }
}

if (-not $accessToken) {
    Write-Host ""
    Write-Host "  Hesap seçin:" -ForegroundColor White
    Write-Host "    1) Yeni hesap oluştur (register)"
    Write-Host "    2) Mevcut hesaba giriş yap (login)"
    $authMode = Read-Host "  Seçim [1/2]"
    Write-Host ""

    if ($cachedEmail) {
        $inputEmail = Read-Host "  E-posta [$cachedEmail]"
        $email = if ($inputEmail) { $inputEmail } else { $cachedEmail }
    } else {
        $email = Read-Host "  E-posta"
    }

    # Güvenli parola okuma
    $securePass = Read-Host "  Şifre (min 12 karakter)" -AsSecureString
    $bstr       = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePass)
    $password   = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

    if ($password.Length -lt 12) {
        Write-Err "Şifre en az 12 karakter olmalıdır (güvenlik standardı)"
    }

    $authResp = $null

    if ($authMode -eq "1") {
        Write-Info "Kayıt yapılıyor..."
        try {
            $authResp = Invoke-Api "$Backend/api/v1/auth/register" "POST" @{} @{
                email    = $email
                password = $password
            }
        } catch {
            Write-Warn "Bu e-posta zaten kayıtlı olabilir, giriş deneniyor..."
            $authMode = "2"
        }
    }

    if ($authMode -eq "2") {
        Write-Info "Giriş yapılıyor..."
        $authResp = Invoke-Api "$Backend/api/v1/auth/login" "POST" @{} @{
            email    = $email
            password = $password
        }
        if ($authResp.StatusCode -and $authResp.StatusCode -ne 200) {
            $errMsg = $authResp.Error.error ?? $authResp.Error.message ?? "E-posta veya şifre yanlış"
            Write-Err "Giriş başarısız ($($authResp.StatusCode)): $errMsg"
        }
    }

    $accessToken = $authResp.data.tokens.access_token
    if (-not $accessToken) { Write-Err "Token alınamadı. Yanıt:`n$($authResp | ConvertTo-Json)" }
    Write-Success "Kimlik doğrulama başarılı"
    Update-EnvFile $EnvFile "AGENT_EMAIL" $email
}

Write-Host ""

# ── Adım 4: Agent token ──────────────────────────────────────────────────────
Write-Step " 4/5  Agent token... "
$agentToken = ""

if ($cachedAccessToken -and ($accessToken -eq $cachedAccessToken) -and $cachedAgentToken) {
    $agentToken = $cachedAgentToken
    Write-Success "Mevcut agent token kullanılıyor"
} else {
    Write-Info "Agent token alınıyor..."
    try {
        $tokenResp  = Invoke-Api "$Backend/api/v1/auth/agent-token" "POST" @{
            Authorization = "Bearer $accessToken"
        }
        $agentToken = $tokenResp.data.agent_token
    } catch {}

    if (-not $agentToken) {
        Write-Warn "Agent token alınamadı, access token kullanılıyor (24 saat geçerli)"
        $agentToken = $accessToken
    } else {
        Write-Success "Agent token alındı"
    }
}

Write-Host ""

# ── Adım 5: Servis seç / oluştur ─────────────────────────────────────────────
Write-Step " 5/5  Servis yapılandırması... "

$svcResp  = Invoke-Api "$Backend/api/v1/services" "GET" @{ Authorization = "Bearer $accessToken" }
$services = $svcResp.data
$svcCount = $services.Count

Write-Host ""
Write-Host "  Servis seçin:" -ForegroundColor White

$serviceId = ""; $serviceName = ""; $serviceHost = ""; $servicePort = 8080
$serviceEndpoint = "/health"; $servicePoll = 10

if ($svcCount -gt 0) {
    for ($i = 0; $i -lt $svcCount; $i++) {
        $svc = $services[$i]
        Write-Host ("  {0}) {1}  {2}  [{3}]" -f ($i+1), $svc.id.Substring(0,8), $svc.name, $svc.status)
    }
    Write-Host "  $($svcCount+1)) Yeni servis oluştur"
    [int]$svcChoice = Read-Host "  Seçim [1-$($svcCount+1)]"
    Write-Host ""

    if ($svcChoice -ge 1 -and $svcChoice -le $svcCount) {
        $selected        = $services[$svcChoice - 1]
        $serviceId       = $selected.id
        $serviceName     = $selected.name
        $serviceHost     = $selected.host
        $servicePort     = $selected.port
        $serviceEndpoint = $selected.health_endpoint
        $servicePoll     = $selected.poll_interval_sec
        Write-Success "Seçilen servis: $serviceName"
    } else {
        $svcChoice = $svcCount + 1
    }
}

if (-not $serviceId) {
    Write-Host "  Yeni servis bilgileri:" -ForegroundColor White
    $serviceName     = Read-Host "    Servis adı          "
    $serviceHost     = Read-Host "    İzlenecek host      "
    [int]$servicePort = Read-Host "    İzlenecek port      "
    $epInput         = Read-Host "    Health endpoint [/health]"
    $serviceEndpoint = if ($epInput) { $epInput } else { "/health" }
    $pollInput       = Read-Host "    Metrik aralığı (s) [10]"
    [int]$servicePoll = if ($pollInput) { [int]$pollInput } else { 10 }
    Write-Host ""

    Write-Info "Servis oluşturuluyor..."
    $createResp = Invoke-Api "$Backend/api/v1/services" "POST" @{
        Authorization = "Bearer $accessToken"
    } @{
        name              = $serviceName
        host              = $serviceHost
        port              = $servicePort
        health_endpoint   = $serviceEndpoint
        poll_interval_sec = $servicePoll
    }

    $serviceId = $createResp.data.id
    if (-not $serviceId) { Write-Err "Servis ID alınamadı.`nYanıt: $($createResp | ConvertTo-Json)" }
    Write-Success "Servis oluşturuldu: $serviceId"
}

Write-Host ""

# ── .env güncelle ─────────────────────────────────────────────────────────────
if (Test-Path $EnvFile) {
    Write-Info ".env güncelleniyor: $EnvFile"
    Update-EnvFile $EnvFile "ACCESS_TOKEN"          $accessToken
    Update-EnvFile $EnvFile "AGENT_SERVICE_ID"      $serviceId
    Update-EnvFile $EnvFile "AGENT_TOKEN"           $agentToken
    Update-EnvFile $EnvFile "AGENT_TARGET_HOST"     $serviceHost
    Update-EnvFile $EnvFile "AGENT_TARGET_PORT"     $servicePort
    Update-EnvFile $EnvFile "AGENT_HEALTH_ENDPOINT" $serviceEndpoint
    Update-EnvFile $EnvFile "AGENT_POLL_INTERVAL"   $servicePoll
    Write-Success ".env güncellendi"
} else {
    Write-Warn ".env dosyası bulunamadı ($EnvFile) — değerleri manuel ekleyin:"
    Write-Host ""
    Write-Host "  AGENT_SERVICE_ID=$serviceId"
    Write-Host "  AGENT_TOKEN=$agentToken"
    Write-Host "  AGENT_TARGET_HOST=$serviceHost"
    Write-Host "  AGENT_TARGET_PORT=$servicePort"
    Write-Host "  AGENT_HEALTH_ENDPOINT=$serviceEndpoint"
    Write-Host "  AGENT_POLL_INTERVAL=$servicePoll"
}

Write-Host ""

# ── Binary indir (isteğe bağlı) ───────────────────────────────────────────────
if ($DownloadBinary) {
    Write-Step " Agent binary indiriliyor... "
    $ok = Install-AgentBinary $Version $InstallDir
    if (-not $ok) {
        Write-Warn "Binary indirme başarısız. Kaynak koddan derleme için:"
        Write-Host "  cargo build --release --manifest-path agent\Cargo.toml"
    }
}

# ── Özet ─────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "╔════════════════════════════════════════════╗" -ForegroundColor $(if ($NoColor) { 'White' } else { 'Cyan' })
Write-Host "║              Kurulum Tamamlandı            ║" -ForegroundColor $(if ($NoColor) { 'White' } else { 'Cyan' })
Write-Host "╚════════════════════════════════════════════╝" -ForegroundColor $(if ($NoColor) { 'White' } else { 'Cyan' })
Write-Host ""
Write-Host "  Platform  : Windows / $($osInfo.Arch)" -ForegroundColor Gray
Write-Host "  Servis ID : $serviceId" -ForegroundColor Cyan
Write-Host "  Servis    : $serviceName" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Agent'ı başlatmak için:" -ForegroundColor White
Write-Host ""

$agentExe = Join-Path $InstallDir "nanonet-agent.exe"
if (Get-Command "nanonet-agent" -ErrorAction SilentlyContinue) {
    Write-Host "  nanonet-agent.exe  (PATH'de kurulu)" -ForegroundColor Green
} elseif (Test-Path $agentExe) {
    Write-Host "  $agentExe" -ForegroundColor Green
} else {
    Write-Host "  cargo build --release --manifest-path agent\Cargo.toml" -ForegroundColor Green
    Write-Host "  (derlendikten sonra agent\target\release\nanonet-agent.exe)" -ForegroundColor DarkGray
}
Write-Host ""

# ── Direkt başlatma ───────────────────────────────────────────────────────────
$runNow = Read-Host "  Agent'ı şimdi başlatayım mı? [e/H]"
if ($runNow -match '^[Ee]') {
    Write-Host ""

    # Çalışan agent varsa durdur
    Get-Process "nanonet-agent" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500

    $agentBin = $null
    if (Get-Command "nanonet-agent" -ErrorAction SilentlyContinue) {
        $agentBin = "nanonet-agent"
    } elseif (Test-Path $agentExe) {
        $agentBin = $agentExe
    }

    if ($agentBin) {
        # WebSocket URL'yi oluştur
        $wsUrl = $Backend -replace '^http://', 'ws://' -replace '^https://', 'wss://'
        $wsUrl = "$wsUrl/ws/agent"

        $envBlock = @{
            NANONET_BACKEND          = $wsUrl
            NANONET_SERVICE_ID       = $serviceId
            NANONET_TOKEN            = $agentToken
            NANONET_HOST             = $serviceHost
            NANONET_PORT             = $servicePort.ToString()
            NANONET_HEALTH_ENDPOINT  = $serviceEndpoint
            NANONET_POLL_INTERVAL    = $servicePoll.ToString()
        }

        # Env değişkenlerini geçici ayarla
        foreach ($kv in $envBlock.GetEnumerator()) {
            [System.Environment]::SetEnvironmentVariable($kv.Key, $kv.Value, "Process")
        }

        $proc = Start-Process -FilePath $agentBin -PassThru -WindowStyle Normal
        Start-Sleep -Seconds 3

        if (-not $proc.HasExited) {
            Write-Success "Agent başlatıldı (PID: $($proc.Id))"
            Write-Host ""
            Write-Host "  Durdurmak için : Stop-Process -Name nanonet-agent" -ForegroundColor Cyan
        } else {
            Write-Warn "Agent erken kapandı (ExitCode: $($proc.ExitCode))"
        }
    } else {
        Write-Warn "Agent binary bulunamadı. Önce derleyin veya -DownloadBinary ile indirin."
    }
}

Write-Host ""
