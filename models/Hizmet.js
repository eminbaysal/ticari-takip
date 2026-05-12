const mongoose = require('mongoose');

const hizmetSchema = new mongoose.Schema({
  firma: { type: mongoose.Schema.Types.ObjectId, ref: 'Firma', required: true },
  tip: {
    type: String,
    required: true
  },
  aciklama: { type: String, required: false, trim: true, default: '' },
  tarih: { type: Date, default: null },
  urunAdi: { type: String, trim: true, default: '' },
  adet: { type: Number, default: null },
  faturaTarihi: { type: Date, default: null },
  oncekiDurum: { type: String, default: '' },
  fiyat: { type: Number, default: null },
  paraBirimi: { type: String, enum: ['TRY', 'USD', 'EUR'], default: 'TRY' },
  faturaKesildi: { type: Boolean, default: false },
  tahsilEdildi:  { type: Boolean, default: false },
  // Döviz → TL dönüşüm snapshot (işlem anındaki kur)
  faturaTL:   { type: Number, default: null },   // fatura anındaki TL karşılığı
  faturaKuru: { type: Number, default: null },   // fatura anındaki USD/TRY kuru
  odemeTL:    { type: Number, default: null },   // ödeme anındaki TL karşılığı
  odemeKuru:  { type: Number, default: null },   // ödeme anındaki USD/TRY kuru
  // Abonelik bağlantısı (internet-aboneligi otomatik kayıtları için)
  abonelikId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Abonelik', default: null },
  abonelikAy:  { type: Date, default: null },   // ayın ilk günü — duplicate kontrol
  devreAlma:   { type: Boolean, default: false }, // tek seferlik devreye alma kalemi
  durum: {
    type: String,
    required: true,
    enum: ['bekliyor', 'tamamlandi', 'fatura-kesildi', 'tahsil-edildi'],
    default: 'bekliyor'
  }
}, { timestamps: true });

module.exports = mongoose.model('Hizmet', hizmetSchema);

