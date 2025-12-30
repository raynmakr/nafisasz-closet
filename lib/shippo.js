/**
 * Shippo Shipping Integration Library
 *
 * Handles:
 * - Address validation
 * - Shipping rate calculation
 * - Label generation
 * - Tracking
 */

const SHIPPO_API_KEY = process.env.SHIPPO_API_KEY;
const SHIPPO_API_URL = 'https://api.goshippo.com';

/**
 * Make authenticated request to Shippo API
 */
async function shippoRequest(endpoint, options = {}) {
  if (!SHIPPO_API_KEY) {
    throw new Error('SHIPPO_API_KEY not configured');
  }

  const url = `${SHIPPO_API_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `ShippoToken ${SHIPPO_API_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('Shippo API error:', JSON.stringify(data, null, 2));

    // Extract meaningful error message
    let errorMessage = 'Shippo API error';

    if (data.detail) {
      errorMessage = data.detail;
    } else if (data.error) {
      errorMessage = data.error;
    } else if (data.messages && Array.isArray(data.messages)) {
      errorMessage = data.messages.map(m => m.text || m).join('; ');
    } else if (data.__all__ && Array.isArray(data.__all__)) {
      errorMessage = data.__all__.join('; ');
    }

    // Check for specific error codes
    if (response.status === 401) {
      errorMessage = 'Invalid Shippo API key. Please check your configuration.';
    } else if (response.status === 404) {
      errorMessage = 'Rate expired or not found. Please get new rates.';
    } else if (response.status === 400 && errorMessage.toLowerCase().includes('rate')) {
      errorMessage = 'This shipping rate has expired. Please go back and get new rates.';
    }

    throw new Error(errorMessage);
  }

  return data;
}

/**
 * Validate an address
 * Returns validated address with suggestions if needed
 */
export async function validateAddress(address) {
  const shippoAddress = {
    name: address.name,
    company: address.company || '',
    street1: address.street1,
    street2: address.street2 || '',
    city: address.city,
    state: address.state,
    zip: address.zip,
    country: address.country || 'US',
    phone: address.phone || '',
    email: address.email || '',
    validate: true,
  };

  const result = await shippoRequest('/addresses', {
    method: 'POST',
    body: JSON.stringify(shippoAddress),
  });

  return {
    isValid: result.validation_results?.is_valid || false,
    messages: result.validation_results?.messages || [],
    objectId: result.object_id,
    address: {
      name: result.name,
      company: result.company,
      street1: result.street1,
      street2: result.street2,
      city: result.city,
      state: result.state,
      zip: result.zip,
      country: result.country,
      phone: result.phone,
      email: result.email,
    },
  };
}

/**
 * Create a shipment and get rates
 *
 * @param {Object} fromAddress - Sender address
 * @param {Object} toAddress - Recipient address
 * @param {Object} parcel - Package dimensions and weight
 * @returns {Object} Shipment with available rates
 */
export async function createShipment(fromAddress, toAddress, parcel) {
  // Create shipment request
  const shipment = {
    address_from: {
      name: fromAddress.name,
      company: fromAddress.company || '',
      street1: fromAddress.street1,
      street2: fromAddress.street2 || '',
      city: fromAddress.city,
      state: fromAddress.state,
      zip: fromAddress.zip,
      country: fromAddress.country || 'US',
      phone: fromAddress.phone || '',
      email: fromAddress.email || '',
    },
    address_to: {
      name: toAddress.name,
      company: toAddress.company || '',
      street1: toAddress.street1,
      street2: toAddress.street2 || '',
      city: toAddress.city,
      state: toAddress.state,
      zip: toAddress.zip,
      country: toAddress.country || 'US',
      phone: toAddress.phone || '',
      email: toAddress.email || '',
    },
    parcels: [{
      length: parcel.length || 10,
      width: parcel.width || 8,
      height: parcel.height || 4,
      distance_unit: parcel.distanceUnit || 'in',
      weight: parcel.weight || 1,
      mass_unit: parcel.massUnit || 'lb',
    }],
    async: false, // Get rates synchronously
  };

  const result = await shippoRequest('/shipments', {
    method: 'POST',
    body: JSON.stringify(shipment),
  });

  // Format rates for display
  const rates = (result.rates || []).map(rate => ({
    id: rate.object_id,
    carrier: rate.provider,
    service: rate.servicelevel?.name || rate.servicelevel_name,
    serviceToken: rate.servicelevel?.token,
    amount: parseFloat(rate.amount),
    currency: rate.currency,
    estimatedDays: rate.estimated_days,
    durationTerms: rate.duration_terms,
    carrierAccountId: rate.carrier_account,
    attributes: rate.attributes || [],
    // For international
    isInternational: fromAddress.country !== toAddress.country,
    customsRequired: rate.includes_customs || false,
  }));

  // Sort by price
  rates.sort((a, b) => a.amount - b.amount);

  return {
    shipmentId: result.object_id,
    status: result.status,
    rates,
    fromAddress: result.address_from,
    toAddress: result.address_to,
    parcel: result.parcels?.[0],
  };
}

/**
 * Purchase a shipping label
 *
 * @param {string} rateId - The rate object ID from createShipment
 * @returns {Object} Transaction with label URL and tracking info
 */
export async function purchaseLabel(rateId) {
  if (!rateId) {
    throw new Error('Rate ID is required to purchase a label');
  }

  const transaction = {
    rate: rateId,
    label_file_type: 'PDF',
    async: false,
  };

  console.log('Purchasing label with rate ID:', rateId);

  const result = await shippoRequest('/transactions', {
    method: 'POST',
    body: JSON.stringify(transaction),
  });

  console.log('Shippo transaction result:', {
    status: result.status,
    object_id: result.object_id,
    tracking_number: result.tracking_number,
    messages: result.messages,
  });

  if (result.status === 'ERROR') {
    // Parse error messages for common issues
    const errorMessages = result.messages?.map(m => m.text) || [];
    let friendlyMessage = errorMessages.join(', ') || 'Label purchase failed';

    // Check for specific error types
    if (errorMessages.some(m => m?.toLowerCase().includes('expired'))) {
      friendlyMessage = 'This shipping rate has expired. Please go back and select a new rate.';
    } else if (errorMessages.some(m => m?.toLowerCase().includes('rate'))) {
      friendlyMessage = 'Invalid rate selected. Please get new shipping rates and try again.';
    } else if (errorMessages.some(m => m?.toLowerCase().includes('balance') || m?.toLowerCase().includes('funds'))) {
      friendlyMessage = 'Insufficient Shippo account balance. Please add funds to your Shippo account.';
    } else if (errorMessages.some(m => m?.toLowerCase().includes('carrier'))) {
      friendlyMessage = 'Carrier account issue. Please verify your Shippo carrier accounts are configured.';
    }

    throw new Error(friendlyMessage);
  }

  // Ensure we have the required fields
  if (!result.tracking_number || !result.label_url) {
    console.error('Incomplete Shippo response:', result);
    throw new Error('Label created but missing tracking number or label URL. Please contact support.');
  }

  return {
    transactionId: result.object_id,
    status: result.status,
    trackingNumber: result.tracking_number,
    trackingUrl: result.tracking_url_provider,
    labelUrl: result.label_url,
    commercialInvoiceUrl: result.commercial_invoice_url,
    rate: {
      amount: parseFloat(result.rate?.amount || 0),
      currency: result.rate?.currency || 'USD',
      carrier: result.rate?.provider,
      service: result.rate?.servicelevel?.name,
    },
    eta: result.eta,
  };
}

/**
 * Get tracking info for a shipment
 *
 * @param {string} carrier - Carrier name (e.g., 'usps', 'fedex', 'ups')
 * @param {string} trackingNumber - The tracking number
 * @returns {Object} Tracking status and history
 */
export async function getTrackingStatus(carrier, trackingNumber) {
  const result = await shippoRequest(`/tracks/${carrier}/${trackingNumber}`);

  return {
    carrier: result.carrier,
    trackingNumber: result.tracking_number,
    status: result.tracking_status?.status,
    statusDetails: result.tracking_status?.status_details,
    statusDate: result.tracking_status?.status_date,
    location: result.tracking_status?.location,
    eta: result.eta,
    servicelevel: result.servicelevel?.name,
    addressFrom: result.address_from,
    addressTo: result.address_to,
    history: (result.tracking_history || []).map(event => ({
      status: event.status,
      statusDetails: event.status_details,
      statusDate: event.status_date,
      location: event.location,
    })),
  };
}

/**
 * Register a webhook for tracking updates
 *
 * @param {string} trackingNumber - The tracking number
 * @param {string} carrier - The carrier name
 * @param {string} webhookUrl - URL to receive tracking updates
 */
export async function registerTrackingWebhook(trackingNumber, carrier, webhookUrl) {
  const result = await shippoRequest('/tracks', {
    method: 'POST',
    body: JSON.stringify({
      carrier,
      tracking_number: trackingNumber,
      metadata: webhookUrl,
    }),
  });

  return {
    objectId: result.object_id,
    carrier: result.carrier,
    trackingNumber: result.tracking_number,
  };
}

/**
 * Get available carriers
 */
export async function getCarriers() {
  const result = await shippoRequest('/carrier_accounts');

  return result.results?.map(carrier => ({
    id: carrier.object_id,
    carrier: carrier.carrier,
    accountId: carrier.account_id,
    active: carrier.active,
    isShippoAccount: carrier.is_shippo_account,
  })) || [];
}

/**
 * Calculate quick shipping estimate
 * For showing estimated costs before full shipment creation
 */
export async function getQuickRates(fromZip, toZip, toCountry, weight, isInternational = false) {
  // Use Shippo's instant rate calculation
  const shipment = {
    address_from: {
      zip: fromZip,
      country: 'US',
    },
    address_to: {
      zip: toZip,
      country: toCountry || 'US',
    },
    parcels: [{
      length: 10,
      width: 8,
      height: 4,
      distance_unit: 'in',
      weight: weight || 1,
      mass_unit: 'lb',
    }],
    async: false,
  };

  try {
    const result = await shippoRequest('/shipments', {
      method: 'POST',
      body: JSON.stringify(shipment),
    });

    const rates = (result.rates || []).map(rate => ({
      carrier: rate.provider,
      service: rate.servicelevel?.name,
      amount: parseFloat(rate.amount),
      estimatedDays: rate.estimated_days,
    }));

    // Return cheapest and fastest options
    const cheapest = rates.reduce((a, b) => a.amount < b.amount ? a : b, rates[0]);
    const fastest = rates.reduce((a, b) => (a.estimatedDays || 99) < (b.estimatedDays || 99) ? a : b, rates[0]);

    return {
      cheapest,
      fastest,
      allRates: rates.sort((a, b) => a.amount - b.amount).slice(0, 5),
    };
  } catch (error) {
    console.error('Quick rate estimate failed:', error);
    return null;
  }
}

/**
 * Helper to format carrier name for display
 */
export function formatCarrierName(carrier) {
  const names = {
    'usps': 'USPS',
    'ups': 'UPS',
    'fedex': 'FedEx',
    'dhl_express': 'DHL Express',
    'dhl_ecommerce': 'DHL eCommerce',
    'ontrac': 'OnTrac',
    'lasership': 'LaserShip',
    'canada_post': 'Canada Post',
    'royal_mail': 'Royal Mail',
    'australia_post': 'Australia Post',
    'purolator_canada': 'Purolator',
  };
  return names[carrier?.toLowerCase()] || carrier;
}

/**
 * Check if shipping is international
 */
export function isInternationalShipping(fromCountry, toCountry) {
  return (fromCountry || 'US') !== (toCountry || 'US');
}

/**
 * Get customs forms requirements for international shipping
 */
export function getCustomsRequirements(toCountry) {
  // Countries requiring customs forms
  const requiresCustoms = !['US', 'PR', 'VI', 'GU', 'AS', 'MP'].includes(toCountry);

  // Countries with special requirements
  const specialCountries = {
    'CA': 'NAFTA/USMCA forms may be required',
    'MX': 'NAFTA/USMCA forms may be required',
    'GB': 'Post-Brexit customs documentation required',
    'AU': 'Agricultural items restricted',
  };

  return {
    required: requiresCustoms,
    notes: specialCountries[toCountry] || null,
  };
}

// Export for use in other modules
export default {
  validateAddress,
  createShipment,
  purchaseLabel,
  getTrackingStatus,
  registerTrackingWebhook,
  getCarriers,
  getQuickRates,
  formatCarrierName,
  isInternationalShipping,
  getCustomsRequirements,
};
