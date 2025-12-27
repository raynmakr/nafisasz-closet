import { query } from '../../lib/db.js';

/**
 * Cron job to check for expired auctions and process winners
 * Runs every 5 minutes on Vercel Pro plan
 */
export default async function handler(req, res) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Find expired auctions that haven't been processed
    const expiredAuctions = await query(`
      SELECT l.*,
             (SELECT b.user_id FROM bids b WHERE b.listing_id = l.id ORDER BY b.amount DESC LIMIT 1) as winner_id,
             (SELECT b.amount FROM bids b WHERE b.listing_id = l.id ORDER BY b.amount DESC LIMIT 1) as winning_bid
      FROM listings l
      WHERE l.status = 'active'
        AND l.auction_end_time < NOW()
        AND l.auction_end_time IS NOT NULL
    `);

    const results = {
      processed: 0,
      withWinner: 0,
      noWinner: 0,
      errors: [],
    };

    for (const auction of expiredAuctions.rows) {
      try {
        if (auction.winner_id && auction.winning_bid) {
          // Auction has a winner - create transaction
          await query(`
            INSERT INTO transactions (listing_id, buyer_id, curator_id, final_price, status, created_at, updated_at)
            VALUES ($1, $2, $3, $4, 'pending_payment', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (listing_id) DO NOTHING
          `, [auction.id, auction.winner_id, auction.curator_id, auction.winning_bid]);

          // Update listing status
          await query(`
            UPDATE listings SET status = 'sold', updated_at = CURRENT_TIMESTAMP WHERE id = $1
          `, [auction.id]);

          results.withWinner++;
        } else {
          // No bids - mark as expired
          await query(`
            UPDATE listings SET status = 'expired', updated_at = CURRENT_TIMESTAMP WHERE id = $1
          `, [auction.id]);

          results.noWinner++;
        }

        results.processed++;
      } catch (error) {
        results.errors.push({ listingId: auction.id, error: error.message });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Processed ${results.processed} expired auctions`,
      results,
    });
  } catch (error) {
    console.error('Cron check-auctions error:', error);
    return res.status(500).json({ error: error.message });
  }
}
