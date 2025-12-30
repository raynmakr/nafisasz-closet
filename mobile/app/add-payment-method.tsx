import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { stripeService, SavedPaymentMethod } from '@/services/stripe';
import { useThemeColors } from '@/hooks';
import { SPACING, FONTS, BORDER_RADIUS } from '@/constants';
import ExpoGoPaymentNotice from '@/components/ExpoGoPaymentNotice';

// Check if running in Expo Go
const isExpoGo = Constants.appOwnership === 'expo';

// Conditionally import Stripe components
let useStripe: any = null;
let CardField: any = null;

if (!isExpoGo) {
  try {
    const stripe = require('@stripe/stripe-react-native');
    useStripe = stripe.useStripe;
    CardField = stripe.CardField;
  } catch (e) {
    console.warn('Stripe not available');
  }
}

type ScreenStatus = 'loading' | 'ready' | 'saving' | 'success' | 'error';

export default function AddPaymentMethodScreen() {
  // Show notice if in Expo Go or Stripe not available
  if (isExpoGo || !useStripe || !CardField) {
    return <ExpoGoPaymentNotice />;
  }

  return <AddPaymentMethodContent />;
}

function AddPaymentMethodContent() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const colors = useThemeColors();
  const { confirmSetupIntent } = useStripe!();

  const [status, setStatus] = useState<ScreenStatus>('loading');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [cardComplete, setCardComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeSetup();
  }, []);

  const initializeSetup = async () => {
    try {
      setStatus('loading');
      setError(null);

      const result = await stripeService.createSetupIntent();
      setClientSecret(result.clientSecret);
      setStatus('ready');
    } catch (err: any) {
      console.error('Setup intent error:', err);
      setError(err.message || 'Failed to initialize');
      setStatus('error');
    }
  };

  const handleSaveCard = async () => {
    if (!clientSecret || !cardComplete) return;

    try {
      setStatus('saving');

      const { setupIntent, error: confirmError } = await confirmSetupIntent(clientSecret, {
        paymentMethodType: 'Card',
      });

      if (confirmError) {
        throw new Error(confirmError.message);
      }

      if (!setupIntent?.paymentMethodId) {
        throw new Error('No payment method returned');
      }

      // Confirm with backend
      await stripeService.confirmPaymentMethod(setupIntent.paymentMethodId);

      setStatus('success');

      // Show success and navigate back
      setTimeout(() => {
        if (returnTo) {
          router.replace(returnTo as any);
        } else {
          router.back();
        }
      }, 1500);
    } catch (err: any) {
      console.error('Save card error:', err);
      setError(err.message || 'Failed to save card');
      setStatus('error');
    }
  };

  if (status === 'loading') {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>
          Setting up...
        </Text>
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
          Card Saved!
        </Text>
        <Text style={[styles.successMessage, { color: colors.textMuted }]}>
          You can now place claims on items.
        </Text>
      </View>
    );
  }

  if (status === 'error' && !clientSecret) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle" size={64} color={colors.error} />
        <Text style={[styles.errorTitle, { color: colors.text }]}>
          Setup Error
        </Text>
        <Text style={[styles.errorMessage, { color: colors.textMuted }]}>
          {error}
        </Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: colors.accent }]}
          onPress={initializeSetup}
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Add Payment Method</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        {/* Info Card */}
        <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
          <Ionicons name="shield-checkmark" size={24} color={colors.accent} />
          <View style={styles.infoContent}>
            <Text style={[styles.infoTitle, { color: colors.text }]}>
              Secure Payment
            </Text>
            <Text style={[styles.infoText, { color: colors.textMuted }]}>
              Your card will only be charged if you win a claim. Card details are securely stored by Stripe.
            </Text>
          </View>
        </View>

        {/* Card Input */}
        <View style={styles.cardSection}>
          <Text style={[styles.label, { color: colors.text }]}>Card Details</Text>
          <View style={[styles.cardFieldContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <CardField
              postalCodeEnabled={true}
              placeholders={{
                number: '4242 4242 4242 4242',
              }}
              cardStyle={{
                backgroundColor: colors.surface,
                textColor: colors.text,
                placeholderColor: colors.textMuted,
              }}
              style={styles.cardField}
              onCardChange={(details) => {
                setCardComplete(details.complete);
                if (error) setError(null);
              }}
            />
          </View>
          {error && status === 'error' && (
            <Text style={[styles.errorText, { color: colors.error }]}>
              {error}
            </Text>
          )}
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[
            styles.saveButton,
            { backgroundColor: cardComplete ? colors.accent : colors.surface },
          ]}
          onPress={handleSaveCard}
          disabled={!cardComplete || status === 'saving'}
        >
          {status === 'saving' ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons
                name="card"
                size={20}
                color={cardComplete ? '#FFFFFF' : colors.textMuted}
              />
              <Text
                style={[
                  styles.saveButtonText,
                  { color: cardComplete ? '#FFFFFF' : colors.textMuted },
                ]}
              >
                Save Card
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Test Card Info */}
        <View style={[styles.testInfo, { borderColor: colors.border }]}>
          <Text style={[styles.testInfoTitle, { color: colors.textMuted }]}>
            Test Mode
          </Text>
          <Text style={[styles.testInfoText, { color: colors.textMuted }]}>
            Use card: 4242 4242 4242 4242{'\n'}
            Any future date, any CVC, any ZIP
          </Text>
        </View>
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
  headerTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: SPACING.lg,
  },
  infoCard: {
    flexDirection: 'row',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  infoText: {
    fontSize: FONTS.sizes.sm,
    lineHeight: 20,
  },
  cardSection: {
    marginBottom: SPACING.xl,
  },
  label: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    marginBottom: SPACING.sm,
  },
  cardFieldContainer: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  cardField: {
    width: '100%',
    height: 50,
  },
  errorText: {
    fontSize: FONTS.sizes.sm,
    marginTop: SPACING.sm,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  saveButtonText: {
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
  },
  testInfo: {
    marginTop: SPACING.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    borderStyle: 'dashed',
  },
  testInfoTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  testInfoText: {
    fontSize: FONTS.sizes.xs,
    lineHeight: 18,
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
});
