import Stripe from 'stripe';

let stripeInstance;

export function getStripe() {
  if (!stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });
  }
  return stripeInstance;
}

// Platform fee rates by subscription tier
export const PLATFORM_FEE_RATES = {
  free: 0.10,    // 10%
  pro: 0.07,     // 7%
  elite: 0.05,   // 5%
};

// Bidding war premium split
export const BIDDING_WAR_SPLIT = {
  curator: 0.75, // 75%
  platform: 0.25, // 25%
};

/**
 * Calculate platform fee and curator earnings
 * @param {number} finalPrice - The winning bid amount
 * @param {number} startingBid - The starting bid (retail × 1.20)
 * @param {string} subscriptionTier - Curator's subscription tier (free, pro, elite)
 * @returns {{ platformFee: number, curatorEarnings: number, breakdown: object }}
 */
export function calculateFees(finalPrice, startingBid, subscriptionTier = 'free') {
  const tier = subscriptionTier.toLowerCase();
  const baseFeeRate = PLATFORM_FEE_RATES[tier] || PLATFORM_FEE_RATES.free;

  // Base platform fee on the starting bid amount
  const baseFee = startingBid * baseFeeRate;

  // Calculate bidding war premium (amount above starting bid)
  const premium = Math.max(0, finalPrice - startingBid);
  const platformPremium = premium * BIDDING_WAR_SPLIT.platform;
  const curatorPremium = premium * BIDDING_WAR_SPLIT.curator;

  // Total platform fee
  const platformFee = parseFloat((baseFee + platformPremium).toFixed(2));

  // Curator earnings (final price - platform fee)
  const curatorEarnings = parseFloat((finalPrice - platformFee).toFixed(2));

  return {
    platformFee,
    curatorEarnings,
    breakdown: {
      finalPrice,
      startingBid,
      baseFeeRate,
      baseFee: parseFloat(baseFee.toFixed(2)),
      premium: parseFloat(premium.toFixed(2)),
      platformPremium: parseFloat(platformPremium.toFixed(2)),
      curatorPremium: parseFloat(curatorPremium.toFixed(2)),
    }
  };
}

/**
 * Create a Stripe Connect Express account for a curator
 * @param {string} email - Curator's email
 * @param {object} metadata - Additional metadata
 * @returns {Promise<Stripe.Account>}
 */
export async function createConnectAccount(email, metadata = {}) {
  const stripe = getStripe();

  const account = await stripe.accounts.create({
    type: 'express',
    email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata,
  });

  return account;
}

/**
 * Create an account link for Stripe Connect onboarding
 * @param {string} accountId - Stripe Connect account ID
 * @param {string} returnUrl - URL to return to after onboarding
 * @param {string} refreshUrl - URL if link expires
 * @returns {Promise<Stripe.AccountLink>}
 */
export async function createAccountLink(accountId, returnUrl, refreshUrl) {
  const stripe = getStripe();

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  });

  return accountLink;
}

/**
 * Get Stripe Connect account details
 * @param {string} accountId - Stripe Connect account ID
 * @returns {Promise<Stripe.Account>}
 */
export async function getConnectAccount(accountId) {
  const stripe = getStripe();
  return await stripe.accounts.retrieve(accountId);
}

/**
 * Check if a Connect account has completed onboarding
 * @param {string} accountId - Stripe Connect account ID
 * @returns {Promise<{ complete: boolean, chargesEnabled: boolean, payoutsEnabled: boolean }>}
 */
export async function checkAccountStatus(accountId) {
  const account = await getConnectAccount(accountId);

  return {
    complete: account.details_submitted && account.charges_enabled && account.payouts_enabled,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
  };
}

/**
 * Create a PaymentIntent to charge a buyer
 * @param {number} amount - Amount in dollars
 * @param {string} currency - Currency code (default: usd)
 * @param {object} metadata - Payment metadata
 * @returns {Promise<Stripe.PaymentIntent>}
 */
export async function createPaymentIntent(amount, currency = 'usd', metadata = {}) {
  const stripe = getStripe();

  // Convert dollars to cents
  const amountInCents = Math.round(amount * 100);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountInCents,
    currency,
    metadata,
    automatic_payment_methods: {
      enabled: true,
    },
  });

  return paymentIntent;
}

/**
 * Create a SetupIntent for saving a payment method
 * @param {string} customerId - Stripe customer ID (optional)
 * @param {object} metadata - Setup metadata
 * @returns {Promise<Stripe.SetupIntent>}
 */
export async function createSetupIntent(customerId = null, metadata = {}) {
  const stripe = getStripe();

  const params = {
    usage: 'off_session',
    metadata,
  };

  if (customerId) {
    params.customer = customerId;
  }

  return await stripe.setupIntents.create(params);
}

/**
 * Create or retrieve a Stripe customer
 * @param {string} email - Customer email
 * @param {object} metadata - Customer metadata
 * @returns {Promise<Stripe.Customer>}
 */
export async function getOrCreateCustomer(email, metadata = {}) {
  const stripe = getStripe();

  // Search for existing customer
  const customers = await stripe.customers.list({
    email,
    limit: 1,
  });

  if (customers.data.length > 0) {
    return customers.data[0];
  }

  // Create new customer
  return await stripe.customers.create({
    email,
    metadata,
  });
}

/**
 * Create a transfer to a connected account (payout to curator)
 * @param {number} amount - Amount in dollars
 * @param {string} destinationAccountId - Curator's Stripe Connect account ID
 * @param {object} metadata - Transfer metadata
 * @returns {Promise<Stripe.Transfer>}
 */
export async function createTransfer(amount, destinationAccountId, metadata = {}) {
  const stripe = getStripe();

  // Convert dollars to cents
  const amountInCents = Math.round(amount * 100);

  const transfer = await stripe.transfers.create({
    amount: amountInCents,
    currency: 'usd',
    destination: destinationAccountId,
    metadata,
  });

  return transfer;
}

/**
 * Verify a Stripe webhook signature
 * @param {string} payload - Raw request body
 * @param {string} signature - Stripe signature header
 * @returns {Stripe.Event}
 */
export function verifyWebhookSignature(payload, signature) {
  const stripe = getStripe();

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  }

  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET
  );
}
