import { api } from './api';

export interface Transaction {
  id: number;
  listing_id: number;
  buyer_id: number;
  curator_id: number;
  final_price: string;
  platform_fee: string;
  curator_earnings: string;
  shipping_cost: string | null;
  status: TransactionStatus;
  payment_intent_id: string | null;
  stripe_transfer_id: string | null;
  receipt_url: string | null;
  tracking_number: string | null;
  shipping_label: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  payout_completed_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  title?: string;
  photos?: string[];
  brand?: string;
  size?: string;
  buyer_name?: string;
  buyer_email?: string;
  curator_name?: string;
}

export type TransactionStatus =
  | 'pending_payment'
  | 'payment_failed'
  | 'paid'
  | 'curator_confirmed'
  | 'shipped'
  | 'delivered'
  | 'payout_complete'
  | 'disputed'
  | 'refunded';

export const transactionsService = {
  /**
   * Get user's transactions
   * @param role - 'buyer' for purchases, 'seller' for sales
   * @param status - Optional status filter
   */
  async getTransactions(
    role: 'buyer' | 'seller' = 'buyer',
    status?: TransactionStatus
  ): Promise<{ transactions: Transaction[] }> {
    const params: Record<string, string> = { role };
    if (status) params.status = status;
    return api.get('/transactions', params);
  },

  /**
   * Curator confirms they've purchased the item
   */
  async confirmPurchase(transactionId: number, receiptUrl?: string): Promise<{ success: boolean; status: string }> {
    return api.post(`/transactions/${transactionId}/confirm-purchase`, { receiptUrl });
  },

  /**
   * Curator marks item as shipped
   */
  async markShipped(
    transactionId: number,
    trackingNumber: string,
    shippingLabel?: string
  ): Promise<{ success: boolean; status: string }> {
    return api.post(`/transactions/${transactionId}/mark-shipped`, {
      trackingNumber,
      shippingLabel,
    });
  },

  /**
   * Buyer confirms delivery - triggers payout to curator
   */
  async confirmDelivery(transactionId: number): Promise<{
    success: boolean;
    status: string;
    transferId?: string;
    curatorEarnings?: string;
    payoutError?: string;
    payoutSkipped?: string;
  }> {
    return api.post(`/transactions/${transactionId}/confirm-delivery`);
  },
};
