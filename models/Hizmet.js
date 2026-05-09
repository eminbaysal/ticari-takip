const mongoose = require('mongoose');

const hizmetSchema = new mongoose.Schema({
  firma: { type: mongoose.Schema.Types.ObjectId, ref: 'Firma', required: true },
  tip: {
    type: String,
    required: true
  },
  aciklama: { type: String, required: true, trim: true },
  tarih: { type: Date, default: null },
  urunAdi: { type: String, trim: true, default: '' },
  adet: { type: Number, default: null },
  fiyat: { type: Number, default: null },
  paraBirimi: { type: String, enum: ['TRY', 'USD'], default: 'TRY' },
  durum: {
    type: String,
    required: true,
    enum: ['bekliyor', 'tamamlandi', 'tahsil-edildi'],
    default: 'bekliyor'
  }
}, { timestamps: true });

module.exports = mongoose.model('Hizmet', hizmetSchema);

