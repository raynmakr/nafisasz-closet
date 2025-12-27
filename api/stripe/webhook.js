import { verifyWebhookSignature } from '../../lib/stripe.js';
import { query } from '../../lib/db.js';

// Disable body parsing for webhook signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let event;
  try {
    const rawBody = await getRawBody(req);
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    event = verifyWebhookSignature(rawBody, signature);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'account.updated':
        await handleAccountUpdated(event.data.object);
        break;

      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object);
        break;

      case 'transfer.created':
        await handleTransferCreated(event.data.object);
        break;

      case 'charge.dispute.created':
        await handleDisputeCreated(event.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error(`Error handling event ${event.type}:`, err);
    return res.status(500).json({ error: 'Webhook handler error' });
  }
}

/**
 * Handle Stripe Connect account updates
 * Update curator's stripe_onboarding_complete status
 */
async function handleAccountUpdated(account) {
  console.log('Account updated:', account.id);

  const isComplete = account.details_submitted &&
                     account.charges_enabled &&
                     account.payouts_enabled;

  // Update curator's Stripe status
  await query(
    `UPDATE curators
     SET stripe_onboarding_complete = $1, updated_at = CURRENT_TIMESTAMP
     WHERE stripe_account_id = $2`,
    [isComplete, account.id]
  );

  console.log(`Curator Stripe onboarding ${isComplete ? 'completed' : 'incomplete'} for account ${account.id}`);
}

/**
 * Handle successful payment
 * Update transaction status to 'paid'
 */
async function handlePaymentIntentSucceeded(paymentIntent) {
  console.log('Payment succeeded:', paymentIntent.id);

  const transactionId = paymentIntent.metadata?.transactionId;
  if (!transactionId) {
    console.log('No transactionId in payment metadata, skipping');
    return;
  }

  // Update transaction status
  await query(
    `UPDATE transactions
     SET status = 'paid', updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND payment_intent_id = $2`,
    [transactionId, paymentIntent.id]
  );

  // Get transaction details for notification
  const txResult = await query(
    `SELECT t.*, l.title as listing_title, u.name as buyer_name
     FROM transactions t
     JOIN listings l ON t.listing_id = l.id
     JOIN users u ON t.buyer_id = u.id
     WHERE t.id = $1`,
    [transactionId]
  );

  if (txResult.rows[0]) {
    const tx = txResult.rows[0];
    console.log(`Transaction ${tx.id} marked as paid for listing: ${tx.listing_title}`);

    // TODO: Send push notification to curator to purchase the item
  }
}

/**
 * Handle failed payment
 * Update transaction status to 'payment_failed'
 */
async function handlePaymentIntentFailed(paymentIntent) {
  console.log('Payment failed:', paymentIntent.id);

  const transactionId = paymentIntent.metadata?.transactionId;
  if (!transactionId) {
    console.log('No transactionId in payment metadata, skipping');
    return;
  }

  // Update transaction status
  await query(
    `UPDATE transactions
     SET status = 'payment_failed', updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND payment_intent_id = $2`,
    [transactionId, paymentIntent.id]
  );

  // TODO: Send notification to buyer about payment failure
  console.log(`Payment failed for transaction ${transactionId}`);
}

/**
 * Handle transfer created (payout to curator)
 */
async function handleTransferCreated(transfer) {
  console.log('Transfer created:', transfer.id);

  const transactionId = transfer.metadata?.transactionId;
  if (!transactionId) {
    console.log('No transactionId in transfer metadata, skipping');
    return;
  }

  // Update transaction with transfer ID
  await query(
    `UPDATE transactions
     SET stripe_transfer_id = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [transfer.id, transactionId]
  );

  console.log(`Transfer ${transfer.id} recorded for transaction ${transactionId}`);
}

/**
 * Handle dispute created
 */
async function handleDisputeCreated(dispute) {
  console.log('Dispute created:', dispute.id);

  // Try to find the transaction by payment intent
  const paymentIntentId = dispute.payment_intent;
  if (!paymentIntentId) {
    console.log('No payment_intent in dispute, skipping');
    return;
  }

  // Update transaction status
  await query(
    `UPDATE transactions
     SET status = 'disputed', updated_at = CURRENT_TIMESTAMP
     WHERE payment_intent_id = $1`,
    [paymentIntentId]
  );

  // TODO: Notify admin about dispute
  console.log(`Dispute created for payment ${paymentIntentId}`);
}
