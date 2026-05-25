/**
 * Jewellery Auto-Pricing Engine
 *
 * Formula (industry standard):
 *   goldValue      = goldRatePerGram × weightGrams × (karat / 24)
 *   wastage        = goldValue × (wastagePercent / 100)
 *   makingCharge   = goldValue × (makingChargePercent / 100) + makingChargeFlat
 *   basePrice      = goldValue + wastage + makingCharge + stoneCharges
 *   sellingPrice   = basePrice × (1 + gstPercent / 100)
 */

const KARAT_PURITY = { 24: 1.0, 22: 0.9167, 18: 0.75, 14: 0.5833, 10: 0.4167 };

/**
 * @param {Object} params
 * @param {number} params.goldRatePer10g   - Current MCX rate per 10g (₹)
 * @param {number} params.weightGrams      - Net weight of jewellery in grams
 * @param {number} params.karat            - 22, 18, etc.
 * @param {number} params.makingChargePercent
 * @param {number} params.makingChargeFlat
 * @param {number} params.wastagePercent
 * @param {number} params.stoneCharges
 * @param {number} params.gstPercent
 * @returns {{ goldValue, wastage, makingCharge, basePrice, sellingPrice, breakdown }}
 */
exports.calculatePrice = ({
  goldRatePer10g,
  weightGrams,
  karat = 22,
  makingChargePercent = 12,
  makingChargeFlat = 0,
  wastagePercent = 5,
  stoneCharges = 0,
  gstPercent = 3,
}) => {
  const goldRatePerGram = goldRatePer10g / 10;
  const purity = KARAT_PURITY[karat] || KARAT_PURITY[22];

  const goldValue    = +(goldRatePerGram * weightGrams * purity).toFixed(2);
  const wastage      = +(goldValue * (wastagePercent / 100)).toFixed(2);
  const makingCharge = +(goldValue * (makingChargePercent / 100) + makingChargeFlat).toFixed(2);
  const basePrice    = +(goldValue + wastage + makingCharge + stoneCharges).toFixed(2);
  const gstAmount    = +(basePrice * (gstPercent / 100)).toFixed(2);
  const sellingPrice = +(basePrice + gstAmount).toFixed(2);

  return {
    goldValue,
    wastage,
    makingCharge,
    stoneCharges,
    gstAmount,
    basePrice,
    sellingPrice,
    breakdown: {
      goldRatePer10g,
      goldRatePerGram: +goldRatePerGram.toFixed(2),
      karat,
      purityPercent: +(purity * 100).toFixed(2),
      weightGrams,
      makingChargePercent,
      wastagePercent,
      gstPercent,
    },
  };
};

/**
 * Get current gold rate (mock — replace with real MCX API)
 * Returns rate per 10g in INR
 */
exports.getCurrentGoldRate = async () => {
  // TODO: integrate real API e.g. https://www.goldapi.io
  // For now, return a mock rate with small random variance
  const BASE_RATES = { '24K': 6350, '22K': 5989, '18K': 4901 };
  const variance = (Math.random() - 0.5) * 20;
  return {
    per10g_24K: +(BASE_RATES['24K'] + variance).toFixed(0),
    per10g_22K: +(BASE_RATES['22K'] + variance * 0.9167).toFixed(0),
    per10g_18K: +(BASE_RATES['18K'] + variance * 0.75).toFixed(0),
    silver_perKg: 84200,
    updatedAt: new Date().toISOString(),
    source: 'MCX (mock)',
  };
};
