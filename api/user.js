import jwt from 'jsonwebtoken';
import { getUser, updateUser, getCurator, createCurator, isHandleTaken, validateHandle } from '../lib/db.js';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const decoded = verifyToken(req);
  if (!decoded) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // GET user profile
    if (req.method === 'GET') {
      const user = await getUser(decoded.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const curator = user.role === 'curator' ? await getCurator(decoded.userId) : null;

      return res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          handle: user.handle,
          avatarUrl: user.avatar_url,
          profilePhoto: user.profile_photo,
          role: user.role,
          bio: user.bio,
          createdAt: user.created_at
        },
        curator: curator ? {
          id: curator.id,
          subscriptionTier: curator.subscription_tier,
          healthScore: curator.health_score,
          totalSales: curator.total_sales,
          totalEarnings: parseFloat(curator.total_earnings),
          rating: parseFloat(curator.rating),
          ratingCount: curator.rating_count,
          approved: curator.approved,
          stripeOnboardingComplete: curator.stripe_onboarding_complete
        } : null
      });
    }

    // PUT update user profile
    if (req.method === 'PUT') {
      const { name, bio, profilePhoto, handle } = req.body;
      const updates = {};
      if (name !== undefined) updates.name = name;
      if (bio !== undefined) updates.bio = bio;
      if (profilePhoto !== undefined) updates.profile_photo = profilePhoto;

      // Handle validation and update
      if (handle !== undefined) {
        const handleValidation = validateHandle(handle);
        if (!handleValidation.valid) {
          return res.status(400).json({ error: handleValidation.error });
        }

        const taken = await isHandleTaken(handle, decoded.userId);
        if (taken) {
          return res.status(400).json({ error: 'This handle is already taken' });
        }

        updates.handle = handle.toLowerCase();
      }

      const user = await updateUser(decoded.userId, updates);
      return res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          handle: user.handle,
          profilePhoto: user.profile_photo,
          avatarUrl: user.avatar_url || user.profile_photo,
          role: user.role,
          bio: user.bio
        }
      });
    }

    // POST become a curator
    if (req.method === 'POST') {
      const { action } = req.body;

      if (action === 'become-curator') {
        const user = await getUser(decoded.userId);
        if (user.role === 'curator') {
          return res.status(400).json({ error: 'Already a curator' });
        }

        const curator = await createCurator(decoded.userId);
        return res.json({
          success: true,
          message: 'Curator application submitted',
          curator: {
            id: curator.id,
            approved: curator.approved
          }
        });
      }

      return res.status(400).json({ error: 'Invalid action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('User error:', error);
    return res.status(500).json({ error: error.message });
  }
}
