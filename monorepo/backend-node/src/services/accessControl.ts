/**
 * Authorization helpers used by services: permission checks and branch scoping.
 * Backend-enforced — UI hiding is never relied upon.
 */

import { ErrorMessages } from '../constants';
import type { AuthUser } from '../models';
import { ForbiddenError } from '../utils/errors';

export const hasPermission = (actor: AuthUser, code: string): boolean =>
  actor.isSuperAdmin || actor.permissions.includes(code);

export const assertPermission = (actor: AuthUser, code: string): void => {
  if (!hasPermission(actor, code)) throw new ForbiddenError();
};

/**
 * Resolves which branch a query is limited to.
 * - Company-wide roles: the requested branch (or all when undefined).
 * - Branch-scoped roles: always their own branch; requesting another branch is forbidden.
 */
export const resolveBranchScope = (actor: AuthUser, requested?: number | null): number | undefined => {
  if (actor.isCompanyWide) return requested ?? undefined;
  if (!actor.branchId) throw new ForbiddenError(ErrorMessages.BRANCH_FORBIDDEN);
  if (requested && requested !== actor.branchId) throw new ForbiddenError(ErrorMessages.BRANCH_FORBIDDEN);
  return actor.branchId;
};

/** Throws if the actor cannot act on a record belonging to `branchId`. */
export const assertBranchAccess = (actor: AuthUser, branchId: number | null | undefined): void => {
  if (actor.isCompanyWide) return;
  if (!branchId || branchId !== actor.branchId) throw new ForbiddenError(ErrorMessages.BRANCH_FORBIDDEN);
};
