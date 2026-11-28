/**
 * Rate limiting and request logging.
 */

import rateLimit from 'express-rate-limit';
import { NextFunction, Request, Response } from 'express';
import { config } from '../config';
import { ErrorCodes, ErrorMessages, StatusCodes } from '../constants';
import { logger } from '../utils/logger';

const limitedResponse = { success: false, error: { code: ErrorCodes.RATE_LIMITED, message: ErrorMessages.RATE_LIMITED } };

export const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMinutes * 60_000,
  limit: config.rateLimit.max,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  statusCode: StatusCodes.TOO_MANY_REQUESTS,
  message: limitedResponse,
});

/** Password / OTP sign-in: only failed attempts count, so normal sign-ins never lock a user out. */
export const loginLimiter = rateLimit({
  windowMs: config.rateLimit.windowMinutes * 60_000,
  limit: config.rateLimit.authMax,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  statusCode: StatusCodes.TOO_MANY_REQUESTS,
  message: limitedResponse,
});

/** Stricter limiter for registration and password reset: every request counts. */
export const authLimiter = rateLimit({
  windowMs: config.rateLimit.windowMinutes * 60_000,
  limit: config.rateLimit.authMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  statusCode: StatusCodes.TOO_MANY_REQUESTS,
  message: limitedResponse,
});

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    logger.info('http', { method: req.method, path: req.originalUrl.split('?')[0], status: res.statusCode, ms: Math.round(ms), user: req.user?.id });
  });
  next();
};
