import jwt from 'jsonwebtoken';
import { query, getPool, getCurator } from '../../lib/db.js';
import { calculateFees, capturePreAuth } from '../../lib/stripe.js';
import { notifyBuyerPaymentFailed, notifyCuratorPaymentReceived } from '../../lib/notifications.js';

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
 * Complete an auction - triggered by client when timer expires or curator closes early
 *
 * POST /api/listings/complete
 * Body: { listingId, reason: 'timer_expired' | 'curator_closed' }
 *
 * Returns:
 * - { success: true, status: 'sold', transaction: { id, winnerId, winnerName, finalPrice, paymentIntentClientSecret } }
 * - { success: true, status: 'expired', message: 'Auction ended with no claims' }
 * - { success: true, status: 'already_completed', currentStatus: 'sold'|'expired' }
 * - { error: 'Auction has not ended yet', code: 'AUCTION_ACTIVE', auctionEnd: '...' }
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Authentication
  const decoded = verifyToken(req);
  if (!decoded) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { listingId, reason } = req.body;

  if (!listingId || !reason) {
    return res.status(400).json({ error: 'Missing listingId or reason' });
  }

  if (!['timer_expired', 'curator_closed'].includes(reason)) {
    return res.status(400).json({ error: 'Invalid reason. Must be timer_expired or curator_closed' });
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get listing with row lock to prevent race conditions
    const listingResult = await client.query(
      `SELECT l.*, c.user_id as curator_user_id, c.subscription_tier,
              c.stripe_account_id, c.stripe_onboarding_complete
       FROM listings l
       JOIN curators c ON l.curator_id = c.id
       WHERE l.id = $1 FOR UPDATE`,
      [listingId]
    );

    const listing = listingResult.rows[0];
    if (!listing) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Check if already completed
    if (['sold', 'expired'].includes(listing.status)) {
      await client.query('ROLLBACK');
      return res.json({
        success: true,
        status: 'already_completed',
        currentStatus: listing.status,
      });
    }

    // Authorization check for early close
    if (reason === 'curator_closed') {
      if (listing.curator_user_id !== decoded.userId) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Only the curator can close this auction early' });
      }
    } else if (reason === 'timer_expired') {
      // Verify auction has actually ended (with 5-second grace period)
      const now = new Date();
      const auctionEnd = new Date(listing.auction_end);
      const gracePeriodMs = 5000; // 5 seconds grace

      if (now < new Date(auctionEnd.getTime() - gracePeriodMs)) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Auction has not ended yet',
          code: 'AUCTION_ACTIVE',
          auctionEnd: listing.auction_end,
        });
      }
    }

    // Get winning bid info with payment_intent_id
    const winnerResult = await client.query(
      `SELECT b.*, u.name as winner_name, u.email as winner_email
       FROM bids b
       JOIN users u ON b.bidder_id = u.id
       WHERE b.listing_id = $1 AND b.is_winning = TRUE
       ORDER BY b.amount DESC LIMIT 1`,
      [listingId]
    );

    const winningBid = winnerResult.rows[0];

    if (winningBid) {
      // Calculate fees
      const fees = calculateFees(
        parseFloat(winningBid.amount),
        parseFloat(listing.starting_bid),
        listing.subscription_tier || 'free'
      );

      // Check for existing transaction (idempotency)
      const existingTx = await client.query(
        'SELECT * FROM transactions WHERE listing_id = $1',
        [listingId]
      );

      let transaction;
      let paymentIntent;
      let paymentStatus = 'pending_payment';
      let paymentError = null;

      if (existingTx.rows[0]) {
        transaction = existingTx.rows[0];
        paymentStatus = transaction.status;
      } else {
        // Capture the pre-authorized payment from the winning bid
        if (winningBid.payment_intent_id) {
          try {
            // Capture the pre-auth (this actually charges the card)
            paymentIntent = await capturePreAuth(winningBid.payment_intent_id);

            if (paymentIntent.status === 'succeeded') {
              paymentStatus = 'paid';
            } else {
              paymentStatus = 'pending_payment';
            }
          } catch (err) {
            console.error('Pre-auth capture failed:', err);
            paymentStatus = 'payment_failed';
            paymentError = err.message;
          }
        } else {
          // No pre-auth found (legacy bid without pre-auth)
          console.warn('No pre-auth found for winning bid:', winningBid.id);
          paymentStatus = 'pending_payment';
        }

        // Create transaction record
        const txResult = await client.query(
          `INSERT INTO transactions
           (listing_id, buyer_id, curator_id, final_price, platform_fee,
            curator_earnings, status, payment_intent_id, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
                   CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           RETURNING *`,
          [
            listingId,
            winningBid.bidder_id,
            listing.curator_id,
            winningBid.amount,
            fees.platformFee,
            fees.curatorEarnings,
            paymentStatus,
            winningBid.payment_intent_id || null,
          ]
        );
        transaction = txResult.rows[0];
      }

      // Update listing status
      await client.query(
        `UPDATE listings SET status = 'sold', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [listingId]
      );

      await client.query('COMMIT');

      // Send notifications based on payment status
      if (paymentStatus === 'paid') {
        // Notify curator that payment was received
        notifyCuratorPaymentReceived(
          listing.curator_user_id,
          transaction.id,
          listing.title,
          parseFloat(winningBid.amount)
        ).catch(err => console.error('Failed to notify curator:', err));
      } else if (paymentStatus === 'payment_failed') {
        // Notify buyer that payment failed
        notifyBuyerPaymentFailed(
          winningBid.bidder_id,
          transaction.id,
          listing.title
        ).catch(err => console.error('Failed to notify buyer:', err));
      }

      // Return success
      return res.json({
        success: true,
        status: 'sold',
        paymentStatus,
        paymentError,
        transaction: {
          id: transaction.id,
          winnerId: winningBid.bidder_id,
          winnerName: winningBid.winner_name || 'Winner',
          finalPrice: parseFloat(winningBid.amount),
        },
      });
    } else {
      // No bids - mark as expired
      await client.query(
        `UPDATE listings SET status = 'expired', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [listingId]
      );

      await client.query('COMMIT');

      return res.json({
        success: true,
        status: 'expired',
        message: 'Auction ended with no claims',
      });
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Complete auction error:', error);
    return res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
}
