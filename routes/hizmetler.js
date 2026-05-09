const express = require('express');
const router = express.Router();
const Hizmet = require('../models/Hizmet');
const Firma = require('../models/Firma');

// Tüm hizmetler (özet için)
router.get('/ozet', async (req, res) => {
  try {
    const hizmetler = await Hizmet.find({ fiyat: { $ne: null } });
    let tryToplam = 0, tryTahsil = 0, tryBekleyen = 0;
    let usdToplam = 0, usdTahsil = 0, usdBekleyen = 0;
    hizmetler.forEach(h => {
      const f = h.fiyat || 0;
      const pb = h.paraBirimi || 'TRY';
      if (pb === 'USD') {
        usdToplam += f;
        if (h.durum === 'tahsil-edildi') usdTahsil += f;
        else usdBekleyen += f;
      } else {
        tryToplam += f;
        if (h.durum === 'tahsil-edildi') tryTahsil += f;
        else tryBekleyen += f;
      }
    });
    res.json({ tryToplam, tryTahsil, tryBekleyen, usdToplam, usdTahsil, usdBekleyen });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Firma hizmet ekle
router.post('/', async (req, res) => {
  try {
    const { firma, tip, aciklama, tarih, fiyat, paraBirimi, durum, urunAdi, adet, faturaTarihi, oncekiDurum } = req.body;
    if (!firma) return res.status(400).json({ error: 'Firma ID gerekli.' });
    if (!tip) return res.status(400).json({ error: 'Hizmet tipi gerekli.' });
    if (!aciklama && tip !== 'urun-tedariki') return res.status(400).json({ error: 'Açıklama gerekli.' });
    const firmaDoc = await Firma.findById(firma);
    if (!firmaDoc) return res.status(404).json({ error: 'Firma bulunamadı.' });
    const hizmet = new Hizmet({
      firma,
      tip,
      aciklama,
      tarih: tarih || null,
      fiyat: fiyat !== '' && fiyat !== undefined ? parseFloat(fiyat) : null,
      paraBirimi: paraBirimi || 'TRY',
      durum: durum || 'bekliyor',
      urunAdi: urunAdi || '',
      adet: adet !== '' && adet !== undefined ? parseFloat(adet) : null,
      faturaTarihi: faturaTarihi || null,
      oncekiDurum: oncekiDurum || ''
    });
    await hizmet.save();
    res.status(201).json(hizmet);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Hizmet güncelle
router.put('/:id', async (req, res) => {
  try {
    const { tip, aciklama, tarih, fiyat, paraBirimi, durum, urunAdi, adet, faturaTarihi, oncekiDurum } = req.body;
    if (!tip) return res.status(400).json({ error: 'Hizmet tipi gerekli.' });
    if (!aciklama && tip !== 'urun-tedariki') return res.status(400).json({ error: 'Açıklama gerekli.' });
    const hizmet = await Hizmet.findByIdAndUpdate(
      req.params.id,
      {
        tip,
        aciklama,
        tarih: tarih || null,
        fiyat: fiyat !== '' && fiyat !== undefined ? parseFloat(fiyat) : null,
        paraBirimi: paraBirimi || 'TRY',
        durum: durum || 'bekliyor',
        urunAdi: urunAdi || '',
        adet: adet !== '' && adet !== undefined ? parseFloat(adet) : null,
        faturaTarihi: faturaTarihi || null,
        oncekiDurum: oncekiDurum !== undefined ? oncekiDurum : ''
      },
      { new: true, runValidators: true }
    );
    if (!hizmet) return res.status(404).json({ error: 'Hizmet bulunamadı.' });
    res.json(hizmet);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sadece durum güncelle (tick için)
router.patch('/:id/durum', async (req, res) => {
  try {
    const { durum, oncekiDurum } = req.body;
    const hizmet = await Hizmet.findByIdAndUpdate(
      req.params.id,
      { durum, oncekiDurum },
      { new: true, runValidators: true }
    );
    if (!hizmet) return res.status(404).json({ error: 'Hizmet bulunamadı.' });
    res.json(hizmet);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Hizmet sil
router.delete('/:id', async (req, res) => {
  try {
    const hizmet = await Hizmet.findByIdAndDelete(req.params.id);
    if (!hizmet) return res.status(404).json({ error: 'Hizmet bulunamadı.' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

