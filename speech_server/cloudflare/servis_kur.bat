@echo off
chcp 65001 >nul
echo ══════════════════════════════════════════════════
echo   Cloudflare Tunnel — Windows Servis Kurulumu
echo   (Bilgisayar açıldığında otomatik başlar)
echo ══════════════════════════════════════════════════
echo.

REM Yönetici yetkisi gerekli
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo HATA: Yönetici olarak çalıştır!
  echo Bu bat dosyasına sağ tıkla → "Yönetici olarak çalıştır"
  pause
  exit /b 1
)

REM Config dosyası var mı kontrol et
if not exist "%USERPROFILE%\.cloudflared\config.yml" (
  echo HATA: config.yml bulunamadı.
  echo Önce kurulum.bat dosyasını çalıştır!
  pause
  exit /b 1
)

echo [1/2] Mevcut servis kaldırılıyor (varsa)...
cloudflared service uninstall >nul 2>&1

echo [2/2] Servis kuruluyor...
cloudflared service install
if %errorlevel% neq 0 (
  echo HATA: Servis kurulamadı.
  pause
  exit /b 1
)

echo.
echo ✓ Cloudflare Tunnel servisi kuruldu!
echo   Bilgisayar açıldığında otomatik başlayacak.
echo.
echo   Servis durumu kontrol:  sc query cloudflared
echo   Servisi başlat:         net start cloudflared
echo   Servisi durdur:         net stop cloudflared
echo   Servisi kaldır:         cloudflared service uninstall
echo.
pause
