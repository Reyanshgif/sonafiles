const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');

dotenv.config();

const app = express();

// ── Middleware ─────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Serve Static Files ───────────────────────────────────────────
app.use('/frontend', express.static(path.join(__dirname, 'frontend')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Import All Routes ────────────────────────────────────────────
const authRoutes = require('./src/routes/authRoutes');
const vendorRoutes = require('./src/routes/vendorRoutes');
const productRoutes = require('./src/routes/productRoutes');
const orderRoutes = require('./src/routes/orderRoutes');
const earningRoutes = require('./src/routes/earningRoutes');
const goldRoutes = require('./src/routes/goldRoutes');

// ── Use All Routes ───────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/earnings', earningRoutes);
app.use('/api/gold', goldRoutes);

// ── Health Check ──────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'success',
    message: 'Server is running!',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ── Home Route ────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.send('🎉 Sonachandi API is working! Visit /frontend/index.html for the website.');
});

// ── 404 Handler ──────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.url}`
  });
});

// ── Error Handler ─────────────────────────────────────────────────
const errorHandler = require('./src/middleware/errorhandeler');
app.use(errorHandler);

// ── MongoDB Connection ──────────────────────────────────────────
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sonachandi';
    await mongoose.connect(mongoURI);
    console.log('✅ MongoDB Connected Successfully');
  } catch (error) {
    console.log('❌ MongoDB Connection Error:', error.message);
    process.exit(1);
  }
};

connectDB();

// ── Start Server ──────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📱 Frontend: http://localhost:${PORT}/frontend/index.html`);
  console.log(`🔗 API: http://localhost:${PORT}/api/health`);
});