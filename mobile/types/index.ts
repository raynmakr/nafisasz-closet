// User types
export type UserRole = 'BUYER' | 'CURATOR' | 'ADMIN';
export type SubscriptionTier = 'FREE' | 'PRO' | 'ELITE';

export interface User {
  id: string;
  email: string;
  name: string;
  handle: string | null;
  role: UserRole;
  profilePhoto: string | null;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: string;
  curator?: CuratorProfile | null;
}

export interface CuratorProfile {
  id: string;
  subscriptionTier: SubscriptionTier;
  healthScore: number;
  totalSales: number;
  totalEarnings: number;
  rating: number;
  ratingCount: number;
  approved: boolean;
  stripeOnboardingComplete: boolean;
}

// Listing types
export type ListingStatus = 'DRAFT' | 'ACTIVE' | 'SOLD' | 'EXPIRED' | 'CANCELLED';
export type AuctionDuration = 'THIRTY_MINUTES' | 'TWO_HOURS' | 'SIX_HOURS' | 'TWENTY_FOUR_HOURS' | 'FORTY_EIGHT_HOURS';

export interface Listing {
  id: string;
  title: string;
  description: string | null;
  brand: string | null;
  size: string | null;
  category: string | null;
  condition: string | null;
  retailPrice: number;
  startingBid: number;
  currentHighBid: number | null;
  highBidderId: string | null;
  photos: string[];
  status: ListingStatus;
  auctionDuration: AuctionDuration;
  auctionStart: string | null;
  auctionEnd: string | null;
  extensionsUsed: number;
  returnsAllowed: boolean;
  localPickupAvailable: boolean;
  createdAt: string;
  bidCount: number;
  curator: ListingCurator | null;
  recentBids?: Bid[];
}

export interface ListingCurator {
  id: string;
  userId: string;
  name: string;
  handle: string | null;
  profilePhoto: string | null;
  rating: number;
  totalSales: number;
}

// Bid types
export interface Bid {
  id: string;
  amount: number;
  createdAt: string;
  bidder: {
    id: string;
    name: string;
  };
}

export interface UserClaim {
  id: string;
  amount: number;
  isWinning: boolean;
  createdAt: string;
  listing: {
    id: string;
    title: string;
    photo: string;
    status: ListingStatus;
    currentHighBid: number | null;
    auctionEnd: string | null;
  };
}

// Curator types
export interface Curator {
  id: string;
  userId: string;
  name: string;
  handle: string | null;
  profilePhoto: string | null;
  avatarUrl: string | null;
  bio: string | null;
  subscriptionTier: SubscriptionTier;
  healthScore: number;
  totalSales: number;
  rating: number;
  ratingCount: number;
  listingCount: number;
  memberSince?: string;
}

// Invitation types
export interface InvitationInfo {
  code: string;
  inviteLink: string;
  deepLink: string;
  referralCount: number;
  usesCount: number;
}

export interface InvitationValidation {
  valid: boolean;
  message?: string;
  inviter?: {
    name: string;
    handle: string | null;
  };
}

// Auth types
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  role?: 'BUYER' | 'CURATOR';
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    errors?: Record<string, string[]>;
  };
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Socket events
export interface BidEvent {
  listingId: string;
  bidAmount: number;
  bidderName: string;
  isWinning: boolean;
  currentHighBid: number;
}

export interface AuctionExtendedEvent {
  listingId: string;
  newEndTime: string;
  extensionsLeft: number;
}

export interface AuctionEndedEvent {
  listingId: string;
  winnerId: string;
  finalPrice: number;
}
