import jwt from 'jsonwebtoken';
import { placeBid, getListing, getUserBids } from './lib/db.js';

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
        createdAt: bid.created_at,
        listing: {
          id: bid.listing_id.toString(),
          title: bid.listing_title,
          photo: bid.listing_photos?.[0] || '',
          status: bid.listing_status?.toUpperCase() || 'ACTIVE',
          currentHighBid: bid.current_high_bid ? parseFloat(bid.current_high_bid) : null,
          auctionEnd: bid.auction_end
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
    try {
      const { listingId, amount } = req.body;

      if (!listingId || !amount) {
        return res.status(400).json({ error: 'Missing listingId or amount' });
      }

      const bid = await placeBid(listingId, decoded.userId, parseFloat(amount));
      const listing = await getListing(listingId);

      return res.json({
        success: true,
        bid: {
          id: bid.id,
          amount: parseFloat(bid.amount),
          isWinning: bid.is_winning,
          createdAt: bid.created_at
        },
        listing: {
          currentHighBid: parseFloat(listing.current_high_bid),
          auctionEnd: listing.auction_end,
          extensionsUsed: listing.extensions_used
        }
      });

    } catch (error) {
      console.error('Bid error:', error);
      return res.status(400).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
