import jwt from 'jsonwebtoken';
import { query, getCurator } from '../lib/db.js';
import {
  createConnectAccount,
  createAccountLink,
  checkAccountStatus,
} from '../lib/stripe.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const APP_URL = process.env.APP_URL || 'https://nafisasz-closet.vercel.app';
const APP_SCHEME = process.env.APP_SCHEME || 'nafisascloset';

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

  const decoded = verifyToken(req);
  if (!decoded) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // GET - Check Stripe account status
    if (req.method === 'GET') {
      return await handleGetStatus(req, res, decoded);
    }

    // POST - Create account or get onboarding link
    if (req.method === 'POST') {
      const { action } = req.body || {};

      if (action === 'create-account') {
        return await handleCreateAccount(req, res, decoded);
      }

      if (action === 'create-link' || !action) {
        return await handleCreateLink(req, res, decoded);
      }

      return res.status(400).json({ error: 'Invalid action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Stripe Connect error:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Get curator's Stripe account status
 */
async function handleGetStatus(req, res, decoded) {
  // Get curator profile
  const curator = await getCurator(decoded.userId);
  if (!curator) {
    return res.status(403).json({ error: 'Not a curator' });
  }

  if (!curator.stripe_account_id) {
    return res.json({
      hasAccount: false,
      onboardingComplete: false,
      chargesEnabled: false,
      payoutsEnabled: false,
    });
  }

  // Check account status with Stripe
  const status = await checkAccountStatus(curator.stripe_account_id);

  // Update local status if different
  if (status.complete !== curator.stripe_onboarding_complete) {
    await query(
      `UPDATE curators SET stripe_onboarding_complete = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [status.complete, curator.id]
    );
  }

  return res.json({
    hasAccount: true,
    onboardingComplete: status.complete,
    chargesEnabled: status.chargesEnabled,
    payoutsEnabled: status.payoutsEnabled,
    detailsSubmitted: status.detailsSubmitted,
  });
}

/**
 * Create a new Stripe Connect account for curator
 */
async function handleCreateAccount(req, res, decoded) {
  // Get user email
  const userResult = await query('SELECT email, name FROM users WHERE id = $1', [decoded.userId]);
  if (!userResult.rows[0]) {
    return res.status(404).json({ error: 'User not found' });
  }
  const user = userResult.rows[0];

  // Get curator profile
  const curator = await getCurator(decoded.userId);
  if (!curator) {
    return res.status(403).json({ error: 'Not a curator' });
  }

  // Check if already has account
  if (curator.stripe_account_id) {
    return res.status(400).json({
      error: 'Already has Stripe account',
      accountId: curator.stripe_account_id,
    });
  }

  // Create Stripe Connect account
  const account = await createConnectAccount(user.email, {
    userId: decoded.userId.toString(),
    curatorId: curator.id.toString(),
    name: user.name || '',
  });

  // Save account ID to curator
  await query(
    `UPDATE curators SET stripe_account_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
    [account.id, curator.id]
  );

  // Create onboarding link
  const returnUrl = `${APP_SCHEME}://stripe-return?status=success`;
  const refreshUrl = `${APP_URL}/api/stripe/connect?refresh=true`;

  const accountLink = await createAccountLink(account.id, returnUrl, refreshUrl);

  return res.json({
    accountId: account.id,
    onboardingUrl: accountLink.url,
    expiresAt: new Date(accountLink.expires_at * 1000).toISOString(),
  });
}

/**
 * Create/refresh onboarding link for existing account
 */
async function handleCreateLink(req, res, decoded) {
  // Get curator profile
  const curator = await getCurator(decoded.userId);
  if (!curator) {
    return res.status(403).json({ error: 'Not a curator' });
  }

  // If no account exists, create one first
  if (!curator.stripe_account_id) {
    return await handleCreateAccount(req, res, decoded);
  }

  // Check current status
  const status = await checkAccountStatus(curator.stripe_account_id);

  // If onboarding is complete, return status instead
  if (status.complete) {
    return res.json({
      accountId: curator.stripe_account_id,
      onboardingComplete: true,
      chargesEnabled: status.chargesEnabled,
      payoutsEnabled: status.payoutsEnabled,
    });
  }

  // Create new onboarding link
  const returnUrl = `${APP_SCHEME}://stripe-return?status=success`;
  const refreshUrl = `${APP_URL}/api/stripe/connect?refresh=true`;

  const accountLink = await createAccountLink(curator.stripe_account_id, returnUrl, refreshUrl);

  return res.json({
    accountId: curator.stripe_account_id,
    onboardingUrl: accountLink.url,
    expiresAt: new Date(accountLink.expires_at * 1000).toISOString(),
  });
}
