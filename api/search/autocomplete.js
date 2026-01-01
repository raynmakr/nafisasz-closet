import jwt from 'jsonwebtoken';
import { getAutocompleteSuggestions } from '../../lib/db.js';

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
    // Auth is optional for autocomplete
    verifyToken(req);

    const { q: query, limit = '10' } = req.query;

    if (!query || query.trim().length < 2) {
      return res.json({ suggestions: [] });
    }

    const limitNum = Math.min(parseInt(limit, 10) || 10, 20);
    const suggestions = await getAutocompleteSuggestions(query.trim(), limitNum);

    return res.json({ suggestions });

  } catch (error) {
    console.error('Autocomplete error:', error);
    return res.status(500).json({ error: error.message });
  }
}
