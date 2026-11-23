/**
 * Authentication API calls.
 */

import { API } from '@/constants/api';
import type { AuthUser, LoginResult } from '@/types';
import { http, tokenStore } from './apiClient';

export const authService = {
  login: (identifier: string, password: string) => http.post<LoginResult>(API.AUTH.LOGIN, { identifier, password }),
  verifyOtp: (userId: number, code: string) => http.post<LoginResult>(API.AUTH.OTP_VERIFY, { userId, code }),
  me: () => http.get<AuthUser>(API.AUTH.ME),
  forgotPassword: (identifier: string) => http.post<{ message: string }>(API.AUTH.FORGOT, { identifier }),
  resetPassword: (identifier: string, code: string, newPassword: string) => http.post<{ message: string }>(API.AUTH.RESET, { identifier, code, newPassword }),
  changePassword: (currentPassword: string, newPassword: string) => http.post<void>(API.AUTH.CHANGE_PASSWORD, { currentPassword, newPassword }),
  logout: async () => {
    const refreshToken = tokenStore.getRefreshToken() ?? undefined;
    try {
      await http.post(API.AUTH.LOGOUT, { refreshToken });
    } finally {
      tokenStore.clear();
    }
  },
};
