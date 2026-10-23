import { apiClient } from './api';
import type { LoginCredentials, LoginResponse, RefreshTokenResponse } from '../types/auth';

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>('/auth/login', credentials);
    return response;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout', {});
  },

  refreshToken: async (): Promise<RefreshTokenResponse> => {
    const response = await apiClient.post<RefreshTokenResponse>('/auth/refresh', {});
    return response;
  },

  getCurrentUser: async () => {
    const response = await apiClient.get('/auth/me');
    return response;
  },

  forgotPassword: async (username: string) => {
    await apiClient.post('/auth/forgot-password', { username });
  },

  resetPassword: async (token: string, password: string) => {
    await apiClient.post('/auth/reset-password', { token, password });
  },
};