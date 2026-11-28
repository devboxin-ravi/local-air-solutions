/**
 * Authentication state (external store) + session bootstrap, login, OTP, logout and permission checks.
 */

import { useCallback, useSyncExternalStore } from 'react';
import { authService } from '@/services/authService';
import { ApiError, refreshAccessToken, tokenStore } from '@/services/apiClient';
import { HTTP, QUERY } from '@/constants/api';
import type { AuthUser, LoginResult } from '@/types';

type Status = 'loading' | 'authenticated' | 'anonymous';
interface AuthState {
  status: Status;
  user: AuthUser | null;
}

let state: AuthState = { status: 'loading', user: null };
const listeners = new Set<() => void>();
const setState = (next: AuthState) => {
  state = next;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

tokenStore.onExpired(() => setState({ status: 'anonymous', user: null }));

let bootstrapped = false;
/** Restores a session from the stored refresh token (runs once). */
export const bootstrapSession = async (): Promise<void> => {
  if (bootstrapped) return;
  bootstrapped = true;
  if (!tokenStore.getRefreshToken()) {
    setState({ status: 'anonymous', user: null });
    return;
  }
  // Retries while the server is unreachable (e.g. restarting) instead of signing the user out.
  for (let attempt = 1; ; attempt += 1) {
    try {
      const token = await refreshAccessToken();
      if (!token) break;
      setState({ status: 'authenticated', user: await authService.me() });
      return;
    } catch (e) {
      const signedOut = e instanceof ApiError && e.status === HTTP.UNAUTHORIZED;
      if (signedOut || attempt >= QUERY.SESSION_RETRY_ATTEMPTS) break;
      await new Promise((resolve) => setTimeout(resolve, QUERY.SESSION_RETRY_MS));
    }
  }
  setState({ status: 'anonymous', user: null });
};

const complete = (r: LoginResult): LoginResult => {
  if (!r.otpRequired) {
    tokenStore.setTokens(r.tokens);
    setState({ status: 'authenticated', user: r.user });
  }
  return r;
};

export function useAuth() {
  const snapshot = useSyncExternalStore(subscribe, () => state);

  const login = useCallback(async (identifier: string, password: string) => complete(await authService.login(identifier, password)), []);
  const verifyOtp = useCallback(async (userId: number, code: string) => complete(await authService.verifyOtp(userId, code)), []);
  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      setState({ status: 'anonymous', user: null });
    }
  }, []);
  const reloadUser = useCallback(async () => {
    const user = await authService.me();
    setState({ status: 'authenticated', user });
  }, []);

  const can = useCallback(
    (permission?: string) => {
      const u = snapshot.user;
      if (!permission) return true;
      if (!u) return false;
      return u.isSuperAdmin || u.permissions.includes(permission);
    },
    [snapshot.user],
  );

  return { ...snapshot, login, verifyOtp, logout, reloadUser, can };
}
