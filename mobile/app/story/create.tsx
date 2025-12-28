import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { uploadService } from '../../services/upload';
import { storiesService } from '../../services/stories';

const COLORS = {
  background: '#1A0A2E',
  surface: '#2D1B4E',
  accent: '#E63946',
  text: '#FFFFFF',
  muted: '#8B7A9E',
  placeholder: '#6B5A7E',
};

export default function CreateStoryScreen() {
  const router = useRouter();
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  const pickVideo = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow access to your photo library');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 0.8,
      videoMaxDuration: 60, // Max 60 seconds
    });

    if (!result.canceled && result.assets[0]) {
      setVideoUri(result.assets[0].uri);
    }
  };

  const recordVideo = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow access to your camera');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 0.8,
      videoMaxDuration: 60, // Max 60 seconds
    });

    if (!result.canceled && result.assets[0]) {
      setVideoUri(result.assets[0].uri);
    }
  };

  const handlePost = async () => {
    if (!videoUri) {
      Alert.alert('No video', 'Please select or record a video first');
      return;
    }

    setIsUploading(true);
    setUploadProgress('Uploading video...');

    try {
      // Upload video to Cloudinary
      const uploadResult = await uploadService.uploadVideo(videoUri);

      setUploadProgress('Creating story...');

      // Create story
      await storiesService.createStory({
        videoUrl: uploadResult.url,
        thumbnailUrl: uploadResult.thumbnailUrl || undefined,
        caption: caption.trim() || undefined,
        location: location.trim() || undefined,
        duration: uploadResult.duration,
      });

      Alert.alert('Success', 'Your story has been posted!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      console.error('Story creation error:', error);
      Alert.alert('Error', error.message || 'Failed to create story');
    } finally {
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="close" size={28} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.title}>New Story</Text>
          <TouchableOpacity
            onPress={handlePost}
            disabled={!videoUri || isUploading}
            style={[
              styles.postButton,
              (!videoUri || isUploading) && styles.postButtonDisabled,
            ]}
          >
            {isUploading ? (
              <ActivityIndicator size="small" color={COLORS.text} />
            ) : (
              <Text style={styles.postButtonText}>Post</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Video preview or picker */}
          {videoUri ? (
            <View style={styles.videoContainer}>
              <Video
                source={{ uri: videoUri }}
                style={styles.videoPreview}
                resizeMode={ResizeMode.COVER}
                shouldPlay
                isLooping
                isMuted
              />
              <TouchableOpacity
                style={styles.changeVideoButton}
                onPress={() => setVideoUri(null)}
              >
                <Ionicons name="close-circle" size={32} color={COLORS.text} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.pickerContainer}>
              <Text style={styles.pickerTitle}>Add a Video</Text>
              <Text style={styles.pickerSubtitle}>
                Share a fashion find from your hunt (max 60 seconds)
              </Text>
              <View style={styles.pickerButtons}>
                <TouchableOpacity style={styles.pickerButton} onPress={recordVideo}>
                  <Ionicons name="videocam" size={32} color={COLORS.accent} />
                  <Text style={styles.pickerButtonText}>Record</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.pickerButton} onPress={pickVideo}>
                  <Ionicons name="images" size={32} color={COLORS.accent} />
                  <Text style={styles.pickerButtonText}>Gallery</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Caption input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Caption</Text>
            <TextInput
              style={styles.captionInput}
              value={caption}
              onChangeText={setCaption}
              placeholder="Tell us about this find..."
              placeholderTextColor={COLORS.placeholder}
              multiline
              maxLength={280}
            />
            <Text style={styles.charCount}>{caption.length}/280</Text>
          </View>

          {/* Location input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Location (optional)</Text>
            <View style={styles.locationInputRow}>
              <Ionicons name="location-outline" size={20} color={COLORS.muted} />
              <TextInput
                style={styles.locationInput}
                value={location}
                onChangeText={setLocation}
                placeholder="e.g., Paris, France"
                placeholderTextColor={COLORS.placeholder}
                maxLength={100}
              />
            </View>
          </View>

          {/* Upload progress */}
          {isUploading && (
            <View style={styles.progressContainer}>
              <ActivityIndicator size="small" color={COLORS.accent} />
              <Text style={styles.progressText}>{uploadProgress}</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  postButton: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
  },
  postButtonDisabled: {
    opacity: 0.5,
  },
  postButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  videoContainer: {
    aspectRatio: 9 / 16,
    width: '100%',
    maxHeight: 400,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
    marginBottom: 20,
  },
  videoPreview: {
    flex: 1,
  },
  changeVideoButton: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  pickerContainer: {
    aspectRatio: 9 / 16,
    width: '100%',
    maxHeight: 400,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: COLORS.muted,
    borderStyle: 'dashed',
  },
  pickerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  pickerSubtitle: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: 'center',
    paddingHorizontal: 32,
    marginBottom: 24,
  },
  pickerButtons: {
    flexDirection: 'row',
    gap: 24,
  },
  pickerButton: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(230, 57, 70, 0.1)',
    minWidth: 100,
  },
  pickerButtonText: {
    fontSize: 14,
    color: COLORS.text,
    marginTop: 8,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 8,
  },
  captionInput: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    color: COLORS.text,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: COLORS.muted,
    textAlign: 'right',
    marginTop: 4,
  },
  locationInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  locationInput: {
    flex: 1,
    padding: 14,
    color: COLORS.text,
    fontSize: 15,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 12,
  },
  progressText: {
    fontSize: 14,
    color: COLORS.muted,
  },
});
