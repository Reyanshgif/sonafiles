const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Vendor = require('../models/Vendor');
const jwt = require('jsonwebtoken');

// Middleware to verify token and get vendor
const protect = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized - Please login first'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mysecretkey');
    
    // Check if user is a vendor
    const vendor = await Vendor.findOne({ user: decoded.id });
    
    if (!vendor) {
      return res.status(403).json({
        success: false,
        error: 'You must be a registered vendor to add products'
      });
    }
    
    req.vendorId = vendor._id;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Not authorized - Invalid token'
    });
  }
};

// ========== PUBLIC ROUTES ==========

// @desc    Get all products (public - for homepage)
// @route   GET /api/products
// @access  Public
router.get('/', async (req, res) => {
  try {
    // Get ALL products - no status filter!
    const products = await Product.find({})
      .populate({
        path: 'vendor',
        populate: { path: 'user', select: 'firstName lastName' }
      })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Get single product by ID
// @route   GET /api/products/:id
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate({
        path: 'vendor',
        populate: { path: 'user', select: 'firstName lastName' }
      });

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// ========== VENDOR ROUTES (Protected) ==========

// @desc    Add new product
// @route   POST /api/products
// @access  Private (Vendors only)
router.post('/', protect, async (req, res) => {
  try {
    console.log('📦 Adding new product');

    const productData = {
      name: req.body.name,
      description: req.body.description,
      price: req.body.price,
      stock: req.body.stock,
      category: req.body.category,
      metalType: req.body.metalType,
      purity: req.body.purity,
      weight: req.body.weight,
      images: req.body.images || [],
      gemstone: req.body.gemstone,
      occasion: req.body.occasion,
      mrp: req.body.mrp,
      makingCharges: req.body.makingCharges,
      gst: req.body.gst,
      sku: req.body.sku,
      vendor: req.vendorId,
      isActive: true  // Set active by default
    };

    const product = await Product.create(productData);

    res.status(201).json({
      success: true,
      data: product
    });

  } catch (error) {
    console.error('❌ Product creation error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Get products by vendor (own products)
// @route   GET /api/products/vendor/me
// @access  Private
router.get('/vendor/me', protect, async (req, res) => {
  try {
    const products = await Product.find({ vendor: req.vendorId })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private
router.put('/:id', protect, async (req, res) => {
  try {
    let product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Make sure user owns this product
    if (product.vendor.toString() !== req.vendorId.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this product'
      });
    }

    product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Make sure user owns this product
    if (product.vendor.toString() !== req.vendorId.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this product'
      });
    }

    await product.deleteOne();

    res.json({
      success: true,
      data: {}
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;