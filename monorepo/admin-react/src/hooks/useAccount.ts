/**
 * Account self-service logic: profile photo, password change and reset flow.
 */

import { authService } from '@/services/authService';
import { useAction } from './useApi';
import { useAuth } from './useAuth';

/** Save the signed-in user's own name / email / mobile / username, then refresh the cached user. */
export function useUpdateProfile() {
  const { reloadUser } = useAuth();
  return useAction((body: { name: string; email: string | null; mobile: string; username: string | null }) => authService.updateMe(body), {
    success: 'Profile saved',
    silentError: true,
    onSuccess: () => void reloadUser(),
  });
}

/** Upload / remove the signed-in user's profile photo, then refresh the cached user. */
export function useAvatar() {
  const { reloadUser } = useAuth();
  return {
    upload: useAction((file: File) => authService.uploadAvatar(file), { success: 'Profile photo updated', onSuccess: () => void reloadUser() }),
    remove: useAction(() => authService.removeAvatar(), { success: 'Profile photo removed', onSuccess: () => void reloadUser() }),
  };
}

export const useChangePassword = () =>
  useAction((v: { current: string; next: string }) => authService.changePassword(v.current, v.next), { success: 'Password updated' });

export const useRequestPasswordReset = (onSent: (message: string) => void) =>
  useAction((identifier: string) => authService.forgotPassword(identifier), { onSuccess: (r) => onSent(r.message) });

export const useResetPassword = (onDone: (message: string) => void) =>
  useAction((v: { identifier: string; code: string; password: string }) => authService.resetPassword(v.identifier, v.code, v.password), { onSuccess: (r) => onDone(r.message) });
