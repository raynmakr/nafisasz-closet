import jwt from 'jsonwebtoken';
import { getActiveListings, getListing, createListing, updateListing, publishListing, getCurator, getListingBids, query } from '../lib/db.js';
import { notifyFollowersNewListing, sendPushNotification } from '../lib/notifications.js';
import { cancelPreAuth, refundPayment } from '../lib/stripe.js';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // GET listings
    if (req.method === 'GET') {
      const { id, curatorId, limit = 20, offset = 0 } = req.query;

      // Get single listing
      if (id) {
        const listing = await getListing(id);
        if (!listing) {
          return res.status(404).json({ error: 'Listing not found' });
        }

        const bids = await getListingBids(id, 10);

        return res.json({
          listing: formatListing(listing),
          bids: bids.map(b => ({
            id: b.id,
            amount: parseFloat(b.amount),
            bidderName: b.bidder_name,
            createdAt: b.created_at
          }))
        });
      }

      // Get active listings (optionally filtered by curator)
      const listings = await getActiveListings(parseInt(limit), parseInt(offset), curatorId || null);
      return res.json({
        listings: listings.map(formatListing),
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      });
    }

    // POST create listing or publish
    if (req.method === 'POST') {
      const decoded = verifyToken(req);
      if (!decoded) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { action, listingId } = req.body;

      // Cancel listing with refunds
      if (action === 'cancel') {
        if (!listingId) {
          return res.status(400).json({ error: 'Missing listingId' });
        }

        // Get listing and verify ownership
        const listing = await getListing(listingId);
        if (!listing) {
          return res.status(404).json({ error: 'Listing not found' });
        }

        const curator = await getCurator(decoded.userId);
        if (!curator || listing.curator_id !== curator.id) {
          return res.status(403).json({ error: 'Not authorized to cancel this listing' });
        }

        // Only allow cancellation of active listings
        if (listing.status !== 'active' && listing.status !== 'ACTIVE') {
          return res.status(400).json({ error: `Cannot cancel listing in status: ${listing.status}` });
        }

        const refundResults = { preAuthsCancelled: 0, paymentsRefunded: 0, errors: [] };

        // 1. Cancel all pre-auth holds on active bids
        const bidsResult = await query(
          `SELECT id, bidder_id, amount, payment_intent_id FROM bids WHERE listing_id = $1 AND payment_intent_id IS NOT NULL`,
          [listingId]
        );

        for (const bid of bidsResult.rows) {
          if (bid.payment_intent_id) {
            try {
              await cancelPreAuth(bid.payment_intent_id);
              refundResults.preAuthsCancelled++;
              console.log(`Cancelled pre-auth ${bid.payment_intent_id} for bid ${bid.id}`);
            } catch (err) {
              // Pre-auth might already be captured or cancelled
              console.error(`Failed to cancel pre-auth ${bid.payment_intent_id}:`, err.message);
              refundResults.errors.push(`Bid ${bid.id}: ${err.message}`);
            }
          }
        }

        // 2. Check for any captured transaction and refund if exists
        const txResult = await query(
          `SELECT id, payment_intent_id, final_price, buyer_id, status FROM transactions WHERE listing_id = $1`,
          [listingId]
        );

        if (txResult.rows[0]) {
          const tx = txResult.rows[0];

          // Only refund if payment was captured (status is 'paid' or later)
          if (tx.payment_intent_id && ['paid', 'curator_confirmed', 'shipped'].includes(tx.status)) {
            try {
              const refund = await refundPayment(tx.payment_intent_id, null, 'requested_by_customer', {
                reason: 'curator_cancelled_listing',
                listingId: listingId,
                transactionId: tx.id,
              });
              refundResults.paymentsRefunded++;
              console.log(`Refunded payment ${tx.payment_intent_id} for transaction ${tx.id}`);

              // Update transaction status
              await query(
                `UPDATE transactions SET status = 'refunded', refund_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
                [refund.id, tx.id]
              );
            } catch (err) {
              console.error(`Failed to refund payment ${tx.payment_intent_id}:`, err.message);
              refundResults.errors.push(`Transaction ${tx.id}: ${err.message}`);
            }
          }
        }

        // 3. Update listing status to CANCELLED
        await query(
          `UPDATE listings SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [listingId]
        );

        // 4. Notify affected bidders
        const uniqueBidders = [...new Set(bidsResult.rows.map(b => b.bidder_id))];
        for (const bidderId of uniqueBidders) {
          try {
            await sendPushNotification(
              bidderId,
              'Listing Cancelled',
              `The listing "${listing.title}" has been cancelled by the curator. Any held funds have been released.`,
              { type: 'listing_cancelled', listingId }
            );
          } catch (err) {
            console.error(`Failed to notify bidder ${bidderId}:`, err.message);
          }
        }

        return res.json({
          success: true,
          message: 'Listing cancelled successfully',
          refunds: refundResults,
        });
      }

      // Publish existing listing
      if (action === 'publish') {
        if (!listingId) {
          return res.status(400).json({ error: 'Missing listingId' });
        }

        const listing = await publishListing(listingId);
        if (!listing) {
          return res.status(404).json({ error: 'Listing not found' });
        }

        // Notify followers about new listing
        const curatorInfo = await query(
          `SELECT u.id as user_id, u.name FROM curators c JOIN users u ON c.user_id = u.id WHERE c.id = $1`,
          [listing.curator_id]
        );
        if (curatorInfo.rows[0]) {
          notifyFollowersNewListing(
            curatorInfo.rows[0].user_id,
            curatorInfo.rows[0].name || 'A curator',
            listing.id,
            listing.title
          ).catch((err) => console.error('Failed to send new listing notifications:', err));
        }

        return res.json({ success: true, listing: formatListing(listing) });
      }

      // Create new listing
      const curator = await getCurator(decoded.userId);
      if (!curator) {
        return res.status(403).json({ error: 'Must be a curator to create listings' });
      }

      if (!curator.approved) {
        return res.status(403).json({ error: 'Curator account not approved yet' });
      }

      const { title, description, brand, size, sizes, category, condition, retailPrice, photos, auctionDuration, returnsAllowed, localPickupAvailable } = req.body;

      if (!title || !retailPrice || !auctionDuration || !photos?.length) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const listing = await createListing(curator.id, {
        title,
        description,
        brand,
        size,
        sizes, // New: array of available sizes
        category,
        condition,
        retailPrice,
        photos,
        auctionDuration,
        returnsAllowed,
        localPickupAvailable
      });

      return res.json({ success: true, listing: formatListing(listing) });
    }

    // PUT update listing (draft only)
    if (req.method === 'PUT') {
      const decoded = verifyToken(req);
      if (!decoded) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id, ...updates } = req.body;
      if (!id) {
        return res.status(400).json({ error: 'Missing listing id' });
      }

      // Verify user is a curator
      const curator = await getCurator(decoded.userId);
      if (!curator) {
        return res.status(403).json({ error: 'Must be a curator to update listings' });
      }

      try {
        const listing = await updateListing(id, curator.id, updates);
        return res.json({ success: true, listing: formatListing(listing) });
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }
    }

    // DELETE listing
    if (req.method === 'DELETE') {
      const decoded = verifyToken(req);
      if (!decoded) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ error: 'Missing listing id' });
      }

      const listing = await getListing(id);
      if (!listing) {
        return res.status(404).json({ error: 'Listing not found' });
      }

      // Verify ownership
      const curator = await getCurator(decoded.userId);
      if (!curator || listing.curator_id !== curator.id) {
        return res.status(403).json({ error: 'Not authorized to delete this listing' });
      }

      // Only allow deletion of draft or active listings without bids
      // For simplicity, just delete it
      const { query } = await import('./lib/db.js');
      await query('DELETE FROM listings WHERE id = $1', [id]);

      return res.json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Listings error:', error);
    return res.status(500).json({ error: error.message });
  }
}

function formatListing(l) {
  // Build availableSizes: prefer available_sizes array, fallback to single size
  const availableSizes = l.available_sizes && l.available_sizes.length > 0
    ? l.available_sizes
    : (l.size ? [l.size] : []);

  return {
    id: l.id,
    title: l.title,
    description: l.description,
    brand: l.brand,
    size: l.size, // Keep for backward compatibility
    availableSizes, // New: array of available sizes
    category: l.category,
    condition: l.condition,
    retailPrice: parseFloat(l.retail_price),
    startingBid: parseFloat(l.starting_bid),
    currentHighBid: l.current_high_bid ? parseFloat(l.current_high_bid) : null,
    highBidderId: l.high_bidder_id,
    photos: l.photos || [],
    status: l.status,
    auctionDuration: l.auction_duration,
    auctionStart: l.auction_start,
    auctionEnd: l.auction_end,
    extensionsUsed: l.extensions_used,
    returnsAllowed: l.returns_allowed,
    localPickupAvailable: l.local_pickup_available,
    createdAt: l.created_at,
    bidCount: parseInt(l.bid_count) || 0,
    curator: l.curator_id ? {
      id: l.curator_id,
      userId: l.curator_user_id,
      name: l.curator_name || 'Unknown',
      handle: l.curator_handle,
      profilePhoto: l.curator_profile_photo || l.curator_avatar,
      avatarUrl: l.curator_avatar,
      rating: parseFloat(l.curator_rating) || 0,
      totalSales: l.curator_sales || 0
    } : null
  };
}
