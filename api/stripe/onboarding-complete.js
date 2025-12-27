import jwt from 'jsonwebtoken';
import { query, getCurator } from '../lib/db.js';
import { checkAccountStatus } from '../lib/stripe.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const APP_SCHEME = process.env.APP_SCHEME || 'nafisascloset';

/**
 * Onboarding complete endpoint - called after user completes Stripe onboarding
 * Updates the curator's stripe_onboarding_complete status and redirects to app
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get token from query (passed through Stripe redirect)
  const token = req.query.token;

  if (!token) {
    // No token - just redirect to app
    const redirectUrl = `${APP_SCHEME}://stripe-return?status=success`;
    return res.redirect(302, redirectUrl);
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    const redirectUrl = `${APP_SCHEME}://stripe-return?status=success`;
    return res.redirect(302, redirectUrl);
  }

  try {
    const curator = await getCurator(decoded.userId);

    if (curator && curator.stripe_account_id) {
      // Check and update status
      const status = await checkAccountStatus(curator.stripe_account_id);

      if (status.complete && !curator.stripe_onboarding_complete) {
        await query(
          `UPDATE curators SET stripe_onboarding_complete = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [curator.id]
        );
      }

      const redirectUrl = `${APP_SCHEME}://stripe-return?status=${status.complete ? 'success' : 'incomplete'}`;
      return res.redirect(302, redirectUrl);
    }

    const redirectUrl = `${APP_SCHEME}://stripe-return?status=success`;
    return res.redirect(302, redirectUrl);
  } catch (error) {
    console.error('Onboarding complete error:', error);
    const redirectUrl = `${APP_SCHEME}://stripe-return?status=error`;
    return res.redirect(302, redirectUrl);
  }
}
