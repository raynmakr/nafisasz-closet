import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks';
import { SPACING, FONTS, BORDER_RADIUS } from '@/constants';

export default function ExpoGoPaymentNotice() {
  const colors = useThemeColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Ionicons name="build-outline" size={64} color={colors.accent} />
        <Text style={[styles.title, { color: colors.text }]}>
          Development Build Required
        </Text>
        <Text style={[styles.message, { color: colors.textMuted }]}>
          Payment features require a development build and are not available in Expo Go.
        </Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          To test payments, run:{'\n'}
          <Text style={styles.code}>npx expo run:ios</Text>
        </Text>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.accent }]}
          onPress={() => router.back()}
        >
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  card: {
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    maxWidth: 320,
  },
  title: {
    fontSize: FONTS.sizes.xl,
    fontWeight: 'bold',
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  message: {
    fontSize: FONTS.sizes.md,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: SPACING.lg,
  },
  hint: {
    fontSize: FONTS.sizes.sm,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.xl,
  },
  code: {
    fontFamily: 'Courier',
    fontWeight: 'bold',
  },
  button: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.md,
    fontWeight: 'bold',
  },
});
