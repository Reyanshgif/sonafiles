const express = require('express');
const router  = express.Router();
const { getRates, calculateLivePrice } = require('../controllers/goldController');

router.get('/rates',     getRates);
router.get('/calculate', calculateLivePrice);

module.exports = router;
