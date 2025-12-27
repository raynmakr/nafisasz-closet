import jwt from 'jsonwebtoken';
import { initDatabase, findOrCreateUser, getUser } from '../lib/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRY = '30d';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, provider, idToken, user: appleUser, invitationCode } = req.body;

    // Initialize database
    if (action === 'init-db') {
      await initDatabase();
      return res.json({ success: true, message: 'Database initialized' });
    }

    // Verify existing token
    if (action === 'verify') {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
      }

      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await getUser(decoded.userId);
        if (!user) {
          return res.status(401).json({ error: 'User not found' });
        }
        return res.json({
          valid: true,
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
          }
        });
      } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
      }
    }

    // Sign in
    if (action === 'signin') {
      if (!provider || !idToken) {
        return res.status(400).json({ error: 'Missing provider or idToken' });
      }

      let providerId, email, name, avatarUrl;

      if (provider === 'google') {
        // Verify Google token
        const googleResponse = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
        );

        if (!googleResponse.ok) {
          return res.status(401).json({ error: 'Invalid Google token' });
        }

        const googleData = await googleResponse.json();
        providerId = googleData.sub;
        email = googleData.email;
        name = googleData.name;
        avatarUrl = googleData.picture;

      } else if (provider === 'apple') {
        // Decode Apple token (it's a JWT)
        const tokenParts = idToken.split('.');
        if (tokenParts.length !== 3) {
          return res.status(401).json({ error: 'Invalid Apple token format' });
        }

        const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
        providerId = payload.sub;
        email = payload.email || appleUser?.email;
        name = appleUser?.fullName
          ? `${appleUser.fullName.givenName || ''} ${appleUser.fullName.familyName || ''}`.trim()
          : email?.split('@')[0] || 'Apple User';
        avatarUrl = null;

      } else {
        return res.status(400).json({ error: 'Unsupported provider' });
      }

      // Find or create user (with invitation code if provided)
      const user = await findOrCreateUser(provider, providerId, email, name, avatarUrl, invitationCode);

      // Generate JWT
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRY }
      );

      return res.json({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          handle: user.handle,
          avatarUrl: user.avatar_url,
          profilePhoto: user.profile_photo,
          role: user.role,
          createdAt: user.created_at
        }
      });
    }

    return res.status(400).json({ error: 'Invalid action' });

  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({ error: error.message });
  }
}
