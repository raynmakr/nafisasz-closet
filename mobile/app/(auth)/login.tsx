import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Platform,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuth } from '../../src/context/AuthContext';
import { useThemeColors } from '@/hooks';
import { SPACING, FONTS, BORDER_RADIUS } from '@/constants';
import { invitationService } from '@/services/invitation';

export default function LoginScreen() {
  const colors = useThemeColors();
  const { signInWithApple, canUseAppleAuth, isLoading, isAuthenticated, user, pendingInvitationCode, setInvitationCode } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);
  const [invitationCode, setLocalInvitationCode] = useState('');
  const [inviterName, setInviterName] = useState<string | null>(null);
  const [validatingCode, setValidatingCode] = useState(false);

  // Check Apple auth availability
  useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setAppleAuthAvailable);
    }
  }, []);

  // Pre-populate invitation code if available from deep link
  useEffect(() => {
    if (pendingInvitationCode) {
      setLocalInvitationCode(pendingInvitationCode);
      validateCode(pendingInvitationCode);
    }
  }, [pendingInvitationCode]);

  // Navigate when authentication succeeds
  useEffect(() => {
    if (isAuthenticated && user) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, user]);

  const validateCode = async (code: string) => {
    if (!code || code.length < 6) {
      setInviterName(null);
      return;
    }

    try {
      setValidatingCode(true);
      const result = await invitationService.validateCode(code.toUpperCase());
      if (result.valid && result.inviter) {
        setInviterName(result.inviter.name);
      } else {
        setInviterName(null);
      }
    } catch {
      setInviterName(null);
    } finally {
      setValidatingCode(false);
    }
  };

  const handleCodeChange = (text: string) => {
    const formatted = text.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 8);
    setLocalInvitationCode(formatted);
    if (formatted.length >= 6) {
      validateCode(formatted);
    } else {
      setInviterName(null);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      setSigningIn(true);
      // Save invitation code before signin
      if (invitationCode) {
        await setInvitationCode(invitationCode);
      }
      const user = await signInWithApple(invitationCode || null);
      if (!user) {
        setSigningIn(false); // User cancelled
      }
    } catch (error: any) {
      Alert.alert('Sign In Failed', error.message || 'Could not sign in with Apple');
      setSigningIn(false);
    }
  };

  const isDisabled = isLoading || signingIn;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Nafisa's Closet</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Discover unique luxury fashion from curators worldwide
          </Text>
        </View>

        {/* Invitation Code Input */}
        <View style={styles.inviteSection}>
          <Text style={[styles.inviteLabel, { color: colors.textSecondary }]}>
            Have an invitation code?
          </Text>
          <View style={styles.inviteInputContainer}>
            <TextInput
              style={[
                styles.inviteInput,
                {
                  backgroundColor: colors.surface,
                  color: colors.text,
                  borderColor: inviterName ? colors.accent : colors.border,
                }
              ]}
              placeholder="Enter code (optional)"
              placeholderTextColor={colors.textMuted}
              value={invitationCode}
              onChangeText={handleCodeChange}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={8}
            />
          </View>
          {inviterName && (
            <Text style={[styles.inviterText, { color: colors.accent }]}>
              Invited by {inviterName}
            </Text>
          )}
        </View>

        <View style={styles.buttonContainer}>
          {/* Apple Sign In (iOS only) */}
          {canUseAppleAuth && appleAuthAvailable && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={BORDER_RADIUS.md}
              style={styles.appleButton}
              onPress={handleAppleSignIn}
            />
          )}

          {/* Fallback for non-iOS or if Apple auth not available */}
          {(!canUseAppleAuth || !appleAuthAvailable) && (
            <Text style={[styles.fallbackText, { color: colors.textMuted }]}>
              Sign in is currently only available on iOS devices
            </Text>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={[styles.termsText, { color: colors.textMuted }]}>
            By continuing, you agree to our{' '}
            <Text style={[styles.termsLink, { color: colors.accent }]}>Terms of Service</Text>
            {' '}and{' '}
            <Text style={[styles.termsLink, { color: colors.accent }]}>Privacy Policy</Text>
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
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl * 2,
  },
  title: {
    fontSize: FONTS.sizes.xxxl,
    fontWeight: 'bold',
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FONTS.sizes.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  inviteSection: {
    marginBottom: SPACING.xl,
    alignItems: 'center',
  },
  inviteLabel: {
    fontSize: FONTS.sizes.sm,
    marginBottom: SPACING.sm,
  },
  inviteInputContainer: {
    width: '100%',
    maxWidth: 200,
  },
  inviteInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    fontSize: FONTS.sizes.lg,
    textAlign: 'center',
    letterSpacing: 2,
    fontWeight: '600',
  },
  inviterText: {
    fontSize: FONTS.sizes.sm,
    marginTop: SPACING.xs,
    fontWeight: '500',
  },
  buttonContainer: {
    gap: SPACING.md,
    alignItems: 'center',
  },
  appleButton: {
    height: 56,
    width: '100%',
  },
  fallbackText: {
    fontSize: FONTS.sizes.md,
    textAlign: 'center',
  },
  footer: {
    marginTop: SPACING.xl * 2,
    paddingHorizontal: SPACING.md,
  },
  termsText: {
    fontSize: FONTS.sizes.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  termsLink: {
    fontWeight: '500',
  },
});
