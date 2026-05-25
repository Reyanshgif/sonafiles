const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const Vendor = require('../models/Vendor');
const jwt = require('jsonwebtoken');

// Helper to verify vendor token (used in other routes)
const verifyVendor = async (req) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mysecretkey');
    return await Vendor.findOne({ user: decoded.id });
  } catch {
    return null;
  }
};

// ────────────────────────────────────────────────
// POST /api/orders
// Create new order – compatible with frontend payload
// ────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    console.log('📦 [ORDER CREATE] Received payload:', JSON.stringify(req.body, null, 2));

    const {
      user,               // can be null (guest) or user _id string
      items,
      shippingAddress,
      paymentMethod = 'cod',
      subtotal,
      tax = 0,
      shipping = 0,
      total
    } = req.body;

    // 1. Validate items array
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Items array is required and cannot be empty'
      });
    }

    // 2. Validate shipping address
    if (!shippingAddress ||
        !shippingAddress.fullName ||
        !shippingAddress.addressLine1 ||
        !shippingAddress.city ||
        !shippingAddress.state ||
        !shippingAddress.pincode ||
        !shippingAddress.phone) {
      return res.status(400).json({
        success: false,
        error: 'Complete shipping address is required (fullName, addressLine1, city, state, pincode, phone)'
      });
    }

    // 3. Process each item: validate product, check stock, prepare order item
    const orderItems = [];
    for (const item of items) {
      if (!item.product) {
        return res.status(400).json({
          success: false,
          error: 'Every item must have a product ID'
        });
      }

      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(404).json({
          success: false,
          error: `Product not found: ${item.product}`
        });
      }

      const requestedQty = Number(item.quantity) || 1;
      if (product.stock < requestedQty) {
        return res.status(400).json({
          success: false,
          error: `Insufficient stock for "${product.name}" (only ${product.stock} available)`
        });
      }

      orderItems.push({
        product: product._id,
        vendor: product.vendor,               // taken from product document
        name: item.name || product.name,
        price: Number(item.price) || product.price,
        quantity: requestedQty,
        total: Number(item.total) || (Number(item.price || product.price) * requestedQty),
        image: item.image || (product.images?.[0] || '')
      });

      // Reduce stock
      await Product.findByIdAndUpdate(product._id, {
        $inc: { stock: -requestedQty }
      });
    }

    // 4. Calculate final total if not provided
    const calculatedSubtotal = orderItems.reduce((sum, item) => sum + item.total, 0);
    const finalTotal = Number(total) || (Number(subtotal || calculatedSubtotal) + Number(tax) + Number(shipping));

    // 5. Create the order
    const order = await Order.create({
      user: user || null,                     // guest checkout allowed
      items: orderItems,
      shippingAddress: {
        fullName: shippingAddress.fullName.trim(),
        addressLine1: shippingAddress.addressLine1.trim(),
        addressLine2: (shippingAddress.addressLine2 || '').trim(),
        city: shippingAddress.city.trim(),
        state: shippingAddress.state.trim(),
        pincode: shippingAddress.pincode.trim(),
        phone: shippingAddress.phone.trim()
      },
      paymentMethod: paymentMethod.toLowerCase(),
      subtotal: Number(subtotal || calculatedSubtotal),
      tax: Number(tax),
      shipping: Number(shipping),
      total: finalTotal,
      status: 'pending',
      statusHistory: [{
        status: 'pending',
        note: 'Order placed successfully',
        timestamp: new Date()
      }]
    });

    // 6. Optional: increment totalOrders for involved vendors
    const uniqueVendorIds = [...new Set(orderItems.map(i => i.vendor.toString()))];
    if (uniqueVendorIds.length > 0) {
      await Vendor.updateMany(
        { _id: { $in: uniqueVendorIds } },
        { $inc: { totalOrders: 1 } }
      );
    }

    console.log(`✅ Order created successfully – ID: ${order._id} / Order# ${order.orderId}`);

    res.status(201).json({
      success: true,
      message: 'Order placed successfully!',
      data: order
    });

  } catch (error) {
    console.error('❌ [ORDER CREATE] Failed:', error.stack || error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server error while creating order'
    });
  }
});

// ────────────────────────────────────────────────
// The rest of your routes (vendor orders, status update, etc.)
// ────────────────────────────────────────────────

// GET /api/orders/vendor   (vendor's own orders)
router.get('/vendor', async (req, res) => {
  try {
    const vendor = await verifyVendor(req);
    if (!vendor) {
      return res.status(401).json({ success: false, error: 'Not authorized' });
    }

    const orders = await Order.find({ 'items.vendor': vendor._id })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/orders/:id
router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('items.product', 'name images description metalType purity');

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/orders/:id/status   (vendor updates status)
router.put('/:id/status', async (req, res) => {
  try {
    const vendor = await verifyVendor(req);
    if (!vendor) {
      return res.status(401).json({ success: false, error: 'Not authorized' });
    }

    const { status, note, trackingNumber, courierName } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    if (!order.items.some(item => item.vendor.toString() === vendor._id.toString())) {
      return res.status(403).json({ success: false, error: 'Not authorized for this order' });
    }

    order.status = status;
    if (note) {
      order.statusHistory.push({ status, note, timestamp: new Date() });
    }
    if (trackingNumber) order.trackingNumber = trackingNumber;
    if (courierName) order.courierName = courierName;

    await order.save();

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/orders/:id/payment   (for payment gateway callbacks)
router.put('/:id/payment', async (req, res) => {
  try {
    const { paymentStatus, razorpayOrderId, razorpayPaymentId } = req.body;
    
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    order.paymentStatus = paymentStatus;
    if (razorpayOrderId) order.paymentDetails.razorpayOrderId = razorpayOrderId;
    if (razorpayPaymentId) order.paymentDetails.razorpayPaymentId = razorpayPaymentId;

    await order.save();

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;