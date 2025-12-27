import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useThemeColors } from '@/hooks';
import { SPACING, FONTS, BORDER_RADIUS } from '@/constants';
import { uploadService, listingsService, curatorsService } from '@/services';

// Duration options with minutes for non-linear slider mapping
const DURATION_STOPS = [
  { label: '30 min', value: 'THIRTY_MINUTES' as const, minutes: 30 },
  { label: '2 hours', value: 'TWO_HOURS' as const, minutes: 120 },
  { label: '6 hours', value: 'SIX_HOURS' as const, minutes: 360 },
  { label: '24 hours', value: 'TWENTY_FOUR_HOURS' as const, minutes: 1440 },
  { label: '48 hours', value: 'FORTY_EIGHT_HOURS' as const, minutes: 2880 },
];

type DurationValue = typeof DURATION_STOPS[number]['value'];

export default function CreateScreen() {
  const colors = useThemeColors();
  const [photos, setPhotos] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [brand, setBrand] = useState('');
  const [price, setPrice] = useState('');
  const [durationIndex, setDurationIndex] = useState(2); // Default: 6 hours (index 2)

  // Get current duration info from slider position
  const currentDuration = useMemo(() => DURATION_STOPS[durationIndex], [durationIndex]);
  const [isPosting, setIsPosting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library to add photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 10 - photos.length,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      const newPhotos = result.assets.map(asset => asset.uri);
      setPhotos(prev => [...prev, ...newPhotos].slice(0, 10));
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your camera to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotos(prev => [...prev, result.assets[0].uri].slice(0, 10));
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddPhoto = () => {
    Alert.alert(
      'Add Photo',
      'Choose how you want to add a photo',
      [
        { text: 'Camera', onPress: takePhoto },
        { text: 'Photo Library', onPress: pickImage },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const resetForm = () => {
    setPhotos([]);
    setTitle('');
    setDescription('');
    setBrand('');
    setPrice('');
    setDurationIndex(2); // Reset to 6 hours
  };

  const handlePost = async () => {
    if (photos.length === 0) {
      Alert.alert('Add Photos', 'Please add at least one photo to your post.');
      return;
    }

    if (!title.trim()) {
      Alert.alert('Add Title', 'Please add a title for your post.');
      return;
    }

    const priceNum = parseFloat(price);
    if (!price || isNaN(priceNum) || priceNum <= 0) {
      Alert.alert('Add Price', 'Please enter a valid retail price.');
      return;
    }

    setIsPosting(true);
    setUploadProgress('Setting up...');

    try {
      // Ensure user is a curator (auto-registers if not)
      await curatorsService.becomeCurator();

      setUploadProgress('Uploading photos...');

      // Upload all photos to Cloudinary
      const uploadedUrls = await uploadService.uploadImages(
        photos,
        (completed, total) => {
          setUploadProgress(`Uploading photo ${completed}/${total}...`);
        }
      );

      setUploadProgress('Publishing post...');

      // Create and publish the listing
      await listingsService.createAndPublishListing({
        title: title.trim(),
        description: description.trim() || undefined,
        brand: brand.trim() || undefined,
        photos: uploadedUrls,
        retailPrice: priceNum,
        auctionDuration: currentDuration.value,
      });

      setIsPosting(false);
      setUploadProgress('');

      // Reset form
      resetForm();

      // Navigate to Discover tab to see the new post
      router.replace('/(tabs)');
    } catch (error: any) {
      setIsPosting(false);
      setUploadProgress('');

      const message = error?.response?.data?.error || error?.message || 'Failed to create post';
      Alert.alert('Error', message);
    }
  };

  const canPost = photos.length > 0 && title.trim() && price;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>New Post</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Share your latest find
          </Text>
        </View>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="handled"
        >
          {/* Photo Section */}
          {photos.length === 0 ? (
            <TouchableOpacity
              style={[styles.uploadBox, { borderColor: colors.border }]}
              onPress={handleAddPhoto}
            >
              <Ionicons name="camera-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.uploadText, { color: colors.textSecondary }]}>
                Add Photos
              </Text>
              <Text style={[styles.uploadHint, { color: colors.textMuted }]}>
                Up to 10 photos
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.photosGrid}>
              {photos.map((uri, index) => (
                <View key={index} style={styles.photoContainer}>
                  <Image source={{ uri }} style={styles.photoThumbnail} />
                  <TouchableOpacity
                    style={[styles.removeButton, { backgroundColor: colors.accent }]}
                    onPress={() => removePhoto(index)}
                  >
                    <Ionicons name="close" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                  {index === 0 && (
                    <View style={[styles.coverBadge, { backgroundColor: colors.accent }]}>
                      <Text style={styles.coverBadgeText}>Cover</Text>
                    </View>
                  )}
                </View>
              ))}
              {photos.length < 10 && (
                <TouchableOpacity
                  style={[styles.addMoreButton, { borderColor: colors.border }]}
                  onPress={handleAddPhoto}
                >
                  <Ionicons name="add" size={32} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Title Input */}
          <View style={styles.inputSection}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>
              Title <Text style={{ color: colors.accent }}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: colors.surface,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="e.g. Vintage Chanel Tweed Jacket"
              placeholderTextColor={colors.textMuted}
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />
          </View>

          {/* Brand Input */}
          <View style={styles.inputSection}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>
              Brand
            </Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: colors.surface,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="e.g. Chanel, Gucci, Prada"
              placeholderTextColor={colors.textMuted}
              value={brand}
              onChangeText={setBrand}
              maxLength={50}
            />
          </View>

          {/* Price Input */}
          <View style={styles.inputSection}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>
              Retail Price <Text style={{ color: colors.accent }}>*</Text>
            </Text>
            <View style={[
              styles.priceInputContainer,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}>
              <Text style={[styles.currencySymbol, { color: colors.text }]}>$</Text>
              <TextInput
                style={[styles.priceInput, { color: colors.text }]}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                value={price}
                onChangeText={(text) => {
                  // Only allow numbers and one decimal point
                  const cleaned = text.replace(/[^0-9.]/g, '');
                  const parts = cleaned.split('.');
                  if (parts.length > 2) return;
                  if (parts[1]?.length > 2) return;
                  setPrice(cleaned);
                }}
                keyboardType="decimal-pad"
                maxLength={10}
              />
            </View>
            <Text style={[styles.priceHint, { color: colors.textMuted }]}>
              Starting claim will be ${price ? (parseFloat(price) * 1.2).toFixed(0) : '0'}
            </Text>
          </View>

          {/* Duration Slider */}
          <View style={styles.inputSection}>
            <View style={styles.durationHeader}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>
                Post Duration
              </Text>
              <View style={[styles.durationBadge, { backgroundColor: colors.accent }]}>
                <Text style={styles.durationBadgeText}>{currentDuration.label}</Text>
              </View>
            </View>
            <View style={styles.sliderContainer}>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={4}
                step={1}
                value={durationIndex}
                onValueChange={(value) => setDurationIndex(Math.round(value))}
                minimumTrackTintColor={colors.accent}
                maximumTrackTintColor={colors.surface}
                thumbTintColor={colors.accent}
              />
              <View style={styles.sliderLabels}>
                <Text style={[styles.sliderLabel, { color: colors.textMuted }]}>30m</Text>
                <Text style={[styles.sliderLabel, { color: colors.textMuted }]}>2h</Text>
                <Text style={[styles.sliderLabel, { color: colors.textMuted }]}>6h</Text>
                <Text style={[styles.sliderLabel, { color: colors.textMuted }]}>24h</Text>
                <Text style={[styles.sliderLabel, { color: colors.textMuted }]}>48h</Text>
              </View>
            </View>
          </View>

          {/* Description Section */}
          <View style={styles.inputSection}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>
              Description
            </Text>
            <TextInput
              style={[
                styles.textArea,
                {
                  backgroundColor: colors.surface,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Tell us about this item... size, condition, where you found it"
              placeholderTextColor={colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={500}
            />
            <Text style={[styles.charCount, { color: colors.textMuted }]}>
              {description.length}/500
            </Text>
          </View>

          {/* Spacer for button */}
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Post Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.postButton,
              { backgroundColor: canPost ? colors.accent : colors.surface },
            ]}
            onPress={handlePost}
            disabled={!canPost || isPosting}
          >
            {isPosting ? (
              <View style={styles.postingContainer}>
                <ActivityIndicator color="#FFFFFF" size="small" />
                {uploadProgress ? (
                  <Text style={styles.uploadProgressText}>{uploadProgress}</Text>
                ) : null}
              </View>
            ) : (
              <>
                <Ionicons name="send" size={18} color={canPost ? '#FFFFFF' : colors.textMuted} />
                <Text
                  style={[
                    styles.postButtonText,
                    { color: canPost ? '#FFFFFF' : colors.textMuted },
                  ]}
                >
                  Post
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
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
  subtitle: {
    fontSize: FONTS.sizes.md,
    marginTop: SPACING.xs,
  },
  content: {
    flex: 1,
    padding: SPACING.lg,
  },
  uploadBox: {
    height: 200,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: BORDER_RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  uploadText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    marginTop: SPACING.sm,
  },
  uploadHint: {
    fontSize: FONTS.sizes.sm,
    marginTop: SPACING.xs,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  photoContainer: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    position: 'relative',
  },
  photoThumbnail: {
    width: '100%',
    height: '100%',
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  coverBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  addMoreButton: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputSection: {
    marginBottom: SPACING.lg,
  },
  inputLabel: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    marginBottom: SPACING.sm,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: FONTS.sizes.md,
    height: 48,
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 48,
  },
  currencySymbol: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    marginRight: SPACING.xs,
  },
  priceInput: {
    flex: 1,
    fontSize: FONTS.sizes.md,
    height: '100%',
  },
  priceHint: {
    fontSize: FONTS.sizes.sm,
    marginTop: SPACING.xs,
  },
  durationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  durationBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  durationBadgeText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  sliderContainer: {
    marginHorizontal: -SPACING.xs,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xs,
  },
  sliderLabel: {
    fontSize: FONTS.sizes.xs,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: FONTS.sizes.md,
    minHeight: 100,
  },
  charCount: {
    fontSize: FONTS.sizes.sm,
    textAlign: 'right',
    marginTop: SPACING.xs,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
    alignItems: 'flex-end',
  },
  postButton: {
    flexDirection: 'row',
    height: 44,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.full || 22,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  postButtonText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  postingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  uploadProgressText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.sm,
  },
});
