import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { listingsService } from '@/services';
import { useThemeColors, useListingTimer } from '@/hooks';
import { SPACING, FONTS, BORDER_RADIUS } from '@/constants';
import { Listing } from '@/types';

function MyListingCard({ listing, onDelete }: { listing: Listing; onDelete: (id: string) => void }) {
  const colors = useThemeColors();
  const { formatted, isEnding } = useListingTimer(listing.auctionEnd);
  const isActive = listing.status === 'active' || listing.status === 'ACTIVE';
  const isDraft = listing.status === 'draft' || listing.status === 'DRAFT';
  const statusColor = isActive ? colors.accent : isDraft ? colors.warning || '#F59E0B' : colors.textMuted;

  const handleEdit = () => {
    router.push(`/listing/edit/${listing.id}`);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <TouchableOpacity
        style={styles.cardContent}
        onPress={() => router.push(`/listing/${listing.id}`)}
        activeOpacity={0.9}
      >
        <Image
          source={{ uri: listing.photos[0] || 'https://via.placeholder.com/100' }}
          style={styles.thumbnail}
        />
        <View style={styles.cardInfo}>
          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
            {listing.title}
          </Text>
          <Text style={[styles.cardBrand, { color: colors.textSecondary }]}>
            {listing.brand || 'Unknown Brand'}
          </Text>
          <View style={styles.cardMeta}>
            <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
              <Text style={styles.statusText}>
                {listing.status.toUpperCase()}
              </Text>
            </View>
            {isActive && (
              <Text style={[styles.timerText, { color: isEnding ? colors.error : colors.textSecondary }]}>
                {formatted}
              </Text>
            )}
          </View>
          <Text style={[styles.priceText, { color: colors.text }]}>
            ${(listing.currentHighBid || listing.startingBid).toLocaleString()}
            {listing.bidCount > 0 && (
              <Text style={{ color: colors.textMuted }}> ({listing.bidCount} claims)</Text>
            )}
          </Text>
        </View>
      </TouchableOpacity>
      <View style={styles.actionButtons}>
        {isDraft && (
          <TouchableOpacity
            style={[styles.editButton, { backgroundColor: colors.accent }]}
            onPress={handleEdit}
          >
            <Ionicons name="pencil-outline" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.deleteButton, { backgroundColor: colors.error }]}
          onPress={() => onDelete(listing.id)}
        >
          <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function MyPostsScreen() {
  const colors = useThemeColors();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: listings,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['my-listings'],
    queryFn: () => listingsService.getMyListings(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => listingsService.deleteListing(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-listings'] });
      queryClient.invalidateQueries({ queryKey: ['listings'] });
    },
    onError: () => {
      Alert.alert('Error', 'Failed to delete listing');
    },
  });

  const handleDelete = (id: string) => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(id),
        },
      ]
    );
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={listings?.data || []}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <MyListingCard listing={item} onDelete={handleDelete} />
        )}
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
            <Ionicons name="images-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {isLoading ? 'Loading your posts...' : 'No posts yet'}
            </Text>
            <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
              Create your first post in the Post tab
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: FONTS.sizes.xl,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 40,
  },
  list: {
    padding: SPACING.md,
    gap: SPACING.md,
  },
  card: {
    flexDirection: 'row',
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  cardContent: {
    flex: 1,
    flexDirection: 'row',
    padding: SPACING.sm,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.sm,
  },
  cardInfo: {
    flex: 1,
    marginLeft: SPACING.md,
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    marginBottom: 2,
  },
  cardBrand: {
    fontSize: FONTS.sizes.sm,
    marginBottom: SPACING.xs,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  timerText: {
    fontSize: FONTS.sizes.sm,
  },
  priceText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'column',
  },
  editButton: {
    flex: 1,
    width: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    flex: 1,
    width: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxl * 2,
    gap: SPACING.sm,
  },
  emptyText: {
    fontSize: FONTS.sizes.md,
    marginTop: SPACING.sm,
  },
  emptyHint: {
    fontSize: FONTS.sizes.sm,
  },
});
