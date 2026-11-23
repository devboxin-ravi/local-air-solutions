/**
 * Account self-service logic: password change and reset flow.
 */

import { authService } from '@/services/authService';
import { useAction } from './useApi';

export const useChangePassword = () =>
  useAction((v: { current: string; next: string }) => authService.changePassword(v.current, v.next), { success: 'Password updated' });

export const useRequestPasswordReset = (onSent: (message: string) => void) =>
  useAction((identifier: string) => authService.forgotPassword(identifier), { onSuccess: (r) => onSent(r.message) });

export const useResetPassword = (onDone: (message: string) => void) =>
  useAction((v: { identifier: string; code: string; password: string }) => authService.resetPassword(v.identifier, v.code, v.password), { onSuccess: (r) => onDone(r.message) });
