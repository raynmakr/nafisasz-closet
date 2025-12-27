import { api } from './api';
import { ApiResponse, PaginatedResponse, Listing } from '@/types';

export interface ListingsQueryParams {
  page?: number;
  limit?: number;
  status?: 'ACTIVE' | 'SOLD' | 'EXPIRED';
  curatorId?: string;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'createdAt' | 'auctionEnd' | 'currentHighBid';
  sortOrder?: 'asc' | 'desc';
}

export interface CreateListingInput {
  title: string;
  description?: string;
  brand?: string;
  size?: string;
  category?: string;
  condition?: string;
  retailPrice: number;
  auctionDuration: 'THIRTY_MINUTES' | 'TWO_HOURS' | 'SIX_HOURS' | 'TWENTY_FOUR_HOURS' | 'FORTY_EIGHT_HOURS';
  returnsAllowed?: boolean;
  localPickupAvailable?: boolean;
  photos: string[];
}

interface ListingsResponse {
  listings: Listing[];
  pagination: { limit: number; offset: number };
}

export const listingsService = {
  async getListings(params?: ListingsQueryParams): Promise<{ data: Listing[] }> {
    const response = await api.get<ListingsResponse>('/listings', params as Record<string, unknown>);
    return { data: response.listings || [] };
  },

  async getListing(id: string): Promise<Listing> {
    const response = await api.get<{ listing: Listing; bids: unknown[] }>('/listings', { id });
    return response.listing;
  },

  async createListing(input: CreateListingInput): Promise<Listing> {
    const response = await api.post<{ success: boolean; listing: Listing }>('/listings', input);
    return response.listing;
  },

  async updateListing(id: string, input: Partial<CreateListingInput>): Promise<Listing> {
    const response = await api.put<ApiResponse<Listing>>(`/listings/${id}`, input);
    return response.data!;
  },

  async publishListing(id: string): Promise<Listing> {
    const response = await api.post<{ success: boolean; listing: Listing }>('/listings', { action: 'publish', listingId: id });
    return response.listing;
  },

  async createAndPublishListing(input: CreateListingInput): Promise<Listing> {
    // Create the listing
    const listing = await this.createListing(input);
    // Publish it immediately
    const published = await this.publishListing(listing.id);
    return published;
  },

  async deleteListing(id: string): Promise<void> {
    await api.delete('/listings', { id });
  },

  async getMyListings(): Promise<{ data: Listing[] }> {
    const response = await api.get<ListingsResponse>('/listings/my');
    return { data: response.listings || [] };
  },
};
