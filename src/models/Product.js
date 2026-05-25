const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  stock: {
    type: Number,
    default: 0
  },
  category: {
    type: String,
    enum: ['necklace', 'earrings', 'ring', 'bangles', 'pendant', 'chain'],
    // Not required by default, but if provided must be one of these values
  },
  metalType: {
    type: String,
    enum: ['gold', 'silver', 'diamond', 'platinum'],
  },
  purity: String,
  weight: Number,
  images: [String],
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Product', productSchema);