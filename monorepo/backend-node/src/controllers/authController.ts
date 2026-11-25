/**
 * Auth controller — HTTP only; delegates to AuthService.
 */

import { Request, Response } from 'express';
import { services } from '../dependencies/dependencies';
import { actorOf, asyncHandler, metaOf, sendCreated, sendNoContent, sendOk } from '../utils/http';
import { AuthClients, ErrorMessages, type AuthClient } from '../constants';
import { ValidationError } from '../utils/errors';
import type { UploadedFileInfo } from '../models';

type Audience = Array<'ADMIN' | 'STAFF' | 'CUSTOMER'>;

const loginFor = (audience: Audience, client: AuthClient) =>
  asyncHandler(async (req: Request, res: Response) => {
    sendOk(res, await services().auth.login(req.body.identifier, req.body.password, audience, metaOf(req), client));
  });

/** Admin web panel: admins only. */
export const adminLogin = loginFor(['ADMIN'], AuthClients.ADMIN_PANEL);
/** Mobile app: customers and technicians (role-based navigation in the app). */
export const appLogin = loginFor(['CUSTOMER', 'STAFF', 'ADMIN'], AuthClients.APP);

export const verifyOtp = asyncHandler(async (req, res) => {
  sendOk(res, await services().auth.verifyLoginOtp(req.body.userId, req.body.code, metaOf(req), req.body.client ?? AuthClients.APP));
});

export const refresh = asyncHandler(async (req, res) => {
  sendOk(res, await services().auth.refresh(req.body.refreshToken, metaOf(req)));
});

export const logout = asyncHandler(async (req, res) => {
  await services().auth.logout(req.body.refreshToken, req.user, metaOf(req));
  sendNoContent(res);
});

export const logoutAll = asyncHandler(async (req, res) => {
  await services().auth.logoutAll(actorOf(req));
  sendNoContent(res);
});

export const me = asyncHandler(async (req, res) => {
  sendOk(res, await services().auth.me(actorOf(req)));
});

export const updateMe = asyncHandler(async (req, res) => {
  sendOk(res, await services().auth.updateMe(actorOf(req), req.body));
});

export const uploadAvatar = asyncHandler(async (req, res) => {
  const [file] = (res.locals.files as UploadedFileInfo[] | undefined) ?? [];
  if (!file) throw new ValidationError(ErrorMessages.FILE_REQUIRED);
  sendOk(res, await services().auth.setAvatar(actorOf(req), file.path));
});

export const removeAvatar = asyncHandler(async (req, res) => {
  sendOk(res, await services().auth.setAvatar(actorOf(req), null));
});

export const sessions = asyncHandler(async (req, res) => {
  sendOk(res, await services().auth.sessions(actorOf(req)));
});

export const changePassword = asyncHandler(async (req, res) => {
  await services().auth.changePassword(actorOf(req), req.body.currentPassword, req.body.newPassword);
  sendNoContent(res);
});

export const forgotPassword = asyncHandler(async (req, res) => {
  await services().auth.forgotPassword(req.body.identifier);
  // Identical response regardless of account existence.
  sendOk(res, { message: 'If the account exists, a verification code has been sent.' });
});

export const resetPassword = asyncHandler(async (req, res) => {
  await services().auth.resetPassword(req.body.identifier, req.body.code, req.body.newPassword);
  sendOk(res, { message: 'Password updated. Please sign in.' });
});

export const register = asyncHandler(async (req, res) => {
  sendCreated(res, await services().auth.registerCustomer(req.body, metaOf(req)));
});

export const registerDevice = asyncHandler(async (req, res) => {
  sendOk(res, await services().auth.registerDevice(actorOf(req), req.body.token, req.body.platform));
});

export const unregisterDevice = asyncHandler(async (req, res) => {
  await services().auth.unregisterDevice(req.body.token);
  sendNoContent(res);
});
