import 'react-native-reanimated';
import { useEffect } from 'react';
import { useColorScheme, AppState, AppStateStatus } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { usePushNotifications } from '../hooks';

// Check if we're running in Expo Go (no native modules available)
const isExpoGo = Constants.appOwnership === 'expo';

// Conditionally import Stripe for development builds
let StripeProvider: any = null;
if (!isExpoGo) {
  try {
    const stripe = require('@stripe/stripe-react-native');
    StripeProvider = stripe.StripeProvider;
  } catch (e) {
    console.warn('[Stripe] Failed to load:', e);
  }
}

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

if (isExpoGo) {
  console.log('[Expo Go] Stripe disabled. Use a development build for payment features.');
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 2,
    },
  },
});

// Component to handle OTA updates
function OTAUpdateHandler({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Only check for updates in production builds (not Expo Go)
    if (isExpoGo || __DEV__) {
      return;
    }

    const checkForUpdates = async () => {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          console.log('[Updates] New update available, downloading...');
          await Updates.fetchUpdateAsync();
          console.log('[Updates] Update downloaded, reloading app...');
          await Updates.reloadAsync();
        }
      } catch (error) {
        console.log('[Updates] Error checking for updates:', error);
      }
    };

    // Check on mount
    checkForUpdates();

    // Also check when app comes to foreground
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        checkForUpdates();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  return <>{children}</>;
}

// Component to handle push notifications inside AuthProvider
function PushNotificationHandler({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  // Initialize push notifications - will register token when authenticated
  usePushNotifications(isAuthenticated);

  return <>{children}</>;
}

// Component to handle deep links inside AuthProvider
function DeepLinkHandler({ children }: { children: React.ReactNode }) {
  const { setInvitationCode } = useAuth();

  useEffect(() => {
    // Handle initial URL (app opened via deep link)
    const handleInitialUrl = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        handleDeepLink(initialUrl);
      }
    };

    // Handle URL when app is already open
    const handleUrlEvent = (event: { url: string }) => {
      handleDeepLink(event.url);
    };

    const handleDeepLink = (url: string) => {
      try {
        const parsed = Linking.parse(url);

        // Handle invite deep links: nafisascloset://invite?code=XXX
        if (parsed.path === 'invite' && parsed.queryParams?.code) {
          const code = parsed.queryParams.code as string;
          console.log('Received invitation code from deep link:', code);
          setInvitationCode(code.toUpperCase());
        }

        // Also handle web links: https://nafisaszcloset.com/invite/XXX
        if (parsed.path?.startsWith('invite/')) {
          const code = parsed.path.replace('invite/', '');
          if (code) {
            console.log('Received invitation code from web link:', code);
            setInvitationCode(code.toUpperCase());
          }
        }
      } catch (error) {
        console.error('Error parsing deep link:', error);
      }
    };

    handleInitialUrl();

    const subscription = Linking.addEventListener('url', handleUrlEvent);
    return () => subscription.remove();
  }, [setInvitationCode]);

  return <>{children}</>;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // Wrapper component that conditionally applies StripeProvider
  const AppContent = (
    <OTAUpdateHandler>
      <AuthProvider>
        <PushNotificationHandler>
          <DeepLinkHandler>
          <QueryClientProvider client={queryClient}>
            <StatusBar style="light" />
              <Stack>
                  <Stack.Screen name="index" options={{ headerShown: false }} />
                  <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                  <Stack.Screen name="(tabs)" options={{ headerShown: false, headerBackTitle: 'Back' }} />
                  <Stack.Screen
                    name="listing/[id]"
                    options={{
                      headerShown: true,
                      title: '',
                      headerStyle: { backgroundColor: '#1A0A2E' },
                      headerTintColor: '#FFFFFF',
                      headerBackTitleVisible: false,
                      headerShadowVisible: false,
                    }}
                  />
                  <Stack.Screen
                    name="curator/[id]"
                    options={{
                      headerShown: true,
                      title: '',
                      headerStyle: { backgroundColor: '#1A0A2E' },
                      headerTintColor: '#FFFFFF',
                      headerBackTitleVisible: false,
                      headerShadowVisible: false,
                    }}
                  />
                  <Stack.Screen
                    name="my-posts"
                    options={{
                      headerShown: true,
                      title: 'My Posts',
                      headerStyle: { backgroundColor: '#1A0A2E' },
                      headerTintColor: '#FFFFFF',
                      headerBackTitleVisible: false,
                      headerShadowVisible: false,
                    }}
                  />
                  <Stack.Screen
                    name="payment/[transactionId]"
                    options={{
                      headerShown: true,
                      title: 'Complete Payment',
                      headerStyle: { backgroundColor: '#1A0A2E' },
                      headerTintColor: '#FFFFFF',
                      headerBackTitleVisible: false,
                      headerShadowVisible: false,
                    }}
                  />
                  <Stack.Screen
                    name="add-payment-method"
                    options={{
                      headerShown: false,
                      presentation: 'modal',
                    }}
                  />
                  <Stack.Screen
                    name="orders"
                    options={{
                      headerShown: true,
                      title: 'Orders',
                      headerStyle: { backgroundColor: '#1A0A2E' },
                      headerTintColor: '#FFFFFF',
                      headerBackTitleVisible: false,
                      headerShadowVisible: false,
                    }}
                  />
                  <Stack.Screen
                    name="order/[id]"
                    options={{
                      headerShown: true,
                      title: 'Order Details',
                      headerStyle: { backgroundColor: '#1A0A2E' },
                      headerTintColor: '#FFFFFF',
                      headerBackTitleVisible: false,
                      headerShadowVisible: false,
                    }}
                  />
                  <Stack.Screen
                    name="messages/index"
                    options={{
                      headerShown: false,
                    }}
                  />
                  <Stack.Screen
                    name="messages/[listingId]"
                    options={{
                      headerShown: false,
                    }}
                  />
                  <Stack.Screen
                    name="messages/dm/[userId]"
                    options={{
                      headerShown: false,
                    }}
                  />
                </Stack>
            </QueryClientProvider>
          </DeepLinkHandler>
        </PushNotificationHandler>
      </AuthProvider>
    </OTAUpdateHandler>
  );

  // Wrap with StripeProvider if available (development builds only)
  if (StripeProvider && STRIPE_PUBLISHABLE_KEY) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StripeProvider
          publishableKey={STRIPE_PUBLISHABLE_KEY}
          merchantIdentifier="merchant.com.nafisascloset.app"
        >
          {AppContent}
        </StripeProvider>
      </GestureHandlerRootView>
    );
  }

  // Fallback without Stripe (Expo Go)
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {AppContent}
    </GestureHandlerRootView>
  );
}
