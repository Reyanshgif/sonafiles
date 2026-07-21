const Vendor = require('../models/Vendor');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// ── Generate JWT Token ─────────────────────────────────────────────
const generateToken = (vendor) => {
  return jwt.sign(
    { id: vendor._id, role: vendor.role || 'vendor' },
    process.env.JWT_SECRET || 'mysecretkey',
    { expiresIn: '30d' }
  );
};

// ── Send Token Response ────────────────────────────────────────────
const sendToken = (vendor, statusCode, res) => {
  const token = generateToken(vendor);
  
  // Remove password from output
  const vendorData = vendor.toObject ? vendor.toObject() : vendor;
  delete vendorData.password;
  
  res.status(statusCode).json({
    success: true,
    token,
    vendor: {
      id: vendorData._id,
      shopName: vendorData.shopName,
      ownerName: vendorData.ownerName,
      email: vendorData.email,
      phone: vendorData.phone,
      role: vendorData.role || 'vendor',
      isApproved: vendorData.isApproved || false,
      businessType: vendorData.businessType,
      address: vendorData.address
    }
  });
};

// ── @desc    Register Vendor ──────────────────────────────────────
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    const {
      shopName,
      ownerName,
      email,
      phone,
      password,
      businessType,
      gstNumber,
      panNumber,
      bisLicence,
      address   // ← this is the nested object
    } = req.body;

    // Validate required fields
    if (!shopName || !ownerName || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide all required fields: shopName, ownerName, email, phone, password'
      });
    }

    // Check if vendor exists
    const existing = await Vendor.findOne({ email });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Email already registered.'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create vendor with hashed password
    const vendor = await Vendor.create({
      shopName,
      ownerName,
      email,
      phone,
      password: hashedPassword,  // ← hashed password
      businessType: businessType || 'retailer',
      gstNumber,
      panNumber,
      bisLicence,
      address: address ? {  // ← explicitly map sub-fields
        street: address.street,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        country: address.country || 'India'
      } : undefined,
      isApproved: false,  // Needs admin approval
      isActive: true
    });

    sendToken(vendor, 201, res);
  } catch (err) {
    next(err);
  }
};

// ── @desc    Login Vendor ──────────────────────────────────────────
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide email and password'
      });
    }

    // Find vendor with password field
    const vendor = await Vendor.findOne({ email }).select('+password');
    if (!vendor) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Check if vendor is active
    if (!vendor.isActive) {
      return res.status(403).json({
        success: false,
        error: 'Account is deactivated. Please contact support.'
      });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, vendor.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    sendToken(vendor, 200, res);
  } catch (err) {
    next(err);
  }
};

// ── @desc    Get Current Vendor ────────────────────────────────────
// @route   GET /api/auth/me
// @access  Private (Vendor only)
exports.getMe = async (req, res, next) => {
  try {
    const vendor = await Vendor.findById(req.vendor._id)
      .populate('user', 'firstName lastName email phone');

    if (!vendor) {
      return res.status(404).json({
        success: false,
        error: 'Vendor not found'
      });
    }

    res.json({
      success: true,
      data: vendor
    });
  } catch (err) {
    next(err);
  }
};

// ── @desc    Update Vendor Profile ─────────────────────────────────
// @route   PUT /api/auth/update
// @access  Private (Vendor only)
exports.updateProfile = async (req, res, next) => {
  try {
    const {
      shopName,
      ownerName,
      phone,
      businessType,
      gstNumber,
      panNumber,
      bisLicence,
      address,
      bankDetails
    } = req.body;

    const vendor = await Vendor.findById(req.vendor._id);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        error: 'Vendor not found'
      });
    }

    // Update allowed fields
    if (shopName) vendor.shopName = shopName;
    if (ownerName) vendor.ownerName = ownerName;
    if (phone) vendor.phone = phone;
    if (businessType) vendor.businessType = businessType;
    if (gstNumber) vendor.gstNumber = gstNumber;
    if (panNumber) vendor.panNumber = panNumber;
    if (bisLicence) vendor.bisLicence = bisLicence;
    if (address) vendor.address = address;
    if (bankDetails) vendor.bankDetails = bankDetails;

    await vendor.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: vendor
    });
  } catch (err) {
    next(err);
  }
};

// ── @desc    Change Password ──────────────────────────────────────
// @route   PUT /api/auth/change-password
// @access  Private (Vendor only)
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Please provide current and new password'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 6 characters'
      });
    }

    const vendor = await Vendor.findById(req.vendor._id).select('+password');
    if (!vendor) {
      return res.status(404).json({
        success: false,
        error: 'Vendor not found'
      });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, vendor.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    vendor.password = await bcrypt.hash(newPassword, salt);
    await vendor.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (err) {
    next(err);
  }
};

// ── @desc    Request Password Reset ──────────────────────────────
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Please provide email'
      });
    }

    const vendor = await Vendor.findOne({ email });
    if (!vendor) {
      return res.status(404).json({
        success: false,
        error: 'No vendor found with this email'
      });
    }

    // Generate reset token (you can implement this)
    // For now, just send a success message
    res.json({
      success: true,
      message: 'Password reset instructions sent to your email'
    });
  } catch (err) {
    next(err);
  }
};