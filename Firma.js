const mongoose = require('mongoose');

const firmaSchema = new mongoose.Schema({
  ad: { type: String, required: true, trim: true },
  not: { type: String, trim: true, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Firma', firmaSchema);
