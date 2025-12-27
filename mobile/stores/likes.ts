import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Listing } from '@/types';

interface LikedItem {
  id: string;
  title: string;
  photo: string;
  price: number;
  likedAt: number;
}

interface LikesState {
  likedItems: Record<string, LikedItem>;

  // Actions
  toggleLike: (listing: Listing) => boolean;
  isLiked: (listingId: string) => boolean;
  getLikedItems: () => LikedItem[];
  clearLikes: () => void;
}

export const useLikesStore = create<LikesState>()(
  persist(
    (set, get) => ({
      likedItems: {},

      toggleLike: (listing: Listing) => {
        const { likedItems } = get();
        const isCurrentlyLiked = !!likedItems[listing.id];

        if (isCurrentlyLiked) {
          // Remove from likes
          const { [listing.id]: removed, ...rest } = likedItems;
          set({ likedItems: rest });
          return false;
        } else {
          // Add to likes
          set({
            likedItems: {
              ...likedItems,
              [listing.id]: {
                id: listing.id,
                title: listing.title,
                photo: listing.photos[0] || '',
                price: listing.currentHighBid || listing.startingBid,
                likedAt: Date.now(),
              },
            },
          });
          return true;
        }
      },

      isLiked: (listingId: string) => {
        return !!get().likedItems[listingId];
      },

      getLikedItems: () => {
        const { likedItems } = get();
        return Object.values(likedItems).sort((a, b) => b.likedAt - a.likedAt);
      },

      clearLikes: () => {
        set({ likedItems: {} });
      },
    }),
    {
      name: 'likes-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
