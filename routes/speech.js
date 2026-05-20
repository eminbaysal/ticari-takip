// routes/speech.js — Hibrit mimari: Render → Local Whisper Server
const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const FormData = require('form-data');
const axios    = require('axios');
const { parse, escapeRegex } = require('../lib/speechParser');
const Firma    = require('../models/Firma');
const Hizmet   = require('../models/Hizmet');

// ── uploads/ klasörünü oluştur (yoksa) ───────────────────────
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ── Multer: ses dosyasını diske kaydet ────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename:    (req, file, cb) => {
    const ext = _mimeToExt(file.mimetype);
    cb(null, `ses_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/') || file.mimetype.startsWith('video/')) cb(null, true);
    else cb(new Error('Sadece ses dosyası kabul edilir'));
  },
});

// ── Speech server URL (Cloudflare Tunnel) ────────────────────
const SPEECH_SERVER_URL = (process.env.SPEECH_SERVER_URL || '').replace(/\/$/, '');

console.log('[speech] SPEECH_SERVER_URL:', SPEECH_SERVER_URL || '(tanımsız — özellik kapalı)');

// ── Health check cache ────────────────────────────────────────
// Sunucuyu her /available isteğinde ping atmak yerine 30s cache'liyoruz
let _online    = false;   // son bilinen durum
let _checking  = false;   // çift ping engeli

async function _healthCheck() {
  if (!SPEECH_SERVER_URL || _checking) return;
  _checking = true;
  try {
    await axios.get(`${SPEECH_SERVER_URL}/health`, { timeout: 5_000 });
    if (!_online) console.log('[speech] ✓ Ses sunucusu çevrimiçi');
    _online = true;
  } catch {
    if (_online) console.log('[speech] ✗ Ses sunucusu çevrimdışı');
    _online = false;
  } finally {
    _checking = false;
  }
}

if (SPEECH_SERVER_URL) {
  _healthCheck();                          // sunucu başlarken hemen kontrol
  setInterval(_healthCheck, 30_000);       // sonra her 30 saniye
}

// ── GET /api/speech/available ─────────────────────────────────
router.get('/available', (req, res) => {
  // SPEECH_SERVER_URL tanımlı değilse hiç sorma
  if (!SPEECH_SERVER_URL) return res.json({ available: false });
  res.json({ available: _online });
});

// ── POST /api/speech/transcribe ───────────────────────────────
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  const filePath = req.file?.path;
  try {
    if (!filePath) return res.status(400).json({ error: 'Ses dosyası gönderilmedi' });

    if (!SPEECH_SERVER_URL || !_online) {
      // Hızlı cache miss: bir kez daha dene (ilk istek olabilir)
      await _healthCheck();
      if (!_online) return res.status(503).json({ error: 'Ses servisine ulaşılamıyor' });
    }

    const text = await _callSpeechServer(filePath, req.file);
    res.json({ text });

  } catch (e) {
    console.error('transcribe hata:', e.message);

    // Bağlantı hatalarını özel mesajla döndür
    const baglanti = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET'];
    if (baglanti.includes(e.code) || e.message?.includes('ulaşılamıyor')) {
      return res.status(503).json({ error: 'Ses servisine ulaşılamıyor' });
    }

    res.status(500).json({ error: e.message });
  } finally {
    if (filePath) fs.unlink(filePath, () => {});
  }
});

// ── POST /api/speech/parse ────────────────────────────────────
router.post('/parse', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'text boş olamaz' });

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

// ── POST /api/speech/kaydet ───────────────────────────────────
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
    if (!fId && firmaAd?.trim()) {
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

// ── Local Speech Server'a HTTP isteği gönder ─────────────────
async function _callSpeechServer(filePath, fileInfo) {
  const form = new FormData();
  form.append('audio', fs.createReadStream(filePath), {
    filename:    fileInfo.originalname || `kayit.${_mimeToExt(fileInfo.mimetype)}`,
    contentType: fileInfo.mimetype,
  });

  let response;
  try {
    response = await axios.post(`${SPEECH_SERVER_URL}/transcribe`, form, {
      headers:        form.getHeaders(),
      timeout:        120_000,   // 2 dakika max
      maxContentLength: Infinity,
      maxBodyLength:    Infinity,
    });
  } catch (e) {
    // axios'un ağ hatasını düzgün fırlat
    if (e.code) throw e;                                   // ECONNREFUSED vs.
    if (e.response) {
      const detail = e.response.data?.detail || e.response.data?.error || e.message;
      throw new Error(detail);
    }
    throw e;
  }

  return response.data?.text || '';
}

// ── MIME → uzantı ─────────────────────────────────────────────
function _mimeToExt(mime) {
  if (!mime)                  return 'webm';
  if (mime.includes('webm'))  return 'webm';
  if (mime.includes('ogg'))   return 'ogg';
  if (mime.includes('mp4'))   return 'mp4';
  if (mime.includes('wav'))   return 'wav';
  if (mime.includes('mpeg'))  return 'mp3';
  if (mime.includes('m4a'))   return 'm4a';
  return 'webm';
}

module.exports = router;
