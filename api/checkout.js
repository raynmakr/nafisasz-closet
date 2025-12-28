import jwt from 'jsonwebtoken';
import { query, getUserPurseBalance, spendCoins, getCurrencyRate } from '../lib/db.js';
import { validateCoinSpending, getMaxApplicableCoins } from '../lib/purse.js';
import { getCoinValue } from '../lib/earning-rules.js';
import { updatePaymentIntentAmount } from '../lib/stripe.js';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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
    const action = pathParts[2]; // /api/checkout/[action]

    // POST /api/checkout/apply-coins
    if (req.method === 'POST' && action === 'apply-coins') {
      return handleApplyCoins(req, res, decoded);
    }

    // GET /api/checkout/coin-preview?listingId=X&coinsToApply=Y
    if (req.method === 'GET' && action === 'coin-preview') {
      return handleCoinPreview(req, res, decoded);
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Checkout API error:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * POST /api/checkout/apply-coins
 * Apply coins to a transaction during checkout
 * This is called when user confirms payment with coin discount
 */
async function handleApplyCoins(req, res, decoded) {
  const { listingId, coinsToApply, transactionId } = req.body;

  if (!transactionId) {
    return res.status(400).json({ error: 'transactionId is required' });
  }

  const coinsNum = parseInt(coinsToApply, 10);

  // Get transaction with payment intent
  const txResult = await query(
    'SELECT t.*, l.current_high_bid, l.starting_bid FROM transactions t JOIN listings l ON t.listing_id = l.id WHERE t.id = $1 AND t.buyer_id = $2',
    [transactionId, decoded.userId]
  );

  if (!txResult.rows[0]) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  const tx = txResult.rows[0];
  const itemPrice = parseFloat(tx.final_price);

  // Get user's balance and currency
  const balance = await getUserPurseBalance(decoded.userId);
  if (!balance) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Validate spending
  const validation = validateCoinSpending(itemPrice, coinsNum, balance.coins, balance.currency);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  // Spend coins
  const spendResult = await spendCoins(
    decoded.userId,
    coinsNum,
    tx.listing_id,
    parseInt(transactionId, 10)
  );

  // Update the payment intent amount if one exists
  let paymentIntent = null;
  if (tx.payment_intent_id) {
    try {
      paymentIntent = await updatePaymentIntentAmount(
        tx.payment_intent_id,
        validation.finalPrice,
        {
          coins_applied: coinsNum.toString(),
          coin_discount: validation.discount.toFixed(2),
          original_price: itemPrice.toFixed(2),
        }
      );
    } catch (error) {
      console.error('Failed to update payment intent:', error);
      // Continue even if update fails - we can still complete payment
    }
  }

  // Update transaction with coin discount info
  await query(
    `UPDATE transactions
     SET coins_applied = $1, coin_discount = $2, updated_at = CURRENT_TIMESTAMP
     WHERE id = $3`,
    [coinsNum, validation.discount, transactionId]
  );

  return res.json({
    success: true,
    coinsUsed: coinsNum,
    discount: validation.discount,
    finalPrice: validation.finalPrice,
    newBalance: spendResult.newBalance,
    discountFormatted: `${balance.symbol}${validation.discount.toFixed(2)}`,
    finalPriceFormatted: `${balance.symbol}${validation.finalPrice.toFixed(2)}`,
    paymentIntentClientSecret: paymentIntent?.client_secret || null,
  });
}

/**
 * GET /api/checkout/coin-preview?transactionId=X&coinsToApply=Y
 * Preview coin discount without applying
 */
async function handleCoinPreview(req, res, decoded) {
  const { transactionId, listingId, coinsToApply = '0' } = req.query;

  let itemPrice;

  if (transactionId) {
    // Get price from transaction
    const txResult = await query(
      'SELECT final_price FROM transactions WHERE id = $1 AND buyer_id = $2',
      [transactionId, decoded.userId]
    );
    if (!txResult.rows[0]) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    itemPrice = parseFloat(txResult.rows[0].final_price);
  } else if (listingId) {
    // Get price from listing (legacy support)
    const listing = await query('SELECT * FROM listings WHERE id = $1', [listingId]);
    if (!listing.rows[0]) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    itemPrice = parseFloat(listing.rows[0].current_high_bid || listing.rows[0].starting_bid);
  } else {
    return res.status(400).json({ error: 'transactionId or listingId is required' });
  }

  // Get user's balance and currency
  const balance = await getUserPurseBalance(decoded.userId);
  if (!balance) {
    return res.status(404).json({ error: 'User not found' });
  }

  const coinsNum = parseInt(coinsToApply, 10);
  const maxApplicable = getMaxApplicableCoins(itemPrice, balance.coins, balance.currency);
  const coinValue = getCoinValue(1, balance.currency);

  // Calculate discount
  let discount = 0;
  let finalPrice = itemPrice;
  let coinsUsed = 0;
  let valid = true;
  let error = null;

  if (coinsNum > 0) {
    const validation = validateCoinSpending(itemPrice, coinsNum, balance.coins, balance.currency);
    valid = validation.valid;
    error = validation.error;
    if (validation.valid) {
      discount = validation.discount;
      finalPrice = validation.finalPrice;
      coinsUsed = validation.coinsUsed;
    }
  }

  return res.json({
    itemPrice,
    coinsAvailable: balance.coins,
    maxApplicable,
    coinsToApply: coinsNum,
    coinsUsed,
    discount,
    finalPrice,
    valid,
    error,
    currency: balance.currency,
    symbol: balance.symbol,
    coinValue,
    discountFormatted: `${balance.symbol}${discount.toFixed(2)}`,
    finalPriceFormatted: `${balance.symbol}${finalPrice.toFixed(2)}`,
    savingsText: discount > 0 ? `Save ${balance.symbol}${discount.toFixed(2)} with Gold Coins` : null,
  });
}
