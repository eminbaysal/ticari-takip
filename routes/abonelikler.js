const express = require('express');
const router  = express.Router();
const Abonelik = require('../models/Abonelik');
const Hizmet   = require('../models/Hizmet');
const Firma    = require('../models/Firma');

// ── Yardımcı: o ay için fatura günü (son günü aşmaz)
function faturaGunu(yil, ay, gun) {
  const sonGun = new Date(yil, ay + 1, 0).getDate();
  return new Date(yil, ay, Math.min(gun, sonGun));
}

// ── Yardımcı: ayın ilk günü (duplicate anahtar olarak)
function ayBaslangici(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

// ── Abonelik için eksik aylık kayıtları oluştur (idempotent)
async function tickAbonelik(ab) {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const start      = new Date(ab.baslangicTarihi);
  const billingDay = start.getDate();

  // 1. Devreye alma ücreti (tek seferlik, ilk ay)
  if (ab.devreAlmaUcreti) {
    const var_ = await Hizmet.findOne({ abonelikId: ab._id, devreAlma: true });
    if (!var_) {
      await Hizmet.create({
        firma: ab.firma, tip: 'internet-aboneligi',
        aciklama: `Devreye Alma — ${ab.paketAdi}`,
        tarih: start, fiyat: ab.devreAlmaUcreti,
        paraBirimi: ab.paraBirimi, durum: 'bekliyor',
        abonelikId: ab._id, devreAlma: true,
      });
    }
  }

  // 2. Aylık kayıtlar
  let yil = start.getFullYear();
  let ay  = start.getMonth();

  while (true) {
    const faturaT = faturaGunu(yil, ay, billingDay);
    if (faturaT > today) break;

    const ayKey = ayBaslangici(faturaT);
    const var2  = await Hizmet.findOne({
      abonelikId: ab._id,
      abonelikAy: ayKey,
      devreAlma: { $ne: true },
    });

    if (!var2) {
      await Hizmet.create({
        firma: ab.firma, tip: 'internet-aboneligi',
        aciklama: ab.paketAdi + (ab.aciklama ? ` — ${ab.aciklama}` : ''),
        tarih: faturaT, fiyat: ab.aylikUcret,
        paraBirimi: ab.paraBirimi, durum: 'bekliyor',
        abonelikId: ab._id, abonelikAy: ayKey, devreAlma: false,
      });
    }

    ay++;
    if (ay > 11) { ay = 0; yil++; }
  }
}

// ── Sonraki fatura tarihini hesapla
function sonrakiFatura(ab) {
  const start      = new Date(ab.baslangicTarihi);
  const billingDay = start.getDate();
  const today      = new Date();

  let yil = today.getFullYear();
  let ay  = today.getMonth();

  for (let i = 0; i < 13; i++) {
    const d = faturaGunu(yil, ay, billingDay);
    if (d > today) return d;
    ay++;
    if (ay > 11) { ay = 0; yil++; }
  }
  return null;
}

// ── Firma abonelikleri (+ tick)
router.get('/firma/:firmaId', async (req, res) => {
  try {
    const abonelikler = await Abonelik.find({ firma: req.params.firmaId }).sort({ createdAt: -1 });
    for (const ab of abonelikler.filter(a => a.aktif)) {
      await tickAbonelik(ab);
    }
    // Sonraki fatura tarihini ekle
    const result = abonelikler.map(ab => ({
      ...ab.toObject(),
      sonrakiFaturaTarihi: ab.aktif ? sonrakiFatura(ab) : null,
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Abonelik oluştur
router.post('/', async (req, res) => {
  try {
    const { firma, paketAdi, aylikUcret, paraBirimi, baslangicTarihi, devreAlmaUcreti, aciklama } = req.body;
    if (!firma || !paketAdi || !aylikUcret || !baslangicTarihi)
      return res.status(400).json({ error: 'Firma, paket adı, aylık ücret ve başlangıç tarihi zorunludur.' });

    if (!await Firma.findById(firma))
      return res.status(404).json({ error: 'Firma bulunamadı.' });

    const ab = await Abonelik.create({
      firma, paketAdi: paketAdi.trim(),
      aylikUcret: parseFloat(aylikUcret),
      paraBirimi: paraBirimi || 'TRY',
      baslangicTarihi: new Date(baslangicTarihi),
      devreAlmaUcreti: devreAlmaUcreti ? parseFloat(devreAlmaUcreti) : null,
      aciklama: aciklama || '', aktif: true,
    });
    await tickAbonelik(ab);
    res.status(201).json({ ...ab.toObject(), sonrakiFaturaTarihi: sonrakiFatura(ab) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Abonelik güncelle
router.put('/:id', async (req, res) => {
  try {
    const ab = await Abonelik.findById(req.params.id);
    if (!ab) return res.status(404).json({ error: 'Abonelik bulunamadı.' });

    const { paketAdi, aylikUcret, paraBirimi, devreAlmaUcreti, aciklama, aktif } = req.body;
    if (paketAdi        !== undefined) ab.paketAdi        = paketAdi.trim();
    if (aylikUcret      !== undefined) ab.aylikUcret      = parseFloat(aylikUcret);
    if (paraBirimi      !== undefined) ab.paraBirimi      = paraBirimi;
    if (devreAlmaUcreti !== undefined) ab.devreAlmaUcreti = devreAlmaUcreti ? parseFloat(devreAlmaUcreti) : null;
    if (aciklama        !== undefined) ab.aciklama        = aciklama;
    if (aktif           !== undefined) ab.aktif           = aktif;
    await ab.save();
    if (ab.aktif) await tickAbonelik(ab);
    res.json({ ...ab.toObject(), sonrakiFaturaTarihi: ab.aktif ? sonrakiFatura(ab) : null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Abonelik sil (+ oluşturulan hizmet kayıtları)
router.delete('/:id', async (req, res) => {
  try {
    const ab = await Abonelik.findByIdAndDelete(req.params.id);
    if (!ab) return res.status(404).json({ error: 'Abonelik bulunamadı.' });
    await Hizmet.deleteMany({ abonelikId: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
