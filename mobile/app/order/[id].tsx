import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { useThemeColors } from '@/hooks';
import { SPACING, FONTS, BORDER_RADIUS } from '@/constants';
import { transactionsService, Transaction, TransactionStatus } from '@/services/transactions';
import { api } from '@/services/api';

const STATUS_LABELS: Record<TransactionStatus, string> = {
  pending_payment: 'Payment Pending',
  payment_failed: 'Payment Failed',
  paid: 'Ready to Ship',
  curator_confirmed: 'Ready to Ship',
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

interface OrderDetailData extends Transaction {
  curator_user_id?: number;
  tracking_url?: string;
  label_url?: string;
  shipping_carrier?: string;
  shipping_service?: string;
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeColors();
  const { user } = useAuth();
  const [order, setOrder] = useState<OrderDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showTrackingInput, setShowTrackingInput] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');

  // Determine role from the transaction data itself:
  // - If buyer_handle/buyer_name exists, we fetched as seller (seller sees buyer info)
  // - If curator_handle/curator_name exists, we fetched as buyer (buyer sees curator info)
  const isViewingAsSeller = !!((order as any)?.buyer_handle || (order as any)?.buyer_name);
  const isViewingAsBuyer = !!((order as any)?.curator_handle || (order as any)?.curator_name);

  // Fallback to ID comparison if the fields aren't available
  const isBuyer = isViewingAsBuyer || (!isViewingAsSeller && order?.buyer_id?.toString() === user?.id?.toString());
  const isSeller = user?.role === 'curator' || user?.curator?.approved;

  const loadOrder = useCallback(async () => {
    try {
      // Always fetch both buyer and seller transactions to find the order
      const [buyerResult, sellerResult] = await Promise.all([
        transactionsService.getTransactions('buyer'),
        transactionsService.getTransactions('seller').catch(() => ({ transactions: [] })),
      ]);

      // Check SELLER transactions first (so curators see seller view by default)
      // Then fall back to buyer transactions
      let found = sellerResult.transactions.find((t) => t.id.toString() === id);
      if (!found) {
        found = buyerResult.transactions.find((t) => t.id.toString() === id);
      }

      setOrder(found || null);
    } catch (error) {
      console.error('Failed to load order:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const onRefresh = () => {
    setRefreshing(true);
    loadOrder();
  };

  const handleConfirmPurchase = async () => {
    Alert.alert(
      'Confirm Purchase',
      'Have you purchased this item from the boutique?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Confirm',
          onPress: async () => {
            try {
              setActionLoading(true);
              await transactionsService.confirmPurchase(parseInt(id!));
              Alert.alert('Success', 'Purchase confirmed! Now add shipping info.');
              loadOrder();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to confirm purchase');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleMarkShipped = async () => {
    if (!trackingNumber.trim()) {
      Alert.alert('Error', 'Please enter a tracking number');
      return;
    }

    try {
      setActionLoading(true);
      await transactionsService.markShipped(parseInt(id!), trackingNumber.trim());
      Alert.alert('Success', 'Item marked as shipped! Buyer will be notified.');
      setShowTrackingInput(false);
      setTrackingNumber('');
      loadOrder();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to mark as shipped');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDelivery = async () => {
    Alert.alert(
      'Confirm Delivery',
      'Have you received this item? This will release payment to the seller.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Received',
          onPress: async () => {
            try {
              setActionLoading(true);
              const result = await transactionsService.confirmDelivery(parseInt(id!));
              if (result.success) {
                Alert.alert('Success', 'Delivery confirmed! Thank you for your purchase.');
                loadOrder();
              }
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to confirm delivery');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleTrackPackage = () => {
    if (!order?.tracking_number) return;

    // Use Shippo's tracking URL if available
    if (order.tracking_url) {
      Linking.openURL(order.tracking_url);
      return;
    }

    // Fallback: Try to detect carrier and open tracking URL
    const tracking = order.tracking_number.toUpperCase();
    let url = '';

    if (tracking.startsWith('1Z')) {
      url = `https://www.ups.com/track?tracknum=${tracking}`;
    } else if (tracking.length === 22 || tracking.startsWith('94')) {
      url = `https://tools.usps.com/go/TrackConfirmAction?tLabels=${tracking}`;
    } else if (tracking.length === 12 || tracking.length === 15) {
      url = `https://www.fedex.com/fedextrack/?trknbr=${tracking}`;
    } else {
      url = `https://www.google.com/search?q=track+package+${tracking}`;
    }

    Linking.openURL(url);
  };

  const handleViewLabel = () => {
    if (order?.label_url) {
      Linking.openURL(order.label_url);
    }
  };

  const handlePayNow = () => {
    router.push(`/payment/${id}`);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle-outline" size={64} color={colors.textMuted} />
        <Text style={[styles.errorText, { color: colors.text }]}>Order not found</Text>
      </View>
    );
  }

  const status = order.status as TransactionStatus;
  const statusLabel = STATUS_LABELS[status] || status;
  const statusColor = STATUS_COLORS[status] || colors.textMuted;
  const photo = order.photos?.[0];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Order Details',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
        }}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        {/* Status Banner */}
        <View style={[styles.statusBanner, { backgroundColor: `${statusColor}20` }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusLabel, { color: statusColor }]}>{statusLabel}</Text>
        </View>

        {/* Item Info */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.itemRow}>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.itemImage} />
            ) : (
              <View style={[styles.itemImagePlaceholder, { backgroundColor: colors.background }]}>
                <Ionicons name="image-outline" size={32} color={colors.textMuted} />
              </View>
            )}
            <View style={styles.itemInfo}>
              <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={2}>
                {order.title || 'Untitled Item'}
              </Text>
              {order.brand && (
                <Text style={[styles.itemBrand, { color: colors.textSecondary }]}>
                  {order.brand} {order.size ? `• ${order.size}` : ''}
                </Text>
              )}
              <Text style={[styles.itemPrice, { color: colors.accent }]}>
                ${parseFloat(order.final_price).toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        {/* Order Timeline */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Order Timeline</Text>

          <View style={styles.timeline}>
            <TimelineItem
              icon="checkmark-circle"
              label="Order Placed"
              date={order.created_at}
              completed={true}
              colors={colors}
            />
            <TimelineItem
              icon="card"
              label="Payment Received"
              date={status !== 'pending_payment' && status !== 'payment_failed' ? order.created_at : undefined}
              completed={['paid', 'curator_confirmed', 'shipped', 'delivered', 'payout_complete'].includes(status)}
              colors={colors}
            />
            <TimelineItem
              icon="cube"
              label="Shipped"
              date={order.shipped_at}
              completed={['shipped', 'delivered', 'payout_complete'].includes(status)}
              colors={colors}
            />
            <TimelineItem
              icon="home"
              label="Delivered"
              date={order.delivered_at}
              completed={['delivered', 'payout_complete'].includes(status)}
              isLast
              colors={colors}
            />
          </View>
        </View>

        {/* Tracking Info */}
        {order.tracking_number && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Shipping</Text>
            {order.shipping_carrier && (
              <View style={styles.shippingInfo}>
                <Text style={[styles.carrierText, { color: colors.text }]}>
                  {order.shipping_carrier} {order.shipping_service ? `- ${order.shipping_service}` : ''}
                </Text>
              </View>
            )}
            <View style={styles.trackingRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.trackingLabel, { color: colors.textMuted }]}>Tracking Number</Text>
                <Text style={[styles.trackingNumber, { color: colors.text }]} selectable>{order.tracking_number}</Text>
              </View>
              <TouchableOpacity
                style={[styles.trackButton, { backgroundColor: colors.accent }]}
                onPress={handleTrackPackage}
              >
                <Text style={styles.trackButtonText}>Track</Text>
              </TouchableOpacity>
            </View>
            {!isBuyer && order.label_url && (
              <TouchableOpacity
                style={[styles.labelButton, { borderColor: colors.border }]}
                onPress={handleViewLabel}
              >
                <Ionicons name="document-outline" size={18} color={colors.text} />
                <Text style={[styles.labelButtonText, { color: colors.text }]}>View Label (PDF)</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Parties */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {isBuyer ? 'Seller' : 'Buyer'}
          </Text>
          <View style={styles.partyRow}>
            <View style={[styles.partyAvatar, { backgroundColor: colors.accent }]}>
              <Text style={styles.partyAvatarText}>
                {(isBuyer
                  ? ((order as any).curator_handle || (order as any).curator_name)
                  : ((order as any).buyer_handle || (order as any).buyer_name)
                )?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
            <View>
              <Text style={[styles.partyName, { color: colors.text }]}>
                {isBuyer
                  ? `@${(order as any).curator_handle || (order as any).curator_name}`
                  : `@${(order as any).buyer_handle || (order as any).buyer_name}`
                }
              </Text>
            </View>
          </View>
        </View>

        {/* Seller Actions */}
        {!isBuyer && showTrackingInput && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Add Tracking</Text>
            <TextInput
              style={[styles.trackingInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder="Enter tracking number"
              placeholderTextColor={colors.textMuted}
              value={trackingNumber}
              onChangeText={setTrackingNumber}
              autoCapitalize="characters"
            />
            <View style={styles.inputActions}>
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: colors.border }]}
                onPress={() => {
                  setShowTrackingInput(false);
                  setTrackingNumber('');
                }}
              >
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: colors.accent }]}
                onPress={handleMarkShipped}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Mark Shipped</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Price Breakdown */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Price Details</Text>
          <View style={styles.priceRow}>
            <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>Item Price</Text>
            <Text style={[styles.priceValue, { color: colors.text }]}>
              ${parseFloat(order.final_price).toFixed(2)}
            </Text>
          </View>
          {order.shipping_cost && (
            <View style={styles.priceRow}>
              <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>Shipping</Text>
              <Text style={[styles.priceValue, { color: colors.text }]}>
                ${parseFloat(order.shipping_cost).toFixed(2)}
              </Text>
            </View>
          )}
          <View style={[styles.priceRow, styles.totalRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.totalLabel, { color: colors.text }]}>Total</Text>
            <Text style={[styles.totalValue, { color: colors.accent }]}>
              ${(parseFloat(order.final_price) + (order.shipping_cost ? parseFloat(order.shipping_cost) : 0)).toFixed(2)}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={[styles.actionBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        {/* Buyer: Pay Now */}
        {isBuyer && (status === 'pending_payment' || status === 'payment_failed') && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.accent }]}
            onPress={handlePayNow}
          >
            <Ionicons name="card-outline" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Pay Now</Text>
          </TouchableOpacity>
        )}

        {/* Buyer: Confirm Delivery */}
        {isBuyer && status === 'shipped' && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.accent }]}
            onPress={handleConfirmDelivery}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>Confirm Delivery</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Seller: Create Shipping Label */}
        {!isBuyer && (status === 'paid' || status === 'curator_confirmed') && !showTrackingInput && (
          <>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.accent }]}
              onPress={() => router.push(`/shipping/${id}`)}
            >
              <Ionicons name="document-text-outline" size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Create Label</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: colors.border }]}
              onPress={() => setShowTrackingInput(true)}
            >
              <Ionicons name="create-outline" size={20} color={colors.text} />
              <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Manual</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Track Package */}
        {order.tracking_number && status === 'shipped' && (
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.border }]}
            onPress={handleTrackPackage}
          >
            <Ionicons name="navigate-outline" size={20} color={colors.text} />
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Track Package</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function TimelineItem({
  icon,
  label,
  date,
  completed,
  isLast,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  date?: string | null;
  completed: boolean;
  isLast?: boolean;
  colors: any;
}) {
  const formattedDate = date
    ? new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  return (
    <View style={styles.timelineItem}>
      <View style={styles.timelineLeft}>
        <View
          style={[
            styles.timelineIcon,
            { backgroundColor: completed ? colors.success : colors.border },
          ]}
        >
          <Ionicons
            name={completed ? icon : 'ellipse-outline'}
            size={16}
            color={completed ? '#FFFFFF' : colors.textMuted}
          />
        </View>
        {!isLast && (
          <View
            style={[
              styles.timelineLine,
              { backgroundColor: completed ? colors.success : colors.border },
            ]}
          />
        )}
      </View>
      <View style={styles.timelineContent}>
        <Text style={[styles.timelineLabel, { color: completed ? colors.text : colors.textMuted }]}>
          {label}
        </Text>
        {formattedDate && (
          <Text style={[styles.timelineDate, { color: colors.textMuted }]}>{formattedDate}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: 100,
  },
  errorText: {
    fontSize: FONTS.sizes.lg,
    marginTop: SPACING.md,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: SPACING.sm,
  },
  statusLabel: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  card: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  itemRow: {
    flexDirection: 'row',
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.md,
  },
  itemImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  itemTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemBrand: {
    fontSize: FONTS.sizes.sm,
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    marginBottom: SPACING.md,
  },
  timeline: {
    paddingLeft: SPACING.sm,
  },
  timelineItem: {
    flexDirection: 'row',
    minHeight: 50,
  },
  timelineLeft: {
    alignItems: 'center',
    width: 30,
  },
  timelineIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginVertical: 4,
  },
  timelineContent: {
    flex: 1,
    paddingLeft: SPACING.md,
    paddingBottom: SPACING.md,
  },
  timelineLabel: {
    fontSize: FONTS.sizes.md,
    fontWeight: '500',
  },
  timelineDate: {
    fontSize: FONTS.sizes.xs,
    marginTop: 2,
  },
  shippingInfo: {
    marginBottom: SPACING.sm,
  },
  carrierText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '500',
  },
  trackingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trackingLabel: {
    fontSize: FONTS.sizes.xs,
    marginBottom: 2,
  },
  trackingNumber: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  trackButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  trackButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: FONTS.sizes.sm,
  },
  labelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginTop: SPACING.md,
  },
  labelButtonText: {
    fontWeight: '500',
    fontSize: FONTS.sizes.sm,
    marginLeft: SPACING.xs,
  },
  partyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  partyAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  partyAvatarText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
  },
  partyName: {
    fontSize: FONTS.sizes.md,
    fontWeight: '500',
  },
  partyEmail: {
    fontSize: FONTS.sizes.sm,
    marginTop: 2,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  priceLabel: {
    fontSize: FONTS.sizes.md,
  },
  priceValue: {
    fontSize: FONTS.sizes.md,
    fontWeight: '500',
  },
  totalRow: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
  },
  totalLabel: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  totalValue: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
  },
  trackingInput: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: FONTS.sizes.md,
    marginBottom: SPACING.md,
  },
  inputActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cancelButton: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginRight: SPACING.sm,
  },
  cancelButtonText: {
    fontWeight: '500',
  },
  submitButton: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: SPACING.lg,
    paddingBottom: 34,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: FONTS.sizes.md,
    marginLeft: SPACING.sm,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontWeight: '600',
    fontSize: FONTS.sizes.md,
    marginLeft: SPACING.sm,
  },
});
