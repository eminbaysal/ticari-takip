const express = require('express');
const router = express.Router();
const Firma = require('../models/Firma');
const Hizmet = require('../models/Hizmet');

// Tüm firmalar
router.get('/', async (req, res) => {
  try {
    const firmalar = await Firma.find().sort({ ad: 1 });
    res.json(firmalar);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Firma oluştur
router.post('/', async (req, res) => {
  try {
    const { ad, not, website } = req.body;
    if (!ad) return res.status(400).json({ error: 'Firma adı gerekli.' });
    const firma = new Firma({ ad, not, website });
    await firma.save();
    res.status(201).json(firma);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Firma güncelle
router.put('/:id', async (req, res) => {
  try {
    const { ad, not, website } = req.body;
    if (!ad) return res.status(400).json({ error: 'Firma adı gerekli.' });
    const firma = await Firma.findById(req.params.id);
    if (!firma) return res.status(404).json({ error: 'Firma bulunamadı.' });
    firma.ad = ad;
    firma.not = not || '';
    firma.website = website || '';
    await firma.save();
    res.json(firma);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Firma sil
router.delete('/:id', async (req, res) => {
  try {
    const firma = await Firma.findByIdAndDelete(req.params.id);
    if (!firma) return res.status(404).json({ error: 'Firma bulunamadı.' });
    await Hizmet.deleteMany({ firma: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Firma detay + hizmetler
router.get('/:id/detay', async (req, res) => {
  try {
    const firma = await Firma.findById(req.params.id);
    if (!firma) return res.status(404).json({ error: 'Firma bulunamadı.' });
    const hizmetler = await Hizmet.find({ firma: req.params.id }).sort({ createdAt: -1 });
    res.json({ firma, hizmetler });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

