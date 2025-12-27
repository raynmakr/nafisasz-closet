export * from './colors';

export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
export const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:3000';

export const AUCTION_DURATIONS = {
  THIRTY_MINUTES: { label: '30 minutes', ms: 30 * 60 * 1000 },
  TWO_HOURS: { label: '2 hours', ms: 2 * 60 * 60 * 1000 },
  SIX_HOURS: { label: '6 hours', ms: 6 * 60 * 60 * 1000 },
  TWENTY_FOUR_HOURS: { label: '24 hours', ms: 24 * 60 * 60 * 1000 },
} as const;

export const SUBSCRIPTION_TIERS = {
  FREE: { name: 'Free', fee: 0.10, maxListings: 10 },
  PRO: { name: 'Pro', fee: 0.07, maxListings: Infinity, price: 29 },
  ELITE: { name: 'Elite', fee: 0.05, maxListings: Infinity, price: 99 },
} as const;

export const FONTS = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BORDER_RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};
