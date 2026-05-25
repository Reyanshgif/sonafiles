const Earning = require('../models/Earning');
const Vendor  = require('../models/Vendor');
const axios   = require('axios'); // used for Razorpay REST

// ── Razorpay Payout API helper ────────────────────────────────────────────────
const razorpayRequest = async (method, endpoint, data = {}) => {
  const auth = Buffer.from(
    `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
  ).toString('base64');

  const res = await axios({
    method,
    url: `https://api.razorpay.com/v1${endpoint}`,
    data,
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
  });
  return res.data;
};

// GET /api/earnings  — paginated transactions
exports.getEarnings = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, type, month, year } = req.query;
    const filter = { vendor: req.vendor._id };
    if (type) filter.type = type;
    if (month && year) {
      const start = new Date(year, month - 1, 1);
      const end   = new Date(year, month, 1);
      filter.createdAt = { $gte: start, $lt: end };
    }

    const skip = (page - 1) * limit;
    const [earnings, total] = await Promise.all([
      Earning.find(filter).populate('order', 'orderId customer').sort({ createdAt: -1 }).skip(skip).limit(+limit),
      Earning.countDocuments(filter),
    ]);

    res.json({ status: 'success', results: earnings.length, total, pages: Math.ceil(total / limit), data: { earnings } });
  } catch (err) { next(err); }
};

// GET /api/earnings/summary  — dashboard summary
exports.getSummary = async (req, res, next) => {
  try {
    const vendor = await Vendor.findById(req.vendor._id);

    // Monthly breakdown (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);

    const monthly = await Earning.aggregate([
      { $match: { vendor: req.vendor._id, type: 'credit', createdAt: { $gte: sixMonthsAgo } } },
      { $group: {
        _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
        total: { $sum: '$amount' }, count: { $sum: 1 },
      }},
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    res.json({
      status: 'success',
      data: {
        totalEarnings:  vendor.totalEarnings,
        pendingPayout:  vendor.pendingPayout,
        totalOrders:    vendor.totalOrders,
        monthlyBreakdown: monthly,
      },
    });
  } catch (err) { next(err); }
};

// POST /api/earnings/payout/setup  — register vendor bank with Razorpay
exports.setupPayout = async (req, res, next) => {
  try {
    const { accountHolderName, accountNumber, ifscCode, bankName } = req.body;
    const vendor = await Vendor.findById(req.vendor._id);

    // 1) Create Razorpay Contact (once)
    let contactId = vendor.razorpayContactId;
    if (!contactId) {
      const contact = await razorpayRequest('POST', '/contacts', {
        name: accountHolderName || vendor.ownerName,
        email: vendor.email,
        contact: vendor.phone,
        type: 'vendor',
        reference_id: vendor._id.toString(),
      });
      contactId = contact.id;
      vendor.razorpayContactId = contactId;
    }

    // 2) Create Fund Account
    const fundAccount = await razorpayRequest('POST', '/fund_accounts', {
      contact_id: contactId,
      account_type: 'bank_account',
      bank_account: { name: accountHolderName, ifsc: ifscCode, account_number: accountNumber },
    });

    vendor.razorpayFundAccountId = fundAccount.id;
    vendor.bankDetails = { accountHolderName, accountNumber, ifscCode, bankName };
    await vendor.save();

    res.json({ status: 'success', message: 'Bank account registered for payouts.', data: { fundAccountId: fundAccount.id } });
  } catch (err) { next(err); }
};

// POST /api/earnings/payout/request  — trigger payout
exports.requestPayout = async (req, res, next) => {
  try {
    const vendor = await Vendor.findById(req.vendor._id);

    if (!vendor.razorpayFundAccountId) {
      return res.status(400).json({ status: 'error', message: 'Please set up bank account first.' });
    }
    if (vendor.pendingPayout < 100) {
      return res.status(400).json({ status: 'error', message: 'Minimum payout amount is ₹100.' });
    }

    const amount = req.body.amount || vendor.pendingPayout; // paise
    if (amount > vendor.pendingPayout) {
      return res.status(400).json({ status: 'error', message: `Max available: ₹${vendor.pendingPayout}` });
    }

    // Razorpay Payout API
    const payout = await razorpayRequest('POST', '/payouts', {
      account_number: process.env.RAZORPAY_ACCOUNT_NUMBER, // your platform account
      fund_account_id: vendor.razorpayFundAccountId,
      amount: Math.round(amount * 100), // paise
      currency: 'INR',
      mode: 'IMPS',
      purpose: 'vendor_settlement',
      queue_if_low_balance: true,
      reference_id: `PAYOUT-${vendor._id}-${Date.now()}`,
      narration: 'Sonachandi Vendor Payout',
    });

    // Record transaction
    const balanceBefore = vendor.pendingPayout;
    vendor.pendingPayout -= amount;
    await vendor.save();

    await Earning.create({
      vendor: vendor._id, type: 'payout', amount,
      description: `Payout to ${vendor.bankDetails?.accountNumber?.slice(-4) ? '****' + vendor.bankDetails.accountNumber.slice(-4) : 'bank account'}`,
      payoutStatus: 'processing',
      razorpayPayoutId: payout.id,
      razorpayFundAccountId: vendor.razorpayFundAccountId,
      utrNumber: payout.utr,
      balanceBefore, balanceAfter: vendor.pendingPayout,
    });

    res.json({ status: 'success', message: 'Payout initiated.', data: { payoutId: payout.id, amount, utr: payout.utr } });
  } catch (err) {
    // Razorpay errors come back in err.response.data
    if (err.response?.data) {
      return res.status(400).json({ status: 'error', message: err.response.data.error?.description || 'Payout failed.' });
    }
    next(err);
  }
};

// POST /api/earnings/payout/webhook  — Razorpay webhook for payout status
exports.payoutWebhook = async (req, res, next) => {
  try {
    const { event, payload } = req.body;
    const payoutData = payload?.payout?.entity;
    if (!payoutData) return res.sendStatus(200);

    const earning = await Earning.findOne({ razorpayPayoutId: payoutData.id });
    if (earning) {
      const statusMap = { processed: 'paid', failed: 'failed', reversed: 'failed' };
      earning.payoutStatus = statusMap[event.split('.')[1]] || earning.payoutStatus;
      if (payoutData.utr) earning.utrNumber = payoutData.utr;
      await earning.save();
    }
    res.sendStatus(200);
  } catch (err) { next(err); }
};
