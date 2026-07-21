exports.getRates = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: {
        gold_24k: 6350,
        gold_22k: 5989,
        gold_18k: 4901,
        silver: 84200,
        updatedAt: new Date().toISOString()
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.calculateLivePrice = async (req, res, next) => {
  try {
    const { weight = 10, karat = 22, makingCharge = 12 } = req.query;
    const goldRatePerGram = 5989 / 10;
    const purity = karat / 24;
    const goldValue = goldRatePerGram * weight * purity;
    const making = goldValue * (makingCharge / 100);
    
    res.json({
      success: true,
      data: {
        goldValue: Math.round(goldValue),
        makingCharges: Math.round(making),
        total: Math.round(goldValue + making)
      }
    });
  } catch (err) {
    next(err);
  }
};