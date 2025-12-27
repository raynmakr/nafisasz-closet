import jwt from 'jsonwebtoken';
import { getUser, updateUser } from '../lib/db.js';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const decoded = verifyToken(req);
  if (!decoded) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // PUT update user profile
    if (req.method === 'PUT') {
      const { name, bio, profilePhoto } = req.body;
      const updates = {};
      if (name !== undefined) updates.name = name;
      if (bio !== undefined) updates.bio = bio;
      if (profilePhoto !== undefined) updates.profile_photo = profilePhoto;

      const user = await updateUser(decoded.userId, updates);
      return res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          profilePhoto: user.profile_photo,
          role: user.role,
          bio: user.bio
        }
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('User profile error:', error);
    return res.status(500).json({ error: error.message });
  }
}
