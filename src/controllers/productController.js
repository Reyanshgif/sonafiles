const Product = require('../models/Product');
const Vendor = require('../models/Vendor');
const { calculatePrice, getCurrentGoldRate } = require('../utils/pricing');
const axios = require('axios');
const FormData = require('form-data');

// ========== PUBLIC ROUTES ==========

// @desc    Get ALL products for public (homepage)
// @route   GET /api/products/public
// @access  Public
exports.getPublicProducts = async (req, res, next) => {
  try {
    const { category, metal, search } = req.query;
    const filter = {};
    
    // Optional filters (if provided)
    if (category) filter.category = category;
    if (metal) filter.metalType = metal;
    if (search) filter.name = { $regex: search, $options: 'i' };
    
    // Get all products - no vendor filter, show all active products
    const products = await Product.find(filter)
      .populate('vendor', 'shopName ownerName')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (err) { 
    next(err); 
  }
};

// @desc    Get single product (public)
// @route   GET /api/products/:id
// @access  Public
exports.getProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('vendor', 'shopName ownerName email phone');
      
    if (!product) {
      return res.status(404).json({ 
        status: 'error', 
        message: 'Product not found.' 
      });
    }
    
    res.json({ 
      status: 'success', 
      data: { product } 
    });
  } catch (err) { 
    next(err); 
  }
};

// @desc    Preview price calculation (public)
// @route   GET /api/products/preview-price
// @access  Public
exports.previewPrice = async (req, res, next) => {
  try {
    const goldRates = await getCurrentGoldRate();
    const pricing = calculatePrice({
      goldRatePer10g: goldRates.per10g_22K,
      weightGrams: +req.query.weightGrams || 10,
      karat: +req.query.karat || 22,
      makingChargePercent: +req.query.makingChargePercent || 12,
      makingChargeFlat: +req.query.makingChargeFlat || 0,
      wastagePercent: +req.query.wastagePercent || 5,
      stoneCharges: +req.query.stoneCharges || 0,
      gstPercent: +req.query.gstPercent || 3,
    });
    
    res.json({ 
      status: 'success', 
      data: { pricing, goldRates } 
    });
  } catch (err) { 
    next(err); 
  }
};

// ========== VENDOR ROUTES (Protected) ==========

// @desc    Get vendor's own products
// @route   GET /api/products
// @access  Private (Vendor only)
exports.getVendorProducts = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, category, metal, isActive, search } = req.query;
    const filter = { vendor: req.vendor._id };

    if (category)  filter.category = category;
    if (metal)     filter.metalType = metal;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (search) filter.name = { $regex: search, $options: 'i' };

    const skip = (page - 1) * limit;
    const [products, total] = await Promise.all([
      Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(+limit),
      Product.countDocuments(filter),
    ]);

    res.json({
      success: true,
      results: products.length,
      total,
      pages: Math.ceil(total / limit),
      data: products,
    });
  } catch (err) { 
    next(err); 
  }
};

// @desc    Get single vendor product (by ID)
// @route   GET /api/products/:id/vendor
// @access  Private (Vendor only)
exports.getVendorProduct = async (req, res, next) => {
  try {
    const product = await Product.findOne({ 
      _id: req.params.id, 
      vendor: req.vendor._id 
    });
    
    if (!product) {
      return res.status(404).json({ 
        status: 'error', 
        message: 'Product not found.' 
      });
    }
    
    res.json({ 
      status: 'success', 
      data: { product } 
    });
  } catch (err) { 
    next(err); 
  }
};

// @desc    Create new product
// @route   POST /api/products
// @access  Private (Vendor only)
exports.createProduct = async (req, res, next) => {
  try {
    const {
      name, 
      description, 
      category, 
      metalType,
      purity,
      weight,
      price,
      stock,
      images,
      makingCharges,
      gst,
      sku
    } = req.body;

    // Create product with basic fields
    const productData = {
      vendor: req.vendor._id,
      name,
      description,
      category,
      metalType,
      purity,
      weight: parseFloat(weight),
      price: parseFloat(price),
      stock: parseInt(stock),
      images: images || [],
      makingCharges: makingCharges ? parseFloat(makingCharges) : 0,
      gst: gst ? parseFloat(gst) : 3,
      sku: sku || '',
      isActive: true,
      status: 'active'
    };

    const product = await Product.create(productData);

    // Update vendor product count
    await Vendor.findByIdAndUpdate(req.vendor._id, { 
      $inc: { totalProducts: 1 } 
    });

    res.status(201).json({ 
      success: true, 
      data: product 
    });
  } catch (err) { 
    next(err); 
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private (Vendor only)
exports.updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findOne({ 
      _id: req.params.id, 
      vendor: req.vendor._id 
    });
    
    if (!product) {
      return res.status(404).json({ 
        status: 'error', 
        message: 'Product not found.' 
      });
    }

    const updated = await Product.findByIdAndUpdate(
      product._id, 
      req.body, 
      { new: true, runValidators: true }
    );
    
    res.json({ 
      success: true, 
      data: updated 
    });
  } catch (err) { 
    next(err); 
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private (Vendor only)
exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findOneAndDelete({ 
      _id: req.params.id, 
      vendor: req.vendor._id 
    });
    
    if (!product) {
      return res.status(404).json({ 
        status: 'error', 
        message: 'Product not found.' 
      });
    }
    
    // Update vendor product count
    await Vendor.findByIdAndUpdate(req.vendor._id, { 
      $inc: { totalProducts: -1 } 
    });
    
    res.json({ 
      success: true, 
      message: 'Product deleted.' 
    });
  } catch (err) { 
    next(err); 
  }
};

// @desc    Upload product images
// @route   POST /api/products/:id/images
// @access  Private (Vendor only)
exports.uploadImages = async (req, res, next) => {
  try {
    const product = await Product.findOne({ 
      _id: req.params.id, 
      vendor: req.vendor._id 
    });
    
    if (!product) {
      return res.status(404).json({ 
        status: 'error', 
        message: 'Product not found.' 
      });
    }

    if (!req.files?.length) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'No images uploaded.' 
      });
    }

    const newImages = [];
    for (const file of req.files) {
      const url = await uploadToImgBB(file.buffer, file.originalname);
      newImages.push({
        url,
        publicId: file.originalname,
        isPrimary: product.images.length === 0 && newImages.length === 0
      });
    }

    product.images.push(...newImages);
    await product.save();

    res.json({ 
      success: true, 
      data: { images: product.images } 
    });
  } catch (err) {
    console.error(err);
    next(err);
  }
};

// Helper function for imgBB upload
async function uploadToImgBB(buffer, originalname) {
  const form = new FormData();
  form.append('image', buffer, { filename: originalname });
  form.append('key', '6f9bd3c4179f3a9dba369ffafa732768');

  const res = await axios.post('https://api.imgbb.com/1/upload', form, {
    headers: form.getHeaders()
  });

  if (!res.data.success) {
    throw new Error(res.data.error?.message || 'ImgBB failed');
  }
  
  return res.data.data.url;
}