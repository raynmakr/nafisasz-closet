import jwt from 'jsonwebtoken';
import { query } from '../../lib/db.js';
import { retrievePaymentIntent, createAuctionPaymentIntent } from '../../lib/stripe.js';

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

/**
 * Get PaymentSheet params for a transaction
 *
 * GET /api/transactions/payment-sheet?transactionId=X
 *
 * Returns params needed to initialize Stripe PaymentSheet:
 * - paymentIntent (client_secret)
 * - publishableKey
 * - transaction details
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const decoded = verifyToken(req);
  if (!decoded) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { transactionId } = req.query;

  if (!transactionId) {
    return res.status(400).json({ error: 'Missing transactionId' });
  }

  try {
    // Get transaction with listing and curator info
    const txResult = await query(`
      SELECT t.*,
             l.title, l.photos, l.brand, l.size,
             cu.name as curator_name
      FROM transactions t
      JOIN listings l ON t.listing_id = l.id
      JOIN curators c ON t.curator_id = c.id
      JOIN users cu ON c.user_id = cu.id
      WHERE t.id = $1 AND t.buyer_id = $2
    `, [transactionId, decoded.userId]);

    if (!txResult.rows[0]) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const tx = txResult.rows[0];

    // Only allow payment if status is pending_payment
    if (tx.status !== 'pending_payment') {
      return res.status(400).json({
        error: `Cannot pay for transaction in status: ${tx.status}`,
        status: tx.status
      });
    }

    let paymentIntent;

    if (tx.payment_intent_id) {
      // Retrieve existing payment intent
      paymentIntent = await retrievePaymentIntent(tx.payment_intent_id);

      // Check if payment intent is still valid
      if (['succeeded', 'processing'].includes(paymentIntent.status)) {
        return res.status(400).json({
          error: 'Payment already completed or processing',
          paymentStatus: paymentIntent.status
        });
      }

      // If payment intent is canceled/failed, create a new one
      if (['canceled', 'requires_payment_method'].includes(paymentIntent.status) &&
          paymentIntent.status === 'canceled') {
        paymentIntent = await createAuctionPaymentIntent(
          parseFloat(tx.final_price),
          decoded.userId,
          tx.listing_id,
          tx.curator_id
        );

        // Update transaction with new payment intent
        await query(`
          UPDATE transactions
          SET payment_intent_id = $1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [paymentIntent.id, transactionId]);
      }
    } else {
      // No payment intent exists - create one
      paymentIntent = await createAuctionPaymentIntent(
        parseFloat(tx.final_price),
        decoded.userId,
        tx.listing_id,
        tx.curator_id
      );

      // Update transaction with payment intent ID
      await query(`
        UPDATE transactions
        SET payment_intent_id = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [paymentIntent.id, transactionId]);
    }

    return res.json({
      success: true,
      paymentIntent: paymentIntent.client_secret,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
      transaction: {
        id: tx.id,
        listingId: tx.listing_id,
        title: tx.title,
        brand: tx.brand,
        size: tx.size,
        photo: tx.photos ? tx.photos[0] : null,
        curatorName: tx.curator_name,
        finalPrice: parseFloat(tx.final_price),
        platformFee: parseFloat(tx.platform_fee),
        status: tx.status,
      },
    });
  } catch (error) {
    console.error('Payment sheet error:', error);
    return res.status(500).json({ error: error.message });
  }
}
