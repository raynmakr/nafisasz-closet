import { useEffect, useRef } from 'react';
import { Redirect } from 'expo-router';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { useAuth } from '../src/context/AuthContext';

const LOGO = require('../assets/nc-logo.png');

export default function Index() {
  const { isAuthenticated, isLoading, isProfileComplete } = useAuth();

  // Animation values
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const dot1Opacity = useRef(new Animated.Value(0.3)).current;
  const dot2Opacity = useRef(new Animated.Value(0.3)).current;
  const dot3Opacity = useRef(new Animated.Value(0.3)).current;
  const splashOpacity = useRef(new Animated.Value(1)).current;
  const showSplash = useRef(true);

  useEffect(() => {
    // Phase 1: Logo scales up and fades in (0-800ms)
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // Phase 2: Tagline fades in (600ms delay)
    setTimeout(() => {
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }, 600);

    // Phase 3: Dots start pulsing (1000ms delay)
    setTimeout(() => {
      const createPulse = (dot: Animated.Value, delay: number) => {
        const pulse = () => {
          Animated.sequence([
            Animated.timing(dot, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(dot, {
              toValue: 0.3,
              duration: 300,
              useNativeDriver: true,
            }),
          ]).start(() => {
            if (showSplash.current) {
              setTimeout(pulse, 600);
            }
          });
        };
        setTimeout(pulse, delay);
      };

      createPulse(dot1Opacity, 0);
      createPulse(dot2Opacity, 100);
      createPulse(dot3Opacity, 200);
    }, 1000);

    // Phase 4: Fade out everything (1800ms delay)
    setTimeout(() => {
      showSplash.current = false;
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 400,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }, 1800);
  }, []);

  // Still loading auth - show splash
  if (isLoading) {
    return (
      <Animated.View style={[styles.splashContainer, { opacity: splashOpacity }]}>
        <View style={styles.contentContainer}>
          <Animated.Image
            source={LOGO}
            style={[
              styles.logo,
              {
                opacity: logoOpacity,
                transform: [{ scale: logoScale }],
              },
            ]}
            resizeMode="contain"
          />
          <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
            Luxury Fashion, Curated
          </Animated.Text>
          <View style={styles.dotsContainer}>
            <Animated.View style={[styles.dot, { opacity: dot1Opacity }]} />
            <Animated.View style={[styles.dot, { opacity: dot2Opacity }]} />
            <Animated.View style={[styles.dot, { opacity: dot3Opacity }]} />
          </View>
        </View>
      </Animated.View>
    );
  }

  // After auth loads, redirect based on state
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
    backgroundColor: '#1A0A2E',
  },
  contentContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 280,
    height: 60,
  },
  tagline: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    fontWeight: '300',
    letterSpacing: 2,
    marginTop: 20,
    textTransform: 'uppercase',
  },
  dotsContainer: {
    flexDirection: 'row',
    marginTop: 40,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D4AF37',
  },
});
