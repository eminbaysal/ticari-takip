#!/usr/bin/env python3
# transcribe.py
# Kullanım: python transcribe.py <ses_dosyasi> [model_boyutu]
# Çıktı:    stdout'a JSON {"text": "..."} veya {"error": "..."}

import sys
import json
import os

def main():
    if len(sys.argv) < 2:
        out({"error": "Kullanim: python transcribe.py <dosya> [tiny|base|small]"})
        return

    audio_path = sys.argv[1]
    model_size = sys.argv[2] if len(sys.argv) > 2 else os.environ.get("WHISPER_MODEL", "small")

    if not os.path.exists(audio_path):
        out({"error": "Dosya bulunamadi: " + audio_path})
        return

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        out({"error": "faster-whisper yuklu degil. Calistir: pip install faster-whisper"})
        return

    try:
        # Modeli cache'den yukle (ilk calistirmada indirir)
        model_dir = os.environ.get("WHISPER_MODEL_DIR", None)  # None = varsayilan HuggingFace cache

        model = WhisperModel(
            model_size,
            device="cpu",
            compute_type="int8",        # CPU icin en hizli + dusuk RAM
            download_root=model_dir,
            num_workers=1,
        )

        segments, info = model.transcribe(
            audio_path,
            language="tr",
            beam_size=2,
            best_of=1,
            temperature=0.0,
            vad_filter=True,            # sessizligi atla
            vad_parameters=dict(
                min_silence_duration_ms=500,
            ),
            word_timestamps=False,
        )

        # Segmentleri birlestir
        parts = []
        for seg in segments:
            t = seg.text.strip()
            if t:
                parts.append(t)

        text = " ".join(parts).strip()
        out({"text": text, "language": info.language, "model": model_size})

    except Exception as e:
        out({"error": str(e)})


def out(obj):
    print(json.dumps(obj, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
