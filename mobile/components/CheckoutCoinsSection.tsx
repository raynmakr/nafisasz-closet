import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { purseService, PurseBalance, CoinPreview } from '@/services/purse';
import { useThemeColors } from '@/hooks';
import { SPACING, FONTS, BORDER_RADIUS } from '@/constants';

interface Props {
  listingId: string;
  itemPrice: number;
  onCoinsApplied: (coinsUsed: number, discount: number, finalPrice: number) => void;
}

export default function CheckoutCoinsSection({ listingId, itemPrice, onCoinsApplied }: Props) {
  const colors = useThemeColors();
  const [coinsToApply, setCoinsToApply] = useState(0);
  const [expanded, setExpanded] = useState(false);

  const { data: balance, isLoading: balanceLoading } = useQuery<PurseBalance>({
    queryKey: ['purse-balance'],
    queryFn: () => purseService.getBalance(),
  });

  const { data: preview, isLoading: previewLoading } = useQuery<CoinPreview>({
    queryKey: ['coin-preview', listingId, coinsToApply],
    queryFn: () => purseService.getCoinPreview(listingId, coinsToApply),
    enabled: expanded && coinsToApply > 0,
  });

  // Notify parent when coins are applied
  useEffect(() => {
    if (preview?.valid && coinsToApply > 0) {
      onCoinsApplied(preview.coinsUsed, preview.discount, preview.finalPrice);
    } else {
      onCoinsApplied(0, 0, itemPrice);
    }
  }, [preview, coinsToApply, itemPrice]);

  if (balanceLoading) {
    return null;
  }

  if (!balance || balance.coins < 2) {
    // Need at least 2 coins to redeem
    return null;
  }

  const maxApplicable = Math.min(
    balance.coins,
    Math.floor((itemPrice * 0.5) / balance.coinValue)
  );

  if (maxApplicable < 2) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.8}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.coinEmoji}>🪙</Text>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>Use Gold Coins</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              You have {balance.coins} GC ({balance.valueFormatted})
            </Text>
          </View>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={24}
          color={colors.textMuted}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.content}>
          <View style={styles.sliderSection}>
            <View style={styles.sliderHeader}>
              <Text style={[styles.sliderLabel, { color: colors.textSecondary }]}>
                Apply coins:
              </Text>
              <View style={styles.coinsInput}>
                <TextInput
                  style={[
                    styles.coinsTextInput,
                    { color: colors.text, borderColor: colors.border },
                  ]}
                  value={String(coinsToApply)}
                  onChangeText={(text) => {
                    const num = parseInt(text, 10) || 0;
                    setCoinsToApply(Math.min(num, maxApplicable));
                  }}
                  keyboardType="number-pad"
                  maxLength={3}
                />
                <Text style={[styles.gcLabel, { color: colors.textMuted }]}>GC</Text>
              </View>
            </View>

            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={maxApplicable}
              step={1}
              value={coinsToApply}
              onValueChange={(value) => setCoinsToApply(Math.round(value))}
              minimumTrackTintColor={colors.accent}
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.accent}
            />

            <View style={styles.sliderLabels}>
              <Text style={[styles.sliderLabelText, { color: colors.textMuted }]}>0</Text>
              <Text style={[styles.sliderLabelText, { color: colors.textMuted }]}>
                Max: {maxApplicable} GC
              </Text>
            </View>
          </View>

          {coinsToApply >= 2 && (
            <View style={[styles.previewCard, { backgroundColor: colors.background }]}>
              {previewLoading ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : preview?.valid ? (
                <>
                  <View style={styles.previewRow}>
                    <Text style={[styles.previewLabel, { color: colors.textMuted }]}>
                      Discount
                    </Text>
                    <Text style={[styles.discountValue, { color: colors.accent }]}>
                      -{preview.discountFormatted}
                    </Text>
                  </View>
                  <View style={[styles.previewRow, styles.finalRow]}>
                    <Text style={[styles.finalLabel, { color: colors.text }]}>
                      New Total
                    </Text>
                    <Text style={[styles.finalValue, { color: colors.text }]}>
                      {preview.finalPriceFormatted}
                    </Text>
                  </View>
                  {preview.savingsText && (
                    <Text style={[styles.savingsText, { color: colors.accent }]}>
                      {preview.savingsText}
                    </Text>
                  )}
                </>
              ) : preview?.error ? (
                <Text style={[styles.errorText, { color: colors.error }]}>
                  {preview.error}
                </Text>
              ) : null}
            </View>
          )}

          {coinsToApply > 0 && coinsToApply < 2 && (
            <Text style={[styles.minWarning, { color: colors.textMuted }]}>
              Minimum 2 GC required to apply discount
            </Text>
          )}

          <View style={styles.quickButtons}>
            {[2, 5, 10, maxApplicable].filter((v, i, a) => a.indexOf(v) === i && v <= maxApplicable && v >= 2).map((qty) => (
              <TouchableOpacity
                key={qty}
                style={[
                  styles.quickButton,
                  { borderColor: colors.border },
                  coinsToApply === qty && { backgroundColor: colors.accent, borderColor: colors.accent },
                ]}
                onPress={() => setCoinsToApply(qty)}
              >
                <Text
                  style={[
                    styles.quickButtonText,
                    { color: coinsToApply === qty ? '#FFFFFF' : colors.text },
                  ]}
                >
                  {qty === maxApplicable ? 'Max' : qty} GC
                </Text>
              </TouchableOpacity>
            ))}
            {coinsToApply > 0 && (
              <TouchableOpacity
                style={[styles.clearButton, { borderColor: colors.border }]}
                onPress={() => setCoinsToApply(0)}
              >
                <Ionicons name="close" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  coinEmoji: {
    fontSize: 28,
  },
  title: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: FONTS.sizes.sm,
  },
  content: {
    padding: SPACING.md,
    paddingTop: 0,
  },
  sliderSection: {
    marginBottom: SPACING.md,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  sliderLabel: {
    fontSize: FONTS.sizes.sm,
  },
  coinsInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  coinsTextInput: {
    width: 60,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.xs,
    textAlign: 'center',
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  gcLabel: {
    fontSize: FONTS.sizes.sm,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderLabelText: {
    fontSize: FONTS.sizes.xs,
  },
  previewCard: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewLabel: {
    fontSize: FONTS.sizes.sm,
  },
  discountValue: {
    fontSize: FONTS.sizes.md,
    fontWeight: 'bold',
  },
  finalRow: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  finalLabel: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  finalValue: {
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
  },
  savingsText: {
    textAlign: 'center',
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    marginTop: SPACING.sm,
  },
  errorText: {
    fontSize: FONTS.sizes.sm,
    textAlign: 'center',
  },
  minWarning: {
    fontSize: FONTS.sizes.sm,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  quickButtons: {
    flexDirection: 'row',
    gap: SPACING.xs,
    flexWrap: 'wrap',
  },
  quickButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  quickButtonText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
  },
  clearButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
