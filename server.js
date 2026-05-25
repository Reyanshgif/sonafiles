const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');  // ← ADD THIS

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// ========== SERVE STATIC FILES ==========
app.use('/frontend', express.static(path.join(__dirname, 'frontend')));
// This serves files from the 'frontend' folder at the '/frontend' URL path

// ========== IMPORT ALL ROUTES ==========
const authRoutes = require('./src/routes/authRoutes');
const vendorRoutes = require('./src/routes/vendorRoutes');
const productRoutes = require('./src/routes/productRoutes');
const orderRoutes = require('./src/routes/orderRoutes');

// ========== USE ALL ROUTES ==========
app.use('/api/auth', authRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);

// Test route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'success',
    message: 'Server is running!',
    timestamp: new Date().toISOString()
  });
});

// Home route
app.get('/', (req, res) => {
  res.send('🎉 Sonachandi API is working!');
});

// MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/sonachandi');
    console.log('✅ MongoDB Connected Successfully');
  } catch (error) {
    console.log('❌ MongoDB Connection Error:', error.message);
  }
};

connectDB();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});