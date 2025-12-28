import jwt from 'jsonwebtoken';
import { getUserInvitationCode, createInvitationCodeForUser, getUserReferrals } from '../../lib/db.js';

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
    // Get or create invitation code for user
    let invitationCode = await getUserInvitationCode(decoded.userId);

    if (!invitationCode) {
      // Create one if it doesn't exist
      const code = await createInvitationCodeForUser(decoded.userId);
      invitationCode = await getUserInvitationCode(decoded.userId);
    }

    // Get referral count
    const referrals = await getUserReferrals(decoded.userId);

    const code = invitationCode.code;
    const baseUrl = process.env.APP_URL || 'https://nafisaszcloset.com';

    return res.json({
      code: code,
      inviteLink: `${baseUrl}/invite/${code}`,
      deepLink: `nafisascloset://invite/${code}`,
      referralCount: referrals.length,
      usesCount: invitationCode.uses_count || 0
    });

  } catch (error) {
    console.error('Invitation info error:', error);
    return res.status(500).json({ error: error.message });
  }
}
