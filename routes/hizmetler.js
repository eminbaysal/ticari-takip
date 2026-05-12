const express = require('express');
const router = express.Router();
const Hizmet = require('../models/Hizmet');
const Firma = require('../models/Firma');

// Tüm hizmetler (özet için)
router.get('/ozet', async (req, res) => {
  try {
    const hizmetler = await Hizmet.find({ fiyat: { $ne: null } });
    let tryToplam = 0, tryTahsil = 0, tryBekleyen = 0, tryFatura = 0;
    let usdToplam = 0, usdTahsil = 0, usdBekleyen = 0, usdFatura = 0;
    hizmetler.forEach(h => {
      const f = h.fiyat || 0;
      const pb = h.paraBirimi || 'TRY';
      // Yeni boolean flag'ler birincil kaynak; yoksa eski durum alanına bak (geriye dönük uyum)
      const isFatura = h.faturaKesildi === true || h.durum === 'fatura-kesildi';
      const isTahsil = h.tahsilEdildi  === true || h.durum === 'tahsil-edildi';
      if (pb === 'USD') {
        usdToplam += f;
        if (isTahsil) usdTahsil += f; else usdBekleyen += f;
        if (isFatura)  usdFatura += f;
        // TL snapshot: USD hizmetler için TL karşılığını TRY toplamlarına ekle
        if (isFatura && h.faturaTL != null) tryFatura += h.faturaTL;
        if (isTahsil && h.odemeTL  != null) tryTahsil += h.odemeTL;
      } else {
        tryToplam += f;
        if (isTahsil) tryTahsil += f; else tryBekleyen += f;
        if (isFatura)  tryFatura += f;
      }
    });
    res.json({ tryToplam, tryTahsil, tryBekleyen, tryFatura, usdToplam, usdTahsil, usdBekleyen, usdFatura });
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

// Sadece durum güncelle (eski uyum için)
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

// Bağımsız fatura / tahsil flag toggle
router.patch('/:id/flags', async (req, res) => {
  try {
    const hizmet = await Hizmet.findById(req.params.id);
    if (!hizmet) return res.status(404).json({ error: 'Hizmet bulunamadı.' });

    // Mevcut efektif durumu hesapla (eski durum alanı → geriye dönük uyum)
    const curFatura = hizmet.faturaKesildi === true || hizmet.durum === 'fatura-kesildi';
    const curTahsil = hizmet.tahsilEdildi  === true || hizmet.durum === 'tahsil-edildi';

    const newFatura = req.body.faturaKesildi !== undefined ? req.body.faturaKesildi : curFatura;
    const newTahsil = req.body.tahsilEdildi  !== undefined ? req.body.tahsilEdildi  : curTahsil;

    // durum alanını yeni flag'lerle senkronize et (toplam hesaplamaları için)
    const billingDurums = ['fatura-kesildi', 'tahsil-edildi'];
    const baseDurum = !billingDurums.includes(hizmet.durum)
      ? hizmet.durum
      : (hizmet.oncekiDurum || 'bekliyor');

    let durum;
    if (newTahsil)       durum = 'tahsil-edildi';
    else if (newFatura)  durum = 'fatura-kesildi';
    else                 durum = baseDurum;

    // USD → TL snapshot: işlem anındaki kuru kayıt altına al
    const isUSD   = (hizmet.paraBirimi || 'TRY') === 'USD';
    const kurUSD  = isUSD && req.body.kurUSD ? parseFloat(req.body.kurUSD) : null;
    const fiyat   = hizmet.fiyat || 0;

    const updateFields = { faturaKesildi: newFatura, tahsilEdildi: newTahsil, durum };

    if (isUSD && req.body.faturaKesildi !== undefined) {
      if (newFatura && kurUSD) {
        // Fatura ilk kez kesiliyor → snapshot kaydet (mevcut snapshot varsa değiştirme)
        if (!hizmet.faturaTL) {
          updateFields.faturaTL   = Math.round(fiyat * kurUSD * 100) / 100;
          updateFields.faturaKuru = kurUSD;
        }
      } else if (!newFatura) {
        // Fatura geri alındı → snapshot temizle
        updateFields.faturaTL   = null;
        updateFields.faturaKuru = null;
      }
    }

    if (isUSD && req.body.tahsilEdildi !== undefined) {
      if (newTahsil && kurUSD) {
        // Ödeme ilk kez alındı → snapshot kaydet (mevcut snapshot varsa değiştirme)
        if (!hizmet.odemeTL) {
          updateFields.odemeTL   = Math.round(fiyat * kurUSD * 100) / 100;
          updateFields.odemeKuru = kurUSD;
        }
      } else if (!newTahsil) {
        // Ödeme geri alındı → snapshot temizle
        updateFields.odemeTL   = null;
        updateFields.odemeKuru = null;
      }
    }

    const updated = await Hizmet.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true }
    );
    res.json(updated);
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

