const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    shopName: {
      type: String,
      required: [true, 'Shop/Business name is required'],
      trim: true,
      minlength: [3, 'Shop name must be at least 3 characters']
    },
    ownerName: {
      type: String,
      required: [true, 'Owner name is required'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
      unique: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      match: [/^[6-9]\d{9}$/, 'Please enter a valid 10-digit Indian mobile number']
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false  // Don't return password by default
    },
    role: {
      type: String,
      enum: ['vendor', 'admin'],
      default: 'vendor'
    },
    isActive: { 
      type: Boolean, 
      default: true 
    },
    isVerified: { 
      type: Boolean, 
      default: false 
    },
    isApproved: { 
      type: Boolean, 
      default: false 
    },
    approvedAt: { 
      type: Date 
    },
    businessType: {
      type: String,
      enum: ['retailer', 'manufacturer', 'wholesaler', 'designer', 'other'],
      default: 'retailer'
    },
    gstNumber: { 
      type: String, 
      trim: true, 
      uppercase: true 
    },
    panNumber: { 
      type: String, 
      trim: true, 
      uppercase: true 
    },
    bisLicence: { 
      type: String, 
      trim: true 
    },
    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      pincode: {
        type: String,
        trim: true,
        match: [/^[1-9][0-9]{5}$/, 'Invalid Indian pincode format']
      },
      country: { type: String, default: 'India', trim: true }
    },
    bankDetails: {
      accountHolderName: { type: String, trim: true },
      accountNumber: { type: String, trim: true },
      ifscCode: { type: String, trim: true, uppercase: true },
      bankName: { type: String, trim: true },
      upiId: { type: String, trim: true }
    },
    razorpayContactId: { type: String },
    razorpayFundAccountId: { type: String },
    totalEarnings: { type: Number, default: 0 },
    pendingPayout: { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 },
    totalProducts: { type: Number, default: 0 },
    profileImage: { type: String },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    verifiedAt: { type: Date }
  },
  { 
    timestamps: true, 
    toJSON: { virtuals: true }, 
    toObject: { virtuals: true } 
  }
);

// ── Indexes for better performance ──────────────────────────────
vendorSchema.index({ phone: 1 });
vendorSchema.index({ email: 1 });
vendorSchema.index({ isApproved: 1, isActive: 1 });
vendorSchema.index({ 'address.city': 1, 'address.state': 1 });

// ── Virtual: Full address ────────────────────────────────────────
vendorSchema.virtual('fullAddress').get(function() {
  if (!this.address) return '';
  const parts = [
    this.address.street,
    this.address.city,
    this.address.state,
    this.address.pincode,
    this.address.country
  ].filter(Boolean);
  return parts.join(', ');
});

// ── Method: Check if vendor can sell ─────────────────────────────
vendorSchema.methods.canSell = function() {
  return this.isActive && this.isApproved;
};

// ── Method: Get public profile data ──────────────────────────────
vendorSchema.methods.getPublicProfile = function() {
  return {
    id: this._id,
    shopName: this.shopName,
    ownerName: this.ownerName,
    email: this.email,
    phone: this.phone,
    businessType: this.businessType,
    address: this.address,
    isApproved: this.isApproved,
    totalProducts: this.totalProducts,
    totalOrders: this.totalOrders,
    profileImage: this.profileImage,
    createdAt: this.createdAt
  };
};

module.exports = mongoose.model('Vendor', vendorSchema);