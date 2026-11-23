/**
 * HTTP helpers for controllers: async wrapper and consistent response envelopes.
 *
 * Success: { success: true, data, meta? }
 * Error:   { success: false, error: { code, message, details? } }
 */

import { NextFunction, Request, RequestHandler, Response } from 'express';
import { StatusCodes } from '../constants/api';
import { UnauthorizedError } from './errors';
import type { AuthUser, Paginated, RequestMeta } from '../models';

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export const sendOk = <T>(res: Response, data: T, status: number = StatusCodes.OK): void => {
  res.status(status).json({ success: true, data });
};

export const sendCreated = <T>(res: Response, data: T): void => sendOk(res, data, StatusCodes.CREATED);

export const sendPage = <T>(res: Response, page: Paginated<T>): void => {
  res.status(StatusCodes.OK).json({ success: true, data: page.items, meta: page.meta });
};

export const sendNoContent = (res: Response): void => {
  res.status(StatusCodes.NO_CONTENT).send();
};

/** Returns the authenticated user or throws 401. */
export const actorOf = (req: Request): AuthUser => {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
};

export const metaOf = (req: Request): RequestMeta => ({
  ip: req.ip,
  userAgent: req.get('user-agent') ?? undefined,
});

export const idParam = (req: Request, name = 'id'): number => Number(req.params[name]);
