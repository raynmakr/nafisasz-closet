/**
 * PURSE EARNING RULES
 * All coin amounts for the Gold Coins loyalty program
 *
 * Philosophy: Tiered reduction model
 * - Referrals: Moderate rewards (50% reduction from original)
 * - Buyers: Lower rewards (60-70% reduction) - easier to acquire
 * - Curators: Higher rewards (30-40% reduction) - critical supply side
 * - Engagement: Minimal rewards (50% reduction)
 */

// ===========================================
// REFERRAL REWARDS
// ===========================================
export const REFERRAL_REWARDS = {
  // When friend makes their first purchase, referrer gets this
  REFERRAL_SUCCESSFUL: 11, // $49.50 value

  // Friend's welcome bonus when they sign up via referral link
  REFERRAL_SIGNUP_BONUS: 6, // $27.00 value
};

// ===========================================
// BUYER MILESTONE REWARDS
// ===========================================
export const BUYER_MILESTONES = {
  FIRST_PURCHASE: {
    threshold: 1,
    coins: 2, // $9.00 value
    source: 'first_purchase',
    flag: 'coins_first_purchase',
  },
  THIRD_PURCHASE: {
    threshold: 3,
    coins: 3, // $13.50 value
    source: 'third_purchase',
    flag: 'coins_third_purchase',
  },
  FIFTH_PURCHASE: {
    threshold: 5,
    coins: 4, // $18.00 value
    source: 'fifth_purchase',
    flag: 'coins_fifth_purchase',
  },
  TENTH_PURCHASE: {
    threshold: 10,
    coins: 7, // $31.50 value
    source: 'tenth_purchase',
    flag: 'coins_tenth_purchase',
  },
};

// Birthday reward (auto-awarded once per year)
export const BIRTHDAY_REWARD = 2; // $9.00 value

// ===========================================
// CURATOR MILESTONE REWARDS
// ===========================================
export const CURATOR_MILESTONES = {
  FIRST_SALE: {
    threshold: 1,
    coins: 7, // $31.50 value
    source: 'curator_first_sale',
    flag: 'coins_first_sale',
  },
  TEN_SALES: {
    threshold: 10,
    coins: 28, // $126.00 value
    source: 'curator_10_sales',
    flag: 'coins_10_sales',
  },
  FIFTY_SALES: {
    threshold: 50,
    coins: 67, // $301.50 value
    source: 'curator_50_sales',
    flag: 'coins_50_sales',
  },
  HUNDRED_FOLLOWERS: {
    threshold: 100,
    coins: 14, // $63.00 value
    source: 'curator_100_followers',
    flag: 'coins_100_followers',
  },
  HIGH_RATING_90DAYS: {
    minRating: 4.8,
    minDays: 90,
    coins: 20, // $90.00 value
    source: 'curator_high_rating',
    flag: 'coins_high_rating_90days',
  },
};

// ===========================================
// ENGAGEMENT REWARDS
// ===========================================
export const ENGAGEMENT_REWARDS = {
  COMPLETE_PROFILE: {
    coins: 1, // $4.50 value
    source: 'complete_profile',
    flag: 'coins_profile_complete',
  },
  CONNECT_INSTAGRAM: {
    coins: 1, // $4.50 value
    source: 'connect_instagram',
    flag: 'coins_instagram_connected',
  },
  UPLOAD_PROFILE_PHOTO: {
    coins: 1, // $4.50 value
    source: 'upload_profile_photo',
    flag: 'coins_photo_uploaded',
  },
  ENABLE_NOTIFICATIONS: {
    coins: 1, // $4.50 value
    source: 'enable_notifications',
    flag: 'coins_notifications_enabled',
  },
  WRITE_REVIEW: {
    coins: 1, // $4.50 value per review
    source: 'write_review',
    // No flag - can earn multiple times
  },
  WELCOME_BONUS: {
    coins: 6, // $27.00 value
    source: 'welcome_bonus',
    flag: 'coins_welcome_bonus',
  },
};

// ===========================================
// SPENDING RULES
// ===========================================
export const SPENDING_RULES = {
  MIN_COINS: 2, // Minimum 2 GC to redeem ($9.00 minimum discount)
  MAX_DISCOUNT_PERCENT: 0.5, // Maximum 50% of item price
};

// ===========================================
// GIFTING RULES
// ===========================================
export const GIFTING_RULES = {
  MAX_PER_GIFT: 11, // Maximum 11 GC per gift ($49.50 value)
  MAX_GIFTS_PER_MONTH: 5, // Maximum 5 gifts per month
  MAX_AMOUNT_PER_MONTH: 55, // Maximum 55 GC per month ($247.50 value)
  GIFT_EXPIRY_DAYS: 30, // Gift cards expire after 30 days
};

// ===========================================
// CURRENCY VALUES (locked January 2026)
// ===========================================
export const CURRENCY_VALUES = {
  USD: { value: 4.50, symbol: '$' },
  GBP: { value: 3.50, symbol: '£' },
  EUR: { value: 4.00, symbol: '€' },
  CAD: { value: 6.00, symbol: 'C$' },
  AED: { value: 15.00, symbol: 'AED' },
};

/**
 * Get coin value in a specific currency
 * @param {number} coins - Number of coins
 * @param {string} currency - Currency code (USD, GBP, EUR, CAD, AED)
 * @returns {number} Value in the specified currency
 */
export function getCoinValue(coins, currency = 'USD') {
  const rate = CURRENCY_VALUES[currency] || CURRENCY_VALUES.USD;
  return coins * rate.value;
}

/**
 * Get currency symbol
 * @param {string} currency - Currency code
 * @returns {string} Currency symbol
 */
export function getCurrencySymbol(currency = 'USD') {
  const rate = CURRENCY_VALUES[currency] || CURRENCY_VALUES.USD;
  return rate.symbol;
}

/**
 * Format coins with value display
 * @param {number} coins - Number of coins
 * @param {string} currency - Currency code
 * @returns {string} Formatted string like "10 GC ($45.00)"
 */
export function formatCoinsWithValue(coins, currency = 'USD') {
  const value = getCoinValue(coins, currency);
  const symbol = getCurrencySymbol(currency);
  return `${coins} GC (${symbol}${value.toFixed(2)})`;
}
