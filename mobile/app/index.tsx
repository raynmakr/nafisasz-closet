import { useEffect, useState, useRef } from 'react';
import { Redirect } from 'expo-router';
import { View, Image, StyleSheet, Animated, Dimensions } from 'react-native';
import { useAuth } from '../src/context/AuthContext';

const LOGO = require('../assets/nc-logo.png');
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function Index() {
  const { isAuthenticated, isLoading, isProfileComplete } = useAuth();
  const [showSplash, setShowSplash] = useState(true);

  // Animation values
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoPosition = useRef(new Animated.Value(SCREEN_HEIGHT * 0.33)).current; // Start at 1/3
  const splashOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Start animation immediately
    // Phase 1: Fade in while dropping (0-1.2s)
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(logoPosition, {
        toValue: SCREEN_HEIGHT * 0.66, // End at 2/3
        duration: 1200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Phase 2: Hold briefly then fade out (1.2-2s)
      setTimeout(() => {
        Animated.timing(splashOpacity, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }).start(() => {
          setShowSplash(false);
        });
      }, 200); // Brief hold
    });
  }, []);

  // Show splash screen with logo animation
  if (showSplash) {
    return (
      <Animated.View style={[styles.splashContainer, { opacity: splashOpacity }]}>
        <Animated.Image
          source={LOGO}
          style={[
            styles.logo,
            {
              opacity: logoOpacity,
              transform: [{ translateY: logoPosition }],
            },
          ]}
          resizeMode="contain"
        />
      </Animated.View>
    );
  }

  // Still loading auth
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        {/* Empty purple screen while loading */}
      </View>
    );
  }

  // After splash, redirect based on auth state
  if (isAuthenticated) {
    if (isProfileComplete) {
      return <Redirect href="/(tabs)" />;
    } else {
      return <Redirect href="/(auth)/complete-profile" />;
    }
  }

  return <Redirect href="/(auth)/login" />;
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#1A0A2E',
  },
  logo: {
    width: 280,
    height: 60,
    position: 'absolute',
  },
});
