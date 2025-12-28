import jwt from 'jsonwebtoken';
import { query } from '../../lib/db.js';
import { getStripe } from '../../lib/stripe.js';

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

/**
 * POST /api/payment-methods/confirm
 * Confirm and save payment method after SetupIntent succeeds
 */
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

  const { paymentMethodId } = req.body;

  if (!paymentMethodId) {
    return res.status(400).json({ error: 'Missing paymentMethodId' });
  }

  const stripe = getStripe();

  try {
    // Verify the payment method exists and belongs to user's customer
    const userResult = await query(
      'SELECT stripe_customer_id FROM users WHERE id = $1',
      [decoded.userId]
    );

    const user = userResult.rows[0];
    if (!user?.stripe_customer_id) {
      return res.status(400).json({ error: 'No Stripe customer found' });
    }

    // Get payment method and verify it's attached to the customer
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

    if (paymentMethod.customer !== user.stripe_customer_id) {
      return res.status(400).json({ error: 'Payment method does not belong to user' });
    }

    // Set as default payment method on customer
    await stripe.customers.update(user.stripe_customer_id, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // Save to user record
    await query(
      'UPDATE users SET default_payment_method_id = $1 WHERE id = $2',
      [paymentMethodId, decoded.userId]
    );

    return res.json({
      success: true,
      paymentMethod: {
        id: paymentMethod.id,
        brand: paymentMethod.card?.brand,
        last4: paymentMethod.card?.last4,
        expMonth: paymentMethod.card?.exp_month,
        expYear: paymentMethod.card?.exp_year,
      },
    });
  } catch (error) {
    console.error('Confirm payment method error:', error);
    return res.status(500).json({ error: error.message });
  }
}
