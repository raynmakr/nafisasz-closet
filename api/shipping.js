import jwt from 'jsonwebtoken';
import { query } from '../lib/db.js';
import {
  validateAddress,
  createShipment,
  purchaseLabel,
  getTrackingStatus,
  getQuickRates,
  formatCarrierName,
} from '../lib/shippo.js';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const decoded = verifyToken(req);
  if (!decoded) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Parse URL path
    const pathParts = req.url.split('?')[0].split('/').filter(Boolean);
    const action = pathParts[2]; // /api/shipping/:action

    switch (action) {
      case 'addresses':
        return await handleAddresses(req, res, decoded, pathParts[3]);
      case 'validate':
        return await handleValidateAddress(req, res, decoded);
      case 'rates':
        return await handleGetRates(req, res, decoded);
      case 'label':
        return await handlePurchaseLabel(req, res, decoded);
      case 'track':
        return await handleTrackShipment(req, res, decoded);
      case 'quick-estimate':
        return await handleQuickEstimate(req, res, decoded);
      default:
        return res.status(404).json({ error: 'Endpoint not found' });
    }
  } catch (error) {
    console.error('Shipping error:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Handle user addresses CRUD
 */
async function handleAddresses(req, res, decoded, addressId) {
  // GET - List user addresses
  if (req.method === 'GET' && !addressId) {
    const result = await query(
      `SELECT * FROM shipping_addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC`,
      [decoded.userId]
    );
    return res.json({ addresses: result.rows });
  }

  // GET - Get single address
  if (req.method === 'GET' && addressId) {
    const result = await query(
      `SELECT * FROM shipping_addresses WHERE id = $1 AND user_id = $2`,
      [addressId, decoded.userId]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Address not found' });
    }
    return res.json({ address: result.rows[0] });
  }

  // POST - Create address
  if (req.method === 'POST') {
    const { name, company, street1, street2, city, state, zip, country, phone, email, isDefault, validate } = req.body;

    if (!name || !street1 || !city || !state || !zip) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Optionally validate address with Shippo
    let isValidated = false;
    let shippoObjectId = null;
    if (validate && process.env.SHIPPO_API_KEY) {
      try {
        const validation = await validateAddress({ name, company, street1, street2, city, state, zip, country, phone, email });
        isValidated = validation.isValid;
        shippoObjectId = validation.objectId;
        if (!isValidated && validation.messages?.length > 0) {
          return res.status(400).json({
            error: 'Address validation failed',
            messages: validation.messages,
          });
        }
      } catch (err) {
        console.error('Address validation error:', err);
        // Continue without validation
      }
    }

    // If setting as default, unset other defaults first
    if (isDefault) {
      await query(
        `UPDATE shipping_addresses SET is_default = FALSE WHERE user_id = $1`,
        [decoded.userId]
      );
    }

    const result = await query(
      `INSERT INTO shipping_addresses (user_id, name, company, street1, street2, city, state, zip, country, phone, email, is_default, is_validated, shippo_object_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [decoded.userId, name, company, street1, street2, city, state, zip, country || 'US', phone, email, isDefault || false, isValidated, shippoObjectId]
    );

    return res.status(201).json({ address: result.rows[0] });
  }

  // PUT - Update address
  if (req.method === 'PUT' && addressId) {
    const { name, company, street1, street2, city, state, zip, country, phone, email, isDefault } = req.body;

    // Verify ownership
    const existing = await query(
      `SELECT * FROM shipping_addresses WHERE id = $1 AND user_id = $2`,
      [addressId, decoded.userId]
    );
    if (!existing.rows[0]) {
      return res.status(404).json({ error: 'Address not found' });
    }

    // If setting as default, unset other defaults first
    if (isDefault) {
      await query(
        `UPDATE shipping_addresses SET is_default = FALSE WHERE user_id = $1`,
        [decoded.userId]
      );
    }

    const result = await query(
      `UPDATE shipping_addresses
       SET name = COALESCE($1, name),
           company = COALESCE($2, company),
           street1 = COALESCE($3, street1),
           street2 = COALESCE($4, street2),
           city = COALESCE($5, city),
           state = COALESCE($6, state),
           zip = COALESCE($7, zip),
           country = COALESCE($8, country),
           phone = COALESCE($9, phone),
           email = COALESCE($10, email),
           is_default = COALESCE($11, is_default),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $12 AND user_id = $13
       RETURNING *`,
      [name, company, street1, street2, city, state, zip, country, phone, email, isDefault, addressId, decoded.userId]
    );

    return res.json({ address: result.rows[0] });
  }

  // DELETE - Delete address
  if (req.method === 'DELETE' && addressId) {
    const result = await query(
      `DELETE FROM shipping_addresses WHERE id = $1 AND user_id = $2 RETURNING *`,
      [addressId, decoded.userId]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Address not found' });
    }
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

/**
 * Validate an address
 */
async function handleValidateAddress(req, res, decoded) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const address = req.body;

  if (!address.name || !address.street1 || !address.city || !address.state || !address.zip) {
    return res.status(400).json({ error: 'Missing required address fields' });
  }

  const result = await validateAddress(address);
  return res.json(result);
}

/**
 * Get shipping rates for a transaction
 */
async function handleGetRates(req, res, decoded) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { transactionId, fromAddress, toAddress, parcel } = req.body;

  // If transactionId provided, get curator's address and buyer's address from transaction
  if (transactionId) {
    // Get transaction with curator info
    const txResult = await query(`
      SELECT t.*, c.user_id as curator_user_id, u.name as buyer_name, u.email as buyer_email
      FROM transactions t
      JOIN curators c ON t.curator_id = c.id
      JOIN users u ON t.buyer_id = u.id
      WHERE t.id = $1
    `, [transactionId]);

    if (!txResult.rows[0]) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const tx = txResult.rows[0];

    // Verify user is the curator for this transaction
    if (tx.curator_user_id !== decoded.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Get curator's default address
    const curatorAddrResult = await query(
      `SELECT * FROM shipping_addresses WHERE user_id = $1 ORDER BY is_default DESC LIMIT 1`,
      [decoded.userId]
    );

    // Get buyer's default address
    const buyerAddrResult = await query(
      `SELECT * FROM shipping_addresses WHERE user_id = $1 ORDER BY is_default DESC LIMIT 1`,
      [tx.buyer_id]
    );

    if (!curatorAddrResult.rows[0]) {
      return res.status(400).json({ error: 'Curator address required. Please add a shipping address.' });
    }

    if (!buyerAddrResult.rows[0]) {
      return res.status(400).json({ error: 'Buyer has not added a shipping address yet.' });
    }

    const curatorAddr = curatorAddrResult.rows[0];
    const buyerAddr = buyerAddrResult.rows[0];

    // Get rates from Shippo
    const shipment = await createShipment(
      curatorAddr,
      buyerAddr,
      parcel || { weight: 1, length: 10, width: 8, height: 4 }
    );

    // Update transaction with shipment ID
    await query(
      `UPDATE transactions SET shippo_shipment_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [shipment.shipmentId, transactionId]
    );

    return res.json({
      shipmentId: shipment.shipmentId,
      rates: shipment.rates.map(rate => ({
        ...rate,
        carrierFormatted: formatCarrierName(rate.carrier),
      })),
      fromAddress: curatorAddr,
      toAddress: buyerAddr,
    });
  }

  // Manual addresses provided
  if (!fromAddress || !toAddress) {
    return res.status(400).json({ error: 'From and to addresses required' });
  }

  const shipment = await createShipment(
    fromAddress,
    toAddress,
    parcel || { weight: 1, length: 10, width: 8, height: 4 }
  );

  return res.json({
    shipmentId: shipment.shipmentId,
    rates: shipment.rates.map(rate => ({
      ...rate,
      carrierFormatted: formatCarrierName(rate.carrier),
    })),
  });
}

/**
 * Purchase a shipping label
 */
async function handlePurchaseLabel(req, res, decoded) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { transactionId, rateId, parcel } = req.body;

  if (!transactionId || !rateId) {
    return res.status(400).json({ error: 'Transaction ID and rate ID required' });
  }

  // Get transaction with curator info
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

  // Verify user is the curator for this transaction
  if (tx.curator_user_id !== decoded.userId) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  // Verify transaction is in correct status (allow from paid or curator_confirmed)
  if (tx.status !== 'paid' && tx.status !== 'curator_confirmed') {
    return res.status(400).json({ error: `Cannot generate label in status: ${tx.status}` });
  }

  // Purchase the label
  const label = await purchaseLabel(rateId);

  // Update transaction with label info
  await query(`
    UPDATE transactions
    SET shippo_rate_id = $1,
        shippo_transaction_id = $2,
        tracking_number = $3,
        tracking_url = $4,
        label_url = $5,
        shipping_carrier = $6,
        shipping_service = $7,
        shipping_cost = $8,
        package_weight = $9,
        package_length = $10,
        package_width = $11,
        package_height = $12,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $13
  `, [
    rateId,
    label.transactionId,
    label.trackingNumber,
    label.trackingUrl,
    label.labelUrl,
    label.rate.carrier,
    label.rate.service,
    label.rate.amount,
    parcel?.weight || 1,
    parcel?.length || 10,
    parcel?.width || 8,
    parcel?.height || 4,
    transactionId,
  ]);

  return res.json({
    success: true,
    label: {
      transactionId: label.transactionId,
      trackingNumber: label.trackingNumber,
      trackingUrl: label.trackingUrl,
      labelUrl: label.labelUrl,
      carrier: formatCarrierName(label.rate.carrier),
      service: label.rate.service,
      cost: label.rate.amount,
    },
  });
}

/**
 * Track a shipment
 */
async function handleTrackShipment(req, res, decoded) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const transactionId = url.searchParams.get('transactionId');
  const carrier = url.searchParams.get('carrier');
  const trackingNumber = url.searchParams.get('trackingNumber');

  // If transactionId provided, get tracking info from transaction
  if (transactionId) {
    const txResult = await query(`
      SELECT t.tracking_number, t.shipping_carrier, t.buyer_id, c.user_id as curator_user_id
      FROM transactions t
      JOIN curators c ON t.curator_id = c.id
      WHERE t.id = $1
    `, [transactionId]);

    if (!txResult.rows[0]) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const tx = txResult.rows[0];

    // Verify user is buyer or curator
    if (tx.buyer_id !== decoded.userId && tx.curator_user_id !== decoded.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (!tx.tracking_number || !tx.shipping_carrier) {
      return res.status(400).json({ error: 'No tracking info available' });
    }

    const tracking = await getTrackingStatus(tx.shipping_carrier, tx.tracking_number);
    return res.json({ tracking });
  }

  // Manual tracking lookup
  if (!carrier || !trackingNumber) {
    return res.status(400).json({ error: 'Carrier and tracking number required' });
  }

  const tracking = await getTrackingStatus(carrier, trackingNumber);
  return res.json({ tracking });
}

/**
 * Get quick shipping estimate (for buyer preview)
 */
async function handleQuickEstimate(req, res, decoded) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { fromZip, toZip, toCountry, weight } = req.body;

  if (!fromZip || !toZip) {
    return res.status(400).json({ error: 'From and to ZIP codes required' });
  }

  const estimate = await getQuickRates(fromZip, toZip, toCountry || 'US', weight || 1);

  if (!estimate) {
    return res.status(400).json({ error: 'Could not get shipping estimate' });
  }

  return res.json(estimate);
}
