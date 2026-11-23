/**
 * Centralized error handling → consistent `{ success: false, error }` envelope.
 */

import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { StatusCodes } from '../constants/api';
import { ErrorCodes, ErrorMessages } from '../constants/errors';
import { config } from '../config';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

export const notFoundHandler = (_req: Request, res: Response): void => {
  res.status(StatusCodes.NOT_FOUND).json({ success: false, error: { code: ErrorCodes.NOT_FOUND, message: ErrorMessages.ROUTE_NOT_FOUND } });
};

export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
  if (err instanceof ZodError) {
    const details: Record<string, string> = {};
    for (const issue of err.issues) details[issue.path.join('.') || '_'] = issue.message;
    res.status(StatusCodes.UNPROCESSABLE).json({ success: false, error: { code: ErrorCodes.VALIDATION_ERROR, message: ErrorMessages.VALIDATION_FAILED, details } });
    return;
  }
  if (err instanceof AppError) {
    if (err.statusCode >= StatusCodes.INTERNAL_SERVER_ERROR) logger.error(err.message, { path: req.path, code: err.code });
    res.status(err.statusCode).json({ success: false, error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) } });
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(StatusCodes.CONFLICT).json({ success: false, error: { code: ErrorCodes.CONFLICT, message: ErrorMessages.ALREADY_EXISTS('Record') } });
      return;
    }
    if (err.code === 'P2025') {
      res.status(StatusCodes.NOT_FOUND).json({ success: false, error: { code: ErrorCodes.NOT_FOUND, message: ErrorMessages.NOT_FOUND('Record') } });
      return;
    }
    if (err.code === 'P2003') {
      res.status(StatusCodes.CONFLICT).json({ success: false, error: { code: ErrorCodes.CONFLICT, message: ErrorMessages.CANNOT_DELETE_IN_USE('Record') } });
      return;
    }
  }
  if ((err as { type?: string })?.type === 'entity.parse.failed') {
    res.status(StatusCodes.BAD_REQUEST).json({ success: false, error: { code: ErrorCodes.VALIDATION_ERROR, message: 'Malformed JSON body' } });
    return;
  }
  logger.error('Unhandled error', { path: req.path, method: req.method, error: (err as Error)?.message, stack: config.debug ? (err as Error)?.stack : undefined });
  res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    success: false,
    error: { code: ErrorCodes.INTERNAL_ERROR, message: ErrorMessages.INTERNAL_ERROR, ...(config.debug ? { details: (err as Error)?.message } : {}) },
  });
};
