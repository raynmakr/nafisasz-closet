import { api } from './api';
import {
  ApiResponse,
  AuthResponse,
  User,
  LoginInput,
  RegisterInput,
} from '@/types';

export const authService = {
  async login(input: LoginInput): Promise<AuthResponse> {
    const response = await api.post<ApiResponse<AuthResponse>>('/auth/login', input);
    if (response.data) {
      await api.setTokens(response.data.tokens);
    }
    return response.data!;
  },

  async register(input: RegisterInput): Promise<AuthResponse> {
    const response = await api.post<ApiResponse<AuthResponse>>('/auth/register', input);
    if (response.data) {
      await api.setTokens(response.data.tokens);
    }
    return response.data!;
  },

  async logout(): Promise<void> {
    try {
      const tokens = await api.getTokens();
      if (tokens?.refreshToken) {
        await api.post('/auth/logout', { refreshToken: tokens.refreshToken });
      }
    } finally {
      await api.clearTokens();
    }
  },

  async getCurrentUser(): Promise<User> {
    const response = await api.get<ApiResponse<User>>('/auth/me');
    return response.data!;
  },

  async isAuthenticated(): Promise<boolean> {
    const tokens = await api.getTokens();
    return !!tokens?.accessToken;
  },
};
