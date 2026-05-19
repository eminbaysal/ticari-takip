// routes/speech.js
const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const { OpenAI } = require('openai');
const { Readable } = require('stream');
const { parse, escapeRegex } = require('../lib/speechParser');
const Firma    = require('../models/Firma');
const Hizmet   = require('../models/Hizmet');

// Multer — ses blob'unu bellekte tut (disk yazma yok)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB (Whisper limiti)
});

// ── POST /api/speech/transcribe ──────────────────────────────
// Browser'dan gelen ses blob → Whisper → metin
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Ses dosyası gönderilmedi' });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY sunucuda tanımlı değil' });

    const openai = new OpenAI({ apiKey });

    // OpenAI SDK File nesnesi ister — Buffer'dan oluştur
    const ext      = _mimeToExt(req.file.mimetype);
    const filename = `ses.${ext}`;
    const file     = new File([req.file.buffer], filename, { type: req.file.mimetype });

    const transcription = await openai.audio.transcriptions.create({
      file,
      model:           'whisper-1',
      language:        'tr',
      response_format: 'text',
    });

    // response_format:'text' → string döner
    const text = typeof transcription === 'string' ? transcription : (transcription.text || '');
    res.json({ text: text.trim() });

  } catch (e) {
    console.error('speech/transcribe hata:', e?.message || e);
    res.status(500).json({ error: e?.message || 'Transkripsiyon başarısız' });
  }
});

// ── POST /api/speech/parse ───────────────────────────────────
// Metni parse et, firma ara, önizleme döndür
router.post('/parse', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'text boş olamaz' });

    const parsed = parse(text.trim());

    let firma     = null;
    let firmaYeni = false;

    if (parsed.firmaAd) {
      firma = await Firma.findOne({
        ad: { $regex: new RegExp('^' + escapeRegex(parsed.firmaAd) + '$', 'i') }
      }).lean();

      if (!firma) {
        firma = await Firma.findOne({
          ad: { $regex: new RegExp(escapeRegex(parsed.firmaAd), 'i') }
        }).lean();
      }

      if (!firma) firmaYeni = true;
    }

    res.json({
      parsed,
      firma:        firma ? { _id: firma._id, ad: firma.ad } : null,
      firmaYeni,
      originalText: text.trim(),
    });
  } catch (e) {
    console.error('speech/parse hata:', e);
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/speech/kaydet ──────────────────────────────────
router.post('/kaydet', async (req, res) => {
  try {
    const {
      firmaId, firmaAd,
      tip, aciklama, urunAdi, adet,
      fiyat, paraBirimi,
      aylikUcret, aktivasyonUcreti, yillikUcret,
      faturaKesildi, tahsilEdildi,
    } = req.body;

    let fId = firmaId || null;
    if (!fId && firmaAd && firmaAd.trim()) {
      let f = await Firma.findOne({
        ad: { $regex: new RegExp('^' + escapeRegex(firmaAd.trim()) + '$', 'i') }
      });
      if (!f) f = await Firma.create({ ad: firmaAd.trim() });
      fId = f._id;
    }

    if (!fId) return res.status(400).json({ error: 'Firma belirtilmedi' });

    const hizmet = await Hizmet.create({
      firma:            fId,
      tip:              tip              || 'diger',
      aciklama:         aciklama         || '',
      urunAdi:          urunAdi          || '',
      adet:             adet             || null,
      fiyat:            fiyat            || null,
      paraBirimi:       paraBirimi       || 'TRY',
      aylikUcret:       aylikUcret       || null,
      aktivasyonUcreti: aktivasyonUcreti || null,
      faturaKesildi:    !!faturaKesildi,
      tahsilEdildi:     !!tahsilEdildi,
      tarih:            new Date(),
      durum:            'bekliyor',
    });

    res.json({ ok: true, hizmetId: hizmet._id, firmaId: fId });
  } catch (e) {
    console.error('speech/kaydet hata:', e);
    res.status(500).json({ error: e.message });
  }
});

// ── Yardımcı: MIME → uzantı ──────────────────────────────────
function _mimeToExt(mime) {
  if (!mime) return 'webm';
  if (mime.includes('webm'))  return 'webm';
  if (mime.includes('ogg'))   return 'ogg';
  if (mime.includes('mp4'))   return 'mp4';
  if (mime.includes('mpeg'))  return 'mpeg';
  if (mime.includes('wav'))   return 'wav';
  if (mime.includes('m4a'))   return 'm4a';
  return 'webm';
}

module.exports = router;
