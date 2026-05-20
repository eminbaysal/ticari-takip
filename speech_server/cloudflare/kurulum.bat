@echo off
chcp 65001 >nul
echo ══════════════════════════════════════════════════
echo   Cloudflare Tunnel Kurulum Rehberi
echo ══════════════════════════════════════════════════
echo.

REM ── 1) cloudflared indir ────────────────────────────────────
echo [1/5] cloudflared indiriliyor...
winget install --id Cloudflare.cloudflared -e --silent
if %errorlevel% neq 0 (
  echo HATA: winget ile kurulamadi. Manuel kur:
  echo https://github.com/cloudflare/cloudflared/releases/latest
  echo cloudflared-windows-amd64.msi dosyasini indir ve kur
  pause
  exit /b 1
)
echo ✓ cloudflared kuruldu
echo.

REM ── 2) Cloudflare hesabına giriş ────────────────────────────
echo [2/5] Cloudflare hesabına giriş yapılıyor...
echo Tarayıcı açılacak — Cloudflare hesabınla giriş yap.
cloudflared tunnel login
echo.

REM ── 3) Tunnel oluştur ───────────────────────────────────────
echo [3/5] Tunnel oluşturuluyor: speech-server
cloudflared tunnel create speech-server
echo.
echo ÖNEMLİ: Yukarıdaki TUNNEL ID'yi not al!
echo Örnek: Created tunnel speech-server with id abc123-def456-...
echo.
pause

REM ── 4) DNS kaydı ekle ──────────────────────────────────────
echo [4/5] DNS kaydı ekleniyor...
echo.
set /p TUNNEL_ID="Tunnel ID gir (abc123-def456 gibi): "
set /p DOMAIN="Alan adını gir (örn: speech.siteadresin.com): "
cloudflared tunnel route dns %TUNNEL_ID% %DOMAIN%
echo.
echo ✓ DNS kaydı eklendi: %DOMAIN%

REM ── 5) config.yml oluştur ──────────────────────────────────
echo [5/5] config.yml oluşturuluyor...
set CONFIG_DIR=%USERPROFILE%\.cloudflared
if not exist "%CONFIG_DIR%" mkdir "%CONFIG_DIR%"

(
echo tunnel: %TUNNEL_ID%
echo credentials-file: %CONFIG_DIR%\%TUNNEL_ID%.json
echo.
echo ingress:
echo   - hostname: %DOMAIN%
echo     service: http://localhost:8000
echo     originRequest:
echo       connectTimeout: 30s
echo   - service: http_status:404
) > "%CONFIG_DIR%\config.yml"

echo ✓ Config yazıldı: %CONFIG_DIR%\config.yml
echo.
echo ══════════════════════════════════════════════════
echo   KURULUM TAMAMLANDI
echo.
echo   Render'da şu env variable'ı ekle:
echo   SPEECH_SERVER_URL = https://%DOMAIN%
echo.
echo   Servisi başlatmak için: servis_kur.bat
echo ══════════════════════════════════════════════════
pause
