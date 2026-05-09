const express = require('express');
const router = express.Router();
const Hizmet = require('../models/Hizmet');
const Firma = require('../models/Firma');

// Tüm hizmetler (özet için)
router.get('/ozet', async (req, res) => {
  try {
    const hizmetler = await Hizmet.find({ fiyat: { $ne: null } });
    let genelToplam = 0;
    let tahsilEdilen = 0;
    let bekleyen = 0;
    hizmetler.forEach(h => {
      const f = h.fiyat || 0;
      genelToplam += f;
      if (h.durum === 'tahsil-edildi') tahsilEdilen += f;
      else bekleyen += f;
    });
    res.json({ genelToplam, tahsilEdilen, bekleyen });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Firma hizmet ekle
router.post('/', async (req, res) => {
  try {
    const { firma, tip, aciklama, tarih, fiyat, durum } = req.body;
    if (!firma) return res.status(400).json({ error: 'Firma ID gerekli.' });
    if (!tip) return res.status(400).json({ error: 'Hizmet tipi gerekli.' });
    if (!aciklama) return res.status(400).json({ error: 'Açıklama gerekli.' });
    const firmaDoc = await Firma.findById(firma);
    if (!firmaDoc) return res.status(404).json({ error: 'Firma bulunamadı.' });
    const hizmet = new Hizmet({
      firma,
      tip,
      aciklama,
      tarih: tarih || null,
      fiyat: fiyat !== '' && fiyat !== undefined ? parseFloat(fiyat) : null,
      durum: durum || 'bekliyor'
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
    const { tip, aciklama, tarih, fiyat, durum } = req.body;
    if (!tip) return res.status(400).json({ error: 'Hizmet tipi gerekli.' });
    if (!aciklama) return res.status(400).json({ error: 'Açıklama gerekli.' });
    const hizmet = await Hizmet.findByIdAndUpdate(
      req.params.id,
      {
        tip,
        aciklama,
        tarih: tarih || null,
        fiyat: fiyat !== '' && fiyat !== undefined ? parseFloat(fiyat) : null,
        durum: durum || 'bekliyor'
      },
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
