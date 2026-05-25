const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const {
  getEarnings, getSummary, setupPayout, requestPayout, payoutWebhook,
} = require('../controllers/earningController');

// Webhook — no auth, called by Razorpay
router.post('/payout/webhook', payoutWebhook);

router.use(protect);

router.get('/',                getSummary);      // dashboard summary
router.get('/transactions',    getEarnings);     // paginated history
router.post('/payout/setup',   setupPayout);     // register bank
router.post('/payout/request', requestPayout);   // trigger payout

module.exports = router;
