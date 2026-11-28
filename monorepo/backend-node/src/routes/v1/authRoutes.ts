/**
 * /api/v1/auth — route definitions only.
 */

import { Router } from 'express';
import * as c from '../../controllers/authController';
import { authenticate, optionalAuthenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { authLimiter, loginLimiter } from '../../middleware/security';
import { uploadFiles } from '../../middleware/upload';
import { UploadRules } from '../../constants';
import {
  changePasswordSchema,
  deviceTokenSchema,
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  otpVerifySchema,
  refreshSchema,
  registerCustomerSchema,
  resetPasswordSchema,
  updateMeSchema,
} from '../../validations/auth';

const r = Router();

r.post('/admin/login', loginLimiter, validate({ body: loginSchema }), c.adminLogin);
r.post('/login', loginLimiter, validate({ body: loginSchema }), c.appLogin);
r.post('/otp/verify', loginLimiter, validate({ body: otpVerifySchema }), c.verifyOtp);
r.post('/register', authLimiter, validate({ body: registerCustomerSchema }), c.register);
// Session refresh runs on every page load and needs a valid token, so only the general API limit applies.
r.post('/refresh', validate({ body: refreshSchema }), c.refresh);
r.post('/forgot-password', authLimiter, validate({ body: forgotPasswordSchema }), c.forgotPassword);
r.post('/reset-password', authLimiter, validate({ body: resetPasswordSchema }), c.resetPassword);

r.post('/logout', validate({ body: logoutSchema }), optionalAuthenticate, c.logout);
r.post('/logout-all', authenticate, c.logoutAll);
r.get('/me', authenticate, c.me);
r.patch('/me', authenticate, validate({ body: updateMeSchema }), c.updateMe);
r.post('/me/avatar', authenticate, uploadFiles(UploadRules.AVATAR_FOLDER, UploadRules.AVATAR_FIELD, UploadRules.IMAGE_MIME_TYPES, 1), c.uploadAvatar);
r.delete('/me/avatar', authenticate, c.removeAvatar);
r.get('/sessions', authenticate, c.sessions);
r.post('/change-password', authenticate, validate({ body: changePasswordSchema }), c.changePassword);
r.post('/devices', authenticate, validate({ body: deviceTokenSchema }), c.registerDevice);
r.delete('/devices', authenticate, validate({ body: deviceTokenSchema.pick({ token: true }) }), c.unregisterDevice);

export { r as authRoutes };

