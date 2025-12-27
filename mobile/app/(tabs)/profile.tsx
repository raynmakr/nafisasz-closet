import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Share,
  ScrollView,
  Linking,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { useThemeColors } from '@/hooks';
import { SPACING, FONTS, BORDER_RADIUS } from '@/constants';
import { uploadService, stripeService } from '@/services';
import { api } from '@/services/api';
import { invitationService } from '@/services/invitation';
import { InvitationInfo } from '@/types';
import { StripeStatus } from '@/services/stripe';

export default function ProfileScreen() {
  const colors = useThemeColors();
  const { user, signOut, refreshUser } = useAuth();
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showCuratorModal, setShowCuratorModal] = useState(false);
  const [instagramHandle, setInstagramHandle] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Handle edit state
  const [showHandleModal, setShowHandleModal] = useState(false);
  const [newHandle, setNewHandle] = useState('');
  const [handleError, setHandleError] = useState<string | null>(null);
  const [savingHandle, setSavingHandle] = useState(false);

  // Invite state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [invitationInfo, setInvitationInfo] = useState<InvitationInfo | null>(null);
  const [loadingInvitation, setLoadingInvitation] = useState(false);

  // Stripe state
  const [showStripeModal, setShowStripeModal] = useState(false);
  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null);
  const [loadingStripe, setLoadingStripe] = useState(false);
  const [startingOnboarding, setStartingOnboarding] = useState(false);

  const isCurator = user?.role === 'curator' || user?.curator?.approved;

  // Load invitation info on mount
  useEffect(() => {
    loadInvitationInfo();
  }, []);

  // Load Stripe status for curators
  useEffect(() => {
    if (isCurator) {
      loadStripeStatus();
    }
  }, [isCurator]);

  const loadStripeStatus = async () => {
    try {
      setLoadingStripe(true);
      const status = await stripeService.getStatus();
      setStripeStatus(status);
    } catch (error) {
      console.error('Failed to load Stripe status:', error);
    } finally {
      setLoadingStripe(false);
    }
  };

  const handleStripeSetup = async () => {
    if (stripeStatus?.onboardingComplete) {
      // Already set up - show status
      Alert.alert(
        'Payment Setup Complete',
        'Your Stripe account is connected and ready to receive payouts.',
        [{ text: 'OK' }]
      );
      return;
    }
    setShowStripeModal(true);
  };

  const startStripeOnboarding = async () => {
    try {
      setStartingOnboarding(true);
      const result = await stripeService.getOnboardingLink();

      if (result.onboardingComplete) {
        await loadStripeStatus();
        setShowStripeModal(false);
        Alert.alert('Already Complete', 'Your payment setup is already complete!');
        return;
      }

      if (result.onboardingUrl) {
        // Open Stripe onboarding in browser
        const browserResult = await WebBrowser.openBrowserAsync(result.onboardingUrl);

        // After returning from browser, refresh status
        await loadStripeStatus();
        await refreshUser?.();
        setShowStripeModal(false);

        if (stripeStatus?.onboardingComplete) {
          Alert.alert('Success', 'Payment setup complete! You can now receive payouts.');
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to start payment setup');
    } finally {
      setStartingOnboarding(false);
    }
  };

  const loadInvitationInfo = async () => {
    try {
      setLoadingInvitation(true);
      const info = await invitationService.getInvitationInfo();
      setInvitationInfo(info);
    } catch (error) {
      console.error('Failed to load invitation info:', error);
    } finally {
      setLoadingInvitation(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const showComingSoon = (feature: string) => {
    Alert.alert(feature, 'This feature is coming soon!');
  };

  const handlePhotoPress = () => {
    Alert.alert(
      'Update Profile Photo',
      'Choose how you want to update your photo',
      [
        { text: 'Camera', onPress: takePhoto },
        { text: 'Photo Library', onPress: pickImage },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your camera.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (!result.canceled && result.assets[0]) {
      await uploadProfilePhoto(result.assets[0].uri);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (!result.canceled && result.assets[0]) {
      await uploadProfilePhoto(result.assets[0].uri);
    }
  };

  const uploadProfilePhoto = async (uri: string) => {
    setUploadingPhoto(true);
    try {
      const urls = await uploadService.uploadImages([uri]);
      if (urls.length > 0) {
        await api.put('/user/profile', { profilePhoto: urls[0] });
        await refreshUser?.();
        Alert.alert('Success', 'Profile photo updated!');
      }
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to update profile photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleApplyToBeCurator = () => {
    setShowCuratorModal(true);
  };

  const submitCuratorApplication = async () => {
    if (!instagramHandle.trim()) {
      Alert.alert('Required', 'Please enter your Instagram handle.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/curators/apply', { instagram: instagramHandle.trim() });
      setShowCuratorModal(false);
      setInstagramHandle('');
      Alert.alert('Application Submitted', 'Thank you! We will review your application and reach out to you on Instagram.');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle edit functions
  const openHandleModal = () => {
    setNewHandle(user?.handle || '');
    setHandleError(null);
    setShowHandleModal(true);
  };

  const validateHandle = (text: string): string | null => {
    if (text.length < 3) return 'Handle must be at least 3 characters';
    if (text.length > 30) return 'Handle must be 30 characters or less';
    if (!/^[a-z]/.test(text)) return 'Handle must start with a letter';
    if (!/^[a-z][a-z0-9_]*$/.test(text)) return 'Only lowercase letters, numbers, and underscores';
    return null;
  };

  const handleHandleChange = (text: string) => {
    const formatted = text.toLowerCase().replace(/[^a-z0-9_]/g, '').substring(0, 30);
    setNewHandle(formatted);
    setHandleError(validateHandle(formatted));
  };

  const saveHandle = async () => {
    const error = validateHandle(newHandle);
    if (error) {
      setHandleError(error);
      return;
    }

    setSavingHandle(true);
    try {
      await api.put('/user', { handle: newHandle });
      await refreshUser?.();
      setShowHandleModal(false);
      Alert.alert('Success', 'Handle updated!');
    } catch (error: any) {
      // Extract error message from axios error response
      const message = error?.response?.data?.error || error?.message || 'Failed to update handle';
      setHandleError(message);
    } finally {
      setSavingHandle(false);
    }
  };

  // Invite functions
  const copyInviteCode = async () => {
    if (invitationInfo?.code) {
      await Clipboard.setStringAsync(invitationInfo.code);
      Alert.alert('Copied!', 'Invitation code copied to clipboard');
    }
  };

  const shareInvite = async () => {
    if (invitationInfo) {
      try {
        await Share.share({
          message: `Join me on Nafisa's Closet! Use my invitation code: ${invitationInfo.code}\n\nOr click: ${invitationInfo.inviteLink}`,
        });
      } catch (error) {
        console.error('Share error:', error);
      }
    }
  };

  const menuItems = [
    { icon: 'person-outline', label: 'Edit Profile', onPress: () => showComingSoon('Edit Profile') },
    ...(isCurator ? [{
      icon: 'wallet-outline',
      label: stripeStatus?.onboardingComplete ? 'Payment Setup ✓' : 'Payment Setup',
      onPress: handleStripeSetup,
      highlight: !stripeStatus?.onboardingComplete,
    }] : []),
    { icon: 'card-outline', label: 'Payment Methods', onPress: () => showComingSoon('Payment Methods') },
    { icon: 'location-outline', label: 'Shipping Addresses', onPress: () => showComingSoon('Shipping Addresses') },
    { icon: 'notifications-outline', label: 'Notifications', onPress: () => showComingSoon('Notifications') },
    { icon: 'help-circle-outline', label: 'Help & Support', onPress: () => showComingSoon('Help & Support') },
    { icon: 'shield-outline', label: 'Privacy Policy', onPress: () => showComingSoon('Privacy Policy') },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Profile</Text>
      </View>

      <View style={styles.profileSection}>
        <TouchableOpacity onPress={handlePhotoPress} disabled={uploadingPhoto}>
          <View style={styles.avatarContainer}>
            {user?.avatarUrl || user?.profilePhoto ? (
              <Image source={{ uri: user.avatarUrl || user.profilePhoto }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
                <Text style={[styles.avatarText, { color: colors.background }]}>
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </Text>
              </View>
            )}
            <View style={[styles.cameraOverlay, { backgroundColor: colors.surface }]}>
              {uploadingPhoto ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Ionicons name="camera" size={16} color={colors.text} />
              )}
            </View>
          </View>
        </TouchableOpacity>

        {/* Handle as primary identifier */}
        <TouchableOpacity style={styles.handleRow} onPress={openHandleModal}>
          <Text style={[styles.userHandle, { color: colors.text }]}>
            @{user?.handle || 'username'}
          </Text>
          <Ionicons name="pencil" size={16} color={colors.textMuted} style={styles.editIcon} />
        </TouchableOpacity>

        {/* Name as secondary */}
        <Text style={[styles.userName, { color: colors.textSecondary }]}>
          {user?.name || 'User'}
        </Text>

        {isCurator && (
          <View style={[styles.badge, { backgroundColor: colors.accent }]}>
            <Text style={[styles.badgeText, { color: colors.background }]}>
              Curator
            </Text>
          </View>
        )}

        {/* Invite Friends Button */}
        <TouchableOpacity
          style={[styles.inviteButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => setShowInviteModal(true)}
        >
          <Ionicons name="person-add-outline" size={18} color={colors.accent} />
          <Text style={[styles.inviteButtonText, { color: colors.text }]}>
            Invite Friends
          </Text>
          {invitationInfo && invitationInfo.referralCount > 0 && (
            <View style={[styles.referralBadge, { backgroundColor: colors.accent }]}>
              <Text style={styles.referralBadgeText}>{invitationInfo.referralCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.menu}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.menuItem, { borderBottomColor: colors.border }]}
            onPress={item.onPress}
          >
            <Ionicons
              name={item.icon as keyof typeof Ionicons.glyphMap}
              size={24}
              color={colors.text}
            />
            <Text style={[styles.menuLabel, { color: colors.text }]}>
              {item.label}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        ))}
      </View>

      {!isCurator && (
        <TouchableOpacity
          style={[styles.curatorApplyButton, { borderColor: colors.accent }]}
          onPress={handleApplyToBeCurator}
        >
          <Ionicons name="sparkles-outline" size={20} color={colors.accent} />
          <Text style={[styles.curatorApplyText, { color: colors.accent }]}>
            Apply to be a Curator
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.logoutButton, { backgroundColor: colors.accent }]}
        onPress={handleLogout}
      >
        <Text style={[styles.logoutText, { color: '#FFFFFF' }]}>Sign Out</Text>
      </TouchableOpacity>

      {/* Curator Application Modal */}
      <Modal
        visible={showCuratorModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCuratorModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[styles.modalContent, styles.glassCard, { backgroundColor: 'rgba(45, 27, 78, 0.95)' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Apply to be a Curator
              </Text>
              <TouchableOpacity onPress={() => setShowCuratorModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalDescription, { color: colors.textSecondary }]}>
              Curators are by invitation only. If you'd like to be considered, please provide your Instagram handle and we will reach out to you.
            </Text>

            <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Text style={[styles.inputPrefix, { color: colors.textMuted }]}>@</Text>
              <TextInput
                style={[styles.modalInput, { color: colors.text }]}
                placeholder="your_instagram"
                placeholderTextColor={colors.textMuted}
                value={instagramHandle}
                onChangeText={setInstagramHandle}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: colors.accent }]}
              onPress={submitCuratorApplication}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Application</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Handle Edit Modal */}
      <Modal
        visible={showHandleModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowHandleModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[styles.modalContent, styles.glassCard, { backgroundColor: 'rgba(45, 27, 78, 0.95)' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Edit Handle
              </Text>
              <TouchableOpacity onPress={() => setShowHandleModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalDescription, { color: colors.textSecondary }]}>
              Your handle is your unique identifier. Others can find you by searching @{newHandle || 'yourhandle'}.
            </Text>

            <View style={[styles.inputContainer, { borderColor: handleError ? colors.accent : colors.border, backgroundColor: colors.background }]}>
              <Text style={[styles.inputPrefix, { color: colors.textMuted }]}>@</Text>
              <TextInput
                style={[styles.modalInput, { color: colors.text }]}
                placeholder="your_handle"
                placeholderTextColor={colors.textMuted}
                value={newHandle}
                onChangeText={handleHandleChange}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={30}
              />
            </View>

            {handleError && (
              <Text style={[styles.errorText, { color: colors.accent }]}>
                {handleError}
              </Text>
            )}

            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: colors.accent, opacity: handleError ? 0.5 : 1 }]}
              onPress={saveHandle}
              disabled={savingHandle || !!handleError}
            >
              {savingHandle ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Save Handle</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Invite Friends Modal */}
      <Modal
        visible={showInviteModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowInviteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[styles.modalContent, styles.glassCard, { backgroundColor: 'rgba(45, 27, 78, 0.95)' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Invite Friends
              </Text>
              <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalDescription, { color: colors.textSecondary }]}>
              Share your invitation code with friends and earn rewards when they join!
            </Text>

            {loadingInvitation ? (
              <ActivityIndicator size="large" color={colors.accent} style={{ marginVertical: SPACING.xl }} />
            ) : invitationInfo ? (
              <>
                <View style={[styles.codeContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[styles.codeLabel, { color: colors.textMuted }]}>Your Code</Text>
                  <Text style={[styles.codeText, { color: colors.text }]}>{invitationInfo.code}</Text>
                </View>

                {invitationInfo.referralCount > 0 && (
                  <View style={styles.statsRow}>
                    <Ionicons name="people" size={20} color={colors.accent} />
                    <Text style={[styles.statsText, { color: colors.textSecondary }]}>
                      {invitationInfo.referralCount} friend{invitationInfo.referralCount !== 1 ? 's' : ''} joined with your code
                    </Text>
                  </View>
                )}

                <View style={styles.inviteActions}>
                  <TouchableOpacity
                    style={[styles.inviteActionButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                    onPress={copyInviteCode}
                  >
                    <Ionicons name="copy-outline" size={20} color={colors.text} />
                    <Text style={[styles.inviteActionText, { color: colors.text }]}>Copy Code</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.inviteActionButton, { backgroundColor: colors.accent }]}
                    onPress={shareInvite}
                  >
                    <Ionicons name="share-outline" size={20} color="#FFFFFF" />
                    <Text style={[styles.inviteActionText, { color: '#FFFFFF' }]}>Share</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <Text style={[styles.errorText, { color: colors.textMuted }]}>
                Unable to load invitation code
              </Text>
            )}
          </View>
        </View>
      </Modal>

      {/* Stripe Setup Modal */}
      <Modal
        visible={showStripeModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowStripeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[styles.modalContent, styles.glassCard, { backgroundColor: 'rgba(45, 27, 78, 0.95)' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Payment Setup
              </Text>
              <TouchableOpacity onPress={() => setShowStripeModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalDescription, { color: colors.textSecondary }]}>
              Connect your bank account to receive payouts when you make sales. This is required to start earning as a curator.
            </Text>

            <View style={[styles.stripeInfoBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Ionicons name="shield-checkmark" size={24} color={colors.success} />
              <View style={styles.stripeInfoText}>
                <Text style={[styles.stripeInfoTitle, { color: colors.text }]}>Secure & Fast</Text>
                <Text style={[styles.stripeInfoDesc, { color: colors.textSecondary }]}>
                  Powered by Stripe. Your banking details are never stored on our servers.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: colors.accent }]}
              onPress={startStripeOnboarding}
              disabled={startingOnboarding}
            >
              {startingOnboarding ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="card-outline" size={20} color="#FFFFFF" style={{ marginRight: SPACING.sm }} />
                  <Text style={styles.submitButtonText}>Connect Bank Account</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={[styles.stripePowered, { color: colors.textMuted }]}>
              You'll be redirected to Stripe to complete setup
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  title: {
    fontSize: FONTS.sizes.xxxl,
    fontWeight: 'bold',
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: FONTS.sizes.xxxl,
    fontWeight: 'bold',
  },
  handleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  userHandle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: 'bold',
  },
  editIcon: {
    marginLeft: SPACING.xs,
  },
  userName: {
    fontSize: FONTS.sizes.md,
    marginTop: SPACING.xs,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    gap: SPACING.sm,
  },
  inviteButtonText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '500',
  },
  referralBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  referralBadgeText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.xs,
    fontWeight: 'bold',
  },
  badge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    marginTop: SPACING.sm,
  },
  badgeText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
  },
  menu: {
    paddingHorizontal: SPACING.lg,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    gap: SPACING.md,
  },
  menuLabel: {
    flex: 1,
    fontSize: FONTS.sizes.md,
  },
  curatorApplyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 2,
    gap: SPACING.sm,
  },
  curatorApplyText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  logoutButton: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  glassCard: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  modalTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: 'bold',
  },
  modalDescription: {
    fontSize: FONTS.sizes.md,
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 48,
    marginBottom: SPACING.lg,
  },
  inputPrefix: {
    fontSize: FONTS.sizes.md,
    marginRight: SPACING.xs,
  },
  modalInput: {
    flex: 1,
    fontSize: FONTS.sizes.md,
  },
  submitButton: {
    flexDirection: 'row',
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  errorText: {
    fontSize: FONTS.sizes.sm,
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
  },
  codeContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  codeLabel: {
    fontSize: FONTS.sizes.sm,
    marginBottom: SPACING.xs,
  },
  codeText: {
    fontSize: FONTS.sizes.xxxl,
    fontWeight: 'bold',
    letterSpacing: 4,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  statsText: {
    fontSize: FONTS.sizes.md,
  },
  inviteActions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  inviteActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    gap: SPACING.sm,
  },
  inviteActionText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  stripeInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },
  stripeInfoText: {
    flex: 1,
  },
  stripeInfoTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  stripeInfoDesc: {
    fontSize: FONTS.sizes.sm,
    lineHeight: 18,
  },
  stripePowered: {
    fontSize: FONTS.sizes.sm,
    textAlign: 'center',
    marginTop: SPACING.md,
  },
});
