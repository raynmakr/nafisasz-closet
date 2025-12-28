import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { api } from '@/services/api';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface PushNotificationState {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
  error: string | null;
}

/**
 * Hook for managing push notifications
 * - Requests permissions on mount
 * - Gets Expo push token
 * - Registers token with backend when user is authenticated
 */
export function usePushNotifications(isAuthenticated: boolean) {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    // Register for push notifications
    registerForPushNotificationsAsync()
      .then((token) => {
        if (token) {
          setExpoPushToken(token);
        }
      })
      .catch((err) => {
        setError(err.message);
      });

    // Listen for incoming notifications (when app is foregrounded)
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        setNotification(notification);
      }
    );

    // Listen for notification responses (when user taps notification)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        handleNotificationResponse(data);
      }
    );

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  // Register token with backend when authenticated
  useEffect(() => {
    if (isAuthenticated && expoPushToken) {
      registerTokenWithBackend(expoPushToken);
    }
  }, [isAuthenticated, expoPushToken]);

  return {
    expoPushToken,
    notification,
    error,
  };
}

/**
 * Request permissions and get Expo push token
 */
async function registerForPushNotificationsAsync(): Promise<string | null> {
  let token: string | null = null;

  // Check if running in Expo Go - push notifications are limited
  const isExpoGo = Constants.appOwnership === 'expo';
  if (isExpoGo) {
    console.log('[Expo Go] Push notifications limited. Use a development build for full functionality.');
    return null;
  }

  // Must be a physical device
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  // Android: Set up notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#E63946',
    });
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permissions if not granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission denied');
    return null;
  }

  // Get the token - requires projectId from EAS
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.log('No EAS projectId found - push notifications require a development build');
      return null;
    }
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    token = tokenData.data;
    console.log('Expo push token:', token);
  } catch (error) {
    console.log('Push token unavailable:', (error as Error).message);
  }

  return token;
}

/**
 * Register push token with backend
 */
async function registerTokenWithBackend(pushToken: string): Promise<void> {
  try {
    await api.post('/user', {
      action: 'register-push-token',
      pushToken,
    });
    console.log('Push token registered with backend');
  } catch (error) {
    console.error('Failed to register push token:', error);
  }
}

/**
 * Handle notification tap - navigate to appropriate screen
 */
function handleNotificationResponse(data: Record<string, unknown>): void {
  // This will be called when user taps a notification
  // Navigation logic can be added here based on data.screen
  console.log('Notification tapped with data:', data);

  // Example navigation (would need router access):
  // if (data.screen === 'listing-detail' && data.listingId) {
  //   router.push(`/listing/${data.listingId}`);
  // }
  // if (data.screen === 'transaction-detail' && data.transactionId) {
  //   router.push(`/transaction/${data.transactionId}`);
  // }
}

export default usePushNotifications;
