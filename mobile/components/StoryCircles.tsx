import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StoryCurator } from '../services/stories';
import { useAuthStore } from '../stores/auth';

interface StoryCirclesProps {
  curators: StoryCurator[];
  onStoryPress: (curatorIndex: number) => void;
  onAddPress?: () => void;
}

const COLORS = {
  background: '#1A0A2E',
  surface: '#2D1B4E',
  accent: '#E63946',
  text: '#FFFFFF',
  muted: '#8B7A9E',
  gradient: ['#9B59B6', '#E91E63'],
};

export function StoryCircles({ curators, onStoryPress, onAddPress }: StoryCirclesProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  const isCurator = user?.role === 'curator';

  if (curators.length === 0 && !isCurator) {
    return null;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Add Story button for curators */}
        {isCurator && (
          <TouchableOpacity
            style={styles.storyItem}
            onPress={onAddPress || (() => router.push('/story/create'))}
          >
            <View style={[styles.avatarContainer, styles.addContainer]}>
              <View style={styles.addButton}>
                <Ionicons name="add" size={28} color={COLORS.text} />
              </View>
            </View>
            <Text style={styles.name} numberOfLines={1}>
              Add Story
            </Text>
          </TouchableOpacity>
        )}

        {/* Curator story circles */}
        {curators.map((curator, index) => (
          <TouchableOpacity
            key={curator.curatorUserId}
            style={styles.storyItem}
            onPress={() => onStoryPress(index)}
          >
            <View
              style={[
                styles.avatarContainer,
                curator.hasUnwatched ? styles.unwatchedRing : styles.watchedRing,
              ]}
            >
              {curator.curatorAvatar ? (
                <Image
                  source={{ uri: curator.curatorAvatar }}
                  style={styles.avatar}
                />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarInitial}>
                    {curator.curatorName?.charAt(0)?.toUpperCase() || '?'}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.name} numberOfLines={1}>
              {curator.curatorName?.split(' ')[0] || curator.curatorHandle}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
  },
  scrollContent: {
    paddingHorizontal: 12,
    gap: 12,
  },
  storyItem: {
    alignItems: 'center',
    width: 72,
  },
  avatarContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unwatchedRing: {
    backgroundColor: COLORS.accent,
    // Gradient ring effect using border
    borderWidth: 2,
    borderColor: '#9B59B6',
  },
  watchedRing: {
    borderWidth: 2,
    borderColor: COLORS.muted,
  },
  addContainer: {
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.muted,
    borderStyle: 'dashed',
  },
  addButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: COLORS.surface,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.text,
  },
  name: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.text,
    textAlign: 'center',
    width: '100%',
  },
});

export default StoryCircles;
