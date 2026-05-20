@echo off
cd /d "%~dp0"

REM ── Virtual environment yoksa oluştur ──────────────────────
if not exist venv (
    echo [1/3] Virtual environment olusturuluyor...
    python -m venv venv
)

REM ── Bağımlılıkları yükle ────────────────────────────────────
echo [2/3] Bagimliliklar yukleniyor...
call venv\Scripts\activate
pip install -q -r requirements.txt

REM ── Sunucuyu başlat ─────────────────────────────────────────
echo [3/3] Sunucu basliyor: http://localhost:8000
echo.
echo  /health     → durum kontrolu
echo  /transcribe → ses dosyasi gonder, metin al
echo.
set WHISPER_MODEL=base
uvicorn main:app --host 0.0.0.0 --port 8000
pause
