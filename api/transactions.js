import jwt from 'jsonwebtoken';
import { query, getCurator } from '../lib/db.js';
import { createTransfer } from '../lib/stripe.js';
import { notifyBuyerItemShipped } from '../lib/notifications.js';
import { incrementPurchaseCount, checkCuratorSaleMilestones } from '../lib/purse.js';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const decoded = verifyToken(req);
  if (!decoded) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // GET /api/transactions - List user's transactions
    if (req.method === 'GET') {
      const { role, status } = req.query;
      return await handleListTransactions(req, res, decoded, role, status);
    }

    // POST /api/transactions/:id/action - Perform action on transaction
    if (req.method === 'POST') {
      const pathParts = req.url.split('/').filter(Boolean);
      const transactionId = pathParts[2]; // /api/transactions/:id/...
      const action = pathParts[3];

      if (!transactionId || !action) {
        return res.status(400).json({ error: 'Missing transaction ID or action' });
      }

      switch (action) {
        case 'confirm-purchase':
          return await handleConfirmPurchase(req, res, decoded, transactionId);
        case 'mark-shipped':
          return await handleMarkShipped(req, res, decoded, transactionId);
        case 'confirm-delivery':
          return await handleConfirmDelivery(req, res, decoded, transactionId);
        default:
          return res.status(400).json({ error: `Unknown action: ${action}` });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Transactions error:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * List transactions for a user
 */
async function handleListTransactions(req, res, decoded, role, status) {
  let sql;
  const params = [decoded.userId];

  if (role === 'seller') {
    // Curator's sold items - show buyer info
    sql = `
      SELECT t.*, l.title, l.photos, l.brand, l.size,
             u.handle as buyer_handle, u.name as buyer_name, u.email as buyer_email
      FROM transactions t
      JOIN listings l ON t.listing_id = l.id
      JOIN users u ON t.buyer_id = u.id
      JOIN curators c ON t.curator_id = c.id
      WHERE c.user_id = $1
    `;
  } else {
    // Buyer's purchases - show curator info (join users via curators to get handle)
    sql = `
      SELECT t.*, l.title, l.photos, l.brand, l.size,
             cu.handle as curator_handle, cu.name as curator_name
      FROM transactions t
      JOIN listings l ON t.listing_id = l.id
      JOIN curators c ON t.curator_id = c.id
      JOIN users cu ON c.user_id = cu.id
      WHERE t.buyer_id = $1
    `;
  }

  if (status) {
    params.push(status);
    sql += ` AND t.status = $${params.length}`;
  }

  sql += ' ORDER BY t.created_at DESC LIMIT 50';

  const result = await query(sql, params);
  return res.json({ transactions: result.rows });
}

/**
 * Curator confirms they've purchased the item
 */
async function handleConfirmPurchase(req, res, decoded, transactionId) {
  const { receiptUrl } = req.body || {};

  // Get transaction
  const txResult = await query(`
    SELECT t.*, c.user_id as curator_user_id
    FROM transactions t
    JOIN curators c ON t.curator_id = c.id
    WHERE t.id = $1
  `, [transactionId]);

  if (!txResult.rows[0]) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  const tx = txResult.rows[0];

  // Verify curator owns this transaction
  if (tx.curator_user_id !== decoded.userId) {
    return res.status(403).json({ error: 'Not your transaction' });
  }

  // Verify transaction is in correct status
  if (tx.status !== 'paid') {
    return res.status(400).json({ error: `Cannot confirm purchase in status: ${tx.status}` });
  }

  // Update transaction
  await query(`
    UPDATE transactions
    SET status = 'curator_confirmed', receipt_url = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
  `, [receiptUrl, transactionId]);

  return res.json({ success: true, status: 'curator_confirmed' });
}

/**
 * Curator marks item as shipped
 */
async function handleMarkShipped(req, res, decoded, transactionId) {
  const { trackingNumber, shippingLabel } = req.body || {};

  if (!trackingNumber) {
    return res.status(400).json({ error: 'Tracking number required' });
  }

  // Get transaction with listing info
  const txResult = await query(`
    SELECT t.*, c.user_id as curator_user_id, l.title as listing_title
    FROM transactions t
    JOIN curators c ON t.curator_id = c.id
    JOIN listings l ON t.listing_id = l.id
    WHERE t.id = $1
  `, [transactionId]);

  if (!txResult.rows[0]) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  const tx = txResult.rows[0];

  // Verify curator owns this transaction
  if (tx.curator_user_id !== decoded.userId) {
    return res.status(403).json({ error: 'Not your transaction' });
  }

  // Verify transaction is in correct status (allow shipping from paid or curator_confirmed)
  if (tx.status !== 'paid' && tx.status !== 'curator_confirmed') {
    return res.status(400).json({ error: `Cannot mark shipped in status: ${tx.status}` });
  }

  // Update transaction
  await query(`
    UPDATE transactions
    SET status = 'shipped',
        tracking_number = $1,
        shipping_label = $2,
        shipped_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $3
  `, [trackingNumber, shippingLabel, transactionId]);

  // Send notification to buyer with tracking info
  notifyBuyerItemShipped(
    tx.buyer_id,
    transactionId,
    tx.listing_title,
    trackingNumber
  ).catch((err) => console.error('Failed to send shipped notification:', err));

  return res.json({ success: true, status: 'shipped' });
}

/**
 * Buyer confirms delivery - triggers payout to curator
 */
async function handleConfirmDelivery(req, res, decoded, transactionId) {
  // Get transaction with curator info
  const txResult = await query(`
    SELECT t.*, c.stripe_account_id, c.stripe_onboarding_complete, c.user_id as curator_user_id
    FROM transactions t
    JOIN curators c ON t.curator_id = c.id
    WHERE t.id = $1
  `, [transactionId]);

  if (!txResult.rows[0]) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  const tx = txResult.rows[0];

  // Verify buyer owns this transaction
  if (tx.buyer_id !== decoded.userId) {
    return res.status(403).json({ error: 'Not your transaction' });
  }

  // Verify transaction is in correct status
  if (tx.status !== 'shipped') {
    return res.status(400).json({ error: `Cannot confirm delivery in status: ${tx.status}` });
  }

  // Update transaction status
  await query(`
    UPDATE transactions
    SET status = 'delivered', delivered_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
  `, [transactionId]);

  // Trigger payout to curator
  if (tx.stripe_account_id && tx.stripe_onboarding_complete) {
    try {
      const transfer = await createTransfer(
        parseFloat(tx.curator_earnings),
        tx.stripe_account_id,
        {
          transactionId: transactionId.toString(),
          listingId: tx.listing_id.toString(),
        }
      );

      // Update transaction with transfer info
      await query(`
        UPDATE transactions
        SET status = 'payout_complete',
            stripe_transfer_id = $1,
            payout_completed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [transfer.id, transactionId]);

      // Update curator's total earnings
      await query(`
        UPDATE curators
        SET total_earnings = total_earnings + $1,
            total_sales = total_sales + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [tx.curator_earnings, tx.curator_id]);

      console.log(`Payout complete: Transfer ${transfer.id} to curator for $${tx.curator_earnings}`);

      // Award milestone coins (async, don't block response)
      awardDeliveryMilestones(tx.buyer_id, tx.curator_id).catch(err =>
        console.error('Error awarding delivery milestones:', err)
      );

      return res.json({
        success: true,
        status: 'payout_complete',
        transferId: transfer.id,
        curatorEarnings: tx.curator_earnings,
      });
    } catch (error) {
      console.error('Payout failed:', error);
      // Transaction marked as delivered, payout can be retried
      return res.json({
        success: true,
        status: 'delivered',
        payoutError: error.message,
      });
    }
  } else {
    console.warn(`Curator ${tx.curator_id} has no Stripe account, payout skipped`);

    // Still award milestone coins even if payout is skipped
    awardDeliveryMilestones(tx.buyer_id, tx.curator_id).catch(err =>
      console.error('Error awarding delivery milestones:', err)
    );

    return res.json({
      success: true,
      status: 'delivered',
      payoutSkipped: 'Curator has not completed Stripe onboarding',
    });
  }
}

/**
 * Award milestone coins after successful delivery
 * - Buyer: purchase count milestone (1st, 3rd, 5th, 10th)
 * - Curator: sale count milestone (1st, 10th, 50th)
 */
async function awardDeliveryMilestones(buyerId, curatorId) {
  const results = { buyer: [], curator: [] };

  // Award buyer milestones (increments purchase count and checks thresholds)
  try {
    const buyerAwards = await incrementPurchaseCount(buyerId);
    if (buyerAwards?.length > 0) {
      console.log(`Awarded buyer ${buyerId} milestones:`, buyerAwards);
      results.buyer = buyerAwards;
    }
  } catch (err) {
    console.error(`Failed to check buyer milestones for ${buyerId}:`, err);
  }

  // Award curator milestones (checks sale thresholds)
  try {
    const curatorAwards = await checkCuratorSaleMilestones(curatorId);
    if (curatorAwards?.length > 0) {
      console.log(`Awarded curator ${curatorId} milestones:`, curatorAwards);
      results.curator = curatorAwards;
    }
  } catch (err) {
    console.error(`Failed to check curator milestones for ${curatorId}:`, err);
  }

  return results;
}
