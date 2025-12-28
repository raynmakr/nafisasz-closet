import { api } from './api';

export interface StripeStatus {
  hasAccount: boolean;
  onboardingComplete: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted?: boolean;
}

export interface OnboardingLink {
  accountId: string;
  onboardingUrl?: string;
  expiresAt?: string;
  onboardingComplete?: boolean;
}

export interface PaymentSheetTransaction {
  id: number;
  listingId: number;
  title: string;
  brand?: string;
  size?: string;
  photo?: string;
  curatorName: string;
  finalPrice: number;
  platformFee: number;
  status: string;
}

export interface PaymentSheetParams {
  success: boolean;
  paymentIntent: string;
  publishableKey: string;
  transaction: PaymentSheetTransaction;
}

export interface SavedPaymentMethod {
  id: string;
  brand?: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;
}

export interface PaymentMethodStatus {
  hasPaymentMethod: boolean;
  paymentMethod: SavedPaymentMethod | null;
}

export interface SetupIntentResult {
  clientSecret: string;
  customerId: string;
}

export const stripeService = {
  /**
   * Get curator's Stripe account status
   */
  async getStatus(): Promise<StripeStatus> {
    return api.get<StripeStatus>('/stripe/connect');
  },

  /**
   * Get or create Stripe onboarding link
   */
  async getOnboardingLink(): Promise<OnboardingLink> {
    return api.post<OnboardingLink>('/stripe/connect', { action: 'create-link' });
  },

  /**
   * Create new Stripe Connect account
   */
  async createAccount(): Promise<OnboardingLink> {
    return api.post<OnboardingLink>('/stripe/connect', { action: 'create-account' });
  },

  /**
   * Get PaymentSheet params for a transaction
   */
  async getPaymentSheetParams(transactionId: number): Promise<PaymentSheetParams> {
    return api.get<PaymentSheetParams>(`/transactions/payment-sheet?transactionId=${transactionId}`);
  },

  /**
   * Get user's saved payment method status
   */
  async getPaymentMethodStatus(): Promise<PaymentMethodStatus> {
    return api.get<PaymentMethodStatus>('/payment-methods');
  },

  /**
   * Create SetupIntent to add a payment method
   */
  async createSetupIntent(): Promise<SetupIntentResult> {
    return api.post<SetupIntentResult>('/payment-methods/setup', {});
  },

  /**
   * Confirm and save payment method after setup
   */
  async confirmPaymentMethod(paymentMethodId: string): Promise<{ success: boolean; paymentMethod: SavedPaymentMethod }> {
    return api.post('/payment-methods/confirm', { paymentMethodId });
  },

  /**
   * Remove saved payment method
   */
  async removePaymentMethod(): Promise<{ success: boolean }> {
    return api.delete('/payment-methods');
  },
};
