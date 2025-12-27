import { create } from 'zustand';
import { Listing, BidEvent, AuctionExtendedEvent, AuctionEndedEvent } from '@/types';

interface ListingsState {
  // Currently viewed listing (for detail page)
  currentListing: Listing | null;

  // Optimistic bid updates
  pendingBids: Map<string, number>;

  // Actions
  setCurrentListing: (listing: Listing | null) => void;
  updateListingBid: (event: BidEvent) => void;
  updateAuctionEnd: (event: AuctionExtendedEvent) => void;
  handleAuctionEnd: (event: AuctionEndedEvent) => void;
  addPendingBid: (listingId: string, amount: number) => void;
  removePendingBid: (listingId: string) => void;
}

export const useListingsStore = create<ListingsState>((set, get) => ({
  currentListing: null,
  pendingBids: new Map(),

  setCurrentListing: (listing) => set({ currentListing: listing }),

  updateListingBid: (event) => {
    const { currentListing } = get();
    if (currentListing?.id === event.listingId) {
      set({
        currentListing: {
          ...currentListing,
          currentHighBid: event.currentHighBid,
          bidCount: currentListing.bidCount + 1,
          recentBids: [
            {
              id: `temp-${Date.now()}`,
              amount: event.bidAmount,
              createdAt: new Date().toISOString(),
              bidder: { id: 'unknown', name: event.bidderName },
            },
            ...(currentListing.recentBids || []).slice(0, 9),
          ],
        },
      });
    }
    // Remove pending bid if this was ours
    get().removePendingBid(event.listingId);
  },

  updateAuctionEnd: (event) => {
    const { currentListing } = get();
    if (currentListing?.id === event.listingId) {
      set({
        currentListing: {
          ...currentListing,
          auctionEnd: event.newEndTime,
          extensionsUsed: 3 - event.extensionsLeft,
        },
      });
    }
  },

  handleAuctionEnd: (event) => {
    const { currentListing } = get();
    if (currentListing?.id === event.listingId) {
      set({
        currentListing: {
          ...currentListing,
          status: 'SOLD',
          currentHighBid: event.finalPrice,
          highBidderId: event.winnerId,
        },
      });
    }
  },

  addPendingBid: (listingId, amount) => {
    const pendingBids = new Map(get().pendingBids);
    pendingBids.set(listingId, amount);
    set({ pendingBids });
  },

  removePendingBid: (listingId) => {
    const pendingBids = new Map(get().pendingBids);
    pendingBids.delete(listingId);
    set({ pendingBids });
  },
}));
