import jwt from 'jsonwebtoken';
import { query, getCurator } from '../../lib/db.js';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const decoded = verifyToken(req);
    if (!decoded) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get the curator for this user
    const curator = await getCurator(decoded.userId);
    if (!curator) {
      return res.json({ listings: [], pagination: { limit: 50, offset: 0 } });
    }

    // Get all listings by this curator (any status)
    const result = await query(`
      SELECT
        l.*,
        u.name as curator_name,
        u.profile_photo as curator_avatar,
        c.rating as curator_rating,
        c.total_sales as curator_sales,
        COALESCE((SELECT COUNT(*) FROM bids WHERE listing_id = l.id), 0) as bid_count
      FROM listings l
      JOIN curators c ON l.curator_id = c.id
      JOIN users u ON c.user_id = u.id
      WHERE c.id = $1
      ORDER BY l.created_at DESC
    `, [curator.id]);

    const listings = result.rows.map(l => ({
      id: l.id,
      title: l.title,
      description: l.description,
      brand: l.brand,
      size: l.size,
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
      curator: {
        id: curator.id,
        name: l.curator_name,
        avatarUrl: l.curator_avatar,
        rating: parseFloat(l.curator_rating) || 0,
        totalSales: l.curator_sales || 0
      }
    }));

    return res.json({
      listings,
      pagination: { limit: 50, offset: 0 }
    });

  } catch (error) {
    console.error('My listings error:', error);
    return res.status(500).json({ error: error.message });
  }
}
