/**
 * Auth controller — HTTP only; delegates to AuthService.
 */

import { Request, Response } from 'express';
import { services } from '../dependencies/dependencies';
import { actorOf, asyncHandler, metaOf, sendCreated, sendNoContent, sendOk } from '../utils/http';

type Audience = Array<'ADMIN' | 'STAFF' | 'CUSTOMER'>;

const loginFor = (audience: Audience) =>
  asyncHandler(async (req: Request, res: Response) => {
    sendOk(res, await services().auth.login(req.body.identifier, req.body.password, audience, metaOf(req)));
  });

/** Admin web panel: admins only. */
export const adminLogin = loginFor(['ADMIN']);
/** Mobile app: customers and technicians (role-based navigation in the app). */
export const appLogin = loginFor(['CUSTOMER', 'STAFF', 'ADMIN']);

export const verifyOtp = asyncHandler(async (req, res) => {
  sendOk(res, await services().auth.verifyLoginOtp(req.body.userId, req.body.code, metaOf(req)));
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
