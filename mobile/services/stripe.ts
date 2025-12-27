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
};
