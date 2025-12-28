import { query } from '../../lib/db.js';
import { createTransfer } from '../../lib/stripe.js';
import { notifyBuyerAutoConfirmed, notifyCuratorPayoutReleased } from '../../lib/notifications.js';
import { incrementPurchaseCount, checkCuratorSaleMilestones } from '../../lib/purse.js';

const CRON_SECRET = process.env.CRON_SECRET;

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify cron secret (if configured)
  if (CRON_SECRET) {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      console.log('Auto-confirm cron: Invalid authorization');
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  console.log('Auto-confirm deliveries cron started');

  try {
    // Find transactions that:
    // - Have status 'shipped'
    // - Were shipped more than 7 days ago
    const result = await query(`
      SELECT t.id, t.buyer_id, t.curator_id, t.curator_earnings, t.listing_id,
             c.stripe_account_id, c.stripe_onboarding_complete,
             l.title as listing_title
      FROM transactions t
      JOIN curators c ON t.curator_id = c.id
      JOIN listings l ON t.listing_id = l.id
      WHERE t.status = 'shipped'
        AND t.shipped_at < NOW() - INTERVAL '7 days'
    `);

    console.log(`Found ${result.rows.length} transactions to auto-confirm`);

    let processed = 0;
    let errors = 0;

    for (const tx of result.rows) {
      try {
        console.log(`Auto-confirming transaction ${tx.id}: "${tx.listing_title}"`);

        // Update transaction status to delivered
        await query(`
          UPDATE transactions
          SET status = 'delivered',
              delivered_at = CURRENT_TIMESTAMP,
              auto_confirmed = TRUE,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `, [tx.id]);

        // Trigger payout to curator if they have Stripe connected
        if (tx.stripe_account_id && tx.stripe_onboarding_complete) {
          try {
            const transfer = await createTransfer(
              parseFloat(tx.curator_earnings),
              tx.stripe_account_id,
              {
                transactionId: tx.id.toString(),
                listingId: tx.listing_id.toString(),
                autoConfirmed: 'true',
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
            `, [transfer.id, tx.id]);

            // Update curator's total earnings
            await query(`
              UPDATE curators
              SET total_earnings = total_earnings + $1,
                  total_sales = total_sales + 1,
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = $2
            `, [tx.curator_earnings, tx.curator_id]);

            console.log(`Payout complete: Transfer ${transfer.id} to curator for $${tx.curator_earnings}`);

            // Notify curator of payout
            await notifyCuratorPayoutReleased(
              tx.curator_id,
              tx.id,
              tx.listing_title,
              parseFloat(tx.curator_earnings)
            );
          } catch (payoutError) {
            console.error(`Payout failed for transaction ${tx.id}:`, payoutError);
            // Transaction is still marked as delivered, payout can be retried manually
          }
        } else {
          console.warn(`Curator ${tx.curator_id} has no Stripe account, payout skipped`);
        }

        // Notify buyer that order was auto-confirmed
        await notifyBuyerAutoConfirmed(tx.buyer_id, tx.id, tx.listing_title);

        // Award milestone coins
        try {
          const buyerAwards = await incrementPurchaseCount(tx.buyer_id);
          if (buyerAwards?.length > 0) {
            console.log(`Awarded buyer ${tx.buyer_id} milestones:`, buyerAwards);
          }

          const curatorAwards = await checkCuratorSaleMilestones(tx.curator_id);
          if (curatorAwards?.length > 0) {
            console.log(`Awarded curator ${tx.curator_id} milestones:`, curatorAwards);
          }
        } catch (milestoneError) {
          console.error(`Error awarding milestones for transaction ${tx.id}:`, milestoneError);
        }

        processed++;
      } catch (txError) {
        console.error(`Error processing transaction ${tx.id}:`, txError);
        errors++;
      }
    }

    console.log(`Auto-confirm cron complete: ${processed} processed, ${errors} errors`);

    return res.json({
      success: true,
      found: result.rows.length,
      processed,
      errors,
    });
  } catch (error) {
    console.error('Auto-confirm cron error:', error);
    return res.status(500).json({ error: error.message });
  }
}
