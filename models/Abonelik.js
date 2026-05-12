const mongoose = require('mongoose');

const abonelikSchema = new mongoose.Schema({
  firma:            { type: mongoose.Schema.Types.ObjectId, ref: 'Firma', required: true },
  paketAdi:         { type: String, required: true, trim: true },
  aylikUcret:       { type: Number, required: true },
  paraBirimi:       { type: String, enum: ['TRY', 'USD', 'EUR'], default: 'TRY' },
  baslangicTarihi:  { type: Date, required: true },
  devreAlmaUcreti:  { type: Number, default: null },
  aciklama:         { type: String, default: '', trim: true },
  aktif:            { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Abonelik', abonelikSchema);
