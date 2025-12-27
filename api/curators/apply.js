import jwt from 'jsonwebtoken';
import { Resend } from 'resend';
import { getUser, query } from '../lib/db.js';

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const decoded = verifyToken(req);
  if (!decoded) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { instagram } = req.body;

    if (!instagram) {
      return res.status(400).json({ error: 'Instagram handle is required' });
    }

    // Get the user info
    const user = await getUser(decoded.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Store the application in the database
    await query(`
      INSERT INTO curator_applications (user_id, instagram, status, created_at)
      VALUES ($1, $2, 'pending', CURRENT_TIMESTAMP)
      ON CONFLICT (user_id) DO UPDATE SET
        instagram = $2,
        status = 'pending',
        updated_at = CURRENT_TIMESTAMP
    `, [decoded.userId, instagram]);

    // Send email notification via Resend
    const resendApiKey = process.env.RESEND_API_KEY;
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);

      try {
        await resend.emails.send({
          from: 'Nafisa\'s Closet <noreply@nafisaszcloset.com>',
          to: ['nafisasz@gmail.com'],
          subject: 'New Curator Application',
          html: `
            <h2>New Curator Application</h2>
            <p><strong>From:</strong> ${user.name} (${user.email})</p>
            <p><strong>Instagram:</strong> <a href="https://instagram.com/${instagram}">@${instagram}</a></p>
            <p><strong>User ID:</strong> ${user.id}</p>
            <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
            <br>
            <p>Review this application in the admin panel.</p>
          `,
        });
      } catch (emailError) {
        console.error('Failed to send email notification:', emailError);
        // Continue even if email fails
      }
    } else {
      console.log('RESEND_API_KEY not configured, skipping email notification');
      console.log('Curator application:', { user: user.email, instagram });
    }

    return res.json({
      success: true,
      message: 'Application submitted successfully'
    });

  } catch (error) {
    console.error('Curator application error:', error);
    return res.status(500).json({ error: error.message });
  }
}
