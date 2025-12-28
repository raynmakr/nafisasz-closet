import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants';

const TOKEN_KEY = 'authToken';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: `${API_URL}/api`,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor - add auth token
    this.client.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        const token = await this.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle errors
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError<{ error?: string | object; message?: string }>) => {
        if (error.response?.status === 401) {
          // Token expired or invalid - clear it
          await this.clearToken();
        }
        // Extract error message from response body
        let message = error.response?.data?.error || error.response?.data?.message || error.message;

        // Handle case where error is an object
        if (typeof message === 'object') {
          message = JSON.stringify(message);
        }

        const enhancedError = new Error(message || 'An error occurred');
        return Promise.reject(enhancedError);
      }
    );
  }

  async getToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }

  async clearToken(): Promise<void> {
    await AsyncStorage.removeItem(TOKEN_KEY);
  }

  // HTTP methods
  async get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    const response = await this.client.get<T>(url, { params });
    return response.data;
  }

  async post<T>(url: string, data?: unknown, options?: { timeout?: number }): Promise<T> {
    const response = await this.client.post<T>(url, data, {
      timeout: options?.timeout,
    });
    return response.data;
  }

  async put<T>(url: string, data?: unknown): Promise<T> {
    const response = await this.client.put<T>(url, data);
    return response.data;
  }

  async delete<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    const response = await this.client.delete<T>(url, { params });
    return response.data;
  }
}

export const api = new ApiClient();
