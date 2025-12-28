import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { purseService, PurseBalance, GiftingLimits } from '@/services/purse';
import { useThemeColors } from '@/hooks';
import { SPACING, FONTS, BORDER_RADIUS } from '@/constants';

export default function GiftCoinsScreen() {
  const colors = useThemeColors();
  const queryClient = useQueryClient();
  const [recipientEmail, setRecipientEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const { data: balance } = useQuery<PurseBalance>({
    queryKey: ['purse-balance'],
    queryFn: () => purseService.getBalance(),
  });

  const { data: limits } = useQuery<GiftingLimits>({
    queryKey: ['purse-limits'],
    queryFn: () => purseService.getGiftingLimits(),
  });

  const amountNum = parseInt(amount, 10) || 0;
  const coinValue = balance ? amountNum * balance.coinValue : 0;

  const canSend = () => {
    if (!balance || !limits) return false;
    if (amountNum < 1 || amountNum > 11) return false;
    if (amountNum > balance.coins) return false;
    if (limits.giftsRemaining <= 0) return false;
    if (limits.amountRemaining < amountNum) return false;
    if (!recipientEmail.trim()) return false;
    return true;
  };

  const handleSend = async () => {
    if (!canSend() || sending) return;

    setSending(true);
    try {
      // For now, we'd need to look up the recipient by email
      // This would require an API endpoint to find user by email
      // For MVP, let's show a message about this limitation

      Alert.alert(
        'Coming Soon',
        'Gifting by email is coming soon! For now, you can gift coins to users you follow.',
        [{ text: 'OK' }]
      );

      // In full implementation:
      // const result = await purseService.createGift(recipientId, amountNum, message);
      // queryClient.invalidateQueries({ queryKey: ['purse-balance'] });
      // queryClient.invalidateQueries({ queryKey: ['purse-limits'] });
      // Alert.alert('Success', `Sent ${amountNum} GC to ${recipientEmail}!`);
      // router.back();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send gift');
    } finally {
      setSending(false);
    }
  };

  const quickAmounts = [1, 3, 5, 11];

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Gift Gold Coins</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Balance Info */}
        <View style={[styles.balanceCard, { backgroundColor: colors.surface }]}>
          <View style={styles.balanceRow}>
            <Text style={[styles.balanceLabel, { color: colors.textMuted }]}>Your Balance</Text>
            <Text style={[styles.balanceValue, { color: colors.accent }]}>
              {balance?.coins || 0} GC
            </Text>
          </View>
          <View style={[styles.limitsRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.limitsText, { color: colors.textMuted }]}>
              Gifts remaining this month: {limits?.giftsRemaining || 0}/5
            </Text>
            <Text style={[styles.limitsText, { color: colors.textMuted }]}>
              Amount remaining: {limits?.amountRemaining || 0}/55 GC
            </Text>
          </View>
        </View>

        {/* Recipient */}
        <Text style={[styles.label, { color: colors.text }]}>Recipient</Text>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border },
          ]}
          placeholder="Enter recipient's email"
          placeholderTextColor={colors.textMuted}
          value={recipientEmail}
          onChangeText={setRecipientEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        {/* Amount */}
        <Text style={[styles.label, { color: colors.text }]}>Amount (1-11 GC)</Text>
        <View style={styles.amountSection}>
          <View style={styles.quickAmounts}>
            {quickAmounts.map((qty) => (
              <TouchableOpacity
                key={qty}
                style={[
                  styles.quickAmountButton,
                  { borderColor: colors.border },
                  amountNum === qty && { backgroundColor: colors.accent, borderColor: colors.accent },
                ]}
                onPress={() => setAmount(String(qty))}
                disabled={qty > (balance?.coins || 0)}
              >
                <Text
                  style={[
                    styles.quickAmountText,
                    { color: amountNum === qty ? '#FFFFFF' : colors.text },
                    qty > (balance?.coins || 0) && { color: colors.textMuted },
                  ]}
                >
                  {qty} GC
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={[
              styles.amountInput,
              { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border },
            ]}
            placeholder="Custom"
            placeholderTextColor={colors.textMuted}
            value={amount}
            onChangeText={(text) => {
              const num = parseInt(text, 10);
              if (text === '' || (num >= 0 && num <= 11)) {
                setAmount(text);
              }
            }}
            keyboardType="number-pad"
            maxLength={2}
          />
        </View>
        {amountNum > 0 && (
          <Text style={[styles.valueText, { color: colors.textSecondary }]}>
            Value: {balance?.symbol || '$'}{coinValue.toFixed(2)}
          </Text>
        )}

        {/* Message */}
        <Text style={[styles.label, { color: colors.text }]}>Message (optional)</Text>
        <TextInput
          style={[
            styles.messageInput,
            { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border },
          ]}
          placeholder="Add a personal message..."
          placeholderTextColor={colors.textMuted}
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={200}
        />
        <Text style={[styles.charCount, { color: colors.textMuted }]}>
          {message.length}/200
        </Text>

        {/* Info */}
        <View style={[styles.infoBox, { backgroundColor: colors.surface }]}>
          <Ionicons name="information-circle-outline" size={20} color={colors.textMuted} />
          <Text style={[styles.infoText, { color: colors.textMuted }]}>
            Gift cards expire after 30 days if not claimed. Recipients receive a notification
            when you send a gift.
          </Text>
        </View>

        {/* Send Button */}
        <TouchableOpacity
          style={[
            styles.sendButton,
            { backgroundColor: canSend() ? colors.accent : colors.surface },
          ]}
          onPress={handleSend}
          disabled={!canSend() || sending}
        >
          {sending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="gift" size={20} color={canSend() ? '#FFFFFF' : colors.textMuted} />
              <Text
                style={[styles.sendButtonText, { color: canSend() ? '#FFFFFF' : colors.textMuted }]}
              >
                Send Gift
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  balanceCard: {
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: FONTS.sizes.md,
  },
  balanceValue: {
    fontSize: FONTS.sizes.xl,
    fontWeight: 'bold',
  },
  limitsRow: {
    borderTopWidth: 1,
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    gap: SPACING.xs,
  },
  limitsText: {
    fontSize: FONTS.sizes.sm,
  },
  label: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    marginTop: SPACING.sm,
  },
  input: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: FONTS.sizes.md,
  },
  amountSection: {
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'center',
  },
  quickAmounts: {
    flexDirection: 'row',
    gap: SPACING.xs,
    flex: 1,
  },
  quickAmountButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  quickAmountText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
  },
  amountInput: {
    width: 80,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    fontSize: FONTS.sizes.md,
    textAlign: 'center',
  },
  valueText: {
    fontSize: FONTS.sizes.sm,
    marginTop: -SPACING.xs,
  },
  messageInput: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: FONTS.sizes.md,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: FONTS.sizes.xs,
    textAlign: 'right',
    marginTop: -SPACING.xs,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  infoText: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    lineHeight: 20,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.md,
  },
  sendButtonText: {
    fontSize: FONTS.sizes.md,
    fontWeight: 'bold',
  },
});
