// routes/speech.js
const express  = require('express');
const router   = express.Router();
const { parse, escapeRegex } = require('../lib/speechParser');
const Firma    = require('../models/Firma');
const Hizmet   = require('../models/Hizmet');

// POST /api/speech/parse
// Metni parse et, firma ara, önizleme döndür — henüz kaydetme yok
router.post('/parse', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'text boş olamaz' });

    const parsed = parse(text.trim());

    let firma    = null;
    let firmaYeni = false;

    if (parsed.firmaAd) {
      // Tam eşleşme (case-insensitive)
      firma = await Firma.findOne({
        ad: { $regex: new RegExp('^' + escapeRegex(parsed.firmaAd) + '$', 'i') }
      }).lean();

      // Tam eşleşme yoksa içerik araması
      if (!firma) {
        firma = await Firma.findOne({
          ad: { $regex: new RegExp(escapeRegex(parsed.firmaAd), 'i') }
        }).lean();
      }

      if (!firma) firmaYeni = true;
    }

    res.json({
      parsed,
      firma:     firma ? { _id: firma._id, ad: firma.ad } : null,
      firmaYeni,
      originalText: text.trim(),
    });
  } catch (e) {
    console.error('speech/parse hata:', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/speech/kaydet
// Kullanıcı önizlemeyi onayladıktan sonra kaydeder
router.post('/kaydet', async (req, res) => {
  try {
    const {
      firmaId, firmaAd,
      tip, aciklama, urunAdi, adet,
      fiyat, paraBirimi,
      aylikUcret, aktivasyonUcreti, yillikUcret,
      faturaKesildi, tahsilEdildi,
    } = req.body;

    // Firma bul veya oluştur
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
      firma:             fId,
      tip:               tip               || 'diger',
      aciklama:          aciklama          || '',
      urunAdi:           urunAdi           || '',
      adet:              adet              || null,
      fiyat:             fiyat             || null,
      paraBirimi:        paraBirimi        || 'TRY',
      aylikUcret:        aylikUcret        || null,
      aktivasyonUcreti:  aktivasyonUcreti  || null,
      faturaKesildi:     !!faturaKesildi,
      tahsilEdildi:      !!tahsilEdildi,
      tarih:             new Date(),
      durum:             'bekliyor',
    });

    res.json({ ok: true, hizmetId: hizmet._id, firmaId: fId });
  } catch (e) {
    console.error('speech/kaydet hata:', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
