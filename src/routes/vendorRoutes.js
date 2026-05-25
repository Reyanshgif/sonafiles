const express = require('express');
const router = express.Router();
const Vendor = require('../models/Vendor');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Middleware to protect routes (checks user token)
const protect = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, error: 'Not authorized' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mysecretkey');
    req.userId = decoded.id; // this is the User's _id
    next();
  } catch (error) {
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
};

// POST /api/vendors/register – Register as a vendor
router.post('/register', protect, async (req, res) => {
  try {
    const {
      businessName,
      businessType,
      contactEmail,
      contactPhone,
      gstNumber,
      panNumber,
      address,
      city,
      state,
      pincode
    } = req.body;

    // Get the user from the token
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Check if user already has a vendor profile
    const existingVendor = await Vendor.findOne({ user: req.userId });
    if (existingVendor) {
      return res.status(400).json({ success: false, error: 'You are already a vendor' });
    }

    // Create vendor document linked to this user
    const vendor = await Vendor.create({
      user: req.userId,                         // ✅ required field
      shopName: businessName,
      ownerName: `${user.firstName} ${user.lastName}`,
      email: contactEmail || user.email,
      phone: contactPhone || user.phone,
      businessType,
      gstNumber,
      panNumber,
      address: {
        street: address,
        city,
        state,
        pincode,
        country: 'India'
      }
      // isApproved defaults to false
    });

    // Optionally update the user's role to 'vendor'
    user.role = 'vendor';
    await user.save();

    res.status(201).json({
      success: true,
      message: 'Vendor registration submitted for approval',
      data: vendor
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// GET /api/vendors – Get all approved vendors (public)
router.get('/', async (req, res) => {
  try {
    const vendors = await Vendor.find({ isApproved: true }).populate('user', 'firstName lastName');
    res.json({ success: true, count: vendors.length, data: vendors });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// GET /api/vendors/dashboard/me – Get own vendor profile (using user reference)
router.get('/dashboard/me', protect, async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ user: req.userId }).populate('user', 'firstName lastName email phone');
    if (!vendor) {
      return res.status(404).json({ success: false, error: 'Vendor profile not found' });
    }
    res.json({ success: true, data: vendor });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;