import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useLocalSearchParams, router } from 'expo-router';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { stripeService, PaymentSheetTransaction } from '@/services/stripe';
import { purseService, CoinPreview } from '@/services/purse';
import { useThemeColors } from '@/hooks';
import { SPACING, FONTS, BORDER_RADIUS } from '@/constants';
import ExpoGoPaymentNotice from '@/components/ExpoGoPaymentNotice';

// Check if running in Expo Go
const isExpoGo = Constants.appOwnership === 'expo';

// Conditionally import Stripe
let useStripe: any = null;

if (!isExpoGo) {
  try {
    const stripe = require('@stripe/stripe-react-native');
    useStripe = stripe.useStripe;
  } catch (e) {
    console.warn('Stripe not available');
  }
}

type PaymentStatus = 'loading' | 'ready' | 'processing' | 'success' | 'error';

export default function PaymentScreen() {
  // Show notice if in Expo Go or Stripe not available
  if (isExpoGo || !useStripe) {
    return <ExpoGoPaymentNotice />;
  }

  return <PaymentContent />;
}

function PaymentContent() {
  const { transactionId } = useLocalSearchParams<{ transactionId: string }>();
  const colors = useThemeColors();
  const { initPaymentSheet, presentPaymentSheet } = useStripe!();

  const [status, setStatus] = useState<PaymentStatus>('loading');
  const [transaction, setTransaction] = useState<PaymentSheetTransaction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [coinPreview, setCoinPreview] = useState<CoinPreview | null>(null);
  const [coinsToApply, setCoinsToApply] = useState(0);
  const [paymentClientSecret, setPaymentClientSecret] = useState<string | null>(null);
  const [applyingCoins, setApplyingCoins] = useState(false);

  useEffect(() => {
    if (transactionId) {
      initializePayment();
    }
  }, [transactionId]);

  const initializePayment = async () => {
    try {
      setStatus('loading');
      setError(null);

      // Get payment sheet params from API
      const params = await stripeService.getPaymentSheetParams(Number(transactionId));

      if (!params.success) {
        throw new Error('Failed to get payment parameters');
      }

      setTransaction(params.transaction);
      setPaymentClientSecret(params.paymentIntent);

      // Fetch coin preview
      try {
        const preview = await purseService.getCoinPreview({ transactionId });
        setCoinPreview(preview);
      } catch (err) {
        console.warn('Failed to fetch coin preview:', err);
        // Continue without coin discount option
      }

      // Initialize Payment Sheet
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: params.paymentIntent,
        merchantDisplayName: "Nafisa's Closet",
        style: 'alwaysDark',
        defaultBillingDetails: {
          name: '',
        },
      });

      if (initError) {
        console.error('PaymentSheet init error:', initError);
        throw new Error(initError.message);
      }

      setStatus('ready');
    } catch (err: any) {
      console.error('Initialize payment error:', err);
      setError(err.message || 'Failed to initialize payment');
      setStatus('error');
    }
  };

  // Update preview when coins change
  const handleCoinsChange = useCallback(async (value: number) => {
    setCoinsToApply(value);
    if (!coinPreview || value === coinPreview.coinsToApply) return;

    try {
      const preview = await purseService.getCoinPreview({ transactionId }, value);
      setCoinPreview(preview);
    } catch (err) {
      console.warn('Failed to update coin preview:', err);
    }
  }, [transactionId, coinPreview?.coinsToApply]);

  const handlePayment = async () => {
    try {
      setStatus('processing');

      // Apply coins if any selected
      if (coinsToApply > 0 && coinPreview?.valid) {
        setApplyingCoins(true);
        try {
          const result = await purseService.applyCoins(Number(transactionId), coinsToApply);

          // Re-initialize payment sheet with new amount if client secret changed
          if (result.paymentIntentClientSecret) {
            const { error: initError } = await initPaymentSheet({
              paymentIntentClientSecret: result.paymentIntentClientSecret,
              merchantDisplayName: "Nafisa's Closet",
              style: 'alwaysDark',
              defaultBillingDetails: { name: '' },
            });

            if (initError) {
              throw new Error(initError.message);
            }
          }
        } catch (err: any) {
          console.error('Apply coins error:', err);
          Alert.alert('Error', err.message || 'Failed to apply coins');
          setStatus('ready');
          return;
        } finally {
          setApplyingCoins(false);
        }
      }

      const { error: paymentError } = await presentPaymentSheet();

      if (paymentError) {
        if (paymentError.code === 'Canceled') {
          // User canceled - just go back to ready state
          setStatus('ready');
          return;
        }
        throw new Error(paymentError.message);
      }

      // Payment successful!
      setStatus('success');

      // Show success alert and navigate
      Alert.alert(
        'Payment Successful!',
        'Your payment has been processed. The curator will now purchase and ship your item.',
        [
          {
            text: 'View Order',
            onPress: () => {
              router.replace('/(tabs)/activity');
            },
          },
        ]
      );
    } catch (err: any) {
      console.error('Payment error:', err);
      setError(err.message || 'Payment failed');
      setStatus('error');
    }
  };

  const formatPrice = (price: number) => {
    return `$${price.toFixed(2)}`;
  };

  const getCurrentTotal = () => {
    if (coinPreview && coinsToApply > 0 && coinPreview.valid) {
      return coinPreview.finalPrice;
    }
    return transaction?.finalPrice || 0;
  };

  if (status === 'loading') {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>
          Preparing payment...
        </Text>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle" size={64} color={colors.error} />
        <Text style={[styles.errorTitle, { color: colors.text }]}>
          Payment Error
        </Text>
        <Text style={[styles.errorMessage, { color: colors.textMuted }]}>
          {error}
        </Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: colors.accent }]}
          onPress={initializePayment}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.back()}
        >
          <Text style={[styles.cancelButtonText, { color: colors.textMuted }]}>
            Cancel
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (status === 'success') {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <View style={[styles.successIcon, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
          <Ionicons name="checkmark-circle" size={80} color="#10B981" />
        </View>
        <Text style={[styles.successTitle, { color: colors.text }]}>
          Payment Successful!
        </Text>
        <Text style={[styles.successMessage, { color: colors.textMuted }]}>
          Your order has been confirmed. The curator will purchase and ship your item within 48 hours.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Item Details */}
      {transaction && (
        <View style={[styles.itemCard, { backgroundColor: colors.surface }]}>
          {transaction.photo && (
            <Image
              source={{ uri: transaction.photo }}
              style={styles.itemImage}
              resizeMode="cover"
            />
          )}
          <View style={styles.itemDetails}>
            <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={2}>
              {transaction.title}
            </Text>
            {transaction.brand && (
              <Text style={[styles.itemBrand, { color: colors.textMuted }]}>
                {transaction.brand}
              </Text>
            )}
            {transaction.size && (
              <Text style={[styles.itemSize, { color: colors.textMuted }]}>
                Size: {transaction.size}
              </Text>
            )}
            <Text style={[styles.curatorName, { color: colors.textSecondary }]}>
              Curated by {transaction.curatorName}
            </Text>
          </View>
        </View>
      )}

      {/* Order Summary */}
      <View style={[styles.summaryCard, { backgroundColor: colors.surface }]}>
        <Text style={[styles.summaryTitle, { color: colors.text }]}>
          Order Summary
        </Text>

        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>
            Winning Claim
          </Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>
            {transaction ? formatPrice(transaction.finalPrice) : '--'}
          </Text>
        </View>

        {/* Gold Coins Discount Section */}
        {coinPreview && coinPreview.coinsAvailable >= 2 && coinPreview.maxApplicable >= 2 && (
          <>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <View style={styles.coinsSection}>
              <View style={styles.coinsSectionHeader}>
                <Text style={[styles.coinsTitle, { color: colors.text }]}>
                  Apply Gold Coins
                </Text>
                <Text style={[styles.coinsBalance, { color: colors.textMuted }]}>
                  Balance: {coinPreview.coinsAvailable} GC
                </Text>
              </View>

              <View style={styles.sliderContainer}>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={coinPreview.maxApplicable}
                  step={1}
                  value={coinsToApply}
                  onValueChange={handleCoinsChange}
                  minimumTrackTintColor="#FFD700"
                  maximumTrackTintColor={colors.border}
                  thumbTintColor="#FFD700"
                />
                <View style={styles.sliderLabels}>
                  <Text style={[styles.sliderLabel, { color: colors.textMuted }]}>0</Text>
                  <Text style={[styles.sliderValue, { color: '#FFD700' }]}>
                    {coinsToApply} GC
                  </Text>
                  <Text style={[styles.sliderLabel, { color: colors.textMuted }]}>
                    {coinPreview.maxApplicable}
                  </Text>
                </View>
              </View>

              {coinsToApply > 0 && coinPreview.valid && (
                <View style={[styles.discountRow, { backgroundColor: 'rgba(255, 215, 0, 0.1)' }]}>
                  <Text style={[styles.discountLabel, { color: '#FFD700' }]}>
                    Coin Discount
                  </Text>
                  <Text style={[styles.discountValue, { color: '#FFD700' }]}>
                    -{coinPreview.discountFormatted}
                  </Text>
                </View>
              )}

              {coinsToApply > 0 && !coinPreview.valid && coinPreview.error && (
                <Text style={[styles.errorText, { color: colors.error }]}>
                  {coinPreview.error}
                </Text>
              )}
            </View>
          </>
        )}

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.summaryRow}>
          <Text style={[styles.totalLabel, { color: colors.text }]}>
            Total
          </Text>
          <Text style={[styles.totalValue, { color: colors.accent }]}>
            {formatPrice(getCurrentTotal())}
          </Text>
        </View>

        {coinsToApply > 0 && coinPreview?.valid && (
          <Text style={[styles.savingsText, { color: '#10B981' }]}>
            You save {coinPreview.discountFormatted} with Gold Coins!
          </Text>
        )}
      </View>

      {/* Payment Info */}
      <View style={styles.paymentInfo}>
        <View style={styles.secureRow}>
          <Ionicons name="lock-closed" size={16} color={colors.textMuted} />
          <Text style={[styles.secureText, { color: colors.textMuted }]}>
            Secure payment powered by Stripe
          </Text>
        </View>
        <Text style={[styles.infoText, { color: colors.textMuted }]}>
          Your payment is protected. Funds will be held until you confirm delivery of your item.
        </Text>
      </View>

      {/* Pay Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.payButton,
            { backgroundColor: status === 'processing' || applyingCoins ? colors.surface : colors.accent },
          ]}
          onPress={handlePayment}
          disabled={status === 'processing' || applyingCoins}
        >
          {status === 'processing' || applyingCoins ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="card" size={20} color="#FFFFFF" />
              <Text style={styles.payButtonText}>
                Pay {formatPrice(getCurrentTotal())}
              </Text>
            </>
          )}
        </TouchableOpacity>
        {coinsToApply > 0 && coinPreview?.valid && (
          <Text style={[styles.coinApplyNote, { color: colors.textMuted }]}>
            {coinsToApply} Gold Coins will be applied
          </Text>
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
    padding: SPACING.xl,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONTS.sizes.md,
  },
  errorTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: 'bold',
    marginTop: SPACING.lg,
  },
  errorMessage: {
    fontSize: FONTS.sizes.md,
    textAlign: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  retryButton: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.md,
    fontWeight: 'bold',
  },
  cancelButton: {
    marginTop: SPACING.md,
    padding: SPACING.md,
  },
  cancelButtonText: {
    fontSize: FONTS.sizes.md,
  },
  successIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  successTitle: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: 'bold',
    marginBottom: SPACING.sm,
  },
  successMessage: {
    fontSize: FONTS.sizes.md,
    textAlign: 'center',
    lineHeight: 24,
  },
  itemCard: {
    flexDirection: 'row',
    margin: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  itemImage: {
    width: 100,
    height: 100,
  },
  itemDetails: {
    flex: 1,
    padding: SPACING.md,
  },
  itemTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  itemBrand: {
    fontSize: FONTS.sizes.sm,
  },
  itemSize: {
    fontSize: FONTS.sizes.sm,
    marginTop: SPACING.xs,
  },
  curatorName: {
    fontSize: FONTS.sizes.sm,
    marginTop: SPACING.sm,
  },
  summaryCard: {
    margin: SPACING.lg,
    marginTop: 0,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
  },
  summaryTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
    marginBottom: SPACING.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  summaryLabel: {
    fontSize: FONTS.sizes.md,
  },
  summaryValue: {
    fontSize: FONTS.sizes.md,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    marginVertical: SPACING.sm,
  },
  totalLabel: {
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: FONTS.sizes.xl,
    fontWeight: 'bold',
  },
  paymentInfo: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  secureText: {
    fontSize: FONTS.sizes.sm,
  },
  infoText: {
    fontSize: FONTS.sizes.sm,
    lineHeight: 20,
  },
  buttonContainer: {
    padding: SPACING.lg,
    marginTop: 'auto',
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  payButtonText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
  },
  coinApplyNote: {
    fontSize: FONTS.sizes.sm,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  coinsSection: {
    paddingVertical: SPACING.md,
  },
  coinsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  coinsTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  coinsBalance: {
    fontSize: FONTS.sizes.sm,
  },
  sliderContainer: {
    marginVertical: SPACING.sm,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: -SPACING.xs,
  },
  sliderLabel: {
    fontSize: FONTS.sizes.xs,
  },
  sliderValue: {
    fontSize: FONTS.sizes.md,
    fontWeight: 'bold',
  },
  discountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    marginTop: SPACING.sm,
  },
  discountLabel: {
    fontSize: FONTS.sizes.md,
    fontWeight: '500',
  },
  discountValue: {
    fontSize: FONTS.sizes.md,
    fontWeight: 'bold',
  },
  errorText: {
    fontSize: FONTS.sizes.sm,
    marginTop: SPACING.sm,
  },
  savingsText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
});
