// routes/speech.js
const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const { spawn } = require('child_process');
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

// ── Python yolu ───────────────────────────────────────────────
const PYTHON = process.env.PYTHON_PATH || 'python';
const MODEL  = process.env.WHISPER_MODEL || 'small';
const SCRIPT = path.join(__dirname, '..', 'transcribe.py');

console.log('[speech] PYTHON_PATH :', PYTHON);
console.log('[speech] SCRIPT      :', SCRIPT);
console.log('[speech] WHISPER_MODEL:', MODEL);
console.log('[speech] transcribe.py mevcut:', fs.existsSync(SCRIPT));

// ── GET /api/speech/available — özellik aktif mi? ────────────
router.get('/available', (req, res) => {
  res.json({ available: process.env.SPEECH_ENABLED === 'true' });
});

// ── GET /api/speech/test — tanı endpoint'i ───────────────────
router.get('/test', async (req, res) => {
  const result = {
    PYTHON,
    MODEL,
    SCRIPT,
    scriptMevcut: fs.existsSync(SCRIPT),
    uploadDir: UPLOAD_DIR,
  };

  // Python'u sahte dosyayla çalıştır, ham çıktıyı döndür
  await new Promise((resolve) => {
    let stdout = '', stderr = '';
    const proc = require('child_process').spawn(PYTHON, [SCRIPT, 'test_yok.webm', MODEL], {
      timeout: 15_000,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
    });
    proc.stdout.setEncoding('utf8');
    proc.stderr.setEncoding('utf8');
    proc.stdout.on('data', d => { stdout += d; });
    proc.stderr.on('data', d => { stderr += d; });
    proc.on('error', err => { result.spawnHata = err.message; resolve(); });
    proc.on('close', code => {
      result.exitCode = code;
      result.stdout   = stdout.slice(0, 500);
      result.stderr   = stderr.slice(0, 500);
      resolve();
    });
  });

  res.json(result);
});

// ── POST /api/speech/transcribe ───────────────────────────────
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  const filePath = req.file?.path;
  try {
    if (!filePath) return res.status(400).json({ error: 'Ses dosyası gönderilmedi' });

    const text = await _runWhisper(filePath, MODEL);
    res.json({ text });

  } catch (e) {
    console.error('transcribe hata:', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    // Geçici dosyayı sil
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

// ── faster-whisper çalıştır ───────────────────────────────────
function _runWhisper(audioPath, modelSize) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    const proc = spawn(PYTHON, [SCRIPT, audioPath, modelSize], {
      timeout: 120_000,  // 2 dakika max
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
    });

    proc.stdout.setEncoding('utf8');
    proc.stderr.setEncoding('utf8');
    proc.stdout.on('data', d => { stdout += d; });
    proc.stderr.on('data', d => { stderr += d; });  // model indirme ilerlemesi

    proc.on('error', err => {
      if (err.code === 'ENOENT') {
        reject(new Error(
          `Python bulunamadı ("${PYTHON}"). ` +
          `.env dosyasına PYTHON_PATH=<python yolu> ekleyin`
        ));
      } else {
        reject(new Error('Python başlatılamadı: ' + err.message));
      }
    });

    proc.on('close', code => {
      const raw = stdout.trim();

      // stdout boşsa Python script'i başlamadan çöktü
      if (!raw) {
        reject(new Error(
          'Python çıktı vermedi (exit=' + code + ').\n' +
          'PYTHON_PATH: ' + PYTHON + '\n' +
          'SCRIPT: ' + SCRIPT + '\n' +
          (stderr ? 'stderr: ' + stderr.slice(0, 500) : 'stderr boş')
        ));
        return;
      }

      // Son satır JSON olmalı (faster-whisper bazen uyarı basar)
      const lines = raw.split('\n').filter(Boolean);
      const lastLine = lines[lines.length - 1];

      try {
        const result = JSON.parse(lastLine);
        if (result.error) reject(new Error(result.error));
        else resolve(result.text || '');
      } catch {
        reject(new Error(
          'JSON parse hatası: ' + lastLine.slice(0, 200) +
          (stderr ? '\nstderr: ' + stderr.slice(0, 300) : '')
        ));
      }
    });
  });
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
