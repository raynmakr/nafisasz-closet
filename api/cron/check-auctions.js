import { query, getPool } from '../../lib/db.js';
import { calculateFees, capturePreAuth } from '../../lib/stripe.js';

/**
 * Safety-net cron job for missed auctions
 *
 * Runs HOURLY (not every 5 minutes) as a backup for client-triggered completions.
 * Only processes auctions that expired > 5 minutes ago to give client triggers time.
 *
 * Primary completion happens via /api/listings/complete (client-triggered).
 * This cron catches edge cases:
 * - Client was offline when auction ended
 * - Network failure during completion
 * - No viewers when auction ended
 */
export default async function handler(req, res) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    const results = {
      processed: 0,
      withWinner: 0,
      noWinner: 0,
      alreadyProcessed: 0,
      errors: [],
    };

    // Find expired auctions that:
    // 1. Are still 'active'
    // 2. Ended more than 5 minutes ago (grace period for client triggers)
    const expiredAuctions = await client.query(`
      SELECT l.*,
             c.user_id as curator_user_id,
             c.subscription_tier,
             c.stripe_account_id,
             (SELECT b.bidder_id FROM bids b
              WHERE b.listing_id = l.id AND b.is_winning = TRUE
              ORDER BY b.amount DESC LIMIT 1) as winner_id,
             (SELECT b.amount FROM bids b
              WHERE b.listing_id = l.id AND b.is_winning = TRUE
              ORDER BY b.amount DESC LIMIT 1) as winning_bid,
             (SELECT b.payment_intent_id FROM bids b
              WHERE b.listing_id = l.id AND b.is_winning = TRUE
              ORDER BY b.amount DESC LIMIT 1) as winning_bid_payment_intent_id,
             (SELECT u.name FROM bids b
              JOIN users u ON b.bidder_id = u.id
              WHERE b.listing_id = l.id AND b.is_winning = TRUE
              ORDER BY b.amount DESC LIMIT 1) as winner_name
      FROM listings l
      JOIN curators c ON l.curator_id = c.id
      WHERE l.status = 'active'
        AND l.auction_end IS NOT NULL
        AND l.auction_end < NOW() - INTERVAL '5 minutes'
      ORDER BY l.auction_end ASC
      LIMIT 50
    `);

    console.log(`[Safety Net] Found ${expiredAuctions.rows.length} unprocessed auctions`);

    for (const auction of expiredAuctions.rows) {
      try {
        await client.query('BEGIN');

        // Double-check status with lock
        const checkResult = await client.query(
          'SELECT status FROM listings WHERE id = $1 FOR UPDATE',
          [auction.id]
        );

        if (checkResult.rows[0]?.status !== 'active') {
          results.alreadyProcessed++;
          await client.query('ROLLBACK');
          continue;
        }

        // Check if transaction already exists
        const existingTx = await client.query(
          'SELECT id, payment_intent_id FROM transactions WHERE listing_id = $1',
          [auction.id]
        );

        if (existingTx.rows[0]) {
          // Transaction exists, just update listing status
          await client.query(
            `UPDATE listings SET status = 'sold', updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [auction.id]
          );
          results.alreadyProcessed++;
          await client.query('COMMIT');
          console.log(`[Safety Net] Auction ${auction.id} - transaction exists, updated status`);
          continue;
        }

        if (auction.winner_id && auction.winning_bid) {
          // Has winner - capture pre-auth and create transaction
          const fees = calculateFees(
            parseFloat(auction.winning_bid),
            parseFloat(auction.starting_bid),
            auction.subscription_tier || 'free'
          );

          let paymentStatus = 'pending_payment';
          let paymentIntentId = auction.winning_bid_payment_intent_id;

          // Capture the pre-authorized payment if it exists
          if (paymentIntentId) {
            try {
              const capturedIntent = await capturePreAuth(paymentIntentId);
              if (capturedIntent.status === 'succeeded') {
                paymentStatus = 'paid';
              }
              console.log(`[Safety Net] Captured pre-auth ${paymentIntentId} - status: ${capturedIntent.status}`);
            } catch (captureError) {
              console.error(`[Safety Net] Pre-auth capture failed for auction ${auction.id}:`, captureError);
              paymentStatus = 'payment_failed';
            }
          } else {
            console.warn(`[Safety Net] No pre-auth found for auction ${auction.id} - legacy bid`);
          }

          await client.query(`
            INSERT INTO transactions
            (listing_id, buyer_id, curator_id, final_price, platform_fee,
             curator_earnings, status, payment_intent_id, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
                    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `, [
            auction.id,
            auction.winner_id,
            auction.curator_id,
            auction.winning_bid,
            fees.platformFee,
            fees.curatorEarnings,
            paymentStatus,
            paymentIntentId,
          ]);

          await client.query(
            `UPDATE listings SET status = 'sold', updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [auction.id]
          );

          // TODO: Send push notification to winner

          results.withWinner++;
          console.log(`[Safety Net] Processed auction ${auction.id} - winner: ${auction.winner_name || auction.winner_id}, payment: ${paymentStatus}`);
        } else {
          // No bids - mark as expired
          await client.query(
            `UPDATE listings SET status = 'expired', updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [auction.id]
          );

          results.noWinner++;
          console.log(`[Safety Net] Processed auction ${auction.id} - no claims`);
        }

        await client.query('COMMIT');
        results.processed++;
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`[Safety Net] Error processing auction ${auction.id}:`, error);
        results.errors.push({ listingId: auction.id, error: error.message });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Safety net processed ${results.processed} auctions`,
      results,
    });
  } catch (error) {
    console.error('[Safety Net] Fatal error:', error);
    return res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
}
