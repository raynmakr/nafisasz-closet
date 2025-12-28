import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Image,
  Modal,
  StatusBar,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { StoryCurator, HuntStory } from '../services/stories';
import { storiesService } from '../services/stories';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const COLORS = {
  background: '#000000',
  text: '#FFFFFF',
  muted: 'rgba(255, 255, 255, 0.6)',
  progressBg: 'rgba(255, 255, 255, 0.3)',
  progressFill: '#FFFFFF',
};

interface StoryViewerProps {
  visible: boolean;
  curators: StoryCurator[];
  initialCuratorIndex: number;
  onClose: () => void;
}

export function StoryViewer({
  visible,
  curators,
  initialCuratorIndex,
  onClose,
}: StoryViewerProps) {
  const [curatorIndex, setCuratorIndex] = useState(initialCuratorIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const videoRef = useRef<Video>(null);

  const currentCurator = curators[curatorIndex];
  const currentStory = currentCurator?.stories[storyIndex];

  // Reset when opening with new curator
  useEffect(() => {
    if (visible) {
      setCuratorIndex(initialCuratorIndex);
      setStoryIndex(0);
      setProgress(0);
    }
  }, [visible, initialCuratorIndex]);

  // Record view when story changes
  useEffect(() => {
    if (visible && currentStory && !currentStory.viewed) {
      storiesService.recordView(currentStory.id).catch(console.error);
    }
  }, [visible, currentStory?.id]);

  const goToNextStory = () => {
    if (!currentCurator) return;

    if (storyIndex < currentCurator.stories.length - 1) {
      // Next story from same curator
      setStoryIndex(storyIndex + 1);
      setProgress(0);
      setIsLoading(true);
    } else if (curatorIndex < curators.length - 1) {
      // Next curator
      setCuratorIndex(curatorIndex + 1);
      setStoryIndex(0);
      setProgress(0);
      setIsLoading(true);
    } else {
      // End of all stories
      onClose();
    }
  };

  const goToPrevStory = () => {
    if (storyIndex > 0) {
      // Previous story from same curator
      setStoryIndex(storyIndex - 1);
      setProgress(0);
      setIsLoading(true);
    } else if (curatorIndex > 0) {
      // Previous curator (go to their last story)
      const prevCurator = curators[curatorIndex - 1];
      setCuratorIndex(curatorIndex - 1);
      setStoryIndex(prevCurator.stories.length - 1);
      setProgress(0);
      setIsLoading(true);
    }
  };

  const handleTap = (event: any) => {
    const { locationX } = event.nativeEvent;
    if (locationX < SCREEN_WIDTH / 3) {
      goToPrevStory();
    } else if (locationX > (SCREEN_WIDTH * 2) / 3) {
      goToNextStory();
    } else {
      // Center tap - pause/play
      setIsPaused(!isPaused);
    }
  };

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;

    setIsLoading(false);

    if (status.durationMillis && status.positionMillis) {
      setProgress(status.positionMillis / status.durationMillis);
    }

    if (status.didJustFinish) {
      goToNextStory();
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  if (!visible || !currentCurator || !currentStory) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        {/* Video */}
        <TouchableWithoutFeedback onPress={handleTap}>
          <View style={styles.videoContainer}>
            <Video
              ref={videoRef}
              source={{ uri: currentStory.videoUrl }}
              style={styles.video}
              resizeMode={ResizeMode.COVER}
              shouldPlay={!isPaused}
              isLooping={false}
              onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
            />

            {isLoading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color={COLORS.text} />
              </View>
            )}

            {isPaused && !isLoading && (
              <View style={styles.pauseOverlay}>
                <Ionicons name="play" size={60} color={COLORS.text} />
              </View>
            )}
          </View>
        </TouchableWithoutFeedback>

        {/* Top overlay */}
        <SafeAreaView style={styles.topOverlay}>
          {/* Progress bars */}
          <View style={styles.progressContainer}>
            {currentCurator.stories.map((_, index) => (
              <View key={index} style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width:
                        index < storyIndex
                          ? '100%'
                          : index === storyIndex
                          ? `${progress * 100}%`
                          : '0%',
                    },
                  ]}
                />
              </View>
            ))}
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.userInfo}>
              {currentCurator.curatorAvatar ? (
                <Image
                  source={{ uri: currentCurator.curatorAvatar }}
                  style={styles.avatar}
                />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarInitial}>
                    {currentCurator.curatorName?.charAt(0)?.toUpperCase() || '?'}
                  </Text>
                </View>
              )}
              <View style={styles.userText}>
                <Text style={styles.userName}>{currentCurator.curatorName}</Text>
                <Text style={styles.timeAgo}>
                  {formatTimeAgo(currentStory.createdAt)}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color={COLORS.text} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {/* Bottom overlay - caption */}
        {currentStory.caption && (
          <SafeAreaView style={styles.bottomOverlay}>
            <Text style={styles.caption}>{currentStory.caption}</Text>
            {currentStory.location && (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={14} color={COLORS.muted} />
                <Text style={styles.location}>{currentStory.location}</Text>
              </View>
            )}
          </SafeAreaView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  videoContainer: {
    flex: 1,
  },
  video: {
    flex: 1,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  pauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 8,
    paddingHorizontal: 12,
  },
  progressContainer: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 12,
  },
  progressBarBg: {
    flex: 1,
    height: 2,
    backgroundColor: COLORS.progressBg,
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.progressFill,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2D1B4E',
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  userText: {
    marginLeft: 10,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  timeAgo: {
    fontSize: 12,
    color: COLORS.muted,
  },
  closeButton: {
    padding: 8,
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 24,
    backgroundColor: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
  },
  caption: {
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 20,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  location: {
    fontSize: 13,
    color: COLORS.muted,
    marginLeft: 4,
  },
});

export default StoryViewer;
