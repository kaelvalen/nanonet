@echo off
:: ─────────────────────────────────────────────────────────────────────────────
:: dev.bat — NanoNet Windows Başlatıcı
:: dev.ps1'i PowerShell üzerinden çalıştırır.
::
:: Kullanım:
::   dev.bat setup    — ilk kurulum
::   dev.bat dev      — geliştirme ortamını başlat
::   dev.bat down     — servisleri durdur
::   dev.bat reset    — servisleri durdur + DB sıfırla
::   dev.bat logs     — logları takip et
::   dev.bat ps       — çalışan container'ları listele
:: ─────────────────────────────────────────────────────────────────────────────

:: PowerShell 7+ varsa tercih et (pwsh), yoksa Windows PowerShell (powershell) kullan
where /q pwsh 2>nul
if %ERRORLEVEL% EQU 0 (
    pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0dev.ps1" %*
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0dev.ps1" %*
)
