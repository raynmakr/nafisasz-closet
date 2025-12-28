import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  purseService,
  PurseBalance,
  CoinTransaction,
  GiftCard,
  getTransactionEmoji,
  getTransactionColor,
} from '@/services/purse';
import { useThemeColors } from '@/hooks';
import { useAuth } from '@/src/context/AuthContext';
import { SPACING, FONTS, BORDER_RADIUS } from '@/constants';

type TabType = 'history' | 'gifts' | 'earn';

export default function PurseScreen() {
  const colors = useThemeColors();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('history');
  const [refreshing, setRefreshing] = useState(false);

  const { data: balance, isLoading: balanceLoading } = useQuery<PurseBalance>({
    queryKey: ['purse-balance'],
    queryFn: () => purseService.getBalance(),
    enabled: !!user,
  });

  const { data: transactionsData, isLoading: transactionsLoading } = useQuery({
    queryKey: ['purse-transactions'],
    queryFn: () => purseService.getTransactions(1, 50),
    enabled: !!user && activeTab === 'history',
  });

  const { data: giftsData } = useQuery({
    queryKey: ['purse-gifts'],
    queryFn: () => purseService.getPendingGifts(),
    enabled: !!user && activeTab === 'gifts',
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['purse-balance'] }),
      queryClient.invalidateQueries({ queryKey: ['purse-transactions'] }),
      queryClient.invalidateQueries({ queryKey: ['purse-gifts'] }),
    ]);
    setRefreshing(false);
  };

  const handleClaimGift = async (giftCardId: number) => {
    try {
      await purseService.claimGift(giftCardId);
      queryClient.invalidateQueries({ queryKey: ['purse-balance'] });
      queryClient.invalidateQueries({ queryKey: ['purse-gifts'] });
    } catch (error: any) {
      console.error('Failed to claim gift:', error);
    }
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
        size={18}
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

  const renderTransaction = ({ item }: { item: CoinTransaction }) => (
    <View style={[styles.transactionItem, { backgroundColor: colors.surface }]}>
      <View style={styles.transactionLeft}>
        <Text style={styles.transactionEmoji}>{getTransactionEmoji(item.type)}</Text>
        <View style={styles.transactionInfo}>
          <Text style={[styles.transactionDesc, { color: colors.text }]}>
            {item.description}
          </Text>
          <Text style={[styles.transactionDate, { color: colors.textMuted }]}>
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>
      </View>
      <View style={styles.transactionRight}>
        <Text
          style={[
            styles.transactionAmount,
            { color: getTransactionColor(item.type) },
          ]}
        >
          {item.amount > 0 ? '+' : ''}{item.amount} GC
        </Text>
        <Text style={[styles.transactionValue, { color: colors.textMuted }]}>
          {item.valueFormatted}
        </Text>
      </View>
    </View>
  );

  const renderGiftCard = ({ item }: { item: GiftCard }) => (
    <View style={[styles.giftCard, { backgroundColor: colors.surface }]}>
      <View style={styles.giftHeader}>
        <Text style={styles.giftEmoji}>🎁</Text>
        <View style={styles.giftInfo}>
          <Text style={[styles.giftSender, { color: colors.text }]}>
            From {item.senderName}
          </Text>
          <Text style={[styles.giftAmount, { color: colors.accent }]}>
            {item.amount} GC ({item.valueFormatted})
          </Text>
        </View>
      </View>
      {item.message && (
        <Text style={[styles.giftMessage, { color: colors.textSecondary }]}>
          "{item.message}"
        </Text>
      )}
      <View style={styles.giftFooter}>
        <Text style={[styles.giftExpiry, { color: colors.textMuted }]}>
          Expires: {new Date(item.expiresAt).toLocaleDateString()}
        </Text>
        <TouchableOpacity
          style={[styles.claimButton, { backgroundColor: colors.accent }]}
          onPress={() => handleClaimGift(item.id)}
        >
          <Text style={styles.claimButtonText}>Claim</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEarnOpportunity = (
    title: string,
    description: string,
    coins: number,
    completed: boolean,
    onPress?: () => void
  ) => (
    <TouchableOpacity
      style={[
        styles.earnItem,
        { backgroundColor: colors.surface },
        completed && styles.earnItemCompleted,
      ]}
      onPress={onPress}
      disabled={completed}
    >
      <View style={styles.earnLeft}>
        {completed ? (
          <Ionicons name="checkmark-circle" size={24} color={colors.accent} />
        ) : (
          <Text style={styles.earnEmoji}>🪙</Text>
        )}
        <View style={styles.earnInfo}>
          <Text style={[styles.earnTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.earnDesc, { color: colors.textMuted }]}>
            {description}
          </Text>
        </View>
      </View>
      <Text style={[styles.earnCoins, { color: completed ? colors.textMuted : colors.accent }]}>
        +{coins} GC
      </Text>
    </TouchableOpacity>
  );

  if (balanceLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>My Purse</Text>
        <TouchableOpacity onPress={() => router.push('/gift-coins')}>
          <Ionicons name="gift-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Balance Card */}
      <View style={[styles.balanceCard, { backgroundColor: colors.surface }]}>
        <View style={styles.balanceHeader}>
          <Text style={styles.balanceEmoji}>🪙</Text>
          <Text style={[styles.balanceLabel, { color: colors.textMuted }]}>
            Gold Standard Value
          </Text>
        </View>
        <Text style={[styles.balanceCoins, { color: colors.accent }]}>
          {balance?.coins || 0} GC
        </Text>
        <Text style={[styles.balanceValue, { color: colors.text }]}>
          {balance?.valueFormatted || '$0.00'}
        </Text>
        <Text style={[styles.balanceBasis, { color: colors.textMuted }]}>
          {balance?.goldBasisText || 'Based on January 2026 gold prices'}
        </Text>
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        {renderTab('history', 'History', 'time-outline')}
        {renderTab('gifts', 'Gifts', 'gift-outline')}
        {renderTab('earn', 'Earn', 'add-circle-outline')}
      </View>

      {/* Tab Content */}
      {activeTab === 'history' && (
        <FlatList
          data={transactionsData?.transactions || []}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderTransaction}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📜</Text>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Transactions Yet</Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                Earn coins to see your history here
              </Text>
            </View>
          }
        />
      )}

      {activeTab === 'gifts' && (
        <FlatList
          data={giftsData?.gifts || []}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderGiftCard}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🎁</Text>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Pending Gifts</Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                Gift cards from friends will appear here
              </Text>
            </View>
          }
        />
      )}

      {activeTab === 'earn' && (
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
        >
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Wins</Text>
          {renderEarnOpportunity(
            'Complete Profile',
            'Add your name and bio',
            1,
            user?.bio?.trim()?.length > 0
          )}
          {renderEarnOpportunity(
            'Upload Profile Photo',
            'Add a profile picture',
            1,
            !!user?.profile_photo
          )}
          {renderEarnOpportunity(
            'Enable Notifications',
            'Stay updated on deals',
            1,
            false // Would check notification status
          )}

          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: SPACING.lg }]}>
            Milestone Rewards
          </Text>
          {renderEarnOpportunity('First Purchase', 'Complete your first purchase', 2, false)}
          {renderEarnOpportunity('3rd Purchase', 'Loyal customer reward', 3, false)}
          {renderEarnOpportunity('5th Purchase', 'Growing collection', 4, false)}
          {renderEarnOpportunity('10th Purchase', 'VIP shopper status', 7, false)}

          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: SPACING.lg }]}>
            Referral Bonus
          </Text>
          {renderEarnOpportunity(
            'Invite Friends',
            'Earn 11 GC when they make their first purchase',
            11,
            false,
            () => router.push('/invite')
          )}
        </ScrollView>
      )}
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
  balanceCard: {
    marginHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  balanceEmoji: {
    fontSize: 32,
  },
  balanceLabel: {
    fontSize: FONTS.sizes.sm,
  },
  balanceCoins: {
    fontSize: 48,
    fontWeight: 'bold',
    marginTop: SPACING.sm,
  },
  balanceValue: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '600',
    marginTop: SPACING.xs,
  },
  balanceBasis: {
    fontSize: FONTS.sizes.xs,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
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
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
  },
  listContent: {
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  transactionEmoji: {
    fontSize: 24,
    marginRight: SPACING.md,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDesc: {
    fontSize: FONTS.sizes.md,
    fontWeight: '500',
  },
  transactionDate: {
    fontSize: FONTS.sizes.sm,
    marginTop: 2,
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: FONTS.sizes.md,
    fontWeight: 'bold',
  },
  transactionValue: {
    fontSize: FONTS.sizes.sm,
  },
  giftCard: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  giftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  giftEmoji: {
    fontSize: 32,
    marginRight: SPACING.md,
  },
  giftInfo: {
    flex: 1,
  },
  giftSender: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  giftAmount: {
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
  },
  giftMessage: {
    fontStyle: 'italic',
    marginTop: SPACING.sm,
    marginLeft: 48,
  },
  giftFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  giftExpiry: {
    fontSize: FONTS.sizes.sm,
  },
  claimButton: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  claimButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
    marginBottom: SPACING.sm,
  },
  earnItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
  },
  earnItemCompleted: {
    opacity: 0.6,
  },
  earnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  earnEmoji: {
    fontSize: 24,
    marginRight: SPACING.md,
  },
  earnInfo: {
    flex: 1,
  },
  earnTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  earnDesc: {
    fontSize: FONTS.sizes.sm,
    marginTop: 2,
  },
  earnCoins: {
    fontSize: FONTS.sizes.md,
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
  },
  emptyText: {
    fontSize: FONTS.sizes.md,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
});
