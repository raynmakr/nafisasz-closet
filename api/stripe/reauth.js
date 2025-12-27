import jwt from 'jsonwebtoken';
import { getCurator } from '../lib/db.js';
import { createAccountLink, checkAccountStatus } from '../lib/stripe.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const APP_URL = process.env.APP_URL || 'https://nafisasz-closet.vercel.app';
const APP_SCHEME = process.env.APP_SCHEME || 'nafisascloset';

/**
 * Reauth endpoint - generates a new onboarding link when the previous one expired
 * This is called when Stripe redirects to the refresh_url
 */
export default async function handler(req, res) {
  // Handle both GET (redirect from Stripe) and POST (API call)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // For GET requests (browser redirect), try to get token from query
  let decoded = null;
  const tokenFromQuery = req.query.token;
  const tokenFromHeader = req.headers.authorization?.split(' ')[1];
  const token = tokenFromQuery || tokenFromHeader;

  if (token) {
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      // Token invalid
    }
  }

  // If no valid token, redirect to app with error
  if (!decoded) {
    // Redirect to app with reauth needed message
    const redirectUrl = `${APP_SCHEME}://stripe-return?status=reauth_needed`;
    return res.redirect(302, redirectUrl);
  }

  try {
    const curator = await getCurator(decoded.userId);
    if (!curator || !curator.stripe_account_id) {
      const redirectUrl = `${APP_SCHEME}://stripe-return?status=error&message=no_account`;
      return res.redirect(302, redirectUrl);
    }

    // Check if already complete
    const status = await checkAccountStatus(curator.stripe_account_id);
    if (status.complete) {
      const redirectUrl = `${APP_SCHEME}://stripe-return?status=success`;
      return res.redirect(302, redirectUrl);
    }

    // Generate new onboarding link
    const returnUrl = `${APP_SCHEME}://stripe-return?status=success`;
    const refreshUrl = `${APP_URL}/api/stripe/reauth?token=${token}`;

    const accountLink = await createAccountLink(curator.stripe_account_id, returnUrl, refreshUrl);

    // Redirect to new onboarding link
    return res.redirect(302, accountLink.url);
  } catch (error) {
    console.error('Reauth error:', error);
    const redirectUrl = `${APP_SCHEME}://stripe-return?status=error&message=${encodeURIComponent(error.message)}`;
    return res.redirect(302, redirectUrl);
  }
}
