import jwt from 'jsonwebtoken';
import { query } from '../lib/db.js';
import { getStripe } from '../lib/stripe.js';

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
 * Payment Methods API
 *
 * GET /api/payment-methods - Get user's payment method status
 * DELETE /api/payment-methods - Remove saved payment method
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const decoded = verifyToken(req);
  if (!decoded) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const stripe = getStripe();

  try {
    // GET - Check if user has payment method
    if (req.method === 'GET') {
      const userResult = await query(
        'SELECT stripe_customer_id, default_payment_method_id FROM users WHERE id = $1',
        [decoded.userId]
      );

      const user = userResult.rows[0];
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      let paymentMethod = null;
      if (user.default_payment_method_id) {
        try {
          const pm = await stripe.paymentMethods.retrieve(user.default_payment_method_id);
          paymentMethod = {
            id: pm.id,
            brand: pm.card?.brand,
            last4: pm.card?.last4,
            expMonth: pm.card?.exp_month,
            expYear: pm.card?.exp_year,
          };
        } catch (err) {
          // Payment method no longer valid
          await query(
            'UPDATE users SET default_payment_method_id = NULL WHERE id = $1',
            [decoded.userId]
          );
        }
      }

      return res.json({
        hasPaymentMethod: !!paymentMethod,
        paymentMethod,
      });
    }

    // DELETE - Remove payment method
    if (req.method === 'DELETE') {
      const userResult = await query(
        'SELECT stripe_customer_id, default_payment_method_id FROM users WHERE id = $1',
        [decoded.userId]
      );

      const user = userResult.rows[0];
      if (user?.default_payment_method_id) {
        try {
          await stripe.paymentMethods.detach(user.default_payment_method_id);
        } catch (err) {
          // Ignore if already detached
        }
      }

      await query(
        'UPDATE users SET default_payment_method_id = NULL WHERE id = $1',
        [decoded.userId]
      );

      return res.json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Payment methods error:', error);
    return res.status(500).json({ error: error.message });
  }
}
