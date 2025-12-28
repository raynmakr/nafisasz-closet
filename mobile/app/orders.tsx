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
import { useAuth } from '../src/context/AuthContext';
import { useThemeColors } from '@/hooks';
import { SPACING, FONTS, BORDER_RADIUS } from '@/constants';
import { transactionsService, Transaction, TransactionStatus } from '@/services/transactions';

type TabType = 'purchases' | 'sales';

const STATUS_LABELS: Record<TransactionStatus, string> = {
  pending_payment: 'Payment Pending',
  payment_failed: 'Payment Failed',
  paid: 'Paid - Awaiting Shipment',
  curator_confirmed: 'Confirmed - Preparing',
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

export default function OrdersScreen() {
  const colors = useThemeColors();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('purchases');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isCurator = user?.role === 'curator' || user?.curator?.approved;

  const loadTransactions = useCallback(async () => {
    try {
      const role = activeTab === 'purchases' ? 'buyer' : 'seller';
      const result = await transactionsService.getTransactions(role);
      setTransactions(result.transactions);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  useEffect(() => {
    setLoading(true);
    loadTransactions();
  }, [activeTab, loadTransactions]);

  const onRefresh = () => {
    setRefreshing(true);
    loadTransactions();
  };

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const photo = item.photos?.[0];
    const status = item.status as TransactionStatus;
    const statusLabel = STATUS_LABELS[status] || status;
    const statusColor = STATUS_COLORS[status] || colors.textMuted;

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
              <Text style={[styles.statusText, { color: statusColor }]}>
                {statusLabel}
              </Text>
            </View>
          </View>

          {activeTab === 'purchases' && item.curator_name && (
            <Text style={[styles.orderSubtext, { color: colors.textMuted }]}>
              Seller: {item.curator_name}
            </Text>
          )}

          {activeTab === 'sales' && item.buyer_name && (
            <Text style={[styles.orderSubtext, { color: colors.textMuted }]}>
              Buyer: {item.buyer_name}
            </Text>
          )}

          {item.tracking_number && (
            <View style={styles.trackingRow}>
              <Ionicons name="navigate-outline" size={14} color={colors.textMuted} />
              <Text style={[styles.trackingText, { color: colors.textMuted }]}>
                {item.tracking_number}
              </Text>
            </View>
          )}
        </View>

        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons
        name={activeTab === 'purchases' ? 'bag-outline' : 'pricetag-outline'}
        size={64}
        color={colors.textMuted}
      />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        {activeTab === 'purchases' ? 'No Purchases Yet' : 'No Sales Yet'}
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        {activeTab === 'purchases'
          ? 'Items you win will appear here'
          : 'Items you sell will appear here'}
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Orders',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
        }}
      />

      {/* Tab Switcher */}
      <View style={[styles.tabContainer, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'purchases' && styles.activeTab,
            activeTab === 'purchases' && { borderBottomColor: colors.accent },
          ]}
          onPress={() => setActiveTab('purchases')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'purchases' ? colors.accent : colors.textMuted },
            ]}
          >
            Purchases
          </Text>
        </TouchableOpacity>

        {isCurator && (
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'sales' && styles.activeTab,
              activeTab === 'sales' && { borderBottomColor: colors.accent },
            ]}
            onPress={() => setActiveTab('sales')}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'sales' ? colors.accent : colors.textMuted },
              ]}
            >
              Sales
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={transactions}
          renderItem={renderTransaction}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={[
            styles.listContent,
            transactions.length === 0 && styles.emptyList,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
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
    paddingHorizontal: SPACING.lg,
  },
  tab: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    marginRight: SPACING.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
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
