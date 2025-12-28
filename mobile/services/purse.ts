import { api } from './api';

// ===========================================
// TYPES
// ===========================================

export interface PurseBalance {
  coins: number;
  lifetimeEarned: number;
  currency: string;
  coinValue: number;
  symbol: string;
  value: number;
  valueFormatted: string;
  goldBasisText: string;
  displayText: string;
}

export interface CoinTransaction {
  id: number;
  type: 'earned' | 'spent' | 'gifted' | 'received';
  amount: number;
  source: string;
  balanceAfter: number;
  createdAt: string;
  relatedUserName?: string;
  listingTitle?: string;
  valueFormatted: string;
  description: string;
}

export interface GiftCard {
  id: number;
  amount: number;
  senderName: string;
  message?: string;
  createdAt: string;
  expiresAt: string;
  valueFormatted: string;
}

export interface GiftingLimits {
  giftsSent: number;
  giftsRemaining: number;
  totalAmountSent: number;
  amountRemaining: number;
  maxPerGift: number;
  maxGiftsPerMonth: number;
  maxAmountPerMonth: number;
}

export interface CoinPreview {
  itemPrice: number;
  coinsAvailable: number;
  maxApplicable: number;
  coinsToApply: number;
  coinsUsed: number;
  discount: number;
  finalPrice: number;
  valid: boolean;
  error?: string;
  currency: string;
  symbol: string;
  coinValue: number;
  discountFormatted: string;
  finalPriceFormatted: string;
  savingsText?: string;
}

export interface CreateGiftResult {
  success: boolean;
  giftCard: {
    id: number;
    amount: number;
    recipientId: number;
    message?: string;
    expiresAt: string;
    valueFormatted: string;
  };
}

export interface ClaimGiftResult {
  success: boolean;
  amount: number;
  newBalance: number;
  valueFormatted: string;
}

export interface ApplyCoinsResult {
  success: boolean;
  coinsUsed: number;
  discount: number;
  finalPrice: number;
  newBalance: number;
  discountFormatted: string;
  finalPriceFormatted: string;
  paymentIntentClientSecret?: string;
}

// ===========================================
// PURSE SERVICE
// ===========================================

export const purseService = {
  /**
   * Get user's coin balance
   */
  async getBalance(): Promise<PurseBalance> {
    return api.get<PurseBalance>('/purse/balance');
  },

  /**
   * Get transaction history
   */
  async getTransactions(
    page: number = 1,
    limit: number = 20
  ): Promise<{ transactions: CoinTransaction[]; page: number; limit: number; hasMore: boolean }> {
    return api.get('/purse/transactions', { page: String(page), limit: String(limit) });
  },

  /**
   * Get pending gift cards
   */
  async getPendingGifts(): Promise<{ gifts: GiftCard[] }> {
    return api.get('/purse/gifts');
  },

  /**
   * Get gifting limits
   */
  async getGiftingLimits(): Promise<GiftingLimits> {
    return api.get('/purse/limits');
  },

  /**
   * Create a gift card
   */
  async createGift(
    recipientId: number,
    amount: number,
    message?: string
  ): Promise<CreateGiftResult> {
    return api.post('/purse/gift', { recipientId, amount, message });
  },

  /**
   * Claim a gift card
   */
  async claimGift(giftCardId: number): Promise<ClaimGiftResult> {
    return api.post(`/purse/claim/${giftCardId}`, {});
  },

  /**
   * Preview coin discount for checkout
   */
  async getCoinPreview(
    params: { transactionId?: string; listingId?: string },
    coinsToApply: number = 0
  ): Promise<CoinPreview> {
    return api.get('/checkout/coin-preview', {
      ...params,
      coinsToApply: String(coinsToApply),
    });
  },

  /**
   * Apply coins during checkout
   */
  async applyCoins(
    transactionId: number,
    coinsToApply: number
  ): Promise<ApplyCoinsResult> {
    return api.post('/checkout/apply-coins', {
      transactionId,
      coinsToApply,
    });
  },

  /**
   * Award engagement reward
   */
  async awardEngagementReward(
    rewardType: 'COMPLETE_PROFILE' | 'CONNECT_INSTAGRAM' | 'UPLOAD_PROFILE_PHOTO' | 'ENABLE_NOTIFICATIONS'
  ): Promise<{ awarded: boolean; coins?: number; reason?: string }> {
    return api.post('/purse/engagement', { rewardType });
  },
};

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Format coin amount with currency value
 */
export function formatCoins(coins: number, symbol: string = '$', coinValue: number = 4.5): string {
  const value = coins * coinValue;
  return `${coins} GC (${symbol}${value.toFixed(2)})`;
}

/**
 * Get emoji for transaction type
 */
export function getTransactionEmoji(type: string): string {
  switch (type) {
    case 'earned':
      return '🪙';
    case 'spent':
      return '💸';
    case 'gifted':
      return '🎁';
    case 'received':
      return '🎁';
    default:
      return '🪙';
  }
}

/**
 * Get color for transaction type
 */
export function getTransactionColor(type: string): string {
  switch (type) {
    case 'earned':
      return '#22C55E'; // Green
    case 'spent':
      return '#EF4444'; // Red
    case 'gifted':
      return '#F97316'; // Orange
    case 'received':
      return '#22C55E'; // Green
    default:
      return '#6B7280'; // Gray
  }
}
