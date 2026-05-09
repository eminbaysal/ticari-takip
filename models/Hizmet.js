const mongoose = require('mongoose');

const hizmetSchema = new mongoose.Schema({
  firma: { type: mongoose.Schema.Types.ObjectId, ref: 'Firma', required: true },
  tip: {
    type: String,
    required: true,
    enum: ['danismanlik', 'urun-tedariki', 'cihaz-kurulumu', 'devreye-alma', 'diger']
  },
  aciklama: { type: String, required: true, trim: true },
  tarih: { type: Date, default: null },
  fiyat: { type: Number, default: null },
  durum: {
    type: String,
    required: true,
    enum: ['bekliyor', 'tamamlandi', 'tahsil-edildi'],
    default: 'bekliyor'
  }
}, { timestamps: true });

module.exports = mongoose.model('Hizmet', hizmetSchema);

