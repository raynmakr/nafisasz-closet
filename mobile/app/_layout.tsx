import 'react-native-reanimated';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { usePushNotifications } from '../hooks';

// Check if we're running in Expo Go (no native modules available)
const isExpoGo = Constants.appOwnership === 'expo';

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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
    </GestureHandlerRootView>
  );
}
