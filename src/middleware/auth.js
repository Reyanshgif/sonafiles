const jwt = require('jsonwebtoken');
const Vendor = require('../models/Vendor');

// ── Protect: Verify JWT ───────────────────────────────────────────
exports.protect = async (req, res, next) => {
  try {
    let token;
    
    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    // Also check for token in cookies (optional)
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: 'Not authenticated. Please log in.' 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mysecretkey');
    
    // Check if vendor exists
    const vendor = await Vendor.findById(decoded.id).select('-password');
    if (!vendor) {
      return res.status(401).json({ 
        success: false, 
        error: 'Vendor no longer exists.' 
      });
    }
    
    // Check if vendor is active
    if (!vendor.isActive) {
      return res.status(403).json({ 
        success: false, 
        error: 'Account is deactivated. Please contact support.' 
      });
    }

    // Attach vendor to request object
    req.vendor = vendor;
    req.vendorId = vendor._id;
    next();
    
  } catch (err) {
    // Handle specific JWT errors
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid token. Please log in again.' 
      });
    }
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        error: 'Token expired. Please log in again.' 
      });
    }
    
    return res.status(401).json({ 
      success: false, 
      error: err.message || 'Invalid or expired token.' 
    });
  }
};

// ── Role Guard ────────────────────────────────────────────────────
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.vendor) {
      return res.status(401).json({ 
        success: false, 
        error: 'Not authenticated. Please log in.' 
      });
    }
    
    const vendorRole = req.vendor.role || 'vendor';
    if (!roles.includes(vendorRole)) {
      return res.status(403).json({ 
        success: false, 
        error: `Access denied. Requires role: ${roles.join(' or ')}` 
      });
    }
    next();
  };
};

// ── Check if Vendor is Approved ──────────────────────────────────
exports.isApproved = async (req, res, next) => {
  try {
    if (!req.vendor) {
      return res.status(401).json({ 
        success: false, 
        error: 'Not authenticated.' 
      });
    }
    
    if (!req.vendor.isApproved) {
      return res.status(403).json({ 
        success: false, 
        error: 'Your account is pending approval. Please wait for admin verification.' 
      });
    }
    next();
  } catch (err) {
    next(err);
  }
};

// ── Optional: Get Vendor ID from Token ──────────────────────────
exports.getVendorIdFromToken = async (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mysecretkey');
    return decoded.id;
  } catch (err) {
    return null;
  }
};

// ── Optional: Verify Token (for WebSocket or special cases) ─────
exports.verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'mysecretkey');
  } catch (err) {
    return null;
  }
};