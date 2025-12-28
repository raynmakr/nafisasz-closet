import { api } from './api';

export interface AuctionCompletionResult {
  success: boolean;
  status: 'sold' | 'expired' | 'already_completed';
  transaction?: {
    id: string;
    winnerId: string;
    winnerName: string;
    finalPrice: number;
    paymentIntentClientSecret: string | null;
  };
  message?: string;
  currentStatus?: string;
}

export const auctionService = {
  /**
   * Trigger auction completion when timer expires
   */
  async completeAuction(
    listingId: string,
    reason: 'timer_expired' | 'curator_closed'
  ): Promise<AuctionCompletionResult> {
    const response = await api.post<AuctionCompletionResult>('/listings/complete', {
      listingId,
      reason,
    });
    return response.data;
  },

  /**
   * Early close by curator
   */
  async curatorCloseEarly(listingId: string): Promise<AuctionCompletionResult> {
    return this.completeAuction(listingId, 'curator_closed');
  },
};
