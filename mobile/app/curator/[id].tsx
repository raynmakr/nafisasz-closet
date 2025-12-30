import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Image,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { curatorsService, listingsService } from '@/services';
import { useThemeColors, useListingTimer } from '@/hooks';
import { useAuth } from '@/src/context/AuthContext';
import { SPACING, FONTS, BORDER_RADIUS } from '@/constants';
import { Listing } from '@/types';

function ListingCard({ listing }: { listing: Listing }) {
  const colors = useThemeColors();
  const { formatted, isEnding } = useListingTimer(listing.auctionEnd);

  return (
    <TouchableOpacity
      style={[styles.listingCard, { backgroundColor: colors.surface }]}
      onPress={() => router.push(`/listing/${listing.id}`)}
    >
      <Image
        source={{ uri: listing.photos[0] || 'https://via.placeholder.com/120' }}
        style={styles.listingImage}
      />
      <View style={styles.listingInfo}>
        <Text style={[styles.listingTitle, { color: colors.text }]} numberOfLines={2}>
          {listing.title}
        </Text>
        <Text style={[styles.listingPrice, { color: colors.text }]}>
          ${(listing.currentHighBid || listing.startingBid).toLocaleString()}
        </Text>
        <Text
          style={[
            styles.listingTimer,
            { color: isEnding ? colors.error : colors.textMuted, marginTop: SPACING.xs },
          ]}
        >
          {formatted}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function CuratorProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeColors();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);

  const { data: curator, isLoading: curatorLoading } = useQuery({
    queryKey: ['curator', id],
    queryFn: () => curatorsService.getCurator(id!),
    enabled: !!id,
  });

  // Update following state when curator data loads
  React.useEffect(() => {
    if (curator?.following !== undefined) {
      setIsFollowing(curator.following);
    }
  }, [curator?.following]);

  const { data: listings } = useQuery({
    queryKey: ['curator-listings', id],
    queryFn: () => listingsService.getListings({ curatorId: id, status: 'ACTIVE' }),
    enabled: !!id,
  });

  const followMutation = useMutation({
    mutationFn: () => {
      if (isFollowing) {
        return curatorsService.unfollowCurator(curator?.userId || '');
      }
      return curatorsService.followCurator(curator?.userId || '');
    },
    onSuccess: () => {
      setIsFollowing(!isFollowing);
      queryClient.invalidateQueries({ queryKey: ['curator', id] });
      queryClient.invalidateQueries({ queryKey: ['followed-curators'] });
    },
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['curator', id] }),
      queryClient.invalidateQueries({ queryKey: ['curator-listings', id] }),
    ]);
    setRefreshing(false);
  };

  if (curatorLoading || !curator) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text, textAlign: 'center', marginTop: 100 }}>
          Loading...
        </Text>
      </View>
    );
  }

  const isOwnProfile = user?.id === curator.userId;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={listings?.data || []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ListingCard listing={item} />}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            {curator.profilePhoto ? (
              <Image
                source={{ uri: curator.profilePhoto }}
                style={styles.avatarImage}
              />
            ) : (
              <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
                <Text style={[styles.avatarText, { color: colors.background }]}>
                  {curator.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}

            <Text style={[styles.handle, { color: colors.text }]}>
              @{curator.handle || curator.name.toLowerCase().replace(/\s+/g, '')}
            </Text>

            {curator.bio && (
              <Text style={[styles.bio, { color: colors.textSecondary }]}>
                {curator.bio}
              </Text>
            )}

            <View style={styles.stats}>
              {curator.totalSales > 0 && (
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {curator.totalSales}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                    Sales
                  </Text>
                </View>
              )}
              {curator.rating > 0 && (
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {curator.rating.toFixed(1)}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                    Rating
                  </Text>
                </View>
              )}
              {curator.listingCount > 0 && (
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {curator.listingCount}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                    Active
                  </Text>
                </View>
              )}
            </View>

            {!isOwnProfile && (
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[
                    styles.followButton,
                    {
                      backgroundColor: isFollowing ? colors.surface : colors.accent,
                      borderColor: colors.accent,
                      borderWidth: isFollowing ? 1 : 0,
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
                    size={20}
                    color={isFollowing ? colors.accent : colors.background}
                  />
                  <Text
                    style={[
                      styles.followButtonText,
                      { color: isFollowing ? colors.accent : colors.background },
                    ]}
                  >
                    {followMutation.isPending ? 'Processing...' : isFollowing ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.messageButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => {
                    if (!user) {
                      Alert.alert('Sign In Required', 'Please sign in to message curators');
                      return;
                    }
                    router.push(`/messages/dm/${curator.userId}`);
                  }}
                >
                  <Ionicons name="chatbubble-outline" size={20} color={colors.text} />
                </TouchableOpacity>
              </View>
            )}

            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              Active Listings
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No active listings
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
  list: {
    padding: SPACING.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 40,
    fontWeight: 'bold',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  handle: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: 'bold',
    marginTop: SPACING.md,
  },
  name: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: 'bold',
    marginTop: SPACING.md,
  },
  bio: {
    fontSize: FONTS.sizes.md,
    textAlign: 'center',
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  stats: {
    flexDirection: 'row',
    marginTop: SPACING.lg,
    gap: SPACING.xl,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: FONTS.sizes.xl,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: FONTS.sizes.sm,
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.lg,
    gap: SPACING.sm,
  },
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    gap: SPACING.xs,
  },
  followButtonText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  messageButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: SPACING.xl,
    alignSelf: 'flex-start',
  },
  listingCard: {
    flexDirection: 'row',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  listingImage: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.sm,
  },
  listingInfo: {
    flex: 1,
    marginLeft: SPACING.md,
    justifyContent: 'center',
  },
  listingTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '500',
  },
  listingPrice: {
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
    marginTop: SPACING.xs,
  },
  listingTimer: {
    fontSize: FONTS.sizes.sm,
    fontVariant: ['tabular-nums'],
  },
  empty: {
    paddingVertical: SPACING.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FONTS.sizes.md,
  },
});
