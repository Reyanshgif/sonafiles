const mongoose = require('mongoose');

const earningSchema = new mongoose.Schema(
  {
    vendor:       { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    order:        { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    type:         { type: String, enum: ['credit', 'payout', 'refund', 'adjustment'], required: true },
    amount:       { type: Number, required: true },
    description:  { type: String },

    // Payout details (for type: 'payout')
    payoutStatus: { type: String, enum: ['pending', 'processing', 'paid', 'failed'], default: 'pending' },
    razorpayPayoutId:   { type: String },
    razorpayFundAccountId: { type: String },
    utrNumber:    { type: String },   // UTR for bank transfer

    // Running balance
    balanceBefore: { type: Number },
    balanceAfter:  { type: Number },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Earning', earningSchema);
