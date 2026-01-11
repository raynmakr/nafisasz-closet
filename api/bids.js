import jwt from 'jsonwebtoken';
import { placeBid, getListing, getUserBids, query, getPool } from '../lib/db.js';
import { notifyUserOutbid } from '../lib/notifications.js';
import { createPreAuthPaymentIntent, cancelPreAuth } from '../lib/stripe.js';

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

  // GET - fetch user's bids
  if (req.method === 'GET') {
    try {
      const bids = await getUserBids(decoded.userId);

      const formattedBids = bids.map(bid => ({
        id: bid.id.toString(),
        amount: parseFloat(bid.amount),
        isWinning: bid.is_winning,
        selectedSize: bid.selected_size || null,
        createdAt: bid.created_at,
        listing: {
          id: bid.listing_id.toString(),
          title: bid.listing_title,
          photo: bid.listing_photos?.[0] || '',
          status: bid.listing_status?.toUpperCase() || 'ACTIVE',
          currentHighBid: bid.current_high_bid ? parseFloat(bid.current_high_bid) : null,
          auctionEnd: bid.auction_end,
          availableSizes: bid.available_sizes || []
        }
      }));

      return res.json({ bids: formattedBids });
    } catch (error) {
      console.error('Get user bids error:', error);
      return res.status(500).json({ error: 'Failed to fetch claims' });
    }
  }

  // POST - place a bid
  if (req.method === 'POST') {
    const pool = getPool();
    const client = await pool.connect();

    try {
      const { listingId, amount, selectedSize } = req.body;

      if (!listingId || !amount) {
        client.release();
        return res.status(400).json({ error: 'Missing listingId or amount' });
      }

      const bidAmount = parseFloat(amount);
      let finalSelectedSize = selectedSize || null;

      // Get user's payment method
      const userResult = await client.query(
        'SELECT stripe_customer_id, default_payment_method_id FROM users WHERE id = $1',
        [decoded.userId]
      );

      const user = userResult.rows[0];
      if (!user?.stripe_customer_id || !user?.default_payment_method_id) {
        client.release();
        return res.status(400).json({
          error: 'Payment method required',
          code: 'PAYMENT_METHOD_REQUIRED'
        });
      }

      // Get current high bidder before placing new bid (to notify them and cancel their pre-auth)
      const previousBidderResult = await client.query(
        `SELECT l.high_bidder_id, l.title, b.payment_intent_id as previous_payment_intent_id
         FROM listings l
         LEFT JOIN bids b ON b.listing_id = l.id AND b.is_winning = TRUE
         WHERE l.id = $1`,
        [listingId]
      );
      const previousHighBidderId = previousBidderResult.rows[0]?.high_bidder_id;
      const listingTitle = previousBidderResult.rows[0]?.title;
      const previousPaymentIntentId = previousBidderResult.rows[0]?.previous_payment_intent_id;

      // Create pre-authorization for the bid amount
      let paymentIntent;
      try {
        paymentIntent = await createPreAuthPaymentIntent(
          bidAmount,
          user.stripe_customer_id,
          user.default_payment_method_id,
          {
            listingId: listingId.toString(),
            bidderId: decoded.userId.toString(),
            type: 'bid_pre_auth',
          }
        );
      } catch (stripeError) {
        console.error('Pre-auth failed:', stripeError);
        client.release();
        return res.status(400).json({
          error: 'Card authorization failed. Please check your payment method.',
          code: 'CARD_DECLINED',
          details: stripeError.message
        });
      }

      // Place the bid with the payment_intent_id
      await client.query('BEGIN');

      try {
        // Get listing
        const listingResult = await client.query(
          'SELECT * FROM listings WHERE id = $1 FOR UPDATE',
          [listingId]
        );
        if (!listingResult.rows[0]) throw new Error('Listing not found');
        if (listingResult.rows[0].status !== 'active') throw new Error('Auction not active');

        const listing = listingResult.rows[0];
        const availableSizes = listing.available_sizes || [];

        // Size validation
        if (availableSizes.length > 1) {
          // Multiple sizes available - require selection
          if (!finalSelectedSize) {
            throw new Error('Please select a size');
          }
          if (!availableSizes.includes(finalSelectedSize)) {
            throw new Error('Selected size is not available');
          }
        } else if (availableSizes.length === 1) {
          // Single size - auto-select it
          finalSelectedSize = availableSizes[0];
        } else if (listing.size && !finalSelectedSize) {
          // Legacy listing with single size - auto-select
          finalSelectedSize = listing.size;
        }
        // If no sizes at all, proceed without size (backward compat)

        const currentBid = listing.current_high_bid || listing.starting_bid;
        if (bidAmount <= parseFloat(currentBid)) throw new Error('Bid must be higher than current bid');

        // Mark previous winning bid as not winning
        await client.query('UPDATE bids SET is_winning = FALSE WHERE listing_id = $1', [listingId]);

        // Insert new bid with payment_intent_id and selected_size
        const bidResult = await client.query(
          `INSERT INTO bids (listing_id, bidder_id, amount, is_winning, payment_intent_id, selected_size)
           VALUES ($1, $2, $3, TRUE, $4, $5) RETURNING *`,
          [listingId, decoded.userId, bidAmount, paymentIntent.id, finalSelectedSize]
        );

        // Update listing
        await client.query(
          `UPDATE listings SET current_high_bid = $1, high_bidder_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
          [bidAmount, decoded.userId, listingId]
        );

        // Extend auction if within last 2 minutes and extensions available
        const now = new Date();
        const auctionEnd = new Date(listingResult.rows[0].auction_end);
        const timeLeft = auctionEnd - now;

        if (timeLeft < 2 * 60 * 1000 && listingResult.rows[0].extensions_used < 3) {
          const newEnd = new Date(auctionEnd.getTime() + 2 * 60 * 1000);
          await client.query(
            `UPDATE listings SET auction_end = $1, extensions_used = extensions_used + 1 WHERE id = $2`,
            [newEnd, listingId]
          );
        }

        await client.query('COMMIT');

        const bid = bidResult.rows[0];
        const refreshedListing = await getListing(listingId);

        // Cancel previous bidder's pre-auth (async, don't block response)
        if (previousPaymentIntentId && previousHighBidderId !== decoded.userId) {
          cancelPreAuth(previousPaymentIntentId).catch((err) =>
            console.error('Failed to cancel previous pre-auth:', err)
          );

          // Notify previous high bidder that they've been outbid
          notifyUserOutbid(
            previousHighBidderId,
            listingId,
            listingTitle,
            bidAmount
          ).catch((err) => console.error('Failed to send outbid notification:', err));
        }

        return res.json({
          success: true,
          bid: {
            id: bid.id,
            amount: parseFloat(bid.amount),
            isWinning: bid.is_winning,
            selectedSize: bid.selected_size || null,
            createdAt: bid.created_at
          },
          listing: {
            currentHighBid: parseFloat(refreshedListing.current_high_bid),
            auctionEnd: refreshedListing.auction_end,
            extensionsUsed: refreshedListing.extensions_used
          }
        });
      } catch (bidError) {
        await client.query('ROLLBACK');
        // Cancel the pre-auth since bid failed
        cancelPreAuth(paymentIntent.id).catch((err) =>
          console.error('Failed to cancel pre-auth after bid error:', err)
        );
        throw bidError;
      }
    } catch (error) {
      console.error('Bid error:', error);
      return res.status(400).json({ error: error.message });
    } finally {
      client.release();
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
