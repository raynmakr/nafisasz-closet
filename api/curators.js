import jwt from 'jsonwebtoken';
import { getApprovedCurators, getCuratorById, followCurator, unfollowCurator, isFollowing, createCurator, getCurator, query, searchCurators, getFollowedCurators, getUser } from '../lib/db.js';
import { checkCuratorFollowerMilestone } from '../lib/purse.js';
import { notifyCuratorApplication, sendCuratorWelcomeEmail } from '../lib/email.js';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // GET curators
    if (req.method === 'GET') {
      const { id, search, following, limit = 20, offset = 0 } = req.query;
      const decoded = verifyToken(req);

      // Get curators the user is following
      if (following === 'true') {
        if (!decoded) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        const curators = await getFollowedCurators(decoded.userId);
        return res.json({
          curators: curators.map(c => ({
            id: c.id,
            userId: c.user_id,
            name: c.name,
            handle: c.handle,
            avatarUrl: c.avatar_url,
            bio: c.bio,
            totalSales: c.total_sales,
            rating: parseFloat(c.rating),
            activeListings: parseInt(c.active_listings) || 0
          }))
        });
      }

      // Get single curator
      if (id) {
        const curator = await getCuratorById(id);
        if (!curator) {
          return res.status(404).json({ error: 'Curator not found' });
        }

        let following = false;
        if (decoded) {
          following = await isFollowing(decoded.userId, curator.user_id);
        }

        return res.json({
          curator: {
            id: curator.id,
            userId: curator.user_id,
            name: curator.name,
            handle: curator.handle,
            avatarUrl: curator.avatar_url,
            bio: curator.bio,
            subscriptionTier: curator.subscription_tier,
            healthScore: curator.health_score,
            totalSales: curator.total_sales,
            totalEarnings: parseFloat(curator.total_earnings),
            rating: parseFloat(curator.rating),
            ratingCount: curator.rating_count,
            approved: curator.approved
          },
          following
        });
      }

      // Search curators by name or handle
      if (search && search.trim()) {
        const curators = await searchCurators(search.trim(), parseInt(limit), parseInt(offset));
        return res.json({
          curators: curators.map(c => ({
            id: c.id,
            userId: c.user_id,
            name: c.name,
            handle: c.handle,
            avatarUrl: c.avatar_url,
            bio: c.bio,
            subscriptionTier: c.subscription_tier,
            totalSales: c.total_sales,
            rating: parseFloat(c.rating),
            activeListings: parseInt(c.active_listings) || 0
          })),
          pagination: {
            limit: parseInt(limit),
            offset: parseInt(offset)
          }
        });
      }

      // Get all approved curators
      const curators = await getApprovedCurators(parseInt(limit), parseInt(offset));
      return res.json({
        curators: curators.map(c => ({
          id: c.id,
          userId: c.user_id,
          name: c.name,
          handle: c.handle,
          avatarUrl: c.avatar_url,
          bio: c.bio,
          subscriptionTier: c.subscription_tier,
          totalSales: c.total_sales,
          rating: parseFloat(c.rating),
          activeListings: parseInt(c.active_listings) || 0
        })),
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      });
    }

    // POST actions
    if (req.method === 'POST') {
      const decoded = verifyToken(req);
      if (!decoded) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { action, curatorUserId } = req.body;

      // Become a curator
      if (action === 'become') {
        // Check if already a curator
        const existingCurator = await getCurator(decoded.userId);
        if (existingCurator) {
          return res.json({
            success: true,
            message: 'Already a curator',
            curator: existingCurator
          });
        }

        // Create curator and auto-approve for now (MVP)
        const curator = await createCurator(decoded.userId);
        await query('UPDATE curators SET approved = TRUE WHERE id = $1', [curator.id]);
        curator.approved = true;

        // Send email notifications (async, don't block)
        const user = await getUser(decoded.userId);
        notifyCuratorApplication(user, curator)
          .then(result => {
            if (result.success) console.log('Curator application email sent to admin');
          })
          .catch(err => console.error('Error sending curator application email:', err));

        sendCuratorWelcomeEmail(user, curator)
          .then(result => {
            if (result.success) console.log(`Welcome email sent to new curator ${user.email}`);
          })
          .catch(err => console.error('Error sending curator welcome email:', err));

        return res.json({
          success: true,
          message: 'You are now a curator!',
          curator
        });
      }

      // Follow curator
      if (!curatorUserId) {
        return res.status(400).json({ error: 'Missing curatorUserId' });
      }

      await followCurator(decoded.userId, curatorUserId);

      // Check if curator reached 100 followers milestone (async, don't block)
      checkCuratorFollowerMilestone(curatorUserId)
        .then(result => {
          if (result.awarded) {
            console.log(`Awarded 100 followers milestone of ${result.coins} GC to curator ${curatorUserId}`);
          }
        })
        .catch(err => console.error('Error checking follower milestone:', err));

      return res.json({ success: true, message: 'Now following curator' });
    }

    // DELETE unfollow curator
    if (req.method === 'DELETE') {
      const decoded = verifyToken(req);
      if (!decoded) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Accept curatorUserId from either query or body
      const curatorUserId = req.query.curatorUserId || req.body?.curatorUserId;
      if (!curatorUserId) {
        return res.status(400).json({ error: 'Missing curatorUserId' });
      }

      await unfollowCurator(decoded.userId, curatorUserId);
      return res.json({ success: true, message: 'Unfollowed curator' });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Curators error:', error);
    return res.status(500).json({ error: error.message });
  }
}
