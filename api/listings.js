import jwt from 'jsonwebtoken';
import { getActiveListings, getListing, createListing, updateListing, publishListing, getCurator, getListingBids, query } from '../lib/db.js';
import { notifyFollowersNewListing } from '../lib/notifications.js';

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
