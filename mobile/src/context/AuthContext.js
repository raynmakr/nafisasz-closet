import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [pendingInvitationCode, setPendingInvitationCode] = useState(null);

  // Google Auth - use useIdTokenAuthRequest like pawtella-app2
  // Try with just web client ID to see if iOS client is the issue
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_CLIENT_ID,
  });

  // Debug: Log the redirect URI being used
  useEffect(() => {
    if (request) {
      console.log('Google Redirect URI:', request.redirectUri);
    }
  }, [request]);

  // Handle Google response
  useEffect(() => {
    console.log('Google auth response:', response?.type);
    if (response?.type === 'success') {
      const { id_token } = response.params;
      console.log('Google auth success, calling handleSignIn');
      handleSignIn('google', id_token);
    } else if (response?.type === 'error') {
      console.error('Google auth error:', response.error);
    } else if (response?.type === 'dismiss') {
      console.log('Google auth dismissed by user');
    }
  }, [response]);

  // Restore session and pending invitation code on app launch
  useEffect(() => {
    restoreSession();
    loadPendingInvitationCode();
  }, []);

  const loadPendingInvitationCode = async () => {
    try {
      const storedCode = await AsyncStorage.getItem('pendingInvitationCode');
      if (storedCode) {
        setPendingInvitationCode(storedCode);
      }
    } catch (error) {
      console.error('Error loading pending invitation code:', error);
    }
  };

  const setInvitationCode = async (code) => {
    try {
      if (code) {
        await AsyncStorage.setItem('pendingInvitationCode', code);
        setPendingInvitationCode(code);
      } else {
        await AsyncStorage.removeItem('pendingInvitationCode');
        setPendingInvitationCode(null);
      }
    } catch (error) {
      console.error('Error setting invitation code:', error);
    }
  };

  const restoreSession = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('authToken');
      const storedUser = await AsyncStorage.getItem('authUser');

      if (storedToken && storedUser) {
        // Verify token is still valid
        const res = await fetch(`${API_URL}/api/auth`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${storedToken}`
          },
          body: JSON.stringify({ action: 'verify' })
        });

        if (res.ok) {
          const data = await res.json();
          setToken(storedToken);
          setUser(data.user);
        } else {
          // Token invalid, clear storage
          await AsyncStorage.multiRemove(['authToken', 'authUser']);
        }
      }
    } catch (error) {
      console.error('Error restoring session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('authToken');
      if (!storedToken) return;

      const res = await fetch(`${API_URL}/api/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${storedToken}`
        },
        body: JSON.stringify({ action: 'verify' })
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        await AsyncStorage.setItem('authUser', JSON.stringify(data.user));
      }
    } catch (error) {
      console.error('Error refreshing user:', error);
    }
  };

  const handleSignIn = async (provider, idToken, appleUser = null, invitationCode = null) => {
    try {
      setIsSigningIn(true);

      // Use the passed invitationCode or fall back to pending code
      const codeToUse = invitationCode || pendingInvitationCode;

      const res = await fetch(`${API_URL}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'signin',
          provider,
          idToken,
          user: appleUser,
          invitationCode: codeToUse
        })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Sign in failed');
      }

      const data = await res.json();

      // Save to storage
      await AsyncStorage.setItem('authToken', data.token);
      await AsyncStorage.setItem('authUser', JSON.stringify(data.user));

      // Clear pending invitation code after successful signin
      setPendingInvitationCode(null);
      await AsyncStorage.removeItem('pendingInvitationCode');

      setToken(data.token);
      setUser(data.user);

      return data.user;
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    } finally {
      setIsSigningIn(false);
    }
  };

  const signInWithGoogle = useCallback(async () => {
    if (!request) {
      throw new Error('Google auth not configured');
    }
    await promptAsync();
  }, [request, promptAsync]);

  const signInWithApple = useCallback(async (invitationCode = null) => {
    try {
      setIsSigningIn(true);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      return handleSignIn('apple', credential.identityToken, {
        email: credential.email,
        fullName: credential.fullName
      }, invitationCode);
    } catch (error) {
      if (error.code === 'ERR_REQUEST_CANCELED') {
        return null;
      }
      throw error;
    } finally {
      setIsSigningIn(false);
    }
  }, [pendingInvitationCode]);

  const signOut = useCallback(async () => {
    try {
      await AsyncStorage.multiRemove(['authToken', 'authUser']);
      setToken(null);
      setUser(null);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }, []);

  // Helper for authenticated API calls
  const authFetch = useCallback(async (url, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_URL}${url}`, {
      ...options,
      headers
    });

    // Auto sign out on 401
    if (res.status === 401) {
      await signOut();
      throw new Error('Session expired');
    }

    return res;
  }, [token, signOut]);

  const value = {
    user,
    token,
    isLoading,
    isSigningIn,
    isAuthenticated: !!token,
    pendingInvitationCode,
    setInvitationCode,
    signInWithGoogle,
    signInWithApple,
    signOut,
    authFetch,
    refreshUser,
    canUseAppleAuth: Platform.OS === 'ios'
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
