import jwt from 'jsonwebtoken';
import { query, createInvitationCodeForUser } from '../lib/db.js';

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
    // Get user's invitation code
    let codeResult = await query(
      'SELECT code, uses_count FROM invitation_codes WHERE user_id = $1',
      [decoded.userId]
    );

    // Create invitation code if user doesn't have one (for existing users)
    if (codeResult.rows.length === 0) {
      await createInvitationCodeForUser(decoded.userId);
      codeResult = await query(
        'SELECT code, uses_count FROM invitation_codes WHERE user_id = $1',
        [decoded.userId]
      );
    }

    const { code, uses_count } = codeResult.rows[0];

    // Count total referrals (users who used this user's code)
    const referralResult = await query(
      'SELECT COUNT(*) as count FROM users WHERE invited_by_user_id = $1',
      [decoded.userId]
    );

    const referralCount = parseInt(referralResult.rows[0].count) || 0;

    // Generate invite link
    const baseUrl = process.env.APP_URL || 'https://nafisasz-closet.vercel.app';
    const inviteLink = `${baseUrl}/invite/${code}`;
    const deepLink = `nafisascloset://invite?code=${code}`;

    return res.json({
      code,
      inviteLink,
      deepLink,
      referralCount,
      usesCount: uses_count
    });

  } catch (error) {
    console.error('Invitation fetch error:', error);
    return res.status(500).json({ error: error.message });
  }
}
