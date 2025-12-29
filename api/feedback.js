import jwt from 'jsonwebtoken';
import { query } from '../lib/db.js';

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

  try {
    // POST - Submit feedback
    if (req.method === 'POST') {
      const decoded = verifyToken(req);
      if (!decoded) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { message } = req.body;

      if (!message || message.trim().length === 0) {
        return res.status(400).json({ error: 'Message is required' });
      }

      if (message.length > 2000) {
        return res.status(400).json({ error: 'Message too long (max 2000 characters)' });
      }

      // Get user info
      const userResult = await query(
        'SELECT id, email, handle FROM users WHERE id = $1',
        [decoded.userId]
      );
      const user = userResult.rows[0];

      // Insert feedback
      const result = await query(
        `INSERT INTO feedback (user_id, user_email, user_handle, message)
         VALUES ($1, $2, $3, $4)
         RETURNING id, created_at`,
        [user?.id || null, user?.email || null, user?.handle || null, message.trim()]
      );

      console.log(`Feedback submitted by ${user?.handle || 'unknown'}: ${message.substring(0, 50)}...`);

      return res.json({
        success: true,
        feedbackId: result.rows[0].id,
        message: 'Thank you for your feedback!'
      });
    }

    // GET - List feedback (for admin panel later)
    if (req.method === 'GET') {
      const decoded = verifyToken(req);
      if (!decoded) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Check if user is admin (for now, just check role)
      const userResult = await query(
        'SELECT role FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (userResult.rows[0]?.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { status, limit = 50, offset = 0 } = req.query;

      let queryStr = `
        SELECT id, user_id, user_email, user_handle, message, status, admin_notes, created_at, updated_at
        FROM feedback
      `;
      const params = [];

      if (status) {
        params.push(status);
        queryStr += ` WHERE status = $${params.length}`;
      }

      queryStr += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(parseInt(limit), parseInt(offset));

      const result = await query(queryStr, params);

      // Get total count
      let countQuery = 'SELECT COUNT(*) FROM feedback';
      if (status) {
        countQuery += ' WHERE status = $1';
      }
      const countResult = await query(countQuery, status ? [status] : []);

      return res.json({
        feedback: result.rows,
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Feedback error:', error);
    return res.status(500).json({ error: error.message });
  }
}
