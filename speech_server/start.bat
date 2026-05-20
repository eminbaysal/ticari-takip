@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ══════════════════════════════════════════════════
echo   Local Whisper Speech Server
echo ══════════════════════════════════════════════════
echo.

REM ── Virtual environment yoksa oluştur ──────────────────────
if not exist venv (
  echo [1/3] Virtual environment olusturuluyor...
  python -m venv venv
)

REM ── Bağımlılıkları yükle ────────────────────────────────────
echo [2/3] Bagimliliklar kontrol ediliyor...
call venv\Scripts\activate
pip install -q -r requirements.txt

REM ── FastAPI sunucusunu başlat ────────────────────────────────
echo [3/3] Sunucu basliyor: http://localhost:8000
echo.
echo   /health     → durum kontrolu
echo   /transcribe → ses dosyasi gonder, metin al
echo.
echo NOT: Cloudflare Tunnel servis olarak kurulduysa
echo      otomatik aktif olur. Yoksa cloudflare\servis_kur.bat
echo      calistir.
echo.
set WHISPER_MODEL=base
uvicorn main:app --host 0.0.0.0 --port 8000
pause
