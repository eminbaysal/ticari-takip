"""
Local Whisper Speech Server
FastAPI + faster-whisper | CPU | Türkçe transkripsiyon
Başlatma: start.bat  veya  uvicorn main:app --host 0.0.0.0 --port 8000
"""

import os
import tempfile
import shutil
import logging

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

# ── Ayarlar ──────────────────────────────────────────────────
MODEL_SIZE   = os.environ.get("WHISPER_MODEL", "base")   # tiny/base/small
DEVICE       = "cpu"
COMPUTE_TYPE = "int8"   # CPU için en hızlı + düşük RAM

# ── Uygulama ─────────────────────────────────────────────────
app = FastAPI(title="Local Whisper Speech Server", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

# ── Model tek seferinde yükle ─────────────────────────────────
model = None

@app.on_event("startup")
async def load_model():
    global model
    logger.info(f"Model yükleniyor: {MODEL_SIZE} | device={DEVICE} | compute={COMPUTE_TYPE}")
    from faster_whisper import WhisperModel
    model = WhisperModel(
        MODEL_SIZE,
        device=DEVICE,
        compute_type=COMPUTE_TYPE,
        num_workers=1,
    )
    logger.info("✓ Model hazır — sunucu isteklere açık")


# ── GET /health ───────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "model": MODEL_SIZE, "device": DEVICE}


# ── POST /transcribe ──────────────────────────────────────────
@app.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    if model is None:
        raise HTTPException(status_code=503, detail="Model henüz yüklenmedi, lütfen bekleyin")

    # Uzantıyı koru (webm/ogg/mp4/wav)
    original = audio.filename or "kayit.webm"
    suffix   = os.path.splitext(original)[1] or ".webm"

    tmp_path = None
    try:
        # Geçici dosyaya kaydet
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            shutil.copyfileobj(audio.file, tmp)
            tmp_path = tmp.name

        logger.info(f"Transkripsiyon başladı: {original} → {tmp_path}")

        segments, info = model.transcribe(
            tmp_path,
            language="tr",
            beam_size=5,
            best_of=5,
            temperature=0.0,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500),
            word_timestamps=False,
            initial_prompt=(
                "Bilgi işlem ve teknik servis hizmet kaydı. "
                # Ağ / Network
                "Modem, router, switch, access point, fiber, internet, PoE switch, PoE injector, "
                "patch panel, CAT6, fiber optik kablo, SFP, ONU, ONT, OLT, GPON, "
                "firewall, VPN, VLAN, ethernet, Wi-Fi, hotspot, "
                # UniFi / Ubiquiti
                "UniFi, Ubiquiti, UAP, USG, UDM, UDM-Pro, USW, UDR, "
                "UAP-AC-Pro, UAP-AC-Lite, UAP-AC-LR, UAP-AC-M, "
                "airMAX, airFiber, NanoStation, NanoBridge, PowerBeam, LiteBeam, NanoBeam, "
                "Rocket, EdgeRouter, EdgeSwitch, airOS, "
                # Radiolink / PtP
                "Radiolink, radyo link, PtP, PtMP, sektör anten, yagi anten, "
                "Mimosa, Cambium, MikroTik, TP-Link, Cisco, Meraki, Zyxel, "
                "5GHz, 2.4GHz, 60GHz, baz istasyonu, mast, kule, "
                # Güvenlik kamera
                "NVR, DVR, IP kamera, PTZ kamera, dome kamera, bullet kamera, CCTV, "
                "güvenlik kamerası, kamera sistemi, kayıt cihazı, "
                # Sunucu / Donanım
                "server, rack, UPS, PDU, SSD, HDD, RAM, CPU, "
                "laptop, bilgisayar, tablet, monitör, ekran, projeksiyon, "
                "yazıcı, printer, plotter, tarayıcı, barkod okuyucu, POS terminali, "
                # Erişim kontrol
                "access control, parmak izi okuyucu, kart okuyucu, turnike, interkom, "
                "IP telefon, telefon santrali, VoIP, "
                # Yazılım
                "AutoCAD, Excel, Windows, Office, lisans, "
                # Finansal
                "TL, USD, Euro, fatura, tahsilat, aktivasyon, abonelik, "
                "kurulum, montaj, teknik destek, bakım, arıza, garanti."
            ),
        )

        parts = [seg.text.strip() for seg in segments if seg.text.strip()]
        text  = " ".join(parts).strip()

        logger.info(f"✓ Transkripsiyon tamamlandı: \"{text[:80]}\"")
        return {"text": text, "language": info.language, "model": MODEL_SIZE}

    except Exception as e:
        logger.error(f"Transkripsiyon hatası: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
