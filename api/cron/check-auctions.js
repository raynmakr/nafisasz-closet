import { query } from '../lib/db.js';
import { calculateFees, createPaymentIntent } from '../lib/stripe.js';

// Secret key for cron authentication (optional, for external cron services)
const CRON_SECRET = process.env.CRON_SECRET;

export default async function handler(req, res) {
  // Verify cron secret if set (for external cron services)
  if (CRON_SECRET && req.headers['x-cron-secret'] !== CRON_SECRET) {
    // Also allow Vercel cron (no secret needed for internal)
    if (req.headers['x-vercel-cron'] !== '1') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const results = await checkExpiredAuctions();
    return res.json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Find and process expired auctions
 */
async function checkExpiredAuctions() {
  const results = [];

  // Find active listings where auction has ended
  const expiredListings = await query(`
    SELECT l.*,
           c.id as curator_id,
           c.user_id as curator_user_id,
           c.subscription_tier,
           c.stripe_account_id,
           c.stripe_onboarding_complete
    FROM listings l
    JOIN curators c ON l.curator_id = c.id
    WHERE l.status = 'active'
      AND l.auction_end < CURRENT_TIMESTAMP
      AND l.high_bidder_id IS NOT NULL
    ORDER BY l.auction_end ASC
    LIMIT 10
  `);

  console.log(`Found ${expiredListings.rows.length} expired auctions to process`);

  for (const listing of expiredListings.rows) {
    try {
      const result = await processExpiredAuction(listing);
      results.push(result);
    } catch (error) {
      console.error(`Error processing listing ${listing.id}:`, error);
      results.push({
        listingId: listing.id,
        success: false,
        error: error.message,
      });
    }
  }

  // Also handle listings with no bids (mark as expired)
  const noBidListings = await query(`
    UPDATE listings
    SET status = 'expired', updated_at = CURRENT_TIMESTAMP
    WHERE status = 'active'
      AND auction_end < CURRENT_TIMESTAMP
      AND high_bidder_id IS NULL
    RETURNING id
  `);

  if (noBidListings.rows.length > 0) {
    console.log(`Marked ${noBidListings.rows.length} listings as expired (no bids)`);
  }

  return results;
}

/**
 * Process a single expired auction
 */
async function processExpiredAuction(listing) {
  console.log(`Processing expired auction: ${listing.id} - ${listing.title}`);

  // Calculate fees
  const finalPrice = parseFloat(listing.current_high_bid);
  const startingBid = parseFloat(listing.starting_bid);
  const { platformFee, curatorEarnings } = calculateFees(
    finalPrice,
    startingBid,
    listing.subscription_tier || 'free'
  );

  // Create transaction record
  const txResult = await query(`
    INSERT INTO transactions (listing_id, buyer_id, curator_id, final_price, platform_fee, curator_earnings)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (listing_id) DO UPDATE SET
      final_price = EXCLUDED.final_price,
      platform_fee = EXCLUDED.platform_fee,
      curator_earnings = EXCLUDED.curator_earnings,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `, [listing.id, listing.high_bidder_id, listing.curator_id, finalPrice, platformFee, curatorEarnings]);

  const transaction = txResult.rows[0];

  // Update listing status to 'sold'
  await query(`
    UPDATE listings
    SET status = 'sold', updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
  `, [listing.id]);

  // Create PaymentIntent to charge the winner
  let paymentIntent = null;
  try {
    paymentIntent = await createPaymentIntent(finalPrice, 'usd', {
      transactionId: transaction.id.toString(),
      listingId: listing.id.toString(),
      buyerId: listing.high_bidder_id.toString(),
    });

    // Update transaction with payment intent ID
    await query(`
      UPDATE transactions
      SET payment_intent_id = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [paymentIntent.id, transaction.id]);

    console.log(`Created PaymentIntent ${paymentIntent.id} for transaction ${transaction.id}`);
  } catch (error) {
    console.error(`Failed to create PaymentIntent for transaction ${transaction.id}:`, error);
    // Transaction still created, payment can be retried
  }

  // TODO: Send notification to winner about payment
  // TODO: Send notification to curator about sale

  return {
    listingId: listing.id,
    transactionId: transaction.id,
    finalPrice,
    platformFee,
    curatorEarnings,
    paymentIntentId: paymentIntent?.id || null,
    success: true,
  };
}
