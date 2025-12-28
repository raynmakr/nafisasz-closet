import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, RefreshControl, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { bidsService, curatorsService, messagesService } from '@/services';
import { api } from '@/services/api';
import { useLikesStore } from '@/stores';
import { useAuth } from '@/src/context/AuthContext';
import { useThemeColors } from '@/hooks';
import { SPACING, FONTS, BORDER_RADIUS } from '@/constants';
import { UserClaim, Curator } from '@/types';

interface Transaction {
  id: number;
  listing_id: number;
  status: string;
  final_price: number;
}

type TabType = 'claims' | 'likes' | 'following';

export default function ActivityScreen() {
  const colors = useThemeColors();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('likes');
  const [refreshing, setRefreshing] = useState(false);
  const { getLikedItems } = useLikesStore();
  const likedItems = getLikedItems();

  const { data: claims = [], refetch: refetchClaims } = useQuery({
    queryKey: ['my-claims'],
    queryFn: () => bidsService.getMyClaims(),
    enabled: !!user,
  });

  // Fetch pending transactions for "Pay Now" button
  const { data: pendingTransactions = [], refetch: refetchTransactions } = useQuery({
    queryKey: ['pending-transactions'],
    queryFn: async () => {
      const response = await api.get<{ transactions: Transaction[] }>('/transactions?status=pending_payment');
      return response.transactions || [];
    },
    enabled: !!user,
  });

  // Map listing IDs to transaction IDs for quick lookup
  const pendingPaymentMap = new Map<number, number>();
  pendingTransactions.forEach((tx) => {
    pendingPaymentMap.set(tx.listing_id, tx.id);
  });

  const { data: followedCurators = [], refetch: refetchFollowing } = useQuery({
    queryKey: ['followed-curators'],
    queryFn: () => curatorsService.getFollowedCurators(),
    enabled: !!user,
  });

  const { data: conversations = [] } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => messagesService.getConversations(),
    enabled: !!user,
  });

  // Calculate total unread messages
  const totalUnreadMessages = conversations.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);

  const unfollowMutation = useMutation({
    mutationFn: (curator: Curator) => curatorsService.unfollowCurator(curator.userId),
    onSuccess: (_, curator) => {
      // Invalidate all curator-related caches
      queryClient.invalidateQueries({ queryKey: ['followed-curators'] });
      queryClient.invalidateQueries({ queryKey: ['curator', curator.id] });
      queryClient.invalidateQueries({ queryKey: ['curators'] });
    },
    onError: () => {
      Alert.alert('Error', 'Failed to unfollow curator');
    },
  });

  const handleUnfollow = (curator: Curator) => {
    Alert.alert(
      'Unfollow',
      `Are you sure you want to unfollow ${curator.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unfollow',
          style: 'destructive',
          onPress: () => unfollowMutation.mutate(curator),
        },
      ]
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (activeTab === 'claims') {
      await Promise.all([refetchClaims(), refetchTransactions()]);
    } else if (activeTab === 'following') {
      await refetchFollowing();
    }
    setRefreshing(false);
  };

  const renderTab = (tab: TabType, label: string, icon: string) => (
    <TouchableOpacity
      style={[
        styles.tab,
        activeTab === tab && { borderBottomColor: colors.accent, borderBottomWidth: 2 },
      ]}
      onPress={() => setActiveTab(tab)}
    >
      <Ionicons
        name={icon as any}
        size={20}
        color={activeTab === tab ? colors.accent : colors.textMuted}
      />
      <Text
        style={[
          styles.tabText,
          { color: activeTab === tab ? colors.accent : colors.textMuted },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderEmptyState = () => {
    const config: Record<TabType, { icon: string; title: string; text: string }> = {
      likes: {
        icon: 'heart-outline',
        title: 'No Likes Yet',
        text: 'Double-tap on posts to add them to your likes',
      },
      claims: {
        icon: 'pricetag-outline',
        title: 'No Claims Yet',
        text: 'Start claiming items to see your activity here',
      },
      following: {
        icon: 'people-outline',
        title: 'Not Following Anyone',
        text: 'Follow curators to see their posts in your feed',
      },
    };
    const { icon, title, text } = config[activeTab];

    return (
      <View style={styles.empty}>
        <Ionicons name={icon as any} size={64} color={colors.textMuted} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{text}</Text>
      </View>
    );
  };

  const renderLikedItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[styles.itemCard, { backgroundColor: colors.surface }]}
      onPress={() => router.push(`/listing/${item.id}`)}
    >
      <Image source={{ uri: item.photo }} style={styles.itemImage} />
      <View style={styles.itemInfo}>
        <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={[styles.itemPrice, { color: colors.textSecondary }]}>
          ${item.price?.toLocaleString()}
        </Text>
      </View>
      <Ionicons name="heart" size={24} color={colors.accent} />
    </TouchableOpacity>
  );

  const renderClaimItem = ({ item }: { item: UserClaim }) => {
    const isWon = item.listing.status === 'SOLD' && item.isWinning;
    const isActive = item.listing.status === 'ACTIVE';
    const statusColor = item.isWinning ? colors.accent : colors.textMuted;
    const transactionId = pendingPaymentMap.get(Number(item.listing.id));
    const needsPayment = isWon && transactionId;

    let statusText = 'Outbid';
    if (isWon) {
      statusText = needsPayment ? 'Pay Now' : 'Won';
    } else if (item.isWinning) {
      statusText = 'Winning';
    }

    const handlePress = () => {
      if (needsPayment) {
        router.push(`/payment/${transactionId}`);
      } else {
        router.push(`/listing/${item.listing.id}`);
      }
    };

    return (
      <TouchableOpacity
        style={[styles.itemCard, { backgroundColor: colors.surface }]}
        onPress={handlePress}
      >
        <Image
          source={{ uri: item.listing.photo || 'https://via.placeholder.com/60' }}
          style={styles.itemImage}
        />
        <View style={styles.itemInfo}>
          <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={2}>
            {item.listing.title}
          </Text>
          <Text style={[styles.itemPrice, { color: colors.textSecondary }]}>
            Your claim: ${item.amount.toLocaleString()}
          </Text>
          {isActive && item.listing.currentHighBid && (
            <Text style={[styles.itemMeta, { color: colors.textMuted }]}>
              Current: ${item.listing.currentHighBid.toLocaleString()}
            </Text>
          )}
        </View>
        <View style={[
          styles.statusBadge,
          { backgroundColor: needsPayment ? colors.error : statusColor }
        ]}>
          <Text style={styles.statusText}>{statusText}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderFollowingItem = ({ item }: { item: Curator }) => (
    <TouchableOpacity
      style={[styles.itemCard, { backgroundColor: colors.surface }]}
      onPress={() => router.push(`/curator/${item.id}`)}
    >
      <View style={[styles.curatorAvatar, { backgroundColor: colors.accent }]}>
        <Text style={[styles.curatorInitial, { color: colors.background }]}>
          {item.name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.itemInfo}>
        <Text style={[styles.itemTitle, { color: colors.text }]}>{item.name}</Text>
        {item.handle && (
          <Text style={[styles.itemPrice, { color: colors.textSecondary }]}>
            @{item.handle}
          </Text>
        )}
      </View>
      <TouchableOpacity
        style={[styles.unfollowButton, { borderColor: colors.error }]}
        onPress={() => handleUnfollow(item)}
        disabled={unfollowMutation.isPending}
      >
        <Text style={[styles.unfollowText, { color: colors.error }]}>Unfollow</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>Activity</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Your likes and claims
            </Text>
          </View>
          <TouchableOpacity
            style={styles.messagesButton}
            onPress={() => router.push('/messages')}
          >
            <Ionicons name="chatbubble-outline" size={24} color={colors.text} />
            {totalUnreadMessages > 0 && (
              <View style={[styles.unreadIndicator, { backgroundColor: colors.error }]}>
                <Text style={styles.unreadIndicatorText}>
                  {totalUnreadMessages > 99 ? '99+' : totalUnreadMessages}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        {renderTab('likes', 'Likes', 'heart')}
        {renderTab('claims', 'Claims', 'pricetag')}
        {renderTab('following', 'Following', 'people')}
      </View>

      {activeTab === 'likes' ? (
        likedItems.length > 0 ? (
          <FlatList
            data={likedItems}
            keyExtractor={(item) => item.id}
            renderItem={renderLikedItem}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={false}
                onRefresh={() => {}}
                tintColor={colors.accent}
              />
            }
          />
        ) : (
          renderEmptyState()
        )
      ) : activeTab === 'claims' ? (
        claims.length > 0 ? (
          <FlatList
            data={claims}
            keyExtractor={(item) => item.id}
            renderItem={renderClaimItem}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.accent}
              />
            }
          />
        ) : (
          renderEmptyState()
        )
      ) : followedCurators.length > 0 ? (
        <FlatList
          data={followedCurators}
          keyExtractor={(item) => item.id}
          renderItem={renderFollowingItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
          }
        />
      ) : (
        renderEmptyState()
      )}
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
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  messagesButton: {
    position: 'relative',
    padding: SPACING.sm,
  },
  unreadIndicator: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  unreadIndicatorText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  title: {
    fontSize: FONTS.sizes.xxxl,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: FONTS.sizes.md,
    marginTop: SPACING.xs,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginHorizontal: SPACING.lg,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    gap: SPACING.xs,
  },
  tabText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  list: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.md,
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: BORDER_RADIUS.sm,
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '500',
  },
  itemPrice: {
    fontSize: FONTS.sizes.sm,
    marginTop: 2,
  },
  itemMeta: {
    fontSize: FONTS.sizes.xs,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  emptyTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: 'bold',
    marginTop: SPACING.md,
  },
  emptyText: {
    fontSize: FONTS.sizes.md,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  curatorAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  curatorInitial: {
    fontSize: FONTS.sizes.xl,
    fontWeight: 'bold',
  },
  unfollowButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
  },
  unfollowText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
  },
});
