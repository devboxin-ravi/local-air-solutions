/**
 * Authentication API calls.
 */

import { API, AUTH_CLIENT } from '@/constants/api';
import type { AuthUser, LoginResult } from '@/types';
import { http, tokenStore } from './apiClient';

export const authService = {
  login: (identifier: string, password: string) => http.post<LoginResult>(API.AUTH.LOGIN, { identifier, password }),
  /** `client` tells the server this is an admin-panel sign-in (fixed 7-day session). */
  verifyOtp: (userId: number, code: string) => http.post<LoginResult>(API.AUTH.OTP_VERIFY, { userId, code, client: AUTH_CLIENT }),
  me: () => http.get<AuthUser>(API.AUTH.ME),
  forgotPassword: (identifier: string) => http.post<{ message: string }>(API.AUTH.FORGOT, { identifier }),
  resetPassword: (identifier: string, code: string, newPassword: string) => http.post<{ message: string }>(API.AUTH.RESET, { identifier, code, newPassword }),
  changePassword: (currentPassword: string, newPassword: string) => http.post<void>(API.AUTH.CHANGE_PASSWORD, { currentPassword, newPassword }),
  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return http.upload<unknown>(API.AUTH.AVATAR, form);
  },
  removeAvatar: () => http.del(API.AUTH.AVATAR),
  updateMe: (body: { name: string; email: string | null; mobile: string; username: string | null }) => http.patch<AuthUser>(API.AUTH.ME, body),
  logout: async () => {
    const refreshToken = tokenStore.getRefreshToken() ?? undefined;
    try {
      await http.post(API.AUTH.LOGOUT, { refreshToken });
    } finally {
      tokenStore.clear();
    }
  },
};
