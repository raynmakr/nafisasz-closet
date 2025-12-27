import 'react-native-reanimated';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { AuthProvider, useAuth } from '../src/context/AuthContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 2,
    },
  },
});

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
            </Stack>
          </QueryClientProvider>
        </DeepLinkHandler>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
