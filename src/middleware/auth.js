const jwt = require('jsonwebtoken');
const Vendor = require('../models/Vendor');

// ── Protect: verify JWT ───────────────────────────────────
exports.protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
      return res.status(401).json({ status: 'error', message: 'Not authenticated. Please log in.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const vendor = await Vendor.findById(decoded.id).select('-password');
    if (!vendor) {
      return res.status(401).json({ status: 'error', message: 'Vendor no longer exists.' });
    }
    if (!vendor.isActive) {
      return res.status(403).json({ status: 'error', message: 'Account is deactivated.' });
    }

    req.vendor = vendor;
    next();
  } catch (err) {
    return res.status(401).json({ status: 'error', message: 'Invalid or expired token.' });
  }
};

// ── Role Guard ────────────────────────────────────────────
exports.restrictTo = (...roles) => (req, res, next) => {
  if (!roles.includes(req.vendor.role)) {
    return res.status(403).json({ status: 'error', message: 'You do not have permission.' });
  }
  next();
};
