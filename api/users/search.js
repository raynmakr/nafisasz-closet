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
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.json({ users: [] });
    }

    const searchTerm = q.toLowerCase();
    const isHandleSearch = searchTerm.startsWith('@');
    const cleanSearchTerm = isHandleSearch ? searchTerm.slice(1) : searchTerm;

    // Search by name or handle
    const result = await query(`
      SELECT id, name, handle, avatar_url
      FROM users
      WHERE (LOWER(name) LIKE $1 OR LOWER(handle) LIKE $1)
        AND id != $2
      ORDER BY
        CASE
          WHEN LOWER(handle) = $3 THEN 0
          WHEN LOWER(name) = $3 THEN 1
          WHEN LOWER(handle) LIKE $4 THEN 2
          WHEN LOWER(name) LIKE $4 THEN 3
          ELSE 4
        END,
        name
      LIMIT 20
    `, [
      `%${cleanSearchTerm}%`,
      decoded.userId,
      cleanSearchTerm,
      `${cleanSearchTerm}%`,
    ]);

    return res.json({ users: result.rows });
  } catch (error) {
    console.error('User search error:', error);
    return res.status(500).json({ error: error.message });
  }
}
