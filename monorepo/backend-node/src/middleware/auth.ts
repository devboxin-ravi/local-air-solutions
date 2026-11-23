/**
 * Authentication & authorization middleware (backend-enforced RBAC).
 */

import { NextFunction, Request, Response } from 'express';
import type { UserType } from '@prisma/client';
import { services } from '../dependencies/dependencies';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

const BEARER = 'Bearer ';

/** Requires a valid access token; attaches `req.user`. */
export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  const header = req.get('authorization');
  if (!header?.startsWith(BEARER)) return next(new UnauthorizedError());
  services()
    .auth.authenticate(header.slice(BEARER.length))
    .then((user) => {
      req.user = user;
      next();
    })
    .catch(next);
};

/** Attaches req.user when a valid token is present; otherwise continues anonymously. */
export const optionalAuthenticate = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.get('authorization')) return next();
  authenticate(req, res, () => next());
};

/** Requires ALL listed permissions (Super Admin bypasses). */
export const requirePermission =
  (...codes: string[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const u = req.user;
    if (!u) return next(new UnauthorizedError());
    if (u.isSuperAdmin || codes.every((c) => u.permissions.includes(c))) return next();
    next(new ForbiddenError());
  };

/** Requires ANY of the listed permissions. */
export const requireAnyPermission =
  (...codes: string[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const u = req.user;
    if (!u) return next(new UnauthorizedError());
    if (u.isSuperAdmin || codes.some((c) => u.permissions.includes(c))) return next();
    next(new ForbiddenError());
  };

/** Restricts an endpoint to specific user types (e.g. CUSTOMER app, STAFF technician app). */
export const requireUserType =
  (...types: UserType[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const u = req.user;
    if (!u) return next(new UnauthorizedError());
    if (types.includes(u.userType)) return next();
    next(new ForbiddenError());
  };

/** Technicians are STAFF users or admins who also hold a technician profile. */
export const requireTechnician = (req: Request, _res: Response, next: NextFunction): void => {
  const u = req.user;
  if (!u) return next(new UnauthorizedError());
  if (u.staffId && (u.userType === 'STAFF' || u.roles.includes('TECHNICIAN'))) return next();
  next(new ForbiddenError());
};
