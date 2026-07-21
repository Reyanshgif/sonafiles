const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ========== MODELS ==========
const UserSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: { type: String, unique: true },
  password: String,
  phone: String,
  role: { type: String, default: 'user' }
});
const User = mongoose.model('User', UserSchema);

const ProductSchema = new mongoose.Schema({
  name: String,
  description: String,
  price: Number,
  stock: Number,
  category: String,
  metalType: String,
  purity: String,
  weight: Number,
  images: [String],
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});
const Product = mongoose.model('Product', ProductSchema);

const VendorSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  shopName: String,
  businessType: String,
  address: String,
  city: String,
  state: String,
  pincode: String,
  isApproved: { type: Boolean, default: false }
});
const Vendor = mongoose.model('Vendor', VendorSchema);

// ========== AUTH ROUTES ==========
app.post('/api/auth/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone } = req.body;
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, error: 'User already exists' });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const user = await User.create({ firstName, lastName, email, password: hashedPassword, phone });
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || 'mysecretkey',
      { expiresIn: '30d' }
    );
    res.status(201).json({
      success: true,
      token,
      user: { id: user._id, firstName, lastName, email, phone, role: user.role }
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || 'mysecretkey',
      { expiresIn: '30d' }
    );
    res.json({
      success: true,
      token,
      user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone, role: user.role }
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ========== VENDOR ROUTES ==========
const protect = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, error: 'Not authorized' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mysecretkey');
    req.userId = decoded.id;
    next();
  } catch (error) {
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
};

app.post('/api/vendors/register', protect, async (req, res) => {
  try {
    const { shopName, businessType, address, city, state, pincode } = req.body;
    const existing = await Vendor.findOne({ user: req.userId });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Already a vendor' });
    }
    const vendor = await Vendor.create({
      user: req.userId,
      shopName,
      businessType,
      address,
      city,
      state,
      pincode
    });
    await User.findByIdAndUpdate(req.userId, { role: 'vendor' });
    res.status(201).json({ success: true, data: vendor });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ========== PRODUCT ROUTES ==========
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find({}).populate('vendor', 'firstName lastName shopName').sort({ createdAt: -1 });
    res.json({ success: true, count: products.length, data: products });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.get('/api/products/vendor/me', protect, async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ user: req.userId });
    if (!vendor) {
      return res.status(403).json({ success: false, error: 'Not a vendor' });
    }
    const products = await Product.find({ vendor: vendor._id }).sort({ createdAt: -1 });
    res.json({ success: true, count: products.length, data: products });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/products', protect, async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ user: req.userId });
    if (!vendor) {
      return res.status(403).json({ success: false, error: 'Not a vendor' });
    }
    const product = await Product.create({
      ...req.body,
      vendor: vendor._id
    });
    res.status(201).json({ success: true, data: product });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ========== HEALTH CHECK ==========
app.get('/api/health', (req, res) => {
  res.json({ status: 'success', message: 'Server running' });
});

// ========== MONGODB CONNECTION ==========
mongoose.connect('mongodb://127.0.0.1:27017/sonachandi')
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.log('❌ MongoDB Error:', err.message));

// ========== START SERVER ==========
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
});