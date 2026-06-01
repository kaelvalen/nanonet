#Requires -Version 5.1
<#
.SYNOPSIS
    NanoNet geliştirme ortamı başlatıcı — Windows

.DESCRIPTION
    NanoNet geliştirme ortamını Windows'ta kurar ve başlatır.
    Eksik araçları winget (veya chocolatey) ile otomatik yükler.

.PARAMETER Command
    setup | dev | down | reset | logs | ps | help

.EXAMPLE
    .\dev.ps1 setup     # ilk kurulum — araçları kontrol et/kur
    .\dev.ps1 dev       # geliştirme ortamını başlat
    .\dev.ps1 down      # servisleri durdur
    .\dev.ps1 reset     # servisleri durdur + DB sıfırla
    .\dev.ps1 logs      # logları takip et
    .\dev.ps1 ps        # çalışan container'ları listele
#>

[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$Command = "help",

    [Parameter(ValueFromRemainingArguments)]
    [string[]]$Rest
)

$utf8 = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = $utf8
[Console]::InputEncoding = $utf8
$OutputEncoding = $utf8

$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $MyInvocation.MyCommand.Path)

# ── Renkli çıktı ─────────────────────────────────────────────────────────────
function Write-Info  { param($m) Write-Host "[INFO]  $m" -ForegroundColor Cyan    }
function Write-Ok    { param($m) Write-Host "[OK]    $m" -ForegroundColor Green   }
function Write-Warn  { param($m) Write-Host "[WARN]  $m" -ForegroundColor Yellow  }
function Write-Err   { param($m) Write-Host "[ERROR] $m" -ForegroundColor Red     }
function Write-Step  { param($m) Write-Host "`n>> $m"    -ForegroundColor White   }
function Fail        { param($m) Write-Err $m; exit 1 }

# ── PATH yenileme yardımcısı ──────────────────────────────────────────────────
function Refresh-Path {
    $machinePath = [System.Environment]::GetEnvironmentVariable("PATH", "Machine")
    $userPath    = [System.Environment]::GetEnvironmentVariable("PATH", "User")
    $env:PATH    = "$machinePath;$userPath"
}

# ── Paket yöneticisi algılama ─────────────────────────────────────────────────
$HasWinget = $null -ne (Get-Command winget  -ErrorAction SilentlyContinue)
$HasChoco  = $null -ne (Get-Command choco   -ErrorAction SilentlyContinue)

function Install-Pkg {
    param(
        [string]$WingetId,
        [string]$ChocoId,
        [string]$Name
    )
    if ($HasWinget) {
        Write-Info "$Name winget ile kuruluyor ($WingetId)..."
        winget install --id $WingetId -e --silent `
            --accept-package-agreements --accept-source-agreements
    } elseif ($HasChoco) {
        Write-Info "$Name chocolatey ile kuruluyor ($ChocoId)..."
        choco install $ChocoId -y
    } else {
        Write-Warn "$Name otomatik kurulamadı."
        Write-Warn "  winget : https://aka.ms/winget"
        Write-Warn "  choco  : https://chocolatey.org/install"
    }
    Refresh-Path
}

# ── Docker ────────────────────────────────────────────────────────────────────
function Check-Docker {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Warn "Docker bulunamadı, Docker Desktop kuruluyor..."
        Install-Pkg "Docker.DockerDesktop" "docker-desktop" "Docker Desktop"
        Fail "Docker Desktop kuruldu. Bilgisayarı yeniden başlatın, ardından '.\dev.ps1 dev' çalıştırın."
    }

    $info = docker info 2>&1
    if ($LASTEXITCODE -ne 0) {
        Fail "Docker daemon çalışmıyor. Docker Desktop'ı başlatın ve tekrar deneyin."
    }

    $cv = docker compose version 2>&1
    if ($LASTEXITCODE -ne 0) {
        Fail "Docker Compose plugin bulunamadı. Docker Desktop'ı güncelleyin (>= 3.x)."
    }

    Write-Ok "Docker: $(docker --version)"
}

# ── Go ────────────────────────────────────────────────────────────────────────
function Check-Go {
    if (Get-Command go -ErrorAction SilentlyContinue) {
        Write-Ok "Go: $(go version)"; return
    }
    Write-Warn "Go bulunamadı, kuruluyor..."
    Install-Pkg "GoLang.Go" "golang" "Go"
    if (Get-Command go -ErrorAction SilentlyContinue) { Write-Ok "Go: $(go version)" }
}

# ── Node.js ───────────────────────────────────────────────────────────────────
function Check-Node {
    if (Get-Command node -ErrorAction SilentlyContinue) {
        Write-Ok "Node.js: $(node --version)"; return
    }
    Write-Warn "Node.js bulunamadı, kuruluyor..."
    Install-Pkg "OpenJS.NodeJS.LTS" "nodejs-lts" "Node.js"
    if (Get-Command node -ErrorAction SilentlyContinue) { Write-Ok "Node.js: $(node --version)" }
}

# ── Rust ──────────────────────────────────────────────────────────────────────
function Check-Rust {
    if (Get-Command cargo -ErrorAction SilentlyContinue) {
        Write-Ok "Rust: $(rustc --version)"; return
    }
    Write-Warn "Rust/Cargo bulunamadı, rustup ile kuruluyor..."
    Install-Pkg "Rustlang.Rustup" "rustup.install" "Rustup"

    # rustup varsa stable toolchain kur
    if (Get-Command rustup -ErrorAction SilentlyContinue) {
        rustup default stable 2>&1 | Out-Null
    }

    # Cargo PATH'e ekle
    $cargoBin = "$env:USERPROFILE\.cargo\bin"
    if (Test-Path $cargoBin) {
        $env:PATH = "$cargoBin;$env:PATH"
    }

    if (Get-Command cargo -ErrorAction SilentlyContinue) { Write-Ok "Rust: $(rustc --version)" }
}

# ── Git ───────────────────────────────────────────────────────────────────────
function Check-Git {
    if (Get-Command git -ErrorAction SilentlyContinue) {
        Write-Ok "Git: $(git --version)"; return
    }
    Write-Warn "Git bulunamadı, kuruluyor..."
    Install-Pkg "Git.Git" "git" "Git"
    if (Get-Command git -ErrorAction SilentlyContinue) { Write-Ok "Git: $(git --version)" }
}

# ── jq ────────────────────────────────────────────────────────────────────────
function Check-Jq {
    if (Get-Command jq -ErrorAction SilentlyContinue) {
        Write-Ok "jq hazır"; return
    }
    Write-Warn "jq bulunamadı, kuruluyor..."
    Install-Pkg "jqlang.jq" "jq" "jq"
}

# ── HOME ortam değişkeni (Docker Compose volume mount için) ──────────────────
function Ensure-Home {
    if (-not $env:HOME) {
        $env:HOME = $env:USERPROFILE
        Write-Info "HOME=$env:HOME ayarlandı"
    }
}

# ── .env kurulumu ─────────────────────────────────────────────────────────────
function Setup-Env {
    if (-not (Test-Path ".env")) {
        if (Test-Path ".env.example") {
            Copy-Item ".env.example" ".env"
            Write-Ok ".env oluşturuldu (.env.example'dan)"
            Write-Warn "Önemli: .env içindeki JWT_SECRET ve CLAUDE_API_KEY alanlarını doldurun!"
        } else {
            Write-Warn ".env.example bulunamadı. .env dosyasını manuel oluşturun."
        }
    } else {
        Write-Ok ".env mevcut"
    }
}

# ── Docker ağ kurulumu ────────────────────────────────────────────────────────
# docker-compose.dev.yml 'kind' ağını external olarak bekler.
function Setup-Networks {
    $networkName = docker network ls --filter "name=^kind$" --format "{{.Name}}" 2>$null
    if ($networkName -ne "kind") {
        Write-Info "'kind' Docker ağı oluşturuluyor (Kubernetes geliştirme için)..."
        docker network create kind 2>&1 | Out-Null
        Write-Ok "'kind' ağı oluşturuldu"
    }
}

# ── Compose yardımcısı ────────────────────────────────────────────────────────
function Invoke-Compose {
    Ensure-Home
    if ($Rest -and $Rest.Count -gt 0) {
        docker compose -f docker-compose.dev.yml @args @Rest
    } else {
        docker compose -f docker-compose.dev.yml @args
    }
}

# ── Komutlar ──────────────────────────────────────────────────────────────────
function Cmd-Setup {
    Write-Step "Bağımlılıklar kontrol ediliyor / kuruluyor..."
    Check-Docker
    Check-Go
    Check-Node
    Check-Rust
    Check-Git
    Check-Jq
    Setup-Env
    Setup-Networks
    Write-Host ""
    Write-Ok "Kurulum tamamlandı!"
    Write-Info "Geliştirme ortamını başlatmak için: .\dev.ps1 dev"
}

function Cmd-Dev {
    Write-Step "Geliştirme ortamı başlatılıyor..."
    Check-Docker
    Ensure-Home
    Setup-Env
    Setup-Networks

    docker compose -f docker-compose.dev.yml up --build -d

    Write-Host ""
    Write-Ok "Servisler çalışıyor!"
    Write-Host "  Frontend:  http://localhost:3000" -ForegroundColor Cyan
    Write-Host "  Backend:   http://localhost:8080" -ForegroundColor Cyan
    Write-Host "  API Docs:  http://localhost:8080/api/docs" -ForegroundColor Cyan
    Write-Host ""
    Write-Info "Loglar için:      .\dev.ps1 logs"
    Write-Info "Durdurmak için:   .\dev.ps1 down"
}

function Cmd-Down {
    Write-Step "Servisler durduruluyor..."
    Ensure-Home
    docker compose -f docker-compose.dev.yml down
    Write-Ok "Tüm servisler durduruldu."
}

function Cmd-Reset {
    Write-Step "Ortam sıfırlanıyor (volume'lar da siliniyor)..."
    Ensure-Home
    docker compose -f docker-compose.dev.yml down -v
    Write-Ok "Sıfırlama tamamlandı — veritabanı temizlendi."
}

function Cmd-Logs {
    Ensure-Home
    if ($Rest -and $Rest.Count -gt 0) {
        docker compose -f docker-compose.dev.yml logs -f --tail=100 @Rest
    } else {
        docker compose -f docker-compose.dev.yml logs -f --tail=100
    }
}

function Cmd-Ps {
    Ensure-Home
    docker compose -f docker-compose.dev.yml ps
}

function Show-Help {
    Write-Host ""
    Write-Host "NanoNet Dev Script — Windows (PowerShell)" -ForegroundColor White
    Write-Host ""
    Write-Host "  .\dev.ps1 setup        Bagimliliklari kontrol et / kur (ilk kurulum)" -ForegroundColor Cyan
    Write-Host "  .\dev.ps1 dev          Gelistirme ortamini baslat"                    -ForegroundColor Cyan
    Write-Host "  .\dev.ps1 down         Servisleri durdur"                             -ForegroundColor Cyan
    Write-Host "  .\dev.ps1 reset        Servisleri durdur + volume sil (DB sifirla)"   -ForegroundColor Cyan
    Write-Host "  .\dev.ps1 logs         Tum loglari takip et"                          -ForegroundColor Cyan
    Write-Host "  .\dev.ps1 logs backend Belirli servis loglari"                        -ForegroundColor Cyan
    Write-Host "  .\dev.ps1 ps           Calisan container'lari listele"                -ForegroundColor Cyan
    Write-Host "  .\dev.ps1 help         Bu yardim mesaji"                              -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Ipucu: Ilk kullanim icin '.\dev.ps1 setup' calistirin." -ForegroundColor Yellow
    Write-Host "  Linux/macOS/WSL icin: ./dev.sh" -ForegroundColor Yellow
}

# ── Giriş noktası ─────────────────────────────────────────────────────────────
& {
    switch ($Command.ToLower()) {
        "setup"  { Cmd-Setup }
        "dev"    { Cmd-Dev   }
        "down"   { Cmd-Down  }
        "reset"  { Cmd-Reset }
        "logs"   { Cmd-Logs  }
        "ps"     { Cmd-Ps    }
        default   {
            Write-Host ''
            Write-Host 'NanoNet Dev Script - Windows (PowerShell)' -ForegroundColor White
            Write-Host ''
            Write-Host '  .\dev.ps1 setup        Bagimliliklari kontrol et / kur (ilk kurulum)' -ForegroundColor Cyan
            Write-Host '  .\dev.ps1 dev          Gelistirme ortamini baslat' -ForegroundColor Cyan
            Write-Host '  .\dev.ps1 down         Servisleri durdur' -ForegroundColor Cyan
            Write-Host '  .\dev.ps1 reset        Servisleri durdur + volume sil (DB sifirla)' -ForegroundColor Cyan
            Write-Host '  .\dev.ps1 logs         Tum loglari takip et' -ForegroundColor Cyan
            Write-Host '  .\dev.ps1 logs backend Belirli servis loglari' -ForegroundColor Cyan
            Write-Host '  .\dev.ps1 ps           Calisan containerlari listele' -ForegroundColor Cyan
            Write-Host '  .\dev.ps1 help         Bu yardim mesaji' -ForegroundColor Cyan
            Write-Host ''
            Write-Host '  Ipucu: Ilk kullanim icin .\dev.ps1 setup calistirin.' -ForegroundColor Yellow
            Write-Host '  Linux/macOS/WSL icin: ./dev.sh' -ForegroundColor Yellow
        }
    }
}
