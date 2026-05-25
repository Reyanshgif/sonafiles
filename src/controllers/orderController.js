// src/controllers/orderController.js
const Order = require('../models/Order');
const Product = require('../models/Product');
const Vendor = require('../models/Vendor');
const Earning = require('../models/Earning');

// @desc    Create new order (from index.html)
// @route   POST /api/orders
// @access  Public (but we attach user from token)
exports.createOrder = async (req, res, next) => {
  try {
    console.log('📦 Creating order with body:', req.body);

    const { items, shippingAddress, paymentMethod = 'cod', subtotal, tax = 0, shipping = 0, total } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, error: 'No items provided' });
    }

    // Create order using YOUR model structure
    const order = await Order.create({
      user: req.user ? req.user._id : null,           // from auth middleware
      items: items.map(item => ({
        product: item.product,
        vendor: item.vendor,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        total: item.total || item.price * item.quantity,
        image: item.image
      })),
      shippingAddress: {
        fullName: shippingAddress.fullName || shippingAddress.name,
        addressLine1: shippingAddress.addressLine1 || shippingAddress.street,
        city: shippingAddress.city,
        state: shippingAddress.state,
        pincode: shippingAddress.pincode,
        phone: shippingAddress.phone
      },
      paymentMethod: paymentMethod.toLowerCase(),
      subtotal: subtotal || total,
      tax,
      shipping,
      total,
      status: 'pending',
      statusHistory: [{ status: 'pending', note: 'Order placed successfully', timestamp: new Date() }]
    });

    // Reduce stock for each product
    for (const item of items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: -item.quantity }
      });
    }

    res.status(201).json({
      success: true,
      message: 'Order placed successfully!',
      data: order
    });

  } catch (error) {
    console.error('❌ Create Order Error:', error);
    next(error);
  }
};

// @desc    Get vendor's orders (exactly what vendor-order.html calls)
// @route   GET /api/orders/vendor
exports.getVendorOrders = async (req, res, next) => {
  try {
    const { status, search } = req.query;

    let filter = { 'items.vendor': req.vendor._id };

    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { orderId: { $regex: search, $options: 'i' } },
        { 'shippingAddress.fullName': { $regex: search, $options: 'i' } }
      ];
    }

    const orders = await Order.find(filter)
      .populate('items.product', 'name images price')
      .populate('user', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: orders
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single order
// @route   GET /api/orders/:id
exports.getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      'items.vendor': req.vendor._id
    }).populate('items.product');

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
};

// @desc    Update order status (used by vendor-order.html)
// @route   PUT /api/orders/:id/status
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { status, note, trackingNumber } = req.body;

    const order = await Order.findOne({
      _id: req.params.id,
      'items.vendor': req.vendor._id
    });

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found or not yours' });
    }

    const oldStatus = order.status;
    order.status = status;

    // Add to history
    order.statusHistory.push({
      status,
      note: note || `Changed from ${oldStatus} to ${status}`,
      timestamp: new Date()
    });

    if (trackingNumber) order.trackingNumber = trackingNumber;
    if (status === 'delivered') order.deliveredAt = new Date();
    if (status === 'cancelled') order.cancelledAt = new Date();

    // Credit earnings when Delivered
    if (status === 'delivered' && order.paymentMethod === 'cod' || order.paymentStatus === 'paid') {
      const vendor = await Vendor.findById(req.vendor._id);
      if (vendor) {
        vendor.pendingPayout = (vendor.pendingPayout || 0) + order.total;
        vendor.totalEarnings = (vendor.totalEarnings || 0) + order.total;
        await vendor.save();

        await Earning.create({
          vendor: req.vendor._id,
          order: order._id,
          type: 'credit',
          amount: order.total,
          description: `Order ${order.orderId} delivered`,
        });
      }
    }

    await order.save();

    res.json({
      success: true,
      message: `Order updated to ${status}`,
      data: order
    });
  } catch (err) {
    next(err);
  }
};