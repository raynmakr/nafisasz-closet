import jwt from 'jsonwebtoken';
import { query } from '../../lib/db.js';

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

  const decoded = verifyToken(req);
  if (!decoded) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    const result = await query(`
      SELECT id, name, handle, avatar_url, profile_photo, bio
      FROM users
      WHERE id = $1
    `, [userId]);

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }

    const u = result.rows[0];
    return res.json({
      user: {
        id: u.id,
        name: u.name,
        handle: u.handle,
        avatarUrl: u.avatar_url,
        profilePhoto: u.profile_photo || u.avatar_url,
        bio: u.bio,
      }
    });
  } catch (error) {
    console.error('User profile error:', error);
    return res.status(500).json({ error: error.message });
  }
}
