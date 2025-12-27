import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { listingsService } from '@/services';
import { useLikesStore } from '@/stores';
import { useAuth } from '@/src/context/AuthContext';
import { useThemeColors, useListingTimer } from '@/hooks';
import { SPACING, FONTS, BORDER_RADIUS } from '@/constants';
import { Listing } from '@/types';

function ListingCard({ listing }: { listing: Listing }) {
  const colors = useThemeColors();
  const { formatted, isEnding } = useListingTimer(listing.auctionEnd);
  const isAvailable = listing.status === 'active';
  const { isLiked, toggleLike } = useLikesStore();
  const liked = isLiked(listing.id);
  const [lastTap, setLastTap] = useState<number | null>(null);
  const heartScale = useRef(new Animated.Value(0)).current;

  const handleToggleLike = () => {
    const nowLiked = toggleLike(listing);
    if (nowLiked) {
      heartScale.setValue(0);
      Animated.sequence([
        Animated.spring(heartScale, {
          toValue: 1,
          friction: 3,
          useNativeDriver: true,
        }),
        Animated.timing(heartScale, {
          toValue: 0,
          duration: 200,
          delay: 500,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (lastTap && now - lastTap < DOUBLE_TAP_DELAY) {
      // Double tap - toggle like
      handleToggleLike();
    } else {
      // Single tap - navigate to detail
      setTimeout(() => {
        if (Date.now() - now >= DOUBLE_TAP_DELAY) {
          router.push(`/listing/${listing.id}`);
        }
      }, DOUBLE_TAP_DELAY);
    }
    setLastTap(now);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={handleDoubleTap}
        style={styles.imageContainer}
      >
        <Image
          source={{ uri: listing.photos[0] || 'https://via.placeholder.com/300' }}
          style={styles.cardImage}
          resizeMode="cover"
        />
        {!isAvailable && (
          <View style={styles.unavailableBanner}>
            <Text style={styles.unavailableBannerText}>No Longer Available</Text>
          </View>
        )}
        {/* Heart animation overlay */}
        <Animated.View
          style={[
            styles.heartOverlay,
            {
              transform: [{ scale: heartScale }],
              opacity: heartScale,
            },
          ]}
        >
          <Ionicons name="heart" size={60} color="#E63946" />
        </Animated.View>
        {/* Like button */}
        <TouchableOpacity
          style={styles.likeButton}
          onPress={handleToggleLike}
        >
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={24}
            color={liked ? '#E63946' : '#FFFFFF'}
          />
        </TouchableOpacity>
      </TouchableOpacity>
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardBrand, { color: colors.textSecondary }]}>
            {listing.brand || 'Unknown Brand'}
          </Text>
          <View style={styles.timerContainer}>
            <Text style={[styles.timerLabel, { color: colors.textMuted }]}>
              Time to Buy
            </Text>
            <View
              style={[
                styles.timerBadge,
                { backgroundColor: isEnding ? colors.error : colors.accent },
              ]}
            >
              <Text style={[styles.timerText, { color: '#FFFFFF' }]}>
                {formatted}
              </Text>
            </View>
          </View>
        </View>
        <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
          {listing.title}
        </Text>
        <View style={styles.cardFooter}>
          <View>
            <Text style={[styles.bidLabel, { color: colors.textMuted }]}>
              Price
            </Text>
            <Text style={[styles.bidAmount, { color: colors.text }]}>
              ${(listing.currentHighBid || listing.startingBid).toLocaleString()}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function DiscoverScreen() {
  const colors = useThemeColors();
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  const isCurator = user?.curator?.approved === true;

  const {
    data: listings,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['listings', 'active'],
    queryFn: () => listingsService.getListings({ status: 'ACTIVE', limit: 20 }),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>Discover</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Latest Posts
            </Text>
          </View>
          {isCurator && (
            <TouchableOpacity
              style={[styles.myPostsButton, { backgroundColor: colors.surface }]}
              onPress={() => router.push('/my-posts')}
            >
              <Ionicons name="grid-outline" size={18} color={colors.text} />
              <Text style={[styles.myPostsText, { color: colors.text }]}>My Posts</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={listings?.data || []}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <ListingCard listing={item} />}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {isLoading ? 'Loading posts...' : 'No active posts'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  myPostsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    gap: 6,
  },
  myPostsText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
  },
  title: {
    fontSize: FONTS.sizes.xxxl,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: FONTS.sizes.md,
    marginTop: SPACING.xs,
  },
  list: {
    padding: SPACING.md,
    gap: SPACING.md,
  },
  card: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  imageContainer: {
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: 250,
  },
  unavailableBanner: {
    position: 'absolute',
    top: 20,
    right: -35,
    backgroundColor: '#E63946',
    paddingVertical: 6,
    paddingHorizontal: 40,
    transform: [{ rotate: '45deg' }],
  },
  unavailableBannerText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heartOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -30,
    marginLeft: -30,
  },
  likeButton: {
    position: 'absolute',
    bottom: SPACING.sm,
    right: SPACING.sm,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    padding: SPACING.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  cardBrand: {
    fontSize: FONTS.sizes.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  timerContainer: {
    alignItems: 'flex-end',
  },
  timerLabel: {
    fontSize: FONTS.sizes.xs,
    marginBottom: 2,
  },
  timerBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  timerText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  cardTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    marginBottom: SPACING.sm,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  bidLabel: {
    fontSize: FONTS.sizes.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bidAmount: {
    fontSize: FONTS.sizes.xl,
    fontWeight: 'bold',
  },
  bidCount: {
    fontSize: FONTS.sizes.sm,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyText: {
    fontSize: FONTS.sizes.md,
  },
});
