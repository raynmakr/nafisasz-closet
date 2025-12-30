import { api } from './api';

export interface ShippingAddress {
  id: number;
  user_id: number;
  name: string;
  company?: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string;
  email?: string;
  is_default: boolean;
  is_validated: boolean;
  shippo_object_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ShippingRate {
  id: string;
  carrier: string;
  carrierFormatted: string;
  service: string;
  serviceToken?: string;
  amount: number;
  currency: string;
  estimatedDays?: number;
  durationTerms?: string;
  attributes: string[];
  isInternational: boolean;
  customsRequired: boolean;
}

export interface ShippingLabel {
  transactionId: string;
  trackingNumber: string;
  trackingUrl: string;
  labelUrl: string;
  carrier: string;
  service: string;
  cost: number;
}

export interface TrackingEvent {
  status: string;
  statusDetails: string;
  statusDate: string;
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
}

export interface TrackingInfo {
  carrier: string;
  trackingNumber: string;
  status: string;
  statusDetails: string;
  statusDate: string;
  location?: object;
  eta?: string;
  servicelevel?: string;
  history: TrackingEvent[];
}

export interface PackageDimensions {
  weight: number;
  length: number;
  width: number;
  height: number;
  massUnit?: 'lb' | 'kg';
  distanceUnit?: 'in' | 'cm';
}

export interface QuickEstimate {
  cheapest?: {
    carrier: string;
    service: string;
    amount: number;
    estimatedDays?: number;
  };
  fastest?: {
    carrier: string;
    service: string;
    amount: number;
    estimatedDays?: number;
  };
  allRates: {
    carrier: string;
    service: string;
    amount: number;
    estimatedDays?: number;
  }[];
}

export const shippingService = {
  // =====================
  // Address Management
  // =====================

  /**
   * Get all user addresses
   */
  async getAddresses(): Promise<{ addresses: ShippingAddress[] }> {
    return api.get('/shipping/addresses');
  },

  /**
   * Get a single address by ID
   */
  async getAddress(addressId: number): Promise<{ address: ShippingAddress }> {
    return api.get(`/shipping/addresses/${addressId}`);
  },

  /**
   * Create a new shipping address
   */
  async createAddress(
    address: Omit<ShippingAddress, 'id' | 'user_id' | 'is_validated' | 'shippo_object_id' | 'created_at' | 'updated_at'> & { validate?: boolean }
  ): Promise<{ address: ShippingAddress }> {
    return api.post('/shipping/addresses', address);
  },

  /**
   * Update an existing address
   */
  async updateAddress(
    addressId: number,
    updates: Partial<ShippingAddress>
  ): Promise<{ address: ShippingAddress }> {
    return api.put(`/shipping/addresses/${addressId}`, updates);
  },

  /**
   * Delete an address
   */
  async deleteAddress(addressId: number): Promise<{ success: boolean }> {
    return api.delete(`/shipping/addresses/${addressId}`);
  },

  /**
   * Validate an address with Shippo
   */
  async validateAddress(
    address: Pick<ShippingAddress, 'name' | 'street1' | 'street2' | 'city' | 'state' | 'zip' | 'country' | 'phone' | 'email'>
  ): Promise<{
    isValid: boolean;
    messages: { code: string; text: string }[];
    objectId?: string;
    address: ShippingAddress;
  }> {
    return api.post('/shipping/validate', address);
  },

  // =====================
  // Shipping Rates
  // =====================

  /**
   * Get shipping rates for a transaction
   */
  async getRates(
    transactionId: number,
    parcel?: PackageDimensions
  ): Promise<{
    shipmentId: string;
    rates: ShippingRate[];
    fromAddress: ShippingAddress;
    toAddress: ShippingAddress;
  }> {
    return api.post('/shipping/rates', { transactionId, parcel });
  },

  /**
   * Get shipping rates with custom addresses
   */
  async getRatesWithAddresses(
    fromAddress: Partial<ShippingAddress>,
    toAddress: Partial<ShippingAddress>,
    parcel?: PackageDimensions
  ): Promise<{
    shipmentId: string;
    rates: ShippingRate[];
  }> {
    return api.post('/shipping/rates', { fromAddress, toAddress, parcel });
  },

  /**
   * Get quick shipping estimate by ZIP codes
   */
  async getQuickEstimate(
    fromZip: string,
    toZip: string,
    toCountry?: string,
    weight?: number
  ): Promise<QuickEstimate> {
    return api.post('/shipping/quick-estimate', {
      fromZip,
      toZip,
      toCountry: toCountry || 'US',
      weight: weight || 1,
    });
  },

  // =====================
  // Label Purchase
  // =====================

  /**
   * Purchase a shipping label
   */
  async purchaseLabel(
    transactionId: number,
    rateId: string,
    parcel?: PackageDimensions
  ): Promise<{
    success: boolean;
    label: ShippingLabel;
  }> {
    return api.post('/shipping/label', { transactionId, rateId, parcel });
  },

  // =====================
  // Tracking
  // =====================

  /**
   * Get tracking info for a transaction
   */
  async getTracking(transactionId: number): Promise<{ tracking: TrackingInfo }> {
    return api.get('/shipping/track', { transactionId });
  },

  /**
   * Get tracking info with carrier and tracking number
   */
  async getTrackingByNumber(
    carrier: string,
    trackingNumber: string
  ): Promise<{ tracking: TrackingInfo }> {
    return api.get('/shipping/track', { carrier, trackingNumber });
  },

  // =====================
  // Helpers
  // =====================

  /**
   * Format carrier name for display
   */
  formatCarrier(carrier: string): string {
    const names: Record<string, string> = {
      usps: 'USPS',
      ups: 'UPS',
      fedex: 'FedEx',
      dhl_express: 'DHL Express',
      dhl_ecommerce: 'DHL eCommerce',
      ontrac: 'OnTrac',
      lasership: 'LaserShip',
      canada_post: 'Canada Post',
      royal_mail: 'Royal Mail',
      australia_post: 'Australia Post',
    };
    return names[carrier?.toLowerCase()] || carrier;
  },

  /**
   * Format tracking status for display
   */
  formatStatus(status: string): string {
    const statusMap: Record<string, string> = {
      UNKNOWN: 'Unknown',
      PRE_TRANSIT: 'Label Created',
      TRANSIT: 'In Transit',
      DELIVERED: 'Delivered',
      RETURNED: 'Returned',
      FAILURE: 'Delivery Failed',
    };
    return statusMap[status] || status;
  },

  /**
   * Get status color
   */
  getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      PRE_TRANSIT: '#F59E0B', // Yellow
      TRANSIT: '#3B82F6', // Blue
      DELIVERED: '#10B981', // Green
      RETURNED: '#EF4444', // Red
      FAILURE: '#EF4444', // Red
    };
    return colors[status] || '#6B7280'; // Gray default
  },
};
