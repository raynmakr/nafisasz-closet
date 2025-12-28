import jwt from 'jsonwebtoken';
import {
  getUserPurseBalance,
  getCoinTransactions,
  getGiftingLimits,
  createGiftCard,
  claimGiftCard,
  getPendingGiftCards,
  getUser,
} from '../lib/db.js';
import {
  validateGift,
  validateCoinSpending,
  getMaxApplicableCoins,
  awardEngagementReward,
  adminAwardCoins,
  getPlatformCoinStats,
} from '../lib/purse.js';
import { getCoinValue, getCurrencySymbol, formatCoinsWithValue } from '../lib/earning-rules.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

function verifyToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  try {
    const token = authHeader.split(' ')[1];
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const decoded = verifyToken(req);
  if (!decoded) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const pathParts = req.url.split('?')[0].split('/').filter(Boolean);
    const action = pathParts[2]; // /api/purse/[action]
    const subAction = pathParts[3]; // /api/purse/claim/[giftCardId]

    // GET /api/purse/balance - Get user's coin balance
    if (req.method === 'GET' && action === 'balance') {
      return handleGetBalance(req, res, decoded);
    }

    // GET /api/purse/transactions - Get transaction history
    if (req.method === 'GET' && action === 'transactions') {
      return handleGetTransactions(req, res, decoded);
    }

    // GET /api/purse/gifts - Get pending gift cards
    if (req.method === 'GET' && action === 'gifts') {
      return handleGetGifts(req, res, decoded);
    }

    // GET /api/purse/limits - Get gifting limits
    if (req.method === 'GET' && action === 'limits') {
      return handleGetLimits(req, res, decoded);
    }

    // POST /api/purse/gift - Create a gift card
    if (req.method === 'POST' && action === 'gift') {
      return handleCreateGift(req, res, decoded);
    }

    // POST /api/purse/claim/:giftCardId - Claim a gift card
    if (req.method === 'POST' && action === 'claim') {
      return handleClaimGift(req, res, decoded, subAction);
    }

    // POST /api/purse/validate-spend - Validate coin spending for checkout
    if (req.method === 'POST' && action === 'validate-spend') {
      return handleValidateSpend(req, res, decoded);
    }

    // POST /api/purse/engagement - Award engagement reward
    if (req.method === 'POST' && action === 'engagement') {
      return handleEngagementReward(req, res, decoded);
    }

    // Admin endpoints
    if (action === 'admin') {
      return handleAdminEndpoints(req, res, decoded, subAction);
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Purse API error:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/purse/balance
 * Returns user's coin balance with currency info
 */
async function handleGetBalance(req, res, decoded) {
  const balance = await getUserPurseBalance(decoded.userId);

  if (!balance) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.json({
    coins: balance.coins,
    lifetimeEarned: balance.lifetimeEarned,
    currency: balance.currency,
    coinValue: balance.coinValue,
    symbol: balance.symbol,
    value: balance.value,
    valueFormatted: `${balance.symbol}${balance.value.toFixed(2)}`,
    goldBasisText: balance.goldBasisText,
    displayText: formatCoinsWithValue(balance.coins, balance.currency),
  });
}

/**
 * GET /api/purse/transactions?page=1&limit=20
 * Returns paginated transaction history
 */
async function handleGetTransactions(req, res, decoded) {
  const { page = '1', limit = '20' } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;

  const transactions = await getCoinTransactions(decoded.userId, limitNum, offset);

  // Get user's currency for formatting
  const user = await getUser(decoded.userId);
  const currency = user?.currency || 'USD';

  // Format transactions
  const formattedTransactions = transactions.map((tx) => ({
    id: tx.id,
    type: tx.type,
    amount: tx.amount,
    source: tx.source,
    balanceAfter: tx.balance_after,
    createdAt: tx.created_at,
    relatedUserName: tx.related_user_name,
    listingTitle: tx.listing_title,
    valueFormatted: `${getCurrencySymbol(currency)}${Math.abs(getCoinValue(tx.amount, currency)).toFixed(2)}`,
    description: getTransactionDescription(tx),
  }));

  return res.json({
    transactions: formattedTransactions,
    page: pageNum,
    limit: limitNum,
    hasMore: transactions.length === limitNum,
  });
}

/**
 * GET /api/purse/gifts
 * Returns pending gift cards for the user
 */
async function handleGetGifts(req, res, decoded) {
  const gifts = await getPendingGiftCards(decoded.userId);

  // Get user's currency for formatting
  const user = await getUser(decoded.userId);
  const currency = user?.currency || 'USD';

  const formattedGifts = gifts.map((gift) => ({
    id: gift.id,
    amount: gift.amount,
    senderName: gift.sender_name,
    message: gift.message,
    createdAt: gift.created_at,
    expiresAt: gift.expires_at,
    valueFormatted: formatCoinsWithValue(gift.amount, currency),
  }));

  return res.json({ gifts: formattedGifts });
}

/**
 * GET /api/purse/limits
 * Returns user's current gifting limits
 */
async function handleGetLimits(req, res, decoded) {
  const limits = await getGiftingLimits(decoded.userId);

  return res.json({
    giftsSent: limits.gifts_sent || 0,
    giftsRemaining: 5 - (limits.gifts_sent || 0),
    totalAmountSent: limits.total_amount_sent || 0,
    amountRemaining: 55 - (limits.total_amount_sent || 0),
    maxPerGift: 11,
    maxGiftsPerMonth: 5,
    maxAmountPerMonth: 55,
  });
}

/**
 * POST /api/purse/gift
 * Create a gift card
 */
async function handleCreateGift(req, res, decoded) {
  const { recipientId, amount, message } = req.body;

  if (!recipientId || !amount) {
    return res.status(400).json({ error: 'recipientId and amount are required' });
  }

  const amountNum = parseInt(amount, 10);

  // Validate gift
  const validation = await validateGift(decoded.userId, recipientId, amountNum);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  // Create gift card
  const giftCard = await createGiftCard(decoded.userId, recipientId, amountNum, message);

  // Get currency for formatting
  const user = await getUser(decoded.userId);
  const currency = user?.currency || 'USD';

  return res.json({
    success: true,
    giftCard: {
      id: giftCard.id,
      amount: giftCard.amount,
      recipientId: giftCard.recipient_id,
      message: giftCard.message,
      expiresAt: giftCard.expires_at,
      valueFormatted: formatCoinsWithValue(giftCard.amount, currency),
    },
  });
}

/**
 * POST /api/purse/claim/:giftCardId
 * Claim a gift card
 */
async function handleClaimGift(req, res, decoded, giftCardId) {
  if (!giftCardId) {
    return res.status(400).json({ error: 'Gift card ID required' });
  }

  const result = await claimGiftCard(parseInt(giftCardId, 10), decoded.userId);

  // Get user's currency for formatting
  const user = await getUser(decoded.userId);
  const currency = user?.currency || 'USD';

  return res.json({
    success: true,
    amount: result.amount,
    newBalance: result.newBalance,
    valueFormatted: formatCoinsWithValue(result.amount, currency),
  });
}

/**
 * POST /api/purse/validate-spend
 * Validate coin spending for checkout
 */
async function handleValidateSpend(req, res, decoded) {
  const { itemPrice, coinsToApply } = req.body;

  if (!itemPrice) {
    return res.status(400).json({ error: 'itemPrice is required' });
  }

  const priceNum = parseFloat(itemPrice);
  const coinsNum = parseInt(coinsToApply, 10) || 0;

  // Get user's balance and currency
  const balance = await getUserPurseBalance(decoded.userId);
  if (!balance) {
    return res.status(404).json({ error: 'User not found' });
  }

  const validation = validateCoinSpending(priceNum, coinsNum, balance.coins, balance.currency);

  if (!validation.valid) {
    return res.status(400).json({
      valid: false,
      error: validation.error,
      maxApplicable: getMaxApplicableCoins(priceNum, balance.coins, balance.currency),
    });
  }

  return res.json({
    valid: true,
    discount: validation.discount,
    coinsUsed: validation.coinsUsed,
    finalPrice: validation.finalPrice,
    discountFormatted: `${balance.symbol}${validation.discount.toFixed(2)}`,
    finalPriceFormatted: `${balance.symbol}${validation.finalPrice.toFixed(2)}`,
    maxApplicable: getMaxApplicableCoins(priceNum, balance.coins, balance.currency),
  });
}

/**
 * POST /api/purse/engagement
 * Award engagement reward
 */
async function handleEngagementReward(req, res, decoded) {
  const { rewardType } = req.body;

  if (!rewardType) {
    return res.status(400).json({ error: 'rewardType is required' });
  }

  const validTypes = [
    'COMPLETE_PROFILE',
    'CONNECT_INSTAGRAM',
    'UPLOAD_PROFILE_PHOTO',
    'ENABLE_NOTIFICATIONS',
  ];

  if (!validTypes.includes(rewardType)) {
    return res.status(400).json({ error: 'Invalid reward type' });
  }

  const result = await awardEngagementReward(decoded.userId, rewardType);

  return res.json(result);
}

/**
 * Admin endpoints
 */
async function handleAdminEndpoints(req, res, decoded, subAction) {
  // Check if user is admin
  const user = await getUser(decoded.userId);
  if (user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  // POST /api/purse/admin/award
  if (req.method === 'POST' && subAction === 'award') {
    const { userId, amount, reason } = req.body;

    if (!userId || !amount || !reason) {
      return res.status(400).json({ error: 'userId, amount, and reason are required' });
    }

    const result = await adminAwardCoins(
      parseInt(userId, 10),
      parseInt(amount, 10),
      reason,
      decoded.userId
    );

    return res.json({ success: true, ...result });
  }

  // GET /api/purse/admin/stats
  if (req.method === 'GET' && subAction === 'stats') {
    const stats = await getPlatformCoinStats();
    return res.json(stats);
  }

  return res.status(404).json({ error: 'Admin endpoint not found' });
}

/**
 * Generate human-readable transaction description
 */
function getTransactionDescription(tx) {
  const descriptions = {
    earned: {
      welcome_bonus: 'Welcome bonus',
      referral_signup_bonus: 'Referral signup bonus',
      referral_successful: `Referral reward from ${tx.related_user_name || 'friend'}`,
      first_purchase: 'First purchase milestone',
      third_purchase: 'Third purchase milestone',
      fifth_purchase: 'Fifth purchase milestone',
      tenth_purchase: 'Tenth purchase milestone',
      birthday_month: 'Birthday reward',
      curator_first_sale: 'First sale milestone',
      curator_10_sales: '10 sales milestone',
      curator_50_sales: '50 sales milestone',
      curator_100_followers: '100 followers milestone',
      curator_high_rating: 'High rating milestone',
      complete_profile: 'Profile completion reward',
      connect_instagram: 'Instagram connection reward',
      upload_profile_photo: 'Profile photo reward',
      enable_notifications: 'Notifications enabled reward',
      write_review: 'Review reward',
      admin_award: 'Admin award',
    },
    spent: {
      checkout: tx.listing_title ? `Purchase: ${tx.listing_title}` : 'Purchase discount',
    },
    gifted: {
      gift_sent: `Gift to ${tx.related_user_name || 'user'}`,
    },
    received: {
      gift_received: `Gift from ${tx.related_user_name || 'user'}`,
    },
  };

  const typeDescriptions = descriptions[tx.type] || {};
  return typeDescriptions[tx.source] || tx.source || tx.type;
}
