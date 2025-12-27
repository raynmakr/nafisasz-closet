import { validateInvitationCode } from '../../lib/db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    const inviter = await validateInvitationCode(code);

    if (!inviter) {
      return res.json({
        valid: false,
        message: 'Invalid invitation code'
      });
    }

    return res.json({
      valid: true,
      inviter: {
        name: inviter.name,
        handle: inviter.handle
      }
    });

  } catch (error) {
    console.error('Invitation validation error:', error);
    return res.status(500).json({ error: error.message });
  }
}
