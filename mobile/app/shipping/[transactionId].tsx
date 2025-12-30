import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks';
import { SPACING, FONTS, BORDER_RADIUS } from '@/constants';
import { shippingService, ShippingRate, PackageDimensions } from '@/services/shipping';

type ShippingStep = 'dimensions' | 'rates' | 'label';

export default function ShippingScreen() {
  const { transactionId } = useLocalSearchParams<{ transactionId: string }>();
  const colors = useThemeColors();

  const [step, setStep] = useState<ShippingStep>('dimensions');
  const [loading, setLoading] = useState(false);
  const [rates, setRates] = useState<ShippingRate[]>([]);
  const [selectedRate, setSelectedRate] = useState<ShippingRate | null>(null);
  const [label, setLabel] = useState<{
    labelUrl: string;
    trackingNumber: string;
    trackingUrl: string;
    carrier: string;
    service: string;
    cost: number;
  } | null>(null);

  // Package dimensions
  const [weight, setWeight] = useState('1');
  const [length, setLength] = useState('10');
  const [width, setWidth] = useState('8');
  const [height, setHeight] = useState('4');

  const parcel: PackageDimensions = {
    weight: parseFloat(weight) || 1,
    length: parseFloat(length) || 10,
    width: parseFloat(width) || 8,
    height: parseFloat(height) || 4,
  };

  const handleGetRates = async () => {
    if (!weight || !length || !width || !height) {
      Alert.alert('Error', 'Please fill in all package dimensions');
      return;
    }

    setLoading(true);
    try {
      const result = await shippingService.getRates(parseInt(transactionId!), parcel);
      setRates(result.rates);
      setStep('rates');
    } catch (error: any) {
      const msg = error.message || 'Failed to get shipping rates';

      // Check for address-related errors and provide helpful navigation
      if (msg.includes('address') || msg.includes('Address')) {
        Alert.alert(
          'Shipping Address Required',
          msg.includes('Curator')
            ? 'Please add your shipping address first.'
            : 'The buyer has not added a shipping address yet. Please wait for them to add one.',
          [
            { text: 'Cancel', style: 'cancel' },
            ...(msg.includes('Curator') ? [{
              text: 'Add Address',
              onPress: () => router.push('/addresses'),
            }] : []),
          ]
        );
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePurchaseLabel = async () => {
    if (!selectedRate) {
      Alert.alert('Error', 'Please select a shipping rate');
      return;
    }

    Alert.alert(
      'Confirm Purchase',
      `Purchase ${selectedRate.carrierFormatted} ${selectedRate.service} label for $${selectedRate.amount.toFixed(2)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Purchase',
          onPress: async () => {
            setLoading(true);
            try {
              const result = await shippingService.purchaseLabel(
                parseInt(transactionId!),
                selectedRate.id,
                parcel
              );
              setLabel(result.label);
              setStep('label');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to purchase label');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleOpenLabel = () => {
    if (label?.labelUrl) {
      Linking.openURL(label.labelUrl);
    }
  };

  const handleDone = () => {
    router.back();
  };

  const renderDimensionsStep = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>Package Details</Text>
      <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
        Enter your package dimensions to get shipping rates.
      </Text>

      <View style={styles.dimensionRow}>
        <View style={styles.dimensionField}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Weight (lb)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
            placeholder="1"
            placeholderTextColor={colors.textMuted}
          />
        </View>
      </View>

      <View style={styles.dimensionRow}>
        <View style={styles.dimensionField}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Length (in)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            value={length}
            onChangeText={setLength}
            keyboardType="decimal-pad"
            placeholder="10"
            placeholderTextColor={colors.textMuted}
          />
        </View>
        <View style={styles.dimensionField}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Width (in)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            value={width}
            onChangeText={setWidth}
            keyboardType="decimal-pad"
            placeholder="8"
            placeholderTextColor={colors.textMuted}
          />
        </View>
        <View style={styles.dimensionField}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Height (in)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            value={height}
            onChangeText={setHeight}
            keyboardType="decimal-pad"
            placeholder="4"
            placeholderTextColor={colors.textMuted}
          />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: colors.accent }]}
        onPress={handleGetRates}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.primaryButtonText}>Get Shipping Rates</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderRatesStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.stepHeader}>
        <TouchableOpacity onPress={() => setStep('dimensions')}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: SPACING.md }}>
          <Text style={[styles.stepTitle, { color: colors.text }]}>Select Carrier</Text>
          <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
            Choose a shipping option for your package.
          </Text>
        </View>
      </View>

      <ScrollView style={styles.ratesList}>
        {rates.map((rate) => (
          <TouchableOpacity
            key={rate.id}
            style={[
              styles.rateCard,
              {
                backgroundColor: colors.surface,
                borderColor: selectedRate?.id === rate.id ? colors.accent : colors.border,
                borderWidth: selectedRate?.id === rate.id ? 2 : 1,
              },
            ]}
            onPress={() => setSelectedRate(rate)}
          >
            <View style={styles.rateLeft}>
              <Text style={[styles.carrierName, { color: colors.text }]}>
                {rate.carrierFormatted}
              </Text>
              <Text style={[styles.serviceName, { color: colors.textSecondary }]}>
                {rate.service}
              </Text>
              {rate.estimatedDays && (
                <Text style={[styles.deliveryTime, { color: colors.textMuted }]}>
                  {rate.estimatedDays} {rate.estimatedDays === 1 ? 'day' : 'days'}
                </Text>
              )}
            </View>
            <View style={styles.rateRight}>
              <Text style={[styles.rateAmount, { color: colors.accent }]}>
                ${rate.amount.toFixed(2)}
              </Text>
              {selectedRate?.id === rate.id && (
                <Ionicons name="checkmark-circle" size={24} color={colors.accent} />
              )}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {selectedRate && (
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.accent }]}
          onPress={handlePurchaseLabel}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>
              Purchase Label - ${selectedRate.amount.toFixed(2)}
            </Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );

  const renderLabelStep = () => (
    <View style={[styles.stepContent, styles.centeredContent]}>
      <View style={[styles.successIcon, { backgroundColor: `${colors.success}20` }]}>
        <Ionicons name="checkmark-circle" size={64} color={colors.success} />
      </View>

      <Text style={[styles.successTitle, { color: colors.text }]}>
        Label Created!
      </Text>

      <View style={[styles.labelCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.labelRow}>
          <Text style={[styles.labelLabel, { color: colors.textMuted }]}>Carrier</Text>
          <Text style={[styles.labelValue, { color: colors.text }]}>{label?.carrier}</Text>
        </View>
        <View style={styles.labelRow}>
          <Text style={[styles.labelLabel, { color: colors.textMuted }]}>Service</Text>
          <Text style={[styles.labelValue, { color: colors.text }]}>{label?.service}</Text>
        </View>
        <View style={styles.labelRow}>
          <Text style={[styles.labelLabel, { color: colors.textMuted }]}>Tracking Number</Text>
          <Text style={[styles.labelValue, { color: colors.text }]} selectable>
            {label?.trackingNumber}
          </Text>
        </View>
        <View style={styles.labelRow}>
          <Text style={[styles.labelLabel, { color: colors.textMuted }]}>Cost</Text>
          <Text style={[styles.labelValue, { color: colors.accent }]}>
            ${label?.cost.toFixed(2)}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: colors.accent }]}
        onPress={handleOpenLabel}
      >
        <Ionicons name="download-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
        <Text style={styles.primaryButtonText}>Download Label (PDF)</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.secondaryButton, { borderColor: colors.border }]}
        onPress={handleDone}
      >
        <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Done</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Create Shipping Label',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
        }}
      />

      {/* Progress Indicator */}
      <View style={styles.progressBar}>
        <View style={styles.progressStep}>
          <View
            style={[
              styles.progressDot,
              { backgroundColor: colors.accent },
            ]}
          >
            <Text style={styles.progressNumber}>1</Text>
          </View>
          <Text style={[styles.progressLabel, { color: colors.text }]}>Package</Text>
        </View>
        <View style={[styles.progressLine, { backgroundColor: step === 'dimensions' ? colors.border : colors.accent }]} />
        <View style={styles.progressStep}>
          <View
            style={[
              styles.progressDot,
              { backgroundColor: step === 'dimensions' ? colors.border : colors.accent },
            ]}
          >
            <Text style={styles.progressNumber}>2</Text>
          </View>
          <Text style={[styles.progressLabel, { color: step === 'dimensions' ? colors.textMuted : colors.text }]}>
            Carrier
          </Text>
        </View>
        <View style={[styles.progressLine, { backgroundColor: step === 'label' ? colors.accent : colors.border }]} />
        <View style={styles.progressStep}>
          <View
            style={[
              styles.progressDot,
              { backgroundColor: step === 'label' ? colors.accent : colors.border },
            ]}
          >
            <Text style={styles.progressNumber}>3</Text>
          </View>
          <Text style={[styles.progressLabel, { color: step === 'label' ? colors.text : colors.textMuted }]}>
            Label
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {step === 'dimensions' && renderDimensionsStep()}
        {step === 'rates' && renderRatesStep()}
        {step === 'label' && renderLabelStep()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  progressStep: {
    alignItems: 'center',
  },
  progressDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressNumber: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: FONTS.sizes.sm,
  },
  progressLabel: {
    fontSize: FONTS.sizes.xs,
    marginTop: 4,
  },
  progressLine: {
    height: 2,
    width: 50,
    marginHorizontal: SPACING.sm,
  },
  scrollContent: {
    flexGrow: 1,
    padding: SPACING.lg,
  },
  stepContent: {
    flex: 1,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.lg,
  },
  stepTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  stepDescription: {
    fontSize: FONTS.sizes.md,
    marginBottom: SPACING.lg,
  },
  dimensionRow: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
    gap: SPACING.md,
  },
  dimensionField: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: FONTS.sizes.sm,
    marginBottom: SPACING.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: FONTS.sizes.lg,
    textAlign: 'center',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.lg,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: FONTS.sizes.md,
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginTop: SPACING.md,
  },
  secondaryButtonText: {
    fontWeight: '600',
    fontSize: FONTS.sizes.md,
  },
  ratesList: {
    flex: 1,
  },
  rateCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
  },
  rateLeft: {
    flex: 1,
  },
  carrierName: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  serviceName: {
    fontSize: FONTS.sizes.sm,
    marginTop: 2,
  },
  deliveryTime: {
    fontSize: FONTS.sizes.xs,
    marginTop: 4,
  },
  rateRight: {
    alignItems: 'flex-end',
  },
  rateAmount: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    marginBottom: 4,
  },
  centeredContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: SPACING.xxl,
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  successTitle: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: '700',
    marginBottom: SPACING.lg,
  },
  labelCard: {
    width: '100%',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  labelLabel: {
    fontSize: FONTS.sizes.sm,
  },
  labelValue: {
    fontSize: FONTS.sizes.md,
    fontWeight: '500',
    textAlign: 'right',
    flex: 1,
    marginLeft: SPACING.md,
  },
});
