import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { purseService, PurseBalance as PurseBalanceType } from '@/services/purse';
import { useThemeColors } from '@/hooks';
import { SPACING, FONTS, BORDER_RADIUS } from '@/constants';

interface Props {
  compact?: boolean;
  showValue?: boolean;
  onPress?: () => void;
}

export default function PurseBalance({ compact = false, showValue = true, onPress }: Props) {
  const colors = useThemeColors();

  const { data: balance, isLoading } = useQuery<PurseBalanceType>({
    queryKey: ['purse-balance'],
    queryFn: () => purseService.getBalance(),
  });

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push('/purse');
    }
  };

  if (isLoading || !balance) {
    return null;
  }

  if (compact) {
    return (
      <TouchableOpacity
        style={[styles.compactContainer, { backgroundColor: colors.surface }]}
        onPress={handlePress}
      >
        <Text style={styles.coinEmoji}>🪙</Text>
        <Text style={[styles.compactCoins, { color: colors.text }]}>
          {balance.coins} GC
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.surface }]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Text style={styles.coinEmoji}>🪙</Text>
        </View>
        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: colors.text }]}>My Purse</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Gold Standard Value
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </View>

      <View style={styles.balanceContainer}>
        <Text style={[styles.coinsText, { color: colors.accent }]}>
          {balance.coins} GC
        </Text>
        {showValue && (
          <Text style={[styles.valueText, { color: colors.textSecondary }]}>
            {balance.valueFormatted}
          </Text>
        )}
      </View>

      {balance.coins > 0 && (
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <Text style={[styles.footerText, { color: colors.textMuted }]}>
            Use coins at checkout for discounts
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.sm,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coinEmoji: {
    fontSize: 24,
  },
  titleContainer: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  title: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: FONTS.sizes.sm,
  },
  balanceContainer: {
    marginTop: SPACING.md,
    alignItems: 'center',
  },
  coinsText: {
    fontSize: FONTS.sizes.xxxl,
    fontWeight: 'bold',
  },
  valueText: {
    fontSize: FONTS.sizes.lg,
    marginTop: SPACING.xs,
  },
  compactCoins: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  footer: {
    borderTopWidth: 1,
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    alignItems: 'center',
  },
  footerText: {
    fontSize: FONTS.sizes.sm,
  },
});
