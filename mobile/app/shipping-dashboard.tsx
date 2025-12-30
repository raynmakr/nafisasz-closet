import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks';
import { SPACING, FONTS, BORDER_RADIUS } from '@/constants';
import { transactionsService, Transaction, TransactionStatus } from '@/services/transactions';

type TabType = 'needs_label' | 'in_transit' | 'delivered';

const TAB_LABELS: Record<TabType, string> = {
  needs_label: 'Needs Label',
  in_transit: 'In Transit',
  delivered: 'Delivered',
};

const STATUS_LABELS: Record<TransactionStatus, string> = {
  pending_payment: 'Payment Pending',
  payment_failed: 'Payment Failed',
  paid: 'Ready to Ship',
  curator_confirmed: 'Confirmed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  payout_complete: 'Complete',
  disputed: 'Disputed',
  refunded: 'Refunded',
};

const STATUS_COLORS: Record<TransactionStatus, string> = {
  pending_payment: '#F59E0B',
  payment_failed: '#EF4444',
  paid: '#3B82F6',
  curator_confirmed: '#3B82F6',
  shipped: '#8B5CF6',
  delivered: '#10B981',
  payout_complete: '#10B981',
  disputed: '#EF4444',
  refunded: '#6B7280',
};

export default function ShippingDashboardScreen() {
  const colors = useThemeColors();
  const [activeTab, setActiveTab] = useState<TabType>('needs_label');
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTransactions = useCallback(async () => {
    try {
      const result = await transactionsService.getTransactions('seller');
      setAllTransactions(result.transactions);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const onRefresh = () => {
    setRefreshing(true);
    loadTransactions();
  };

  // Filter transactions based on active tab
  const filteredTransactions = allTransactions.filter((t) => {
    const status = t.status as TransactionStatus;
    switch (activeTab) {
      case 'needs_label':
        return status === 'paid' || status === 'curator_confirmed';
      case 'in_transit':
        return status === 'shipped';
      case 'delivered':
        return status === 'delivered' || status === 'payout_complete';
      default:
        return false;
    }
  });

  // Count items per tab for badges
  const counts = {
    needs_label: allTransactions.filter(
      (t) => t.status === 'paid' || t.status === 'curator_confirmed'
    ).length,
    in_transit: allTransactions.filter((t) => t.status === 'shipped').length,
    delivered: allTransactions.filter(
      (t) => t.status === 'delivered' || t.status === 'payout_complete'
    ).length,
  };

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const photo = item.photos?.[0];
    const status = item.status as TransactionStatus;
    const statusLabel = STATUS_LABELS[status] || status;
    const statusColor = STATUS_COLORS[status] || colors.textMuted;
    const buyerHandle = (item as any).buyer_handle;
    const buyerName = (item as any).buyer_name;

    return (
      <TouchableOpacity
        style={[styles.orderCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => router.push(`/order/${item.id}`)}
        activeOpacity={0.7}
      >
        {photo ? (
          <Image source={{ uri: photo }} style={styles.orderImage} />
        ) : (
          <View style={[styles.orderImagePlaceholder, { backgroundColor: colors.background }]}>
            <Ionicons name="image-outline" size={24} color={colors.textMuted} />
          </View>
        )}

        <View style={styles.orderInfo}>
          <Text style={[styles.orderTitle, { color: colors.text }]} numberOfLines={2}>
            {item.title || 'Untitled Item'}
          </Text>

          {item.brand && (
            <Text style={[styles.orderBrand, { color: colors.textSecondary }]}>
              {item.brand} {item.size ? `• ${item.size}` : ''}
            </Text>
          )}

          <View style={styles.orderMeta}>
            <Text style={[styles.orderPrice, { color: colors.accent }]}>
              ${parseFloat(item.final_price).toFixed(2)}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          </View>

          <Text style={[styles.orderSubtext, { color: colors.textMuted }]}>
            Buyer: @{buyerHandle || buyerName || 'Unknown'}
          </Text>

          {item.tracking_number && (
            <View style={styles.trackingRow}>
              <Ionicons name="navigate-outline" size={14} color={colors.textMuted} />
              <Text style={[styles.trackingText, { color: colors.textMuted }]}>
                {item.tracking_number}
              </Text>
            </View>
          )}

          {item.shipped_at && (
            <Text style={[styles.dateText, { color: colors.textMuted }]}>
              Shipped: {new Date(item.shipped_at).toLocaleDateString()}
            </Text>
          )}

          {item.delivered_at && (
            <Text style={[styles.dateText, { color: colors.textMuted }]}>
              Delivered: {new Date(item.delivered_at).toLocaleDateString()}
            </Text>
          )}
        </View>

        {/* Quick Action Button */}
        {activeTab === 'needs_label' && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.accent }]}
            onPress={(e) => {
              e.stopPropagation();
              router.push(`/shipping/${item.id}`);
            }}
          >
            <Ionicons name="document-text-outline" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        )}

        {activeTab === 'in_transit' && item.tracking_number && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
            onPress={(e) => {
              e.stopPropagation();
              router.push(`/order/${item.id}`);
            }}
          >
            <Ionicons name="location-outline" size={16} color={colors.text} />
          </TouchableOpacity>
        )}

        {activeTab === 'delivered' && (
          <Ionicons name="checkmark-circle" size={24} color={colors.success} />
        )}
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    let icon: keyof typeof Ionicons.glyphMap = 'cube-outline';
    let title = '';
    let subtitle = '';

    switch (activeTab) {
      case 'needs_label':
        icon = 'document-text-outline';
        title = 'No Labels Needed';
        subtitle = 'Orders ready to ship will appear here';
        break;
      case 'in_transit':
        icon = 'airplane-outline';
        title = 'Nothing In Transit';
        subtitle = 'Shipped orders will appear here';
        break;
      case 'delivered':
        icon = 'checkmark-done-outline';
        title = 'No Deliveries Yet';
        subtitle = 'Completed deliveries will appear here';
        break;
    }

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name={icon} size={64} color={colors.textMuted} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      </View>
    );
  };

  const renderTab = (tab: TabType) => {
    const isActive = activeTab === tab;
    const count = counts[tab];

    return (
      <TouchableOpacity
        key={tab}
        style={[
          styles.tab,
          isActive && styles.activeTab,
          isActive && { borderBottomColor: colors.accent },
        ]}
        onPress={() => setActiveTab(tab)}
      >
        <Text
          style={[styles.tabText, { color: isActive ? colors.accent : colors.textMuted }]}
        >
          {TAB_LABELS[tab]}
        </Text>
        {count > 0 && (
          <View
            style={[
              styles.tabBadge,
              { backgroundColor: isActive ? colors.accent : colors.textMuted },
            ]}
          >
            <Text style={styles.tabBadgeText}>{count}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Shipping',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
        }}
      />

      {/* Tab Switcher */}
      <View style={[styles.tabContainer, { borderBottomColor: colors.border }]}>
        {(['needs_label', 'in_transit', 'delivered'] as TabType[]).map(renderTab)}
      </View>

      {/* Summary Stats */}
      {!loading && (
        <View style={[styles.statsContainer, { backgroundColor: colors.surface }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.accent }]}>{counts.needs_label}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>To Ship</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#8B5CF6' }]}>{counts.in_transit}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>In Transit</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.success }]}>{counts.delivered}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Delivered</Text>
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={filteredTransactions}
          renderItem={renderTransaction}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={[
            styles.listContent,
            filteredTransactions.length === 0 && styles.emptyList,
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: SPACING.md,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    gap: SPACING.xs,
  },
  activeTab: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
  },
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  tabBadgeText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.xs,
    fontWeight: 'bold',
  },
  statsContainer: {
    flexDirection: 'row',
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: FONTS.sizes.xl,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: FONTS.sizes.xs,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: SPACING.lg,
  },
  emptyList: {
    flex: 1,
  },
  orderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  orderImage: {
    width: 70,
    height: 70,
    borderRadius: BORDER_RADIUS.md,
  },
  orderImagePlaceholder: {
    width: 70,
    height: 70,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderInfo: {
    flex: 1,
    marginLeft: SPACING.md,
    marginRight: SPACING.sm,
  },
  orderTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    marginBottom: 2,
  },
  orderBrand: {
    fontSize: FONTS.sizes.sm,
    marginBottom: SPACING.xs,
  },
  orderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  orderPrice: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    marginRight: SPACING.sm,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  statusText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
  },
  orderSubtext: {
    fontSize: FONTS.sizes.xs,
  },
  trackingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  trackingText: {
    fontSize: FONTS.sizes.xs,
    marginLeft: 4,
  },
  dateText: {
    fontSize: FONTS.sizes.xs,
    marginTop: 2,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  emptyTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  emptySubtitle: {
    fontSize: FONTS.sizes.md,
    textAlign: 'center',
  },
});
