import { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  Animated,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { listingsService, socketService, curatorsService } from '@/services';
import { useListingsStore, useLikesStore } from '@/stores';
import { useThemeColors, useListingTimer } from '@/hooks';
import { useAuth } from '@/src/context/AuthContext';
import { SPACING, FONTS, BORDER_RADIUS } from '@/constants';
import { api } from '@/services/api';

const { width } = Dimensions.get('window');

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeColors();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { setCurrentListing, updateListingBid, updateAuctionEnd, handleAuctionEnd } =
    useListingsStore();

  const { isLiked, toggleLike } = useLikesStore();
  const [lastTap, setLastTap] = useState<number | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const heartScale = useRef(new Animated.Value(0)).current;

  const { data: listing, isLoading, refetch } = useQuery({
    queryKey: ['listing', id],
    queryFn: () => listingsService.getListing(id!),
    enabled: !!id,
  });

  // Get curator following status
  const { data: curatorData, refetch: refetchCurator } = useQuery({
    queryKey: ['curator', listing?.curator?.id],
    queryFn: () => curatorsService.getCurator(listing!.curator!.id),
    enabled: !!listing?.curator?.id,
  });

  useEffect(() => {
    if (curatorData) {
      // @ts-ignore - following is returned from API
      setIsFollowing(curatorData.following || false);
    }
  }, [curatorData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetch(), refetchCurator()]);
    setRefreshing(false);
  };

  const { formatted, isEnding, isExpired } = useListingTimer(listing?.auctionEnd ?? null);

  const placeBidMutation = useMutation({
    mutationFn: async (amount: number) => {
      return api.post('/bids', { listingId: id, amount });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listing', id] });
      Alert.alert('Success', 'Your claim has been placed!');
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message || 'Failed to place claim. Please try again.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => listingsService.deleteListing(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listings'] });
      queryClient.invalidateQueries({ queryKey: ['my-listings'] });
      router.back();
      Alert.alert('Success', 'Post deleted');
    },
    onError: () => {
      Alert.alert('Error', 'Failed to delete post');
    },
  });

  const handleDelete = () => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(),
        },
      ]
    );
  };

  const followMutation = useMutation({
    mutationFn: () => {
      if (isFollowing) {
        return curatorsService.unfollowCurator(listing?.curator?.userId || '');
      }
      return curatorsService.followCurator(listing?.curator?.userId || '');
    },
    onSuccess: () => {
      setIsFollowing(!isFollowing);
      queryClient.invalidateQueries({ queryKey: ['curator', listing?.curator?.id] });
      queryClient.invalidateQueries({ queryKey: ['followed-curators'] });
      if (!isFollowing) {
        Alert.alert('Following', `You are now following ${listing?.curator?.name}`);
      }
    },
    onError: () => {
      Alert.alert('Error', isFollowing ? 'Failed to unfollow curator' : 'Failed to follow curator');
    },
  });

  const handleToggleLike = () => {
    if (!listing) return;
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
      handleToggleLike();
    }
    setLastTap(now);
  };

  const handleBuyNow = () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to claim this item');
      return;
    }
    const claimAmount = (listing?.currentHighBid || listing?.startingBid || 0) + 1;
    placeBidMutation.mutate(claimAmount);
  };

  const isOwnListing = user?.curator?.id === listing?.curator?.id;

  useEffect(() => {
    if (listing) {
      setCurrentListing(listing);
    }

    if (id) {
      socketService.subscribeToListing(id);

      const unsubBid = socketService.on('bid:new', updateListingBid);
      const unsubExtend = socketService.on('auction:extended', updateAuctionEnd);
      const unsubEnd = socketService.on('auction:ended', handleAuctionEnd);

      return () => {
        socketService.unsubscribeFromListing(id);
        unsubBid();
        unsubExtend();
        unsubEnd();
        setCurrentListing(null);
      };
    }
  }, [id, listing, setCurrentListing, updateListingBid, updateAuctionEnd, handleAuctionEnd]);

  if (isLoading || !listing) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text, textAlign: 'center', marginTop: 100 }}>
          Loading...
        </Text>
      </View>
    );
  }

  const currentBid = listing.currentHighBid || listing.startingBid;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={handleDoubleTap}
          style={styles.imageContainer}
        >
          <Image
            source={{ uri: listing.photos[0] || 'https://via.placeholder.com/400' }}
            style={styles.image}
            resizeMode="cover"
          />
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
            <Ionicons name="heart" size={80} color="#E63946" />
          </Animated.View>
          {/* Like button */}
          <TouchableOpacity
            style={styles.likeButton}
            onPress={handleToggleLike}
          >
            <Ionicons
              name={isLiked(listing.id) ? 'heart' : 'heart-outline'}
              size={28}
              color={isLiked(listing.id) ? '#E63946' : '#FFFFFF'}
            />
          </TouchableOpacity>
        </TouchableOpacity>

        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={[styles.brand, { color: colors.textSecondary }]}>
              {listing.brand || 'Unknown Brand'}
            </Text>
            <View
              style={[
                styles.timerBadge,
                { backgroundColor: isEnding ? colors.error : isExpired ? colors.textMuted : colors.primary },
              ]}
            >
              <Ionicons
                name={isExpired ? 'checkmark-circle' : 'time-outline'}
                size={16}
                color={colors.background}
              />
              <Text style={[styles.timerText, { color: colors.background }]}>
                {isExpired ? 'Ended' : formatted}
              </Text>
            </View>
          </View>

          <Text style={[styles.title, { color: colors.text }]}>{listing.title}</Text>

          <View style={styles.priceRow}>
            <View>
              <Text style={[styles.priceLabel, { color: colors.textMuted }]}>
                Currently Offered At
              </Text>
              <Text style={[styles.price, { color: colors.text }]}>
                ${currentBid.toLocaleString()}
              </Text>
            </View>
          </View>

          {/* Buy Now Button */}
          {!isExpired && !isOwnListing && (
            <TouchableOpacity
              style={[styles.buyNowButton, { backgroundColor: colors.accent }]}
              onPress={handleBuyNow}
              disabled={placeBidMutation.isPending}
            >
              <Ionicons name="flash" size={20} color="#FFFFFF" />
              <Text style={styles.buyNowText}>Claim Now</Text>
            </TouchableOpacity>
          )}

          {listing.description && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Description
              </Text>
              <Text style={[styles.description, { color: colors.textSecondary }]}>
                {listing.description}
              </Text>
            </View>
          )}

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Details</Text>
            <View style={styles.details}>
              {listing.size && (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
                    Size
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {listing.size}
                  </Text>
                </View>
              )}
              {listing.condition && (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
                    Condition
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {listing.condition}
                  </Text>
                </View>
              )}
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
                  Returns
                </Text>
                <Text style={[
                  styles.detailValue,
                  { color: listing.returnsAllowed ? colors.text : colors.textMuted },
                  !listing.returnsAllowed && styles.subtleText
                ]}>
                  {listing.returnsAllowed ? 'Accepted' : 'Not accepted'}
                </Text>
              </View>
            </View>
          </View>

          {listing.curator && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Curator</Text>
              <TouchableOpacity
                style={[styles.curatorCard, { backgroundColor: colors.surface }]}
                onPress={() => router.push(`/curator/${listing.curator!.id}`)}
              >
                <View style={[styles.curatorAvatar, { backgroundColor: colors.accent }]}>
                  <Text style={[styles.curatorInitial, { color: colors.background }]}>
                    {listing.curator.name.charAt(0)}
                  </Text>
                </View>
                <View style={styles.curatorInfo}>
                  <Text style={[styles.curatorName, { color: colors.text }]}>
                    {listing.curator.name}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </TouchableOpacity>

              {/* Follow/Unfollow Button */}
              {!isOwnListing && (
                <TouchableOpacity
                  style={[
                    styles.followButton,
                    {
                      backgroundColor: isFollowing ? colors.accent : colors.surface,
                      borderColor: colors.accent,
                    },
                  ]}
                  onPress={() => {
                    if (!user) {
                      Alert.alert('Sign In Required', 'Please sign in to follow curators');
                      return;
                    }
                    followMutation.mutate();
                  }}
                  disabled={followMutation.isPending}
                >
                  <Ionicons
                    name={isFollowing ? 'checkmark' : 'person-add-outline'}
                    size={18}
                    color={isFollowing ? '#FFFFFF' : colors.accent}
                  />
                  <Text
                    style={[
                      styles.followButtonText,
                      { color: isFollowing ? '#FFFFFF' : colors.accent },
                    ]}
                  >
                    {followMutation.isPending
                      ? 'Processing...'
                      : isFollowing
                      ? 'Following'
                      : 'Follow'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {isOwnListing && (
            <View style={styles.section}>
              <TouchableOpacity
                style={[styles.deleteButton, { borderColor: colors.error }]}
                onPress={handleDelete}
                disabled={deleteMutation.isPending}
              >
                <Ionicons name="trash-outline" size={20} color={colors.error} />
                <Text style={[styles.deleteButtonText, { color: colors.error }]}>
                  {deleteMutation.isPending ? 'Deleting...' : 'Delete Post'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  imageContainer: {
    position: 'relative',
  },
  image: {
    width: width,
    height: width,
  },
  heartOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -40,
    marginLeft: -40,
  },
  likeButton: {
    position: 'absolute',
    bottom: SPACING.md,
    right: SPACING.md,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  brand: {
    fontSize: FONTS.sizes.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    gap: 4,
  },
  timerText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  title: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: 'bold',
    marginBottom: SPACING.md,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: SPACING.lg,
  },
  priceLabel: {
    fontSize: FONTS.sizes.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  price: {
    fontSize: FONTS.sizes.xxxl,
    fontWeight: 'bold',
  },
  bidInfo: {
    alignItems: 'flex-end',
  },
  bidCount: {
    fontSize: FONTS.sizes.md,
  },
  subtleText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '400',
  },
  section: {
    marginTop: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    marginBottom: SPACING.sm,
  },
  description: {
    fontSize: FONTS.sizes.md,
    lineHeight: 24,
  },
  details: {
    gap: SPACING.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: FONTS.sizes.md,
  },
  detailValue: {
    fontSize: FONTS.sizes.md,
    fontWeight: '500',
  },
  curatorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  curatorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  curatorInitial: {
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
  },
  curatorInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  curatorName: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  curatorStats: {
    fontSize: FONTS.sizes.sm,
    marginTop: 2,
  },
  buyNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  buyNowText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  followButtonText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
  },
  deleteButtonText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
});
